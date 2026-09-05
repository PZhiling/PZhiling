import type { RequestContext } from "../core/context.ts";
import { AgentError } from "../core/errors.ts";
import type { BlobId, BlobStore, Durability } from "./blob-store.ts";

/**
 * A typed, versioned key/value view over the blob store.
 *
 * Keys map to blob ids, so a snapshot of the whole namespace is just a copy of
 * the id map: cheap to take, cheap to compare, and structurally shared with
 * every earlier snapshot.
 */
export interface StoredValue<T> {
  readonly value: T;
  readonly blobId: BlobId;
  readonly revision: number;
}

export type Snapshot = Readonly<Record<string, BlobId>>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class AgentStore {
  private readonly index = new Map<string, BlobId>();
  private revision = 0;

  private readonly blobs: BlobStore;
  private readonly namespace: string;

  constructor(blobs: BlobStore, namespace: string) {
    this.blobs = blobs;
    this.namespace = namespace;
  }

  private key(name: string): string {
    if (name.length === 0) throw new AgentError("invalid_input", "empty store key");
    return `${this.namespace}/${name}`;
  }

  async set<T>(ctx: RequestContext, name: string, value: T, durability: Durability = "durable"): Promise<StoredValue<T>> {
    const encoded = encoder.encode(JSON.stringify(value));
    const blobId = await this.blobs.put(ctx, encoded, durability);
    this.index.set(this.key(name), blobId);
    this.revision += 1;
    ctx.emit("debug", "kv.set", { key: name, blobId: blobId.slice(0, 12), revision: this.revision });
    return { value, blobId, revision: this.revision };
  }

  async get<T>(ctx: RequestContext, name: string): Promise<T | undefined> {
    const blobId = this.index.get(this.key(name));
    if (blobId === undefined) return undefined;
    const bytes = await this.blobs.get(ctx, blobId);
    return JSON.parse(decoder.decode(bytes)) as T;
  }

  /**
   * Compare-and-set against the blob id the caller last read. Two agents
   * writing the same key concurrently is a real case once subagents exist;
   * last-write-wins loses one of them silently.
   */
  async compareAndSet<T>(
    ctx: RequestContext,
    name: string,
    expected: BlobId | undefined,
    value: T,
    durability: Durability = "durable",
  ): Promise<StoredValue<T>> {
    const current = this.index.get(this.key(name));
    if (current !== expected) {
      throw new AgentError("integrity", "concurrent write conflict", {
        details: { key: name, expected: expected?.slice(0, 12) ?? "none", actual: current?.slice(0, 12) ?? "none" },
      });
    }
    return this.set(ctx, name, value, durability);
  }

  delete(name: string): boolean {
    const deleted = this.index.delete(this.key(name));
    if (deleted) this.revision += 1;
    return deleted;
  }

  keys(): string[] {
    const prefix = `${this.namespace}/`;
    return [...this.index.keys()].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
  }

  snapshot(): Snapshot {
    return Object.freeze(Object.fromEntries(this.index));
  }

  /** Restore a previous snapshot. Blobs are content-addressed, so this is O(keys). */
  restore(snapshot: Snapshot): void {
    this.index.clear();
    for (const [key, blobId] of Object.entries(snapshot)) this.index.set(key, blobId);
    this.revision += 1;
  }
}
