/**
 * Asset swap layer.
 *
 * The game is fully playable with zero art files: every fighter, backdrop and
 * effect is drawn procedurally. This module is the seam where generated art
 * takes over. Drop images into `public/assets/`, list them in
 * `public/assets/manifest.json`, and the renderer prefers them automatically —
 * per character, per pose, per stage layer. Anything not listed keeps using
 * the code-drawn version, so the swap can happen one sprite at a time instead
 * of as one big-bang import.
 *
 * See docs/GAME-ASSETS.md for the manifest schema and the generation prompts.
 */

export interface SpriteSheetDef {
  src: string;
  frameW: number;
  frameH: number;
  /** Columns in the sheet; rows are inferred. */
  cols: number;
  /** Where the fighter's feet sit inside a frame, as a 0–1 fraction. */
  anchorX?: number;
  anchorY?: number;
  /** Sheet pixels per world unit. 1 means a 74px-tall sprite is a 74-unit body. */
  ppu?: number;
  /** Maps a pose id to one or more frame indices (looped if several). */
  poses: Record<string, number[]>;
}

export interface StageLayerDef {
  src: string;
  /** 0 = pinned to the camera, 1 = moves with the world. */
  parallax: number;
  /** Vertical placement in logical pixels, from the top. */
  y: number;
  /** Repeat horizontally to fill the stage. */
  repeat?: boolean;
  scale?: number;
  opacity?: number;
  /** Additive layers read as light shafts and glow. */
  additive?: boolean;
}

/**
 * A frame-by-frame effect animation that replaces one procedural effect
 * wholesale — list `impact` here and every punch that lands plays your sheet
 * instead of the code-drawn spark burst.
 */
export interface EffectSheetDef {
  src: string;
  frameW: number;
  frameH: number;
  cols: number;
  /** Frames to play. Defaults to every cell in the sheet. */
  frames?: number;
  /** Ticks each frame is held. 2 gives 30 fps playback. */
  hold?: number;
  /** World units the sheet spans at scale 1. */
  size?: number;
  /** Additive suits fire and light; leave off for smoke, dust and debris. */
  additive?: boolean;
  /** Mirror the sheet to match the direction the attacker faces. */
  flip?: boolean;
}

export interface AssetManifest {
  characters?: Record<string, SpriteSheetDef>;
  /** Optional portraits for the character-select screen. */
  portraits?: Record<string, string>;
  stages?: Record<string, { layers: StageLayerDef[] }>;
  /** Keyed by the effect ids the simulation emits (impact, fireBurst, …). */
  effects?: Record<string, EffectSheetDef>;
  /**
   * Single images keyed by id. Skill icons use the action id (`flameSlash`),
   * pickups use `pickup-heal` / `pickup-mana` / `pickup-knife` / `pickup-stick`.
   */
  icons?: Record<string, string>;
  music?: Record<string, string>;
  sfx?: Record<string, string>;
}

const BASE = 'assets/';

export class AssetStore {
  manifest: AssetManifest = {};
  private images = new Map<string, HTMLImageElement>();
  private failed = new Set<string>();
  loaded = false;

  async load(): Promise<void> {
    try {
      const res = await fetch(`${BASE}manifest.json`, { cache: 'no-cache' });
      if (res.ok) this.manifest = (await res.json()) as AssetManifest;
    } catch {
      // No manifest is the expected default — stay fully procedural.
      this.manifest = {};
    }
    this.loaded = true;
    void this.prefetch();
  }

  /** Warm the cache for everything the manifest mentions, without blocking. */
  private async prefetch(): Promise<void> {
    const urls: string[] = [];
    for (const c of Object.values(this.manifest.characters ?? {})) urls.push(c.src);
    for (const p of Object.values(this.manifest.portraits ?? {})) urls.push(p);
    for (const e of Object.values(this.manifest.effects ?? {})) urls.push(e.src);
    for (const i of Object.values(this.manifest.icons ?? {})) urls.push(i);
    for (const s of Object.values(this.manifest.stages ?? {})) {
      for (const l of s.layers) urls.push(l.src);
    }
    for (const u of urls) this.image(u);
  }

  /** Returns the image if it is already decoded, and kicks off a load if not. */
  image(src: string): HTMLImageElement | null {
    if (!src || this.failed.has(src)) return null;
    const cached = this.images.get(src);
    if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
    const img = new Image();
    img.onerror = () => this.failed.add(src);
    img.src = src.startsWith('http') || src.startsWith('/') ? src : BASE + src;
    this.images.set(src, img);
    return null;
  }

  characterSheet(charId: string): SpriteSheetDef | null {
    return this.manifest.characters?.[charId] ?? null;
  }

  portrait(charId: string): HTMLImageElement | null {
    const src = this.manifest.portraits?.[charId];
    return src ? this.image(src) : null;
  }

  /** The atlas for an effect id, or null to keep the procedural version. */
  effectSheet(kind: string): EffectSheetDef | null {
    return this.manifest.effects?.[kind] ?? null;
  }

  icon(id: string): HTMLImageElement | null {
    const src = this.manifest.icons?.[id];
    return src ? this.image(src) : null;
  }

  stageLayers(stageId: string): StageLayerDef[] {
    return this.manifest.stages?.[stageId]?.layers ?? [];
  }

  musicUrl(stageId: string): string | null {
    const src = this.manifest.music?.[stageId];
    return src ? (src.startsWith('http') ? src : BASE + src) : null;
  }

  sfxUrl(id: string): string | null {
    const src = this.manifest.sfx?.[id];
    return src ? (src.startsWith('http') ? src : BASE + src) : null;
  }
}

export const assets = new AssetStore();
