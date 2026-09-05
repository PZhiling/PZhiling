import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { RequestContext } from "../core/context.ts";
import { AgentError } from "../core/errors.ts";

/**
 * Content-addressed storage for agent state.
 *
 * Two deliberate departures from the design this is modelled on:
 *
 *  1. `get` re-hashes the bytes it loaded and rejects a mismatch. A store that
 *     trusts its own keys turns silent corruption into a confusing model
 *     failure three layers away.
 *  2. Durability is a value on the write, not a second method. `local` blobs
 *     are evictable scratch; `durable` blobs survive eviction and are the only
 *     ones a resumable session may reference.
 */

export type Durability = "local" | "durable";

export type BlobId = string; // lowercase hex sha-256

export interface BlobStore {
  put(ctx: RequestContext, data: Uint8Array, durability?: Durability): Promise<BlobId>;
  get(ctx: RequestContext, id: BlobId): Promise<Uint8Array>;
  has(ctx: RequestContext, id: BlobId): Promise<boolean>;
  durabilityOf(ctx: RequestContext, id: BlobId): Promise<Durability | undefined>;
  flush(ctx: RequestContext): Promise<void>;
}

export function blobIdOf(data: Uint8Array): BlobId {
  return createHash("sha256").update(data).digest("hex");
}

const BLOB_ID_PATTERN = /^[0-9a-f]{64}$/;

export function assertBlobId(id: string): asserts id is BlobId {
  if (!BLOB_ID_PATTERN.test(id)) {
    throw new AgentError("invalid_input", "malformed blob id", { details: { id: id.slice(0, 16) } });
  }
}

interface MemoryEntry {
  readonly data: Uint8Array;
  readonly durability: Durability;
  lastUsedAt: number;
}

export interface MemoryBlobStoreOptions {
  /** Byte budget for evictable (`local`) blobs. Durable blobs are exempt. */
  readonly maxLocalBytes?: number;
}

/**
 * In-memory store with an LRU budget over local blobs only.
 */
export class MemoryBlobStore implements BlobStore {
  private readonly entries = new Map<BlobId, MemoryEntry>();
  private localBytes = 0;
  private readonly maxLocalBytes: number;

  constructor(options: MemoryBlobStoreOptions = {}) {
    this.maxLocalBytes = options.maxLocalBytes ?? 64 * 1024 * 1024;
  }

  async put(ctx: RequestContext, data: Uint8Array, durability: Durability = "local"): Promise<BlobId> {
    ctx.throwIfDone();
    const id = blobIdOf(data);
    const existing = this.entries.get(id);
    if (existing !== undefined) {
      // Re-writing an existing blob as durable promotes it; never demote.
      if (durability === "durable" && existing.durability === "local") {
        this.localBytes -= existing.data.byteLength;
        this.entries.set(id, { data: existing.data, durability: "durable", lastUsedAt: ctx.clock.now() });
      } else {
        existing.lastUsedAt = ctx.clock.now();
      }
      return id;
    }
    const copy = new Uint8Array(data);
    this.entries.set(id, { data: copy, durability, lastUsedAt: ctx.clock.now() });
    if (durability === "local") {
      this.localBytes += copy.byteLength;
      this.evictIfNeeded(ctx);
    }
    ctx.observe("kv.blob.put.bytes", copy.byteLength, { durability });
    return id;
  }

  async get(ctx: RequestContext, id: BlobId): Promise<Uint8Array> {
    assertBlobId(id);
    const entry = this.entries.get(id);
    if (entry === undefined) {
      throw new AgentError("not_found", "blob not found", { details: { id: id.slice(0, 12) } });
    }
    entry.lastUsedAt = ctx.clock.now();
    verifyIntegrity(id, entry.data);
    return entry.data;
  }

  async has(_ctx: RequestContext, id: BlobId): Promise<boolean> {
    return this.entries.has(id);
  }

  async durabilityOf(_ctx: RequestContext, id: BlobId): Promise<Durability | undefined> {
    return this.entries.get(id)?.durability;
  }

  async flush(): Promise<void> {}

  private evictIfNeeded(ctx: RequestContext): void {
    if (this.localBytes <= this.maxLocalBytes) return;
    const evictable = [...this.entries.entries()]
      .filter(([, entry]) => entry.durability === "local")
      .sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt);
    for (const [id, entry] of evictable) {
      if (this.localBytes <= this.maxLocalBytes) break;
      this.entries.delete(id);
      this.localBytes -= entry.data.byteLength;
      ctx.count("kv.blob.evicted", 1, {});
    }
  }
}

/**
 * Filesystem store. Writes go to a temp file and are renamed into place, so a
 * crash mid-write can never leave a truncated blob under a valid hash name.
 */
export class FileBlobStore implements BlobStore {
  private readonly durable = new Set<BlobId>();

  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  private pathFor(id: BlobId): string {
    return join(this.root, id.slice(0, 2), id.slice(2, 4), id);
  }

  async put(ctx: RequestContext, data: Uint8Array, durability: Durability = "local"): Promise<BlobId> {
    ctx.throwIfDone();
    const id = blobIdOf(data);
    if (durability === "durable") this.durable.add(id);
    const target = this.pathFor(id);
    await mkdir(dirname(target), { recursive: true });
    const temp = `${target}.${randomUUID().slice(0, 8)}.tmp`;
    try {
      await writeFile(temp, data, { flag: "wx" });
      await rename(temp, target);
    } catch (error) {
      await unlink(temp).catch(() => {});
      throw error;
    }
    ctx.observe("kv.blob.put.bytes", data.byteLength, { durability });
    return id;
  }

  async get(ctx: RequestContext, id: BlobId): Promise<Uint8Array> {
    assertBlobId(id);
    ctx.throwIfDone();
    let data: Buffer;
    try {
      data = await readFile(this.pathFor(id));
    } catch (error) {
      throw new AgentError("not_found", "blob not found", {
        cause: error,
        details: { id: id.slice(0, 12) },
      });
    }
    const bytes = new Uint8Array(data);
    verifyIntegrity(id, bytes);
    return bytes;
  }

  async has(_ctx: RequestContext, id: BlobId): Promise<boolean> {
    try {
      await readFile(this.pathFor(id));
      return true;
    } catch {
      return false;
    }
  }

  async durabilityOf(ctx: RequestContext, id: BlobId): Promise<Durability | undefined> {
    if (!(await this.has(ctx, id))) return undefined;
    return this.durable.has(id) ? "durable" : "local";
  }

  async flush(): Promise<void> {}
}

function verifyIntegrity(id: BlobId, data: Uint8Array): void {
  const actual = blobIdOf(data);
  if (actual !== id) {
    throw new AgentError("integrity", "blob digest mismatch", {
      details: { expected: id.slice(0, 12), actual: actual.slice(0, 12) },
    });
  }
}
