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
- **Text-to-Speech** preview via Google Cloud TTS.
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

## Build & production

```bash
npm run build   # vite build + bundle server to dist/server.cjs
npm start       # NODE_ENV=production node dist/server.cjs
```

## Scripts

| Script          | Description                                 |
| --------------- | ------------------------------------------- |
| `npm run dev`   | Run the Express server with Vite middleware |
| `npm run build` | Build the client and bundle the server      |
| `npm start`     | Serve the production build                  |
| `npm run lint`  | Type-check with `tsc --noEmit`              |
| `npm run clean` | Remove the `dist/` directory                |
