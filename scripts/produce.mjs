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
 *   --provider gemini|openai   image model (default gemini)
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
import { splitText, fingerprint } from './production-utils.mjs';

/* ── arguments ───────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const VALUE_FLAGS = new Set(["provider", "voice", "out", "limit", "delay"]);
const BOOL_FLAGS = new Set(['only-anchors', 'skip-audio', 'skip-images', 'force', 'dry-run', 'help']);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) { positional.push(a); continue; }
  const name = a.slice(2);
  if (VALUE_FLAGS.has(name)) {
    if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value for --${name}`);
    flags[name] = argv[++i];
  } else if (BOOL_FLAGS.has(name)) flags[name] = true;
  else throw new Error(`Unknown option --${name}`);
}
const flag = (name, fallback) => (flags[name] === undefined ? fallback : flags[name]);
const has = (name) => flags[name] === true;
const scriptPath = positional[0];

if (!scriptPath || has('help')) {
  console.error("ใช้: node scripts/produce.mjs <script.md> [--provider gemini|openai] [--only-anchors] [--limit n]");
  console.log('Options: --provider gemini|openai --voice NAME --out DIR --limit N --delay MS --only-anchors --skip-audio --skip-images --force --dry-run');
  process.exit(has('help') ? 0 : 1);
}
if (positional.length !== 1) throw new Error('Expected exactly one script file');
for (const name of ['limit', 'delay']) {
  if (flags[name] !== undefined && (!/^\d+$/.test(flags[name]) || !Number.isSafeInteger(Number(flags[name])))) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
}

const opts = {
  provider: flag("provider", "gemini"),
  voice: flag("voice", "en-US-Journey-D"),
  outDir: flag("out", path.join("out", path.basename(scriptPath).replace(/\.mdx?$/i, ""))),
  onlyAnchors: has("only-anchors"),
  limit: Number(flag("limit", 0)) || 0,
  delay: Number(flag("delay", 3000)),
  skipAudio: has("skip-audio"),
  skipImages: has("skip-images"),
  force: has("force"),
};
if (!["gemini", "openai"].includes(opts.provider)) {
  console.error(`--provider ต้องเป็น gemini หรือ openai (ได้รับ "${opts.provider}")`);
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

function narrationBeats(doc) {
  const lines = doc.split("\n");
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

/* ── storyboard table — same column resolution as the Studio ─────────────── */
const isTableLine = (l) => /\|/.test(l) && l.trim().length > 2;
const splitRow = (l) => l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
const isSepRow = (cells) => cells.every((c) => /^:?-{2,}:?$/.test(c));

function storyboardRows(doc) {
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
    };
  });
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
    if (i + frameLen > buf.length) throw new Error('Truncated MP3 frame');
    seconds += samples / sampleRate;
    frames++;
    i += frameLen;
  }
  if (!frames) throw new Error("อ่านเฟรม MP3 ไม่ได้ ไฟล์อาจเสีย");
  return seconds;
}

/* ── text to speech, one file per beat ───────────────────────────────────── */
async function synthBeat(text, voice, key) {
  const chunks = splitText(text);
  if (chunks.length > 1) {
    const audio = [];
    for (const chunk of chunks) audio.push(await synthBeat(chunk, voice, key));
    return Buffer.concat(audio);
  }
  const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    signal: AbortSignal.timeout(120000),
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
  if (typeof data.audioContent !== 'string' || !data.audioContent) throw new Error('No audio content returned');
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
    const cacheKey = fingerprint({ text: beats[i].text, voice: opts.voice, version: 2 });
    const metaFile = file + '.sha256';
    let buf;
    if (!opts.force && existsSync(file) && await readFile(metaFile, 'utf8').catch(() => '') === cacheKey) { buf = await readFile(file); cached++; }
    else {
      process.stdout.write(`\r  พากย์ ${i + 1}/${beats.length} ...`);
      buf = await synthBeat(beats[i].text, opts.voice, key);
      mp3Seconds(buf);
      await writeFile(file, buf);
      await writeFile(metaFile, cacheKey);
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
      signal: AbortSignal.timeout(120000),
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
      signal: AbortSignal.timeout(120000),
      method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form,
    });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      signal: AbortSignal.timeout(120000),
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-image-2", prompt: prompt + SAFETY, size: OPENAI_SIZE }),
    });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  const first = data?.data?.[0];
  if (first?.b64_json) return Buffer.from(first.b64_json, "base64");
  if (first?.url) {
    const download = await fetch(first.url, { signal: AbortSignal.timeout(120000) });
    if (!download.ok) throw new Error(`Image download HTTP ${download.status}`);
    return Buffer.from(await download.arrayBuffer());
  }
  throw new Error("ไม่ได้ภาพกลับมาจาก OpenAI");
}

const IMAGE_PROVIDERS = { gemini: imageGemini, openai: imageOpenAI };

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
    const prompt = rows[i].prompt || rows[i].visual;
    const cacheKey = fingerprint({ prompt, provider: opts.provider, reference: chainFrom[i] && prev ? fingerprint(prev.toString('base64')) : null, version: 2 });
    const metaFile = file + '.sha256';
    if (!opts.force && existsSync(file) && await readFile(metaFile, 'utf8').catch(() => '') === cacheKey) { prev = await readFile(file); cached++; continue; }
    if (!prompt) { failed.push(`${rows[i].ts} — ไม่มี prompt`); prev = null; continue; }
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      process.stdout.write(`\r  ภาพ ${i + 1}/${rows.length} ${rows[i].ts}${attempt > 1 ? ` (ครั้งที่ ${attempt})` : ""} ...`);
      try {
        const buf = await gen(prompt, chainFrom[i] ? prev : null);
        await writeFile(file, buf);
        await writeFile(metaFile, cacheKey);
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

/* ── main ────────────────────────────────────────────────────────────────── */
const doc = await readFile(scriptPath, "utf8");
const beats = narrationBeats(doc);
const rows = storyboardRows(doc);
if (!opts.skipAudio && !beats.length) throw new Error('No narration beats found; use --skip-audio for image-only work');
if (!opts.skipImages && !rows.length) throw new Error('No storyboard found; use --skip-images for audio-only work');
if (has('dry-run')) {
  log(JSON.stringify({ beats: beats.length, storyboardRows: rows.length, provider: opts.provider, outDir: opts.outDir, skipAudio: opts.skipAudio, skipImages: opts.skipImages }, null, 2));
  process.exit(0);
}
for (const key of [!opts.skipAudio && 'GOOGLE_TTS_API_KEY', !opts.skipImages && (opts.provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY')].filter(Boolean)) {
  if (!process.env[key] || process.env[key] === '...') throw new Error(`Missing ${key}`);
}
await mkdir(opts.outDir, { recursive: true });

log(`\n${path.basename(scriptPath)}`);
log(`  บีต ${beats.length} · แถว storyboard ${rows.length} · provider ${opts.provider} · เสียง ${opts.voice}`);
log(`  เขียนลง ${opts.outDir}\n`);
if (!beats.length) log("  ! ไม่พบ timestamp [M:SS] ในสคริปต์ — ข้ามขั้นเสียง");

const manifest = {
  script: scriptPath, generatedAt: new Date().toISOString(),
  provider: opts.provider, voice: opts.voice,
  beats: beats.length, storyboardRows: rows.length,
};

let audio = null;
if (!opts.skipAudio && beats.length) {
  audio = await runAudio(doc, beats, opts.outDir);
  const map = new Map(audio.measured.map((b) => [b.sec, b.start]));
  const retimed = retime(doc, map);
  const outName = path.basename(scriptPath).replace(/\.mdx?$/i, "") + ".retimed.md";
  await writeFile(path.join(opts.outDir, outName), retimed);
  const est = beats.length ? beats[beats.length - 1].sec : 0;
  const words = beats.reduce((a, b) => a + b.text.split(/\s+/).length, 0);
  manifest.audio = {
    realSeconds: +audio.total.toFixed(2), realClock: cue(audio.total),
    scriptClock: cue(est), wpm: Math.round(words / (audio.total / 60)),
    retimedScript: outName, timeline: audio.measured,
  };
  log(`  เขียนสคริปต์ที่ปรับเวลาแล้ว: ${outName}`);
  log(`  เสียงจริง ${cue(audio.total)} · สคริปต์เขียนไว้ ${cue(est)} · ${manifest.audio.wpm} คำ/นาที`);
}

if (!opts.skipImages && rows.length) {
  // Images key off the storyboard rows, so retiming the cues does not change
  // which frame goes where — only when it appears.
  manifest.images = await runImages(rows, opts.outDir);
} else if (!opts.skipImages) {
  log("  ! ไม่พบตาราง storyboard ในสคริปต์ — ข้ามขั้นภาพ");
}

await writeFile(path.join(opts.outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
if (manifest.images?.failed.length) {
  process.exitCode = 1;
  log(`\nงานยังไม่ครบ → ${opts.outDir}/manifest.json\n`);
} else log(`\nเสร็จแล้ว → ${opts.outDir}/manifest.json\n`);
