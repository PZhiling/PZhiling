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

## Scripts

| Script          | Description                                 |
| --------------- | ------------------------------------------- |
| `npm run dev`   | Run the Express server with Vite middleware |
| `npm run build` | Build the client and bundle the server      |
| `npm start`     | Serve the production build                  |
| `npm run lint`  | Type-check with `tsc --noEmit`              |
| `npm run clean` | Remove the `dist/` directory                |
