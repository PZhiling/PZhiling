#!/usr/bin/env sh
# Wraps the single-source app (artifact/podcast-seo-studio.html) into a
# complete HTML document under docs/ for GitHub Pages, and copies the PWA
# icons. Run after editing the artifact file to keep both in sync.
set -e
cd "$(dirname "$0")/.."

# The Studio carries the youtube-viewer-sim skill inline for Phase 4. The skill
# files under .claude/skills/ are the source; this copies them in before the
# page is built so the two can never disagree.
node scripts/sync-skill.mjs

mkdir -p docs/icons
cp public/icons/icon-192.png public/icons/icon-512.png \
   public/icons/icon-maskable-512.png public/icons/apple-touch-icon.png docs/icons/

{
  cat <<'HEAD'
<!doctype html>
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
HEAD
  # drop the first line (<title>) — the head above already has one
  tail -n +2 artifact/podcast-seo-studio.html
  printf '</body>\n</html>\n'
} > docs/index.html

echo "docs/index.html generated ($(wc -c < docs/index.html) bytes)"
