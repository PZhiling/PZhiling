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
import { REPO, appSource, lift } from "./lib/app-source.mjs";

const scriptPath = process.argv[2] || path.join(REPO, "plans/scripts/ep01-the-competence-trap.md");
const app = await appSource();

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
