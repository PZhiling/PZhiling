import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { ManualClock } from "../src/core/clock.ts";
import { createRootContext } from "../src/core/context.ts";
import type { AgentError } from "../src/core/errors.ts";
import { AgentStore } from "../src/kv/agent-store.ts";
import { blobIdOf, FileBlobStore, MemoryBlobStore } from "../src/kv/blob-store.ts";

function context() {
  return createRootContext({ clock: new ManualClock() }).ctx;
}

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

test("identical content gets one address", async () => {
  const ctx = context();
  const store = new MemoryBlobStore();
  const first = await store.put(ctx, encode("hello"));
  const second = await store.put(ctx, encode("hello"));
  assert.equal(first, second);
  assert.equal(first, blobIdOf(encode("hello")));
});

test("a malformed blob id is rejected before any lookup", async () => {
  const ctx = context();
  const store = new MemoryBlobStore();
  await assert.rejects(
    () => store.get(ctx, "not-a-digest"),
    (error: unknown) => (error as AgentError).kind === "invalid_input",
  );
});

test("corrupted bytes are caught on read rather than handed to the model", async () => {
  const ctx = context();
  const root = await mkdtemp(join(tmpdir(), "zhiling-kv-"));
  const store = new FileBlobStore(root);
  const id = await store.put(ctx, encode("original"));

  // Simulate on-disk corruption under a valid hash name.
  await writeFile(join(root, id.slice(0, 2), id.slice(2, 4), id), "tampered");

  await assert.rejects(
    () => store.get(ctx, id),
    (error: unknown) => (error as AgentError).kind === "integrity",
  );
});

test("local blobs are evicted under budget; durable ones are not", async () => {
  const ctx = context();
  const store = new MemoryBlobStore({ maxLocalBytes: 24 });

  const keep = await store.put(ctx, encode("0123456789"), "durable");
  const first = await store.put(ctx, encode("aaaaaaaaaa"), "local");
  await store.put(ctx, encode("bbbbbbbbbb"), "local");
  await store.put(ctx, encode("cccccccccc"), "local");

  assert.ok(await store.has(ctx, keep), "durable content survives eviction");
  assert.ok(!(await store.has(ctx, first)), "the least recently used local blob is evicted");
});

test("re-writing a local blob as durable promotes it", async () => {
  const ctx = context();
  const store = new MemoryBlobStore();
  const id = await store.put(ctx, encode("x"), "local");
  await store.put(ctx, encode("x"), "durable");
  assert.equal(await store.durabilityOf(ctx, id), "durable");
});

test("the store round-trips typed values and snapshots restore them", async () => {
  const ctx = context();
  const blobs = new MemoryBlobStore();
  const store = new AgentStore(blobs, "session");

  await store.set(ctx, "plan", { steps: ["a", "b"] });
  const snapshot = store.snapshot();

  await store.set(ctx, "plan", { steps: ["c"] });
  assert.deepEqual(await store.get(ctx, "plan"), { steps: ["c"] });

  store.restore(snapshot);
  assert.deepEqual(await store.get(ctx, "plan"), { steps: ["a", "b"] });
});

test("a stale compare-and-set is refused instead of silently overwriting", async () => {
  const ctx = context();
  const store = new AgentStore(new MemoryBlobStore(), "session");

  const first = await store.set(ctx, "notes", "one");
  await store.set(ctx, "notes", "two"); // a concurrent writer wins the race

  await assert.rejects(
    () => store.compareAndSet(ctx, "notes", first.blobId, "three"),
    (error: unknown) => (error as AgentError).kind === "integrity",
  );
  assert.equal(await store.get(ctx, "notes"), "two");
});

test("keys are namespaced and listable", async () => {
  const ctx = context();
  const blobs = new MemoryBlobStore();
  const a = new AgentStore(blobs, "alpha");
  const b = new AgentStore(blobs, "beta");

  await a.set(ctx, "shared", 1);
  await b.set(ctx, "shared", 2);

  assert.deepEqual(a.keys(), ["shared"]);
  assert.equal(await a.get(ctx, "shared"), 1);
  assert.equal(await b.get(ctx, "shared"), 2);
});
