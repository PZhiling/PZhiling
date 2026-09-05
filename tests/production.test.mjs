import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { splitText, fingerprint } from '../scripts/production-utils.mjs';

const root = new URL('../', import.meta.url);
const cli = new URL('../scripts/produce.mjs', import.meta.url);
const run = (...args) => spawnSync(process.execPath, [fileURLToPath(cli), ...args], { cwd: root, encoding: 'utf8' });
for (const text of ['a'.repeat(14000), 'ภาษาไทย😀\n'.repeat(2000), '', 'short']) {
  test(`split preserves content (${text.length} characters)`, () => {
    const chunks = splitText(text);
    assert.equal(chunks.join(''), text);
    assert.ok(chunks.every(c => Buffer.byteLength(c) <= 4200));
  });
}
test('browser chunker preserves long multilingual paragraphs', () => {
  const html = readFileSync(new URL('artifact/podcast-seo-studio.html', root), 'utf8');
  const source = html.slice(html.indexOf('function chunkText('), html.indexOf('async function synthChunk('));
  const context = vm.createContext({ TextEncoder });
  vm.runInContext(source, context);
  const text = 'ไทย😀'.repeat(4000);
  const chunks = context.chunkText(text);
  assert.equal(chunks.join(''), text);
  assert.ok(chunks.every(c => Buffer.byteLength(c) <= 4200));
});
test('cache changes when voice, text or reference changes', () => {
  const base = { text: 'hello', voice: 'A', reference: 'one' };
  for (const change of [{ text: 'new' }, { voice: 'B' }, { reference: 'two' }]) {
    assert.notEqual(fingerprint(base), fingerprint({ ...base, ...change }));
  }
});
test('invalid flags fail before attempting production', () => {
  for (const args of [['--unknown'], ['--limit'], ['--limit', '-1'], ['--delay', 'NaN']]) {
    assert.notEqual(run('missing.md', ...args).status, 0);
  }
});
test('help succeeds without keys', () => assert.equal(run('--help').status, 0));
test('dry run parses narration and storyboard without keys or output', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'production-test-'));
  const script = path.join(dir, 'sample.md');
  writeFileSync(script, '[0:00]\nHello world.\n\n## Production pack\n| Timestamp | Visual | Prompt | Mode |\n| --- | --- | --- | --- |\n| [0:00] | room | A quiet room | ANCHOR |\n');
  const result = run(script, '--dry-run');
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.beats, 1);
  assert.equal(plan.storyboardRows, 1);
});
test('published page contains current artifact', () => {
  const artifact = readFileSync(new URL('artifact/podcast-seo-studio.html', root), 'utf8');
  const page = readFileSync(new URL('docs/index.html', root), 'utf8');
  assert.ok(page.includes(artifact.slice(artifact.indexOf('\n') + 1)));
});
