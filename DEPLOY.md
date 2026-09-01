# Deploying this repo

`main` is the production branch. Two surfaces publish from it, and **neither of
them builds anything** — both serve `docs/` exactly as it sits in the tree.

| Surface | Serves | Trigger |
|---|---|---|
| GitHub Pages — `pzhiling.github.io/PZhiling/` | `main` → `/docs` | automatic on push to `main` |
| Cloudflare Worker — `podcast-seo-studio` | local `./docs` at the moment you run it | **manual**, `npx wrangler deploy` |

The Vite app under `src/` is a separate thing. `npm run build` produces `dist/`,
which **is not published by either surface** — see the note at the top of
`wrangler.toml`. Editing `src/App.tsx` will never change the live site.

## Shipping a change

```bash
git checkout main
git pull
# ...edit docs/... , commit
git push                    # GitHub Pages updates on its own, ~1-2 min
npx wrangler deploy         # Cloudflare does not. Run this too.
```

## Before you deploy to Cloudflare

`wrangler deploy` uploads whatever is in your working tree right now, not what
is on the remote. On the wrong branch, or without pulling, it will happily
publish a stale `docs/`. Check first:

```bash
git branch --show-current   # expect: main
git status --short          # expect: clean
```

## After deploying

The site registers a service worker (`manifest.webmanifest`), so a normal
reload can serve the cached old page. Hard-refresh (Ctrl/Cmd + Shift + R), or
open it in a private window, before concluding a deploy did not work.

## Branches not merged into main

Both are self-contained features parked outside production. Merge them
deliberately, not by accident:

- `claude/grok-bot-architecture-xrfsbp` — Zhiling Agent Core under `agent/`.
  Does not touch `docs/`, so merging it would not change the live site.
- `claude/little-fighter-2-game-hfi0dn` — a fighting game under `game/`, plus
  `docs/prompt-kit.html`. This one **does** add a page to the published site.
