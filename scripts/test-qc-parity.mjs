#!/usr/bin/env node
/**
 * The QC score is computed twice — once in the Studio's inline script, once in
 * produce.mjs — because the CLI cannot load the app's script and the app cannot
 * import a module without giving up being one file. Two copies drift silently,
 * and a gate that disagrees with the panel it is named after is worse than no
 * gate at all.
 *
 * This lifts the scoring functions straight out of artifact/podcast-seo-studio.html
 * and runs them beside the CLI's port on the same document with the same Brand
 * DNA. No browser: the functions are pure once `current` and `brandData` are
 * supplied, which is exactly what produce.mjs builds anyway.
 *
 *   node scripts/test-qc-parity.mjs [script.md]
 */
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const scriptPath = process.argv[2] || path.join(REPO, "plans/scripts/ep01-the-competence-trap.md");
const app = await readFile(path.join(REPO, "artifact/podcast-seo-studio.html"), "utf8");

/* Pull a top-level declaration out of the app source. Functions are taken by
   matching braces from the header; consts by scanning to the semicolon that
   closes them, which is enough for the array and regex literals used here. */
function lift(src, name) {
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
  /* Stop at the first ";" that closes a parsable declaration. Counting braces
     instead would trip over regex quantifiers like {1,6}; an arrow body simply
     needs a later semicolon than the naive first one. */
  let end = i;
  for (let n = 0; n < 40; n++) {
    end = src.indexOf(";\n", end + 1);
    if (end < 0) break;
    const slice = src.slice(i, end + 1);
    try { new Function(slice); return slice; } catch { /* keep extending */ }
  }
  throw new Error(`ตัด ${name} ออกมาแล้วไม่เป็นโค้ดที่ถูกต้อง`);
}

const NEEDED = ["AI_PHRASES", "GREETING", "TS_LINE", "SCRIPT_END", "tsRe",
  "narrationOnly", "rhythmStats", "parseTs", "isTableLine", "splitRow", "isSepRow",
  "storyboardRows", "computeQC"];
const lifted = NEEDED.map((n) => lift(app, n)).join("\n");

/* produce.mjs prints the context it scores; ask it for that rather than
   rebuilding the parsing a third time. */
const outDir = "/tmp/.qc-parity";
await mkdir(outDir, { recursive: true });
const dnaFile = path.join(outDir, "dna.md");
await writeFile(dnaFile, app.match(/<script type="text\/plain" id="dnadefault">([\s\S]*?)<\/script>/)[1].trim());

const cliOut = execFileSync("node", [path.join(REPO, "scripts/produce.mjs"), scriptPath,
  "--qc-only", "--dna", dnaFile, "--out", outDir], { encoding: "utf8" });
const cli = Number(cliOut.match(/QC ก่อนผลิต:\s*([\d.]+)/)?.[1]);
const ctx = JSON.parse(await readFile(path.join(outDir, "qc-context.json"), "utf8"));

const run = new Function("ctx", "dna", `
  ${lifted}
  const brandData = { b_dna: dna };
  const current = { ...ctx, sb: ctx.sb === null ? null : new Set(ctx.sb) };
  return computeQC(current);
`);
const studio = run(ctx, await readFile(dnaFile, "utf8")).total;

const same = Math.abs(cli - studio) < 0.05;
console.log(`  Studio ${studio.toFixed(1)}  ·  produce.mjs ${cli.toFixed(1)}  →  ${same ? "ตรงกัน ✓" : "ไม่ตรงกัน ✗"}`);
if (!same) {
  console.error("\n  โค้ดคิดคะแนนสองที่เพี้ยนจากกันแล้ว — แก้ให้ตรงก่อน merge\n");
  process.exit(1);
}
