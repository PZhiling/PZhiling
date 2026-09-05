#!/usr/bin/env node
/* Copy the youtube-viewer-sim skill into the Studio's Phase 4 prompt template.
 *
 * The skill lives in .claude/skills/ because that is where Claude Code looks
 * for it. The Studio has to carry the same text inline — it is a single HTML
 * file that has to work offline with no build step and no fetch. Two copies of
 * a prompt drift, and a drifted prompt is worse than a missing one, so the
 * skill files are the source and this rewrites the block in the artifact.
 *
 * Idempotent: run it as often as you like. build-pages.sh runs it first.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = path.join(REPO, ".claude", "skills", "youtube-viewer-sim");
const APP = path.join(REPO, "artifact", "podcast-seo-studio.html");
const ID = "viewersimskill";

/* Strip the YAML frontmatter: name and description route the skill inside
   Claude Code and mean nothing to a model being handed the body as a prompt. */
const stripFrontmatter = (md) => md.replace(/^---\n[\s\S]*?\n---\n+/, "");

const escapeForScriptTag = (s) => s.replace(/<\/script>/gi, "<\\/script>");

const [skillMd, personas, app] = await Promise.all([
  readFile(path.join(SKILL, "SKILL.md"), "utf8"),
  readFile(path.join(SKILL, "references", "personas.md"), "utf8"),
  readFile(APP, "utf8"),
]);

const body = [
  stripFrontmatter(skillMd).trim(),
  "",
  "---",
  "",
  "# references/personas.md",
  "",
  personas.trim(),
].join("\n");

const block = `<script type="text/plain" id="${ID}">\n${escapeForScriptTag(body)}\n</script>`;
const re = new RegExp(`<script type="text/plain" id="${ID}">[\\s\\S]*?<\\/script>`);

if (!re.test(app)) {
  console.error(`sync-skill: ไม่พบบล็อก id="${ID}" ใน ${path.relative(REPO, APP)} — เพิ่มบล็อกว่างไว้ก่อน`);
  process.exit(1);
}
const next = app.replace(re, () => block);
if (next === app) {
  console.log(`sync-skill: ตรงกันอยู่แล้ว (${body.length} ตัวอักษร)`);
} else {
  await writeFile(APP, next);
  console.log(`sync-skill: อัปเดต Phase 4 prompt จาก .claude/skills/youtube-viewer-sim (${body.length} ตัวอักษร)`);
}
