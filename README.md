# YT Faceless Podcast SEO Master

AI tool that analyzes SEO gaps and generates full **YouTube Faceless Podcast**
content — niche/keyword analysis, topic selection, a human-sounding voiceover
script, a visual/B-Roll storyboard, and an SEO-optimized description — to drive
traffic back to a website.

The assistant replies in **Thai** (analysis, tables, guidance) while the
generated YouTube assets (title, script, description) are written in
**English**, tuned to read as human-written and avoid YouTube's
inauthentic/repetitive-content patterns.

## Features

- **SEO gap & competitor analysis** with keyword difficulty / opportunity
  scoring rendered as sortable tables and a heatmap.
- **Long-tail keyword suggestions** and a weekly **trending niche** finder.
- **Faceless podcast script generation** with dense timestamps for pacing.
- **Visual storyboard / B-Roll guide**, including copy-ready
  *Google Flow* image prompts (NotebookLM "Analytical Indigo" style).
- **AI auto-fix** for missing visuals, missing prompts, and long visual-freeze
  gaps in the storyboard.
- **Import a hand-edited script** (`.md` / `.txt`) and carry on from there. A
  bare script is wrapped as Phase 3 and its production notes are parked in
  Phase 1, so they never inflate the word count or the duration estimate; the
  B-Roll tab then offers to build the Phase 2 storyboard from the script's own
  timestamps, using the same visual rules as the master prompt.
- **Text-to-Speech** preview via Google Cloud TTS, synthesised one beat per
  timestamp so each cue's real duration is measured rather than assumed. One
  button then rewrites the script, storyboard and description timestamps to the
  audio that actually exists; a proportional fallback covers a voiceover
  recorded elsewhere.
- Export to Markdown (`.md`), script (`.txt`), and B-Roll guide (`.csv`).
- Client-side persistence: input draft, result, history, and competitor
  watchlist are saved in `localStorage`.

## Produce an episode without a browser

`scripts/produce.mjs` runs the pipeline on a machine instead of in a tab, which
is what a 74-beat episode needs: nothing dies when a phone locks, images do not
compete with the browser's storage quota, and every artefact is written to disk
as it is produced, so an interrupted run resumes instead of restarting.

```bash
export GOOGLE_TTS_API_KEY=... GEMINI_API_KEY=...   # OPENAI_API_KEY for --provider openai
node scripts/produce.mjs plans/scripts/ep01-the-competence-trap.md
```

It splits the script on its cues, synthesises one audio file per beat, measures
each one, and rewrites the script, storyboard and description timestamps onto
the real audio.

Images stop short of the API by default. An episode is 74 frames, and a ChatGPT
subscription generates them at no per-image cost while the API bills each one,
so `--provider manual` writes a prompt pack instead: batches of up to eight
images per message, never cutting through an ANCHOR run, with each continuation
frame phrased as "the same scene as image N" so the motif holds inside one chat.
`images/manual/README.md` says which file to save each result as, and a later
run reports what is still missing. `--provider gemini` or `openai` generates
through the API instead, chaining a reference frame through each ANCHOR run.

| Flag | |
| --- | --- |
| `--qc-min <n>` | stop before spending anything if the QC score is below `<n>` |
| `--qc-only`, `--dna <file>` | score and exit; supply the Brand DNA whose banned words count |
| `--make-storyboard` | build the Phase 2 table from the script's own cues |
| `--provider manual` | **default** — write a ChatGPT prompt pack instead of calling an image API |
| `--provider gemini\|openai` | generate through the API: `gemini-2.5-flash-image` or `gpt-image-2` |
| `--only-anchors`, `--limit n` | narrow a run — useful for comparing providers on one ANCHOR run |
| `--voice`, `--delay`, `--out` | TTS voice, pause between image calls, output directory |
| `--skip-audio`, `--skip-images`, `--force` | run one half, or regenerate what is cached |

The QC Gate runs first, before a single call is made — an episode that is not
ready costs 74 TTS calls and 74 image calls to discover any later. It scores the
same eight checks as the Studio's QC panel; `scripts/test-qc-parity.mjs` lifts
the app's own scoring functions out of the HTML and asserts the two agree, so
the CLI gate cannot quietly drift from the panel it is named after. Packaging
and Shorts run last, against the retimed document, and the prompts for all three
are read out of `artifact/podcast-seo-studio.html` at run time rather than
copied.

Output lands in `out/<script>/`: per-beat audio, a concatenated `voiceover.mp3`,
`images/<provider>/`, the retimed script, `packaging.json`, `shorts.md`, and
`manifest.json` with the measured timeline and the QC score before and after.
MP3 durations are read from frame headers, so ffmpeg is not required.

## Architecture

- **Client** — React 19 + Vite + TypeScript + Tailwind CSS v4.
- **Server** — Express (`server.ts`) that serves the app and proxies AI calls:
  - `POST /api/gemini` — content generation via `@google/genai`.
  - `POST /api/tts` — Google Cloud Text-to-Speech.
  - `GET  /api/health` — health check.

### Security: keys stay server-side

Gemini requests are proxied through `POST /api/gemini`, so `GEMINI_API_KEY` is
read **only on the server** and is never injected into the client bundle. The
browser sends the prompt payload; the server attaches the key and calls Gemini.
This matches the `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` capability declared
in `metadata.json`.

## Run locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env.local` (see `.env.example`) and set your keys:
   ```bash
   GEMINI_API_KEY="your-gemini-key"
   GOOGLE_TTS_API_KEY="your-google-cloud-tts-key"  # optional, for TTS
   ```
3. Start the dev server (Express + Vite middleware):
   ```bash
   npm run dev
   ```
   Then open http://localhost:3000

## Use on an Android tablet

**No computer at all?** See **[TABLET-SETUP.md](TABLET-SETUP.md)** (ภาษาไทย) —
covers running the app entirely on the tablet via Termux (prebuilt `dist/`,
pure-JS runtime deps only) and the zero-install AI Studio / Cloud Run route.

## PWA / same-network access

The app is a responsive PWA — it installs to the home screen and runs
full-screen like a native app. The server must stay reachable from the tablet
because AI calls are proxied through it.

**Option A — same Wi-Fi network (quickest):**

1. Run the app on your computer (`npm run dev` or `npm start`).
2. The console prints a network URL, e.g. `On your network (wlan0): http://192.168.1.20:3000`.
3. Open that URL in Chrome on the tablet.
4. Menu (⋮) → **Add to Home screen** to pin it as an app icon.

> Note: over plain `http://` on a LAN, Chrome adds a home-screen *shortcut*.
> The full "install app" experience (standalone window, app icon from the
> manifest) requires HTTPS.

**Option B — deploy to the cloud (use from anywhere, full PWA install):**

Deploy to any Node host with HTTPS (Cloud Run via AI Studio, Railway,
Render, ...). Set `GEMINI_API_KEY` (and optionally `GOOGLE_TTS_API_KEY`)
as server environment variables, then open the HTTPS URL on the tablet —
Chrome will offer **Install app**.

## Build & production

```bash
npm run build   # vite build + bundle server to dist/server.cjs
npm start       # NODE_ENV=production node dist/server.cjs
```

## Deploy to Cloud Run

The repo ships a multi-stage `Dockerfile` (runtime image contains only the
pure-JS production deps + `dist/`). In Cloud Run, choose *Continuously
deploy from a repository*, point it at this repo/branch, pick **Dockerfile**
as the build type, and set `GEMINI_API_KEY` (and optionally
`GOOGLE_TTS_API_KEY`) as service environment variables. The server reads
`PORT` from the environment as Cloud Run requires. Buildpacks also work —
`package.json` has a `gcp-build` script. Step-by-step tablet instructions:
[TABLET-SETUP.md](TABLET-SETUP.md).

## Zhiling Agent Core (`agent/`)

A separate, self-contained agent runtime that lives alongside the web app: a
routed inference layer with automatic failover and a cost budget, a typed
lifecycle hook bus, a permission broker with rule matching and scoped grants,
content-addressed session state, and a tool loop that always reports why it
stopped.

It has **no runtime dependencies** and needs no build step — Node 22+ runs the
TypeScript directly:

```bash
npm run agent:test                       # 85 tests, offline and deterministic
npm run agent:demo -- "summarise this repo"
```

Set `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` or `OPENAI_API_KEY` to route to a
real provider; with none set it runs against a scripted offline provider.

See [agent/README.md](agent/README.md) for the API and
[agent/ARCHITECTURE.md](agent/ARCHITECTURE.md) for the layer map and the design
rationale.

## Scripts

| Script          | Description                                 |
| --------------- | ------------------------------------------- |
| `npm run dev`   | Run the Express server with Vite middleware |
| `npm run build` | Build the client and bundle the server      |
| `npm start`     | Serve the production build                  |
| `npm run lint`  | Type-check with `tsc --noEmit`              |
| `npm run clean` | Remove the `dist/` directory                |
