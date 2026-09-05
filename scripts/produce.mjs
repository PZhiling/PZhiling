#!/usr/bin/env node
/**
 * produce.mjs — run one episode's production off a script file, with no browser.
 *
 * The Studio does this work in a tab, which costs it everything a tab costs:
 * the run dies when the phone locks, images compete with the browser's storage
 * quota, and a 20-minute image batch needs the screen awake for 20 minutes.
 * Here the same pipeline runs on a machine, writes every artefact to disk as it
 * is produced, and picks up where it stopped.
 *
 *   node scripts/produce.mjs plans/scripts/ep01-the-competence-trap.md
 *
 * Flags
 *   --provider manual|gemini|openai
 *                              manual (default) writes a ChatGPT prompt pack and
 *                              generates nothing; the other two call the image API
 *   --voice <name>             TTS voice (default en-US-Journey-D)
 *   --out <dir>                output directory (default out/<script name>)
 *   --only-anchors             generate images for ANCHOR rows only
 *   --limit <n>                stop after n images — for A/B runs
 *   --delay <ms>               pause between image calls (default 3000)
 *   --skip-audio, --skip-images
 *   --force                    regenerate even when the file is already there
 *
 * Keys come from the environment, never from a flag, so they stay out of shell
 * history: GOOGLE_TTS_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { REPO, appSource, extractTemplate, phase2Spec, liftAll, viewerSimSkill } from "./lib/app-source.mjs";

/* ── arguments ───────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const VALUE_FLAGS = new Set(["provider", "voice", "out", "limit", "delay", "qc-min", "dna"]);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) { positional.push(a); continue; }
  const name = a.slice(2);
  if (VALUE_FLAGS.has(name)) flags[name] = argv[++i];
  else flags[name] = true;
}
const flag = (name, fallback) => (flags[name] === undefined ? fallback : flags[name]);
const has = (name) => flags[name] === true;
const scriptPath = positional[0];

if (!scriptPath) {
  console.error("ใช้: node scripts/produce.mjs <script.md> [--provider gemini|openai] [--only-anchors] [--limit n]");
  process.exit(1);
}

const opts = {
  provider: flag("provider", "manual"),
  voice: flag("voice", "en-US-Journey-D"),
  outDir: flag("out", path.join("out", path.basename(scriptPath).replace(/\.mdx?$/i, ""))),
  onlyAnchors: has("only-anchors"),
  limit: Number(flag("limit", 0)) || 0,
  delay: Number(flag("delay", 3000)),
  skipAudio: has("skip-audio"),
  skipImages: has("skip-images"),
  skipPack: has("skip-pack"),
  skipShorts: has("skip-shorts"),
  skipViewerSim: has("skip-viewer-sim"),
  makeStoryboard: has("make-storyboard"),
  qcOnly: has("qc-only"),
  qcMin: flags["qc-min"] ?? 0,
  dna: flag("dna", null),
  force: has("force"),
};
if (!["manual", "gemini", "openai"].includes(opts.provider)) {
  console.error(`--provider ต้องเป็น manual, gemini หรือ openai (ได้รับ "${opts.provider}")`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cue = (sec) => { const t = Math.max(0, Math.round(sec)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const pad = (n) => String(n).padStart(3, "0");
const log = (...a) => console.log(...a);

/* ── script parsing — the same rules the Studio applies ──────────────────── */
const TS_LINE = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/;
const tsRe = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;
const secOf = (h, m, s) => (s !== undefined ? +h * 3600 + +m * 60 + +s : +h * 60 + +m);

/* Production notes sit in the same file as the narration. Counting them as
   speech inflates every downstream number, so cut them at their heading — but
   only after narration has started, so a file with notes on top survives. */
const PACK_HEAD = /^[ \t]*#{1,6}[ \t]*(?:\*{1,2}[ \t]*)?(?:[^\w\s\n]{1,4}[ \t]*)?(?:production[ \t]*(?:pack|notes)|packaging|titles?|description|thumbnail|hashtags?|tags|shorts[ \t]*cut|authenticity|notes[ \t]*for)\b/i;

function cleanNarration(t) {
  return t
    .split("\n").filter((l) => !/^\s*\|/.test(l)).join("\n")
    .replace(tsRe, " ")
    .replace(/^#{1,6}\s.*$/gm, " ")
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/* Read the narration out of Phase 3 when the document has phases. Scanning the
   whole file instead picks up the storyboard table's timestamps as beats — once
   a storyboard exists, Phase 2 sits above the script and its first cue would
   start the count, leaving one more beat than the script has cues. */
function narrationSource(doc) {
  const p3 = doc.match(/(?:^|\n)[ \t]*(?:#{1,6}[ \t]*)?(?:\*{1,2}[ \t]*)?(?:Phase|Step|ส่วนที่|เฟส|ขั้นตอนที่|ตอนที่)[ \t]*3\b[\s\S]*$/i);
  let t = p3 ? p3[0] : doc;
  const di = t.search(/(?:^|\n)\s*(?:#+\s*|\*\*\s*)?(?:youtube\s*)?description\b/i);
  if (di > 0) t = t.slice(0, di);
  return t;
}

function narrationBeats(doc) {
  const lines = narrationSource(doc).split("\n");
  const first = lines.findIndex((l) => TS_LINE.test(l));
  let end = lines.length;
  if (first >= 0) {
    for (let i = first + 1; i < lines.length; i++) {
      if (TS_LINE.test(lines[i])) continue;
      if (PACK_HEAD.test(lines[i])) { end = i; break; }
    }
  }
  const beats = [];
  let cur = null;
  for (const line of lines.slice(0, end)) {
    const m = line.match(TS_LINE);
    if (m) {
      const sec = secOf(m[1], m[2], m[3]);
      if (!cur || cur.sec !== sec) { cur = { sec, lines: [] }; beats.push(cur); }
    }
    if (cur) cur.lines.push(line);
  }
  return beats.map((b) => ({ sec: b.sec, text: cleanNarration(b.lines.join("\n")) })).filter((b) => b.text);
}

/* A hand-written script has no Phase headings, so the app's import wraps it
   before anything reads it: notes to Phase 1, script to Phase 3, an empty
   Phase 2 between. Do the same here or the gate scores a different document
   than the Studio shows — the production notes at the bottom would be read as
   part of the script, and its "## Description" heading counted as the episode
   description. */
const PHASE_HEAD = (n) => new RegExp(`(?:^|\\n)[ \\t]*(?:#{1,6}[ \\t]*)?(?:\\*{1,2}[ \\t]*)?(?:Phase|Step|ส่วนที่|ส่วน|เฟส|ขั้นตอนที่|ขั้นที่|ตอนที่)[ \\t]*${n}\\b`, "i");
const hasPhases = (t) => [1, 2, 3].some((n) => PHASE_HEAD(n).test(t));

function wrapBareScript(text) {
  const lines = String(text).split("\n");
  const first = lines.findIndex((l) => TS_LINE.test(l));
  let end = lines.length;
  if (first >= 0) {
    for (let i = first + 1; i < lines.length; i++) {
      if (TS_LINE.test(lines[i])) continue;
      if (PACK_HEAD.test(lines[i])) { end = i; break; }
    }
  }
  const body = lines.slice(0, end).join("\n").trim();
  const pack = lines.slice(end).join("\n").trim();
  return [
    "## Phase 1: บันทึกการผลิต (นำเข้าจากไฟล์)", pack || "— ไม่มีบันทึกท้ายไฟล์ —",
    "## Phase 2: Visual Storyboard", "ยังไม่มีตาราง Storyboard",
    "## Phase 3: Script", body,
  ].join("\n\n");
}

/* ── storyboard table — same column resolution as the Studio ─────────────── */
const isTableLine = (l) => /\|/.test(l) && l.trim().length > 2;
const splitRow = (l) => l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
const isSepRow = (cells) => cells.every((c) => /^:?-{2,}:?$/.test(c));

/* The storyboard arrives as JSON now — twenty-odd fields per shot is more than
   a markdown table can carry without the model dropping columns. Boards written
   before that still parse through the table reader below, and both shapes come
   back as the same row object so the rest of this script is unchanged.
   ANCHOR is derived, not authored: a shot continuing the previous shot's
   continuity_id is the one that must be generated in sequence off a reference
   frame, which is what ANCHOR always meant. */
function storyboardShots(doc) {
  const m = doc.match(/```storyboard\s*([\s\S]*?)```/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]);
    return Array.isArray(parsed?.shots) && parsed.shots.length ? parsed : null;
  } catch { return null; }
}

function storyboardRows(doc) {
  const board = storyboardShots(doc);
  if (board) {
    return board.shots.map((sh, i) => {
      const prev = board.shots[i - 1], next = board.shots[i + 1];
      // a person's override in the Studio wins over the planner's A/B/C mode
      const declared = String(sh.mode_override || sh.mode || "").toUpperCase();
      // a run's opening frame belongs to the run, or nothing chains off it
      const continues = !!sh.continuity_id && (
        (prev && prev.continuity_id === sh.continuity_id) ||
        (next && next.continuity_id === sh.continuity_id));
      return {
        ts: String(sh.timecode || ""),
        visual: String(sh.shot_description || ""),
        prompt: String(sh.image_prompt || ""),
        motion: String(sh.video_prompt || sh.motion_prompt || ""),
        mode: /ANCHOR/.test(declared) ? "ANCHOR" : /SUPPORT/.test(declared) ? "SUPPORT"
          : continues ? "ANCHOR" : "SUPPORT",
        shot: sh,
      };
    });
  }
  const rows = [];
  let header = null;
  for (const line of doc.split("\n")) {
    if (!isTableLine(line)) { if (header && rows.length) break; header = null; continue; }
    const cells = splitRow(line);
    if (isSepRow(cells)) continue;
    if (!header) { if (/timestamp/i.test(cells.join(" "))) header = cells; continue; }
    rows.push(cells);
  }
  if (!header || !rows.length) return [];
  const pi = header.findIndex((h) => /prompt/i.test(h));
  const mi = header.findIndex((h) => /motion/i.test(h));
  const di = header.findIndex((h) => /\bmode\b|โหมด/i.test(h));
  const vi = header.findIndex((h, i) => i !== di && /visual/i.test(h));
  return rows.map((c) => {
    const mode = di >= 0 ? (c[di] || "").toUpperCase() : "";
    return {
      ts: c[0] || "",
      visual: c[vi >= 0 ? vi : 1] || "",
      prompt: (c[pi >= 0 ? pi : Math.min(3, c.length - 1)] || "").replace(/^"|"$/g, ""),
      motion: mi >= 0 ? (c[mi] || "").replace(/^"|"$/g, "") : "",
      mode: /ANCHOR/.test(mode) ? "ANCHOR" : /SUPPORT/.test(mode) ? "SUPPORT" : "",
      shot: null,
    };
  });
}

/* ── QC Gate ──
   A port of the Studio's computeQC. The prompts below are read out of the app
   file at run time so they cannot drift, but scoring is real code and has to
   live in both places; scripts/test-qc-parity.mjs asserts the two agree on the
   same document, so a change to one that is not mirrored fails loudly. */
const AI_PHRASES = [
  "in today's fast-paced world", "in today's world", "have you ever wondered",
  "first and foremost", "moreover", "furthermore", "in conclusion",
  "as we wrap up", "additionally", "another crucial aspect", "it's important to note",
  "at the end of the day", "without further ado", "let's dive in", "dive deeper into",
  "unlock the secrets", "game-changer", "in this video, we will", "buckle up", "picture this",
];
const GREETING = /^\s*(hi|hello|hey|welcome|what'?s up|good (morning|afternoon|evening)|greetings)\b/i;
const SCRIPT_END = /^[ \t]*(?:#{1,6}[ \t]*)?(?:\*{1,2}[ \t]*)?(?:youtube[ \t]*)?(?:description|timestamps?|hashtags?|tags|website|cta|call[ \t]*to[ \t]*action|คำอธิบาย|แฮชแท็ก|แท็ก|เว็บไซต์)\b[ \t]*:?[ \t]*\*{0,2}[ \t]*$/i;

function narrationOnly(text) {
  const lines = String(text).split("\n");
  const start = lines.findIndex((l) => TS_LINE.test(l));
  if (start < 0) return String(text);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (TS_LINE.test(lines[i])) continue;
    if (SCRIPT_END.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join("\n");
}

function rhythmStats(text) {
  const clean = String(text).replace(/\[[\d:]+\]/g, " ");
  const sents = clean.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => /[A-Za-z]/.test(x));
  const lens = sents.map((x) => (x.match(/[A-Za-z][A-Za-z0-9'’-]*/g) || []).length).filter((n) => n > 0);
  if (lens.length < 15) return null;
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length);
  const openers = {};
  sents.forEach((x) => {
    const w = (x.match(/[A-Za-z]+/) || [""])[0].toLowerCase();
    if (w) openers[w] = (openers[w] || 0) + 1;
  });
  const top = Object.entries(openers).sort((a, b) => b[1] - a[1])[0] || ["-", 0];
  return {
    n: lens.length, mean: Math.round(mean * 10) / 10,
    cv: mean ? sd / mean : 0, topWord: top[0],
    topShare: top[1] / sents.length,
    longShare: lens.filter((n) => n > 30).length / lens.length,
  };
}

function parseTs(text) {
  const out = new Map();
  for (const m of text.matchAll(tsRe)) {
    const sec = secOf(m[1], m[2], m[3]);
    if (!out.has(sec)) out.set(sec, m[0]);
  }
  return [...out.entries()].map(([sec, label]) => ({ sec, label })).sort((a, b) => a.sec - b.sec);
}

/* The context computeQC reads, built the way analyzeResult builds it. */
function analyze(doc) {
  const p2 = doc.match(/(?:^|\n)[ \t]*(?:#{1,6}[ \t]*)?(?:\*{1,2}[ \t]*)?(?:Phase|ส่วนที่|ตอนที่)[ \t]*2\b[\s\S]*?(?=(?:\n[ \t]*(?:#{1,6}[ \t]*)?(?:\*{1,2}[ \t]*)?(?:Phase|ส่วนที่|ตอนที่)[ \t]*3\b)|$)/i)?.[0] ?? null;
  const p3 = doc.match(/(?:^|\n)[ \t]*(?:#{1,6}[ \t]*)?(?:\*{1,2}[ \t]*)?(?:Phase|ส่วนที่|ตอนที่)[ \t]*3\b[\s\S]*$/i)?.[0] ?? null;
  const scriptSrc = narrationOnly(p3 || doc);
  const words = (scriptSrc.replace(tsRe, "").match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
  const estSec = Math.round((words / 150) * 60);
  const ts = parseTs(scriptSrc);
  const total = Math.max(estSec, ts.length ? ts[ts.length - 1].sec + 15 : 0);
  const segs = ts.map((t, i) => {
    const gap = (i + 1 < ts.length ? ts[i + 1].sec : total) - t.sec;
    return { sev: gap > 25 ? "crit" : gap > 18 ? "warn" : "good" };
  });
  const rows = storyboardRows(doc);
  const sb = rows.length ? new Set(rows.map((r) => { const m = String(r.ts).match(/(\d{1,3}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : -1; })) : null;
  const coverage = sb && ts.length ? Math.round(((ts.length - ts.filter((t) => !sb.has(t.sec)).length) / ts.length) * 100) : null;
  return { md: doc, phases: { p2, p3 }, words, ts, segs, sb, coverage, rows, total };
}

function computeQC(c, dnaText) {
  const script = c.phases.p3 || c.md;
  const low = script.toLowerCase();
  const checks = [];

  const found = AI_PHRASES.filter((ph) => low.includes(ph));
  const dnaLine = (dnaText || "").match(/banned words:?\s*([^\n]+)/i);
  const dnaBanned = dnaLine ? dnaLine[1].split(/,\s*/).map((w) => w.trim().toLowerCase()).filter(Boolean) : [];
  const foundDna = dnaBanned.filter((w) =>
    new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(script));
  const allFound = [...found, ...foundDna.map((w) => w + " (DNA)")];
  checks.push({
    name: "ภาษาเหมือนมนุษย์ (Pattern AI + คำต้องห้ามใน Brand DNA)", max: 2,
    score: Math.max(0, 2 - allFound.length * 0.5),
    detail: allFound.length ? `พบ ${allFound.length} จุด: ${allFound.slice(0, 6).join(", ")}` : "ไม่พบวลี Pattern AI",
  });

  const rh = rhythmStats(narrationOnly(c.phases.p3 || c.md));
  if (!rh) checks.push({ name: "จังหวะประโยคเหมือนมนุษย์", max: 1.5, score: 0, na: true, detail: "สคริปต์สั้นเกินไป" });
  else {
    let sc = 0;
    if (rh.cv >= 0.45) sc += 0.7; else if (rh.cv >= 0.3) sc += 0.35;
    if (rh.topShare < 0.3) sc += 0.5; else if (rh.topShare < 0.45) sc += 0.25;
    if (rh.longShare <= 0.05) sc += 0.3; else if (rh.longShare <= 0.15) sc += 0.15;
    checks.push({
      name: "จังหวะประโยคเหมือนมนุษย์", max: 1.5, score: Math.round(sc * 100) / 100,
      detail: `${rh.n} ประโยค เฉลี่ย ${rh.mean} คำ · ความแปรผัน ${rh.cv.toFixed(2)} · "${rh.topWord}" ขึ้นต้น ${Math.round(rh.topShare * 100)}%`,
    });
  }

  let cold = 0; const coldNotes = [];
  const zi = script.indexOf("[0:00]");
  const open = (zi >= 0 ? script.slice(zi + 6, zi + 700) : script.slice(0, 700)).trim();
  if (zi >= 0) cold += 0.5; else coldNotes.push("ไม่พบ [0:00]");
  if (!GREETING.test(open)) cold += 0.5; else coldNotes.push("เปิดด้วยคำทักทาย");
  if (/\d/.test(open.slice(0, 280)) || /\?/.test(open.slice(0, 280)) ||
      /(never|nobody|wrong|mistake|secret|stop|worst|lie|myth|percent)/i.test(open.slice(0, 280))) cold += 1;
  else coldNotes.push("60 วิแรกยังไม่เห็นสัญญาณ hook");
  checks.push({ name: "Cold Open มี Hook ใน 60 วิแรก", max: 2, score: cold, detail: coldNotes.join(" · ") || "เปิดด้วย hook ทันที" });

  let pace = 0;
  if (c.segs.length) pace = (c.segs.reduce((s, g) => s + (g.sev === "good" ? 1 : g.sev === "warn" ? 0.5 : 0), 0) / c.segs.length) * 2;
  checks.push({
    name: "จังหวะ Timestamp ถี่พอ (กันภาพค้าง)", max: 2, score: pace,
    detail: c.segs.length ? `${c.segs.filter((s) => s.sev === "good").length}/${c.segs.length} ช่วงอยู่ในเกณฑ์ ≤18 วิ` : "ไม่พบ Timestamp",
  });

  checks.push({
    name: "คิวภาพ Storyboard ครบทุก Timestamp", max: 1.5,
    score: c.sb === null ? 0 : ((c.coverage ?? 0) / 100) * 1.5,
    detail: c.sb === null ? "ไม่พบตาราง Storyboard ใน Phase 2" : `คิวภาพครอบคลุม ${c.coverage}%`,
  });

  const sbAll = c.rows;
  if (!sbAll.some((r) => r.mode)) {
    checks.push({ name: "ซีเควนซ์ ANCHOR ที่จุดวิกฤต Retention", max: 1.5, score: 0, na: true, detail: "ไม่พบคอลัมน์ Visual Mode" });
  } else {
    const at = sbAll.filter((r) => r.mode === "ANCHOR")
      .map((r) => { const m = String(r.ts).match(/(\d{1,3}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; })
      .filter((s) => s !== null);
    const dur = (c.ts.length ? c.ts[c.ts.length - 1].sec : 0) + 20;
    const zones = [
      { label: "Cold Open", from: 0, to: Math.max(45, dur * 0.08) },
      { label: "Mid re-hook (35–55%)", from: dur * 0.35, to: dur * 0.55 },
      { label: "Resolution (ท้ายคลิป)", from: dur * 0.8, to: Infinity },
    ].map((z) => ({ ...z, ok: at.some((s) => s >= z.from && s <= z.to) }));
    const miss = zones.filter((z) => !z.ok).map((z) => z.label);
    checks.push({
      name: "ซีเควนซ์ ANCHOR ที่จุดวิกฤต Retention", max: 1.5, score: ((3 - miss.length) / 3) * 1.5,
      detail: `ครบ ${3 - miss.length}/3 จุด${miss.length ? " · ขาด: " + miss.join(", ") : ""} · สัดส่วน ANCHOR ${Math.round((at.length / sbAll.length) * 100)}%`,
    });
  }

  const dm = script.match(/(?:^|\n)\s*(?:#+\s*|\*\*\s*)?(?:youtube\s*)?description\b[\s\S]*$/i);
  let descScore = 0, descDetail = "ไม่พบส่วน Description", descText = "";
  if (dm) {
    descText = dm[0];
    const dts = parseTs(descText);
    if (!dts.length) { descScore = 0.5; descDetail = "มี Description แต่ไม่มี Timestamps"; }
    else {
      const sset = new Set(c.ts.map((t) => t.sec));
      const ok = dts.filter((t) => sset.has(t.sec)).length;
      descScore = (ok / dts.length) * 1.5;
      descDetail = `Timestamps ตรงกับสคริปต์ ${ok}/${dts.length} ตัว`;
    }
  }
  checks.push({ name: "Description มี Timestamps ตรงสคริปต์", max: 1.5, score: descScore, detail: descDetail });

  const target = descText || script;
  let cta = 0; const ctaNotes = [];
  if (/https?:\/\//i.test(target)) cta += 0.7; else ctaNotes.push("ไม่มีลิงก์ Backlink");
  if (/#[^\s#]/.test(target)) cta += 0.3; else ctaNotes.push("ไม่มี Hashtags");
  checks.push({ name: "Backlink + Hashtags ใน Description", max: 1, score: cta, detail: ctaNotes.join(" · ") || "ครบ" });

  const live = checks.filter((k) => !k.na);
  const maxSum = live.reduce((s, k) => s + k.max, 0) || 1;
  const total = Math.round((live.reduce((s, k) => s + k.score, 0) / maxSum) * 100) / 10;
  return { total, checks };
}

function printQC(qc, label) {
  log(`\n  ${label}: ${qc.total.toFixed(1)} / 10`);
  for (const k of qc.checks) {
    const mark = k.na ? "–" : k.score >= k.max - 0.01 ? "✓" : k.score > 0 ? "~" : "✗";
    log(`   ${mark} ${k.score.toFixed(2)}/${k.max}  ${k.name}`);
    if (k.detail) log(`        ${k.detail}`);
  }
}

/* ── MP3 duration by frame header, so no ffmpeg has to be installed ──────── */
const BITRATE_V1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const BITRATE_V2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

function mp3Seconds(buf) {
  let i = 0;
  // ID3v2 header is 10 bytes plus a syncsafe size — frames start after it
  if (buf.length > 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    i = 10 + ((buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f));
  }
  let seconds = 0, frames = 0;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) { i++; continue; }
    const verBits = (buf[i + 1] >> 3) & 0x03;      // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const layer = (buf[i + 1] >> 1) & 0x03;        // 1 = Layer III
    const brIdx = (buf[i + 2] >> 4) & 0x0f;
    const srIdx = (buf[i + 2] >> 2) & 0x03;
    const padding = (buf[i + 2] >> 1) & 0x01;
    const rates = RATES[verBits];
    if (layer !== 1 || !rates || srIdx === 3 || brIdx === 0 || brIdx === 15) { i++; continue; }
    const bitrate = (verBits === 3 ? BITRATE_V1L3 : BITRATE_V2L3)[brIdx] * 1000;
    const sampleRate = rates[srIdx];
    if (!bitrate || !sampleRate) { i++; continue; }
    const samples = verBits === 3 ? 1152 : 576;
    const frameLen = Math.floor((samples / 8) * bitrate / sampleRate) + padding;
    if (frameLen < 4) { i++; continue; }
    seconds += samples / sampleRate;
    frames++;
    i += frameLen;
  }
  if (!frames) throw new Error("อ่านเฟรม MP3 ไม่ได้ ไฟล์อาจเสีย");
  return seconds;
}

/* ── text to speech, one file per beat ───────────────────────────────────── */
async function synthBeat(text, voice, key) {
  const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: voice.slice(0, 5), name: voice },
      audioConfig: { audioEncoding: "MP3" },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return Buffer.from(data.audioContent, "base64");
}

/* Cue times in the script are written at a flat 150 wpm; a real voice is not.
   The error is systematic, so it compounds and lands hardest at the end of the
   episode — measured on episode 1, en-US-Journey-D reads at 186 wpm and the
   final cue was seven minutes out. Replace the estimate with the measurement.
   One pass with a callback, never a loop: a sequential rewrite would re-map a
   cue that an earlier step had already moved onto. */
function retime(doc, map) {
  return doc.replace(tsRe, (full, h, m, s) => {
    const sec = secOf(h, m, s);
    return map.has(sec) ? `[${cue(map.get(sec))}]` : full;
  });
}

async function runAudio(doc, beats, dir) {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (!key) throw new Error("ไม่มี GOOGLE_TTS_API_KEY ใน environment");
  await mkdir(path.join(dir, "audio"), { recursive: true });
  const parts = [];
  let clock = 0, made = 0, cached = 0;
  const measured = [];
  for (let i = 0; i < beats.length; i++) {
    const file = path.join(dir, "audio", `beat-${pad(i)}.mp3`);
    let buf;
    if (!opts.force && existsSync(file)) { buf = await readFile(file); cached++; }
    else {
      process.stdout.write(`\r  พากย์ ${i + 1}/${beats.length} ...`);
      buf = await synthBeat(beats[i].text, opts.voice, key);
      await writeFile(file, buf);
      made++;
    }
    const dur = mp3Seconds(buf);
    measured.push({ index: i, cue: cue(beats[i].sec), sec: beats[i].sec, start: clock, dur });
    clock += dur;
    parts.push(buf);
  }
  process.stdout.write("\r");
  // Concatenating encoded frames leaves each file's encoder padding in place —
  // a few tens of milliseconds per joint. Against the systematic error this
  // replaces, that is noise, and it keeps the output playable everywhere.
  await writeFile(path.join(dir, "voiceover.mp3"), Buffer.concat(parts));
  log(`  เสียง: เจนใหม่ ${made} · ใช้ของเดิม ${cached} · รวม ${cue(clock)}`);
  return { measured, total: clock };
}

/* ── image providers ─────────────────────────────────────────────────────
   Both take (prompt, refPngBuffer) and return a PNG buffer. The reference
   frame is what makes an ANCHOR run hold together: without it each call
   invents a new scene, and a run of frames stops reading as one place. */
const SAFETY = ", no text, no watermark, no logo, centered composition with headroom";
const CONTINUE = "Use the supplied image as the reference frame. Keep the same subject, room, camera angle, lens, palette and lighting — this is the same place moments later, not a new scene. Change only what the description below states.\n\n";

async function imageGemini(prompt, ref) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("ไม่มี GEMINI_API_KEY ใน environment");
  const parts = ref
    ? [{ inlineData: { mimeType: "image/png", data: ref.toString("base64") } }, { text: CONTINUE + prompt + SAFETY }]
    : [{ text: prompt + SAFETY }];
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageConfig: { aspectRatio: "16:9" } },
      }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  const part = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
  if (!part) throw new Error("ไม่ได้ภาพกลับมา — อาจติดโควตา หรือ prompt ถูกบล็อก");
  return Buffer.from(part.inlineData.data, "base64");
}

/* gpt-image-2 wants an explicit WIDTHxHEIGHT, both divisible by 16 — which is
   why this is 1024x576 and not the 1920x1080 the ratio would suggest. And a
   reference frame goes to a different endpoint entirely: /images/edits, as
   multipart, rather than the JSON /images/generations. */
const OPENAI_SIZE = "1024x576";
async function imageOpenAI(prompt, ref) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("ไม่มี OPENAI_API_KEY ใน environment");
  let res;
  if (ref) {
    const form = new FormData();
    form.append("model", "gpt-image-2");
    form.append("prompt", CONTINUE + prompt + SAFETY);
    form.append("size", OPENAI_SIZE);
    form.append("image", new Blob([ref], { type: "image/png" }), "reference.png");
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form,
    });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-image-2", prompt: prompt + SAFETY, size: OPENAI_SIZE }),
    });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  const first = data?.data?.[0];
  if (first?.b64_json) return Buffer.from(first.b64_json, "base64");
  if (first?.url) return Buffer.from(await (await fetch(first.url)).arrayBuffer());
  throw new Error("ไม่ได้ภาพกลับมาจาก OpenAI");
}

const IMAGE_PROVIDERS = { gemini: imageGemini, openai: imageOpenAI };

/* Images are the one step where the API is the expensive way round: a ChatGPT
   subscription generates them at no per-image cost, and an episode is 74 of
   them. So the default stops here and hands over a prompt pack instead. The
   batching, the continuation wording and the rule that a batch never cuts
   through an ANCHOR run all come from the app, lifted rather than restated. */
async function runManual(rows, dir) {
  const src = await appSource();
  const { cgptPrompt, cgptBatches, cgptBatchPrompt, reusePlan } =
    liftAll(src, ["cgptPrompt", "cgptBatches", "cgptBatchPrompt", "reusePlan"]);

  // ANCHOR run membership, the same grouping renderBroll computes
  let runId = 0;
  const seq = rows.map((r, i) => {
    if (r.mode !== "ANCHOR") return 0;
    if (i === 0 || rows[i - 1].mode !== "ANCHOR") runId++;
    return runId;
  });
  const runPos = {}, pos = [];
  seq.forEach((s, i) => { if (s) { runPos[s] = (runPos[s] || 0) + 1; pos[i] = runPos[s]; } });

  const outDir = path.join(dir, "images", "manual");
  const promptDir = path.join(outDir, "prompts");
  await mkdir(promptDir, { recursive: true });

  /* A shot carrying reuse_of is a copy of an earlier frame, so it never goes
     into a batch: asking ChatGPT for it again returns something close but not
     the same, which is exactly what reuse exists to avoid. */
  const reuse = reusePlan(rows);
  const reuseIdx = Object.keys(reuse).map(Number);
  const batches = cgptBatches(rows, seq, pos, 8, reuse);
  for (let k = 0; k < batches.length; k++) {
    await writeFile(path.join(promptDir, `batch-${pad(k + 1)}.txt`),
      cgptBatchPrompt(rows, batches[k], seq, pos, k + 1, batches.length));
  }
  // one file per row too, for redoing a single frame later
  for (let i = 0; i < rows.length; i++) {
    await writeFile(path.join(promptDir, `row-${pad(i)}.txt`), cgptPrompt(rows[i], pos[i] > 1));
  }

  const wanted = rows.map((_, i) => i).filter((i) => reuse[i] === undefined);
  const missing = wanted.filter((i) => !existsSync(path.join(outDir, `row-${pad(i)}.png`)));
  const lines = [
    "# ภาพของตอนนี้ — เจนมือใน ChatGPT",
    "",
    `คิว ${rows.length} · ต้องเจนจริง ${wanted.length} ภาพ` +
      (reuseIdx.length ? ` · ใช้ภาพซ้ำ ${reuseIdx.length}` : "") +
      ` · ${batches.length} ชุด · ยังขาด ${missing.length} ภาพ`,
    "",
    "## วิธีทำ",
    "",
    `1. เปิด \`prompts/batch-${pad(1)}.txt\` คัดลอก**ทั้งไฟล์** ไปวางในแชท ChatGPT`,
    "2. ทำครบชุดในแชทเดียว — เฟรมที่ 2 เป็นต้นไปของชุด ANCHOR อ้างภาพก่อนหน้าในแชทนั้น เปิดแชทใหม่แล้วโมทีฟจะหลุด",
    "3. ถ้ามันสร้างไม่ครบในทีเดียว พิมพ์ว่า \"ทำต่อ\" — prompt สั่งไว้แล้วว่าห้ามข้ามหมายเลข",
    "4. เซฟภาพลงโฟลเดอร์นี้ตามชื่อในตารางข้างล่าง",
    "5. รัน produce.mjs ซ้ำเพื่อดูว่ายังขาดภาพไหน",
    "",
    "ชุดถัดไปเปิดแชทใหม่ได้ เพราะชุดไม่เคยตัดกลางซีเควนซ์ ANCHOR",
    "",
    "## เซฟภาพชื่ออะไร",
    "",
    "| ชุด | ภาพที่ | เซฟเป็น | Timestamp | โหมด |",
    "|---|---|---|---|---|",
  ];
  batches.forEach((idxs, k) => idxs.forEach((i, n) => {
    lines.push(`| ${k + 1} | ${n + 1} | \`row-${pad(i)}.png\` | ${String(rows[i].ts).replace(/[\[\]]/g, "")} | ${rows[i].mode === "ANCHOR" ? `ANCHOR ชุด ${seq[i]} เฟรม ${pos[i]}` : "SUPPORT"} |`);
  }));
  if (reuseIdx.length) {
    lines.push("", "## คิวที่ใช้ภาพซ้ำ (ไม่ต้องเจนใหม่)", "",
      "| Timestamp | ก๊อปไฟล์ | มาเป็น |", "|---|---|---|");
    reuseIdx.forEach((i) => lines.push(
      `| ${String(rows[i].ts).replace(/[\[\]]/g, "")} | \`row-${pad(reuse[i])}.png\` | \`row-${pad(i)}.png\` |`));
  }
  lines.push("", "แก้ภาพเดียวทีหลัง: ใช้ `prompts/row-<เลขเดียวกับชื่อไฟล์ภาพ>.txt`");
  await writeFile(path.join(outDir, "README.md"), lines.join("\n") + "\n");

  log(`  ภาพ (เจนมือ): เขียน ${batches.length} ชุด · ${rows.length} prompt รายภาพ` +
    (reuseIdx.length ? ` · ใช้ภาพซ้ำ ${reuseIdx.length} คิว` : ""));
  log(`    → ${path.join(outDir, "README.md")}`);
  if (missing.length) log(`    ยังขาด ${missing.length}/${rows.length} ภาพ`);
  else log(`    ครบทุกภาพแล้ว ✓`);
  return { mode: "manual", batches: batches.length, rows: rows.length,
    generate: wanted.length, reuse: reuseIdx.length, missing: missing.length };
}

async function runImages(rows, dir) {
  const gen = IMAGE_PROVIDERS[opts.provider];
  const outDir = path.join(dir, "images", opts.provider);
  await mkdir(outDir, { recursive: true });

  // Chain only inside a run of consecutive ANCHOR rows — a SUPPORT frame is
  // meant to stand alone, and feeding it a reference would drag the previous
  // scene into a shot that should have started fresh.
  const chainFrom = rows.map((r, i) => r.mode === "ANCHOR" && i > 0 && rows[i - 1].mode === "ANCHOR");

  const wanted = rows.map((r, i) => i).filter((i) => !opts.onlyAnchors || rows[i].mode === "ANCHOR");
  const todo = opts.limit ? wanted.slice(0, opts.limit) : wanted;
  let made = 0, cached = 0;
  const failed = [];
  let prev = null;

  for (const i of todo) {
    const file = path.join(outDir, `row-${pad(i)}.png`);
    if (!opts.force && existsSync(file)) { prev = await readFile(file); cached++; continue; }
    const prompt = rows[i].prompt || rows[i].visual;
    if (!prompt) { failed.push(`${rows[i].ts} — ไม่มี prompt`); prev = null; continue; }
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      process.stdout.write(`\r  ภาพ ${i + 1}/${rows.length} ${rows[i].ts}${attempt > 1 ? ` (ครั้งที่ ${attempt})` : ""} ...`);
      try {
        const buf = await gen(prompt, chainFrom[i] ? prev : null);
        await writeFile(file, buf);
        prev = buf; ok = true; made++;
      } catch (err) {
        if (attempt === 3) { failed.push(`${rows[i].ts} — ${String(err.message).slice(0, 80)}`); prev = null; }
        else await sleep(2000 * attempt);
      }
    }
    if (opts.delay) await sleep(opts.delay);
  }
  process.stdout.write("\r");
  log(`  ภาพ (${opts.provider}): เจนใหม่ ${made} · ใช้ของเดิม ${cached} · ล้มเหลว ${failed.length}`);
  failed.forEach((f) => log(`    ✗ ${f}`));
  return { made, cached, failed };
}

async function gemini(prompt, temp = 0.7) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("ไม่มี GEMINI_API_KEY ใน environment");
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: temp } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  const out = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!out) throw new Error("ผลลัพธ์ว่างเปล่า");
  return out;
}
const dnaSuffix = (dna) => (dna ? "\n\n---\nBrand DNA ที่ต้องยึด:\n" + dna : "");

/* A viewer cannot see image_prompt, only the frame it produces, so the board
   goes in as description, camera and hold — sending seventy full English
   prompts would bury the script they are supposed to be judging. */
function viewerSimBoard(rows, limit = 80) {
  if (!rows || !rows.length) return "";
  const lines = rows.slice(0, limit).map((r) => {
    const sh = r.shot || {};
    const head = [String(r.ts).replace(/[\[\]]/g, ""), sh.visual_type || r.mode || "",
      (r.visual || r.prompt || "").slice(0, 110)].filter(Boolean).join(" | ");
    const tail = [sh.camera || "", sh.hold_seconds ? sh.hold_seconds + "s" : "",
      sh.reuse_of ? "ใช้ภาพซ้ำ" : ""].filter(Boolean).join(" · ");
    return "- " + head + (tail ? "  (" + tail + ")" : "");
  });
  return lines.join("\n") + (rows.length > limit ? `\n- … อีก ${rows.length - limit} ช็อต` : "");
}

async function viewerSimPrompt(doc, ctx, dna) {
  const board = viewerSimBoard(ctx.rows);
  const script = (narrationSource(doc) || doc).trim();
  return [
    await viewerSimSkill(),
    "",
    "=====================================================================",
    "",
    "ทำตามสกิลด้านบนกับตอนนี้ ตอบเป็นภาษาไทย และคงรูปแบบผลลัพธ์ตามที่สกิลกำหนดไว้ทุกบล็อก",
    "",
    "## บริบทของตอน",
    "- รูปแบบ: YouTube Faceless Podcast (long-form)",
    ctx.total ? `- ความยาวโดยประมาณ: ${cue(ctx.total)}` : "",
    board ? `- มีแผนภาพ ${ctx.rows.length} ช็อต (อยู่ด้านล่าง)`
      : "- ยังไม่มีแผนภาพ ให้ประเมินเฉพาะสคริปต์และบอกไว้ใน ASSUMPTIONS",
    dna ? "\n## Brand DNA ของช่อง\n" + dna : "",
    board ? "\n## แผนภาพ (Phase 2)\n" + board : "",
    "\n## สคริปต์ (Phase 3)\n" + script,
  ].filter(Boolean).join("\n");
}

/* Build the Phase 2 table from the cues the script already carries, so a
   hand-written script does not have to be taken back into the app to get one. */
async function makeStoryboard(doc, ctx, dna) {
  const src = await appSource();
  const script = (ctx.phases.p3 || doc).slice(0, 14000);
  const cues = ctx.ts.map((t) => t.label).join(" ");
  const table = await gemini(
    `${script}\n\n---\n\nจากสคริปต์ด้านบน สร้างเฉพาะ "ตาราง Visual Storyboard" ตามกติกาด้านล่าง\n` +
    `ตอบกลับเป็นตาราง Markdown ล้วนๆ ห้ามมีคำอธิบายก่อนหรือหลังตาราง\n` +
    `ต้องครบทุก Timestamp ต่อไปนี้ เรียงตามลำดับ ห้ามขาดห้ามเกิน:\n${cues}\n\n${phase2Spec(src)}${dnaSuffix(dna)}`);
  if (!table.split("\n").some(isTableLine)) throw new Error("ผลลัพธ์ไม่ใช่ตาราง Markdown");
  const p2 = "## Phase 2: Visual Storyboard\n\n" + table.trim();
  if (ctx.phases.p2) return doc.replace(ctx.phases.p2, () => p2 + "\n\n");
  if (ctx.phases.p3) return doc.replace(ctx.phases.p3, () => p2 + "\n\n" + ctx.phases.p3);
  return doc + "\n\n" + p2;
}

/* ── main ────────────────────────────────────────────────────────────────── */
let doc = await readFile(scriptPath, "utf8");
if (!hasPhases(doc)) doc = wrapBareScript(doc);
const dna = opts.dna ? await readFile(opts.dna, "utf8") : null;
await mkdir(opts.outDir, { recursive: true });

let ctx = analyze(doc);
log(`\n${path.basename(scriptPath)}`);
log(`  บีต ${narrationBeats(doc).length} · แถว storyboard ${ctx.rows.length} · provider ${opts.provider} · เสียง ${opts.voice}`);
log(`  เขียนลง ${opts.outDir}`);

/* The gate runs before anything is spent. An episode that is not ready costs
   74 TTS calls and 74 image calls to find that out any later. */
let qc = computeQC(ctx, dna);
printQC(qc, "QC ก่อนผลิต");
const qcMin = Number(opts.qcMin) || 0;
if (opts.qcOnly) {
  // The parity test scores this same context with the app's own functions.
  await writeFile(path.join(opts.outDir, "qc-context.json"), JSON.stringify({
    md: ctx.md, phases: ctx.phases, ts: ctx.ts, segs: ctx.segs,
    sb: ctx.sb ? [...ctx.sb] : null, coverage: ctx.coverage,
  }));
  log("");
  process.exit(qcMin && qc.total < qcMin ? 1 : 0);
}
if (qcMin && qc.total < qcMin) {
  log(`\n  หยุด: QC ${qc.total.toFixed(1)} ต่ำกว่าเกณฑ์ ${qcMin} — ยังไม่ได้ใช้โควตาสักครั้ง`);
  log(`  แก้สคริปต์แล้วรันใหม่ หรือลด --qc-min ถ้าจงใจปล่อยผ่าน\n`);
  process.exit(1);
}

const manifest = {
  script: scriptPath, generatedAt: new Date().toISOString(),
  provider: opts.provider, voice: opts.voice,
  qcBefore: { total: qc.total, checks: qc.checks.map((k) => ({ name: k.name, score: +k.score.toFixed(2), max: k.max, na: !!k.na })) },
};

if (opts.makeStoryboard && !ctx.rows.length) {
  log("\n  สร้าง Storyboard จากสคริปต์...");
  doc = await makeStoryboard(doc, ctx, dna);
  const sbName = path.basename(scriptPath).replace(/\.mdx?$/i, "") + ".storyboard.md";
  await writeFile(path.join(opts.outDir, sbName), doc);
  ctx = analyze(doc);
  qc = computeQC(ctx, dna);
  printQC(qc, "QC หลังใส่ Storyboard");
  manifest.storyboardScript = sbName;
  manifest.qcAfterStoryboard = { total: qc.total };
} else if (opts.makeStoryboard) {
  log("  มีตาราง Storyboard อยู่แล้ว — ข้าม --make-storyboard");
}

const beats = narrationBeats(doc);
if (!beats.length) log("\n  ! ไม่พบ timestamp [M:SS] — ข้ามขั้นเสียง");
manifest.beats = beats.length;
manifest.storyboardRows = ctx.rows.length;

let audio = null;
if (!opts.skipAudio && beats.length) {
  log("");
  audio = await runAudio(doc, beats, opts.outDir);
  const map = new Map(audio.measured.map((b) => [b.sec, b.start]));
  doc = retime(doc, map);
  const outName = path.basename(scriptPath).replace(/\.mdx?$/i, "") + ".retimed.md";
  await writeFile(path.join(opts.outDir, outName), doc);
  ctx = analyze(doc);
  const est = beats[beats.length - 1].sec;
  const words = beats.reduce((a, b) => a + b.text.split(/\s+/).length, 0);
  manifest.audio = {
    realSeconds: +audio.total.toFixed(2), realClock: cue(audio.total),
    scriptClock: cue(est), wpm: Math.round(words / (audio.total / 60)),
    retimedScript: outName, timeline: audio.measured,
  };
  log(`  เขียนสคริปต์ที่ปรับเวลาแล้ว: ${outName}`);
  log(`  เสียงจริง ${cue(audio.total)} · สคริปต์เขียนไว้ ${cue(est)} · ${manifest.audio.wpm} คำ/นาที`);
}

if (!opts.skipImages && ctx.rows.length) {
  log("");
  manifest.images = opts.provider === "manual"
    ? await runManual(ctx.rows, opts.outDir)
    : await runImages(ctx.rows, opts.outDir);
} else if (!opts.skipImages) {
  log("\n  ! ไม่พบตาราง storyboard — ข้ามขั้นภาพ (ใส่ --make-storyboard เพื่อให้สร้างเอง)");
}

/* Packaging and Shorts run last: both read the finished document, and the
   description they produce should carry the retimed cues, not the estimates. */
const src = await appSource();
if (!opts.skipPack) {
  try {
    log("\n  สร้าง Packaging (title / thumbnail / tags)...");
    const raw = await gemini(doc.slice(0, 14000) + "\n\n---\n\n" + extractTemplate(src, "PACK_INSTRUCTION") + dnaSuffix(dna), 0.9);
    const json = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    await writeFile(path.join(opts.outDir, "packaging.json"), json);
    const parsed = JSON.parse(json);
    manifest.packaging = { titles: parsed.titles?.length ?? 0, thumbnails: parsed.thumbnails?.length ?? 0, tags: parsed.tags?.length ?? 0 };
    log(`    title ${manifest.packaging.titles} · thumbnail ${manifest.packaging.thumbnails} · tag ${manifest.packaging.tags}`);
  } catch (err) { log(`    ✗ ${err.message}`); manifest.packaging = { error: String(err.message) }; }
}

if (!opts.skipShorts) {
  try {
    log("  สร้างสคริปต์ Shorts...");
    const out = await gemini(doc.slice(0, 14000) + "\n\n---\n\n" + extractTemplate(src, "SHORTS_INSTRUCTION") + dnaSuffix(dna), 0.8);
    await writeFile(path.join(opts.outDir, "shorts.md"), out);
    manifest.shorts = { clips: (out.match(/^##\s*Short\s*\d/gim) || []).length, file: "shorts.md" };
    log(`    ${manifest.shorts.clips} คลิป → shorts.md`);
  } catch (err) { log(`    ✗ ${err.message}`); manifest.shorts = { error: String(err.message) }; }
}

/* Phase 4 · viewer simulation. Every check up to here judges the episode by
   its own rules — coverage, holds, mix. None of them says whether a person
   stays. The prompt is written out whatever happens, because this is the one
   step worth running by hand in a chat where you can argue back. */
if (!opts.skipViewerSim) {
  try {
    log("  จำลองผู้ชมสามคน (Phase 4)...");
    const prompt = await viewerSimPrompt(doc, ctx, dna);
    await writeFile(path.join(opts.outDir, "viewer-sim-prompt.txt"), prompt);
    if (process.env.GEMINI_API_KEY) {
      const out = await gemini(prompt, 0.9);
      await writeFile(path.join(opts.outDir, "viewer-sim.md"), out);
      const exits = (out.match(/EXIT POINT\s*:?\s*([^\n]+)/gi) || [])
        .filter((l) => !/watched to the end|ดูจนจบ|จนจบ/i.test(l)).length;
      manifest.viewerSim = { file: "viewer-sim.md", leftEarly: exits };
      log(`    ออกกลางคัน ${exits} คน → viewer-sim.md`);
    } else {
      manifest.viewerSim = { file: "viewer-sim-prompt.txt", leftEarly: null };
      log("    เขียน prompt ไว้แล้ว → viewer-sim-prompt.txt (เอาไปวางใน Claude/ChatGPT)");
    }
  } catch (err) { log(`    ✗ ${err.message}`); manifest.viewerSim = { error: String(err.message) }; }
}

manifest.qcFinal = { total: computeQC(ctx, dna).total };
await writeFile(path.join(opts.outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
log(`\nเสร็จแล้ว → ${opts.outDir}/manifest.json  ·  QC ${manifest.qcFinal.total.toFixed(1)}/10\n`);
