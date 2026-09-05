/**
 * Read pieces of the Studio out of artifact/podcast-seo-studio.html at run time.
 *
 * The app is deliberately one file, so it cannot import a shared module without
 * giving that up. The CLI can read it, though — which is better than pasting
 * copies of long prompts and scoring rules that change whenever the show's
 * voice does. Everything lifted here stays the app's, and the CLI cannot fall
 * behind it.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

export const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const APP = path.join(REPO, "artifact/podcast-seo-studio.html");

let cached = null;
export async function appSource() {
  if (cached === null) cached = await readFile(APP, "utf8");
  return cached;
}

/** A `const NAME = \`…\`;` template literal, returned without its backticks. */
export function extractTemplate(src, name) {
  const open = `const ${name} = \``;
  const i = src.indexOf(open);
  if (i < 0) return null;
  const end = src.indexOf("`;", i + open.length);
  return end < 0 ? null : src.slice(i + open.length, end);
}

/**
 * The youtube-viewer-sim skill body, read from .claude/skills/ — the same files
 * the Studio's Phase 4 prompt is synced from, so both pipelines simulate
 * viewers by identical rules. The YAML frontmatter routes the skill inside
 * Claude Code and means nothing to a model handed the body as a prompt.
 */
export async function viewerSimSkill() {
  const dir = path.join(REPO, ".claude/skills/youtube-viewer-sim");
  const [skill, personas] = await Promise.all([
    readFile(path.join(dir, "SKILL.md"), "utf8"),
    readFile(path.join(dir, "references/personas.md"), "utf8"),
  ]);
  return [
    skill.replace(/^---\n[\s\S]*?\n---\n+/, "").trim(),
    "", "---", "",
    "# references/personas.md",
    "",
    personas.trim(),
  ].join("\n");
}

/** The Phase 2 storyboard rules, sliced out of the master prompt template. */
export function phase2Spec(src) {
  const m = src.match(/(?:^|\n)##[ \t]*Phase[ \t]*2\b[\s\S]*?(?=\n##[ \t]*Phase[ \t]*3\b|$)/);
  return m ? m[0].trim() : "";
}

/**
 * Lift a top-level declaration as source text. Functions come out by matching
 * braces from the header. Consts extend to the first semicolon that leaves a
 * parsable declaration — counting braces instead would trip over a regex
 * quantifier like {1,6}, and an arrow body simply needs a later semicolon than
 * the naive first one.
 */
export function lift(src, name) {
  let i = src.indexOf(`function ${name}(`);
  if (i >= 0) {
    const open = src.indexOf("{", i);
    let depth = 0;
    for (let j = open; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}" && --depth === 0) return src.slice(i, j + 1);
    }
  }
  i = src.search(new RegExp(`^const ${name} = `, "m"));
  if (i < 0) throw new Error(`หา ${name} ในไฟล์แอปไม่เจอ`);
  let end = i;
  for (let n = 0; n < 40; n++) {
    end = src.indexOf(";\n", end + 1);
    if (end < 0) break;
    const slice = src.slice(i, end + 1);
    try { new Function(slice); return slice; } catch { /* keep extending */ }
  }
  throw new Error(`ตัด ${name} ออกมาแล้วไม่เป็นโค้ดที่ถูกต้อง`);
}

/** Build callables out of lifted declarations, in one shared scope. */
export function liftAll(src, names, returns = names) {
  const body = names.map((n) => lift(src, n)).join("\n");
  return new Function(`${body}\nreturn { ${returns.join(", ")} };`)();
}
