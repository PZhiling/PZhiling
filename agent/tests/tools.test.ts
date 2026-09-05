import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { ManualClock, systemClock } from "../src/core/clock.ts";
import { createRootContext } from "../src/core/context.ts";
import type { AgentError } from "../src/core/errors.ts";
import { createFetchTool } from "../src/tools/builtin/fetch.ts";
import { createShellTool } from "../src/tools/builtin/shell.ts";
import { createWorkspaceTools, resolveInside } from "../src/tools/builtin/workspace.ts";
import { ToolRegistry } from "../src/tools/registry.ts";

async function workspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "zhiling-ws-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "index.ts"), "export const answer = 42;\n");
  await writeFile(join(root, "README.md"), "# demo\nanswer lives in src\n");
  return root;
}

function context() {
  return createRootContext({ clock: new ManualClock() }).ctx;
}

test("path containment rejects traversal and absolute escapes", () => {
  assert.equal(resolveInside("/repo", "src/a.ts"), "/repo/src/a.ts");
  assert.throws(() => resolveInside("/repo", "../etc/passwd"));
  assert.throws(() => resolveInside("/repo", "/etc/passwd"));
  // A sibling directory that shares a prefix is still outside.
  assert.throws(() => resolveInside("/repo", "/repo-secrets/x"));
});

test("the registry rejects a duplicate name and reports unknown tools", () => {
  const root = "/repo";
  const registry = new ToolRegistry();
  registry.registerAll(createWorkspaceTools({ root }));
  assert.throws(() => registry.registerAll(createWorkspaceTools({ root })));
  assert.throws(() => registry.get("nope"), (error: unknown) => (error as AgentError).kind === "not_found");
  assert.deepEqual(registry.names().sort(), ["list_directory", "read_file", "search_text", "write_file"]);
});

test("read_file returns numbered lines and reports a missing file as a tool error", async () => {
  const root = await workspace();
  const [read] = createWorkspaceTools({ root });
  assert.ok(read);

  const ok = await read.execute(context(), read.validate({ path: "src/index.ts" }) as never);
  assert.match(ok.output, /1 {2}export const answer = 42;/);

  const missing = await read.execute(context(), read.validate({ path: "src/nope.ts" }) as never);
  assert.equal(missing.isError, true);
});

test("a tool's permission description names the concrete target", () => {
  const registry = new ToolRegistry().registerAll(createWorkspaceTools({ root: "/repo" }));
  const write = registry.get("write_file");
  const input = write.validate({ path: "src/a.ts", content: "x" } as never);
  assert.deepEqual(write.describe(input), { path: "/repo/src/a.ts" });
  assert.equal(write.action, "write-file");
});

test("search_text finds matches and refuses an invalid pattern", async () => {
  const root = await workspace();
  const registry = new ToolRegistry().registerAll(createWorkspaceTools({ root }));
  const search = registry.get("search_text");

  const found = await search.execute(context(), search.validate({ pattern: "answer" } as never) as never);
  assert.match(found.output, /src\/index\.ts:1/);

  assert.throws(
    () => search.validate({ pattern: "([" } as never),
    (error: unknown) => (error as AgentError).kind === "invalid_input",
  );
});

test("write_file round-trips through read_file", async () => {
  const root = await workspace();
  const registry = new ToolRegistry().registerAll(createWorkspaceTools({ root }));
  const write = registry.get("write_file");
  const read = registry.get("read_file");

  await write.execute(context(), write.validate({ path: "notes.txt", content: "hello" } as never) as never);
  const back = await read.execute(context(), read.validate({ path: "notes.txt" } as never) as never);
  assert.match(back.output, /hello/);
});

test("the shell tool reports output and exit code", async () => {
  const root = await workspace();
  const shell = createShellTool({ cwd: root });
  const { ctx } = createRootContext({ clock: systemClock });

  const ok = await shell.execute(ctx, shell.validate({ command: "echo hi" }));
  assert.match(ok.output, /hi/);
  assert.equal(ok.metadata?.["exitCode"], 0);

  const bad = await shell.execute(ctx, shell.validate({ command: "exit 3" }));
  assert.equal(bad.isError, true);
  assert.equal(bad.metadata?.["exitCode"], 3);
});

test("the shell tool kills a command that overruns its timeout", async () => {
  const root = await workspace();
  const shell = createShellTool({ cwd: root, timeoutMs: 300 });
  const { ctx } = createRootContext({ clock: systemClock });

  const result = await shell.execute(ctx, shell.validate({ command: "sleep 30" }));
  assert.equal(result.metadata?.["timedOut"], true);
  assert.match(result.output, /timed out/);
});

test("the shell tool does not hand provider keys to the child process", async () => {
  const root = await workspace();
  const shell = createShellTool({ cwd: root });
  const { ctx } = createRootContext({ clock: systemClock });

  process.env["ZHILING_TEST_SECRET"] = "super-secret-value";
  try {
    const result = await shell.execute(ctx, shell.validate({ command: "env" }));
    assert.doesNotMatch(result.output, /super-secret-value/);
    assert.match(result.output, /PATH=/);
  } finally {
    delete process.env["ZHILING_TEST_SECRET"];
  }
});

test("fetch_url rejects unsupported schemes, credentials and off-list hosts", () => {
  const tool = createFetchTool({ allowedHosts: ["example.com"] });
  assert.throws(
    () => tool.validate({ url: "file:///etc/passwd" }),
    (error: unknown) => (error as AgentError).kind === "permission_denied",
  );
  assert.throws(
    () => tool.validate({ url: "https://user:pass@example.com/x" }),
    (error: unknown) => (error as AgentError).kind === "permission_denied",
  );
  assert.throws(
    () => tool.validate({ url: "https://elsewhere.test/x" }),
    (error: unknown) => (error as AgentError).kind === "permission_denied",
  );
  assert.doesNotThrow(() => tool.validate({ url: "https://example.com/ok" }));
});
