#!/usr/bin/env node
/* Wrap the single-source app (artifact/podcast-seo-studio.html) into a complete
 * HTML document under docs/ for GitHub Pages, and copy the PWA icons. Run after
 * editing the artifact to keep both in sync: npm run build:pages
 *
 * This is the only implementation. build-pages.sh calls it, so the shell entry
 * point still works and there is no second copy of these rules to drift.
 */

/* The Studio carries the youtube-viewer-sim skill inline for Phase 4. The files
   under .claude/skills/ are the source; syncing first means the page can never
   be built from a prompt that has drifted from the skill. */
import './sync-skill.mjs';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

const HEAD = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https://i.ytimg.com data: blob:; media-src blob: data:; connect-src https://generativelanguage.googleapis.com https://texttospeech.googleapis.com https://www.googleapis.com; object-src 'none'; base-uri 'none'; form-action 'none'" />
<meta name="theme-color" content="#17181a" />
<meta name="description" content="สตูดิโอสร้างคอนเทนต์ YouTube Faceless Podcast: Prompt + Brand DNA + QC Gate + Storyboard + TTS" />
<title>Podcast SEO Studio</title>
<link rel="manifest" href="manifest.webmanifest" />
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png" />
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />
</head>
<body>
`;

const ICONS = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

const source = await readFile(new URL('artifact/podcast-seo-studio.html', root), 'utf8');
// drop the first line (<title>) — HEAD already carries one
const body = source.slice(source.indexOf('\n') + 1);
const page = HEAD + body + '</body>\n</html>\n';

await mkdir(new URL('docs/icons/', root), { recursive: true });
for (const name of ICONS) {
  await copyFile(new URL('public/icons/' + name, root), new URL('docs/icons/' + name, root));
}
await writeFile(new URL('docs/index.html', root), page);

console.log(`docs/index.html generated (${Buffer.byteLength(page, 'utf8')} bytes)`);
