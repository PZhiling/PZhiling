# Generated assets go here

Drop images, music and sound effects into the folders beside this file, then
list them in `manifest.json` (start from `manifest.example.json`).

Anything not listed keeps using the version the game draws in code, so the
swap can happen one file at a time.

Full spec and the generation prompts: [`docs/GAME-ASSETS.md`](../../../docs/GAME-ASSETS.md)

    portraits/   512×512 PNG, one per character   → character select
    characters/  sprite sheets                    → in-game fighters
    stages/      1920×540 seamless PNG layers     → parallax backdrops
    music/       loopable MP3/OGG, one per stage
    sfx/         short WAV/OGG, one per sound id
