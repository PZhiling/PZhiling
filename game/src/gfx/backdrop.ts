/**
 * Procedural stage backdrops.
 *
 * Each theme composes a few silhouette layers that are rasterised once into
 * offscreen tiles at stage load, then scrolled at different parallax rates.
 * Baking the tiles keeps the per-frame cost to a handful of drawImage calls,
 * which is what makes this hold 60 fps on a mid-range phone.
 *
 * If the asset manifest supplies images for a stage, the renderer uses those
 * instead — these generators are the fallback that ships today.
 */

import { Rng } from '../core/rng';
import type { StageDef } from '../sim/types';
import { hexA, shade } from './rig';

export interface BakedLayer {
  canvas: HTMLCanvasElement;
  parallax: number;
  /** Top edge of the layer in logical pixels. */
  y: number;
  opacity: number;
  additive: boolean;
  /** Horizontal drift per tick, for clouds and mist. */
  drift: number;
}

const TILE_W = 1200;
const VIEW_H = 540;

function makeTile(h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = TILE_W;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

/** A jagged horizon band — mountains, dunes, rooftops depending on params. */
function ridge(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  h: number,
  opts: { base: number; amp: number; step: number; fill: string; jag?: number; snow?: string },
): void {
  const pts: [number, number][] = [];
  let x = -60;
  let y = opts.base;
  while (x < TILE_W + 60) {
    pts.push([x, y]);
    x += opts.step * rng.range(0.6, 1.4);
    y = opts.base + rng.range(-opts.amp, opts.amp);
  }
  // Force the seam to match so the tile repeats without a visible cut.
  pts[pts.length - 1][0] = TILE_W + 60;
  pts[pts.length - 1][1] = pts[0][1];

  ctx.fillStyle = opts.fill;
  ctx.beginPath();
  ctx.moveTo(-60, h);
  for (const [px, py] of pts) ctx.lineTo(px, py);
  ctx.lineTo(TILE_W + 60, h);
  ctx.closePath();
  ctx.fill();

  if (opts.snow) {
    // A lit rim along the ridge line, not detached caps — separate triangles
    // floated free of the peaks whenever the ridge was noisy.
    ctx.strokeStyle = opts.snow;
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [px, py] of pts) ctx.lineTo(px, py);
    ctx.stroke();
  }
}

function buildings(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  h: number,
  opts: { base: number; minH: number; maxH: number; fill: string; window?: string; roof?: 'thai' | 'flat' | 'spire' },
): void {
  let x = -40;
  while (x < TILE_W + 40) {
    const w = rng.range(56, 128);
    const bh = rng.range(opts.minH, opts.maxH);
    const top = opts.base - bh;
    ctx.fillStyle = opts.fill;
    ctx.fillRect(x, top, w, h - top);

    if (opts.roof === 'thai') {
      // Steep multi-tier roof with upturned finials — the silhouette that
      // makes the setting read as Thai without any texture work.
      ctx.beginPath();
      ctx.moveTo(x - 12, top);
      ctx.lineTo(x + w / 2, top - bh * 0.34);
      ctx.lineTo(x + w + 12, top);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = opts.fill;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, top - bh * 0.34);
      ctx.lineTo(x + w / 2, top - bh * 0.5);
      ctx.stroke();
    } else if (opts.roof === 'spire') {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5, top - bh * 0.55);
      ctx.lineTo(x + w * 0.86, top);
      ctx.lineTo(x + w * 0.14, top);
      ctx.closePath();
      ctx.fill();
    }

    if (opts.window) {
      ctx.fillStyle = opts.window;
      for (let wy = top + 16; wy < h - 10; wy += 26) {
        for (let wx = x + 10; wx < x + w - 12; wx += 22) {
          if (rng.chance(0.45)) ctx.fillRect(wx, wy, 8, 12);
        }
      }
    }
    x += w + rng.range(6, 30);
  }
}

function trees(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  h: number,
  opts: { base: number; fill: string; kind: 'bamboo' | 'palm' | 'pine' | 'dead' },
): void {
  let x = -20;
  while (x < TILE_W + 20) {
    const th = rng.range(140, 300);
    const top = opts.base - th;
    ctx.strokeStyle = opts.fill;
    ctx.fillStyle = opts.fill;
    ctx.lineWidth = opts.kind === 'bamboo' ? rng.range(4, 9) : rng.range(6, 14);
    ctx.lineCap = 'round';

    if (opts.kind === 'bamboo') {
      const lean = rng.range(-14, 14);
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.quadraticCurveTo(x + lean * 0.5, (h + top) / 2, x + lean, top);
      ctx.stroke();
      // Leaf clusters near the top.
      for (let i = 0; i < 5; i++) {
        const ly = top + i * 18;
        const dir = i % 2 === 0 ? 1 : -1;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x + lean, ly);
        ctx.quadraticCurveTo(x + lean + dir * 26, ly - 8, x + lean + dir * 44, ly + 4);
        ctx.stroke();
      }
    } else if (opts.kind === 'pine') {
      const pt = opts.base - th * 0.55;
      const halfW = 8 + th * 0.06;
      ctx.beginPath();
      ctx.moveTo(x, opts.base);
      ctx.lineTo(x - halfW, opts.base);
      ctx.lineTo(x, pt);
      ctx.lineTo(x + halfW, opts.base);
      ctx.closePath();
      ctx.fill();
    } else if (opts.kind === 'dead') {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + rng.range(-10, 10), top);
      ctx.stroke();
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const by = top + rng.range(10, 90);
        const dir = rng.chance(0.5) ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(x, by);
        ctx.lineTo(x + dir * rng.range(20, 46), by - rng.range(10, 40));
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.quadraticCurveTo(x + 10, (h + top) / 2, x + 18, top);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x + 18, top);
        ctx.quadraticCurveTo(x + 18 + Math.cos(a) * 40, top + Math.sin(a) * 20, x + 18 + Math.cos(a) * 70, top + 26 + Math.abs(Math.sin(a)) * 20);
        ctx.stroke();
      }
    }
    x += rng.range(opts.kind === 'bamboo' ? 26 : 60, opts.kind === 'bamboo' ? 70 : 150);
  }
}

function clouds(ctx: CanvasRenderingContext2D, rng: Rng, h: number, color: string, count: number): void {
  // Each cloud is a cluster of overlapping soft puffs. One big ellipse reads as
  // a grey blob; five small ones read as a cloud.
  for (let i = 0; i < count; i++) {
    const cx = rng.range(-60, TILE_W + 60);
    const cy = rng.range(24, h - 40);
    const spread = rng.range(50, 130);
    const puffs = rng.int(4, 7);
    for (let j = 0; j < puffs; j++) {
      const px = cx + rng.range(-spread, spread);
      const py = cy + rng.range(-14, 14);
      const r = rng.range(20, 46) * (1 - Math.abs(px - cx) / (spread * 2.2));
      if (r <= 4) continue;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, hexA(color, 0.2));
      g.addColorStop(0.6, hexA(color, 0.09));
      g.addColorStop(1, hexA(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function pillars(ctx: CanvasRenderingContext2D, rng: Rng, h: number, base: number, fill: string, broken: boolean): void {
  let x = rng.range(0, 120);
  while (x < TILE_W + 60) {
    const ph = rng.range(120, 280) * (broken && rng.chance(0.5) ? 0.55 : 1);
    const w = rng.range(22, 40);
    ctx.fillStyle = fill;
    ctx.fillRect(x, base - ph, w, ph + (h - base));
    ctx.fillRect(x - 6, base - ph - 12, w + 12, 12);
    if (!broken) ctx.fillRect(x - 8, base - ph - 22, w + 16, 10);
    x += rng.range(120, 260);
  }
}

export function buildBackdrop(stage: StageDef): BakedLayer[] {
  const rng = new Rng(hashString(stage.id));
  const p = stage.palette;
  const layers: BakedLayer[] = [];

  const add = (h: number, parallax: number, y: number, paint: (ctx: CanvasRenderingContext2D) => void, opacity = 1, additive = false, drift = 0) => {
    const { c, ctx } = makeTile(h);
    paint(ctx);
    layers.push({ canvas: c, parallax, y, opacity, additive, drift });
  };

  const far = shade(p.fog, -0.25);
  const mid = shade(p.fog, -0.45);
  // Derive the nearest silhouette band from the ground *line* colour, not the
  // ground itself: on light stages (snow, desert) a darkened ground is still
  // pale, and the foreground trees vanished into the floor.
  const near = shade(p.groundLine, -0.62);

  switch (stage.theme) {
    case 'village':
      add(240, 0.06, 40, (ctx) => clouds(ctx, rng, 240, p.sun, 8), 0.5, true, 0.06);
      add(260, 0.16, 150, (ctx) => ridge(ctx, rng, 260, { base: 130, amp: 46, step: 150, fill: hexA(far, 0.75) }));
      add(240, 0.34, 200, (ctx) => buildings(ctx, rng, 240, { base: 190, minH: 70, maxH: 150, fill: mid, roof: 'thai', window: hexA('#ffd58a', 0.8) }));
      add(200, 0.62, 268, (ctx) => trees(ctx, rng, 200, { base: 190, fill: near, kind: 'palm' }), 0.95);
      break;

    case 'bamboo':
      add(300, 0.1, 60, (ctx) => clouds(ctx, rng, 300, '#2f6b5a', 6), 0.4, true, 0.03);
      add(360, 0.22, 60, (ctx) => trees(ctx, rng, 360, { base: 350, fill: hexA(far, 0.6), kind: 'bamboo' }));
      add(360, 0.46, 110, (ctx) => trees(ctx, rng, 360, { base: 350, fill: hexA(mid, 0.85), kind: 'bamboo' }));
      add(300, 0.8, 240, (ctx) => trees(ctx, rng, 300, { base: 300, fill: near, kind: 'bamboo' }));
      break;

    case 'market':
      add(240, 0.08, 30, (ctx) => clouds(ctx, rng, 240, '#ffffff', 10), 0.55, true, 0.05);
      add(260, 0.2, 140, (ctx) => ridge(ctx, rng, 260, { base: 150, amp: 30, step: 200, fill: hexA(far, 0.6) }));
      add(230, 0.4, 205, (ctx) => buildings(ctx, rng, 230, { base: 180, minH: 60, maxH: 130, fill: mid, roof: 'thai', window: hexA('#ffe0a0', 0.7) }));
      add(160, 0.72, 300, (ctx) => {
        // Moored boats along the canal edge.
        let x = rng.range(0, 200);
        while (x < TILE_W + 80) {
          const w = rng.range(90, 170);
          ctx.fillStyle = near;
          ctx.beginPath();
          ctx.moveTo(x, 100);
          ctx.quadraticCurveTo(x + w / 2, 130, x + w, 100);
          ctx.lineTo(x + w * 0.9, 92);
          ctx.quadraticCurveTo(x + w / 2, 112, x + w * 0.1, 92);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = hexA('#c8a24a', 0.9);
          ctx.fillRect(x + w * 0.3, 60, w * 0.4, 8);
          x += w + rng.range(60, 200);
        }
      });
      break;

    case 'snowpeak':
      add(260, 0.05, 20, (ctx) => clouds(ctx, rng, 260, '#ffffff', 12), 0.5, true, 0.04);
      add(300, 0.14, 90, (ctx) => ridge(ctx, rng, 300, { base: 120, amp: 80, step: 130, fill: hexA(far, 0.7), snow: hexA('#ffffff', 0.55) }));
      add(280, 0.3, 170, (ctx) => ridge(ctx, rng, 280, { base: 110, amp: 60, step: 110, fill: mid, snow: hexA('#eaf4ff', 0.75) }));
      add(220, 0.6, 280, (ctx) => trees(ctx, rng, 220, { base: 210, fill: near, kind: 'pine' }));
      break;

    case 'desert':
      add(240, 0.06, 40, (ctx) => clouds(ctx, rng, 240, p.sun, 5), 0.45, true, 0.02);
      add(260, 0.16, 160, (ctx) => ridge(ctx, rng, 260, { base: 150, amp: 40, step: 240, fill: hexA(far, 0.6) }));
      add(260, 0.36, 210, (ctx) => pillars(ctx, rng, 260, 230, mid, true));
      add(200, 0.66, 300, (ctx) => ridge(ctx, rng, 200, { base: 120, amp: 26, step: 190, fill: near }));
      break;

    case 'lava':
      add(240, 0.1, 40, (ctx) => clouds(ctx, rng, 240, '#ff6a2a', 8), 0.5, true, 0.05);
      add(280, 0.2, 130, (ctx) => ridge(ctx, rng, 280, { base: 120, amp: 70, step: 120, fill: hexA(far, 0.85), jag: 1 }));
      add(260, 0.42, 200, (ctx) => {
        ridge(ctx, rng, 260, { base: 110, amp: 60, step: 100, fill: mid, jag: 1 });
        // Lava seams glowing through the rock.
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 26; i++) {
          const x = rng.range(0, TILE_W);
          const y = rng.range(150, 250);
          const g = ctx.createRadialGradient(x, y, 0, x, y, 40);
          g.addColorStop(0, 'rgba(255,140,40,0.55)');
          g.addColorStop(1, 'rgba(255,60,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 40, y - 40, 80, 80);
        }
        ctx.globalCompositeOperation = 'source-over';
      });
      add(180, 0.75, 330, (ctx) => trees(ctx, rng, 180, { base: 170, fill: '#160a08', kind: 'dead' }));
      break;

    case 'temple':
      add(260, 0.08, 20, (ctx) => clouds(ctx, rng, 260, '#8fa8c8', 10), 0.6, false, 0.08);
      add(280, 0.22, 130, (ctx) => ridge(ctx, rng, 280, { base: 140, amp: 34, step: 200, fill: hexA(far, 0.7) }));
      add(280, 0.4, 170, (ctx) => buildings(ctx, rng, 280, { base: 230, minH: 110, maxH: 210, fill: mid, roof: 'thai' }));
      add(240, 0.7, 280, (ctx) => pillars(ctx, rng, 240, 200, near, true));
      break;

    case 'skycity':
      add(280, 0.04, 10, (ctx) => clouds(ctx, rng, 280, '#ffffff', 16), 0.65, true, 0.1);
      add(300, 0.18, 80, (ctx) => buildings(ctx, rng, 300, { base: 260, minH: 120, maxH: 250, fill: hexA(far, 0.7), roof: 'spire' }));
      add(300, 0.38, 150, (ctx) => buildings(ctx, rng, 300, { base: 250, minH: 100, maxH: 220, fill: mid, roof: 'spire', window: hexA('#ffeebb', 0.8) }));
      add(220, 0.7, 300, (ctx) => clouds(ctx, rng, 220, '#e8f0ff', 12), 0.75, false, 0.16);
      break;

    case 'fortress':
      add(260, 0.08, 20, (ctx) => clouds(ctx, rng, 260, '#5a2a80', 10), 0.5, true, 0.04);
      add(300, 0.2, 110, (ctx) => ridge(ctx, rng, 300, { base: 140, amp: 60, step: 140, fill: hexA(far, 0.8), jag: 1 }));
      add(300, 0.4, 150, (ctx) => buildings(ctx, rng, 300, { base: 270, minH: 150, maxH: 270, fill: mid, roof: 'spire', window: hexA('#c88bff', 0.7) }));
      add(240, 0.72, 290, (ctx) => pillars(ctx, rng, 240, 200, near, false));
      break;

    case 'astral':
      add(300, 0.03, 0, (ctx) => {
        for (let i = 0; i < 260; i++) {
          const x = rng.range(0, TILE_W);
          const y = rng.range(0, 300);
          const r = rng.range(0.4, 1.8);
          ctx.fillStyle = hexA('#ffffff', rng.range(0.25, 0.95));
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        // A nebula wash so the sky is not just dots.
        for (let i = 0; i < 5; i++) {
          const x = rng.range(0, TILE_W);
          const y = rng.range(40, 240);
          const g = ctx.createRadialGradient(x, y, 0, x, y, 220);
          g.addColorStop(0, hexA(rng.pick(['#5a3ad0', '#2a6ad0', '#8a3ad0']), 0.3));
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 220, y - 220, 440, 440);
        }
      }, 1, true, 0.01);
      add(300, 0.18, 120, (ctx) => ridge(ctx, rng, 300, { base: 150, amp: 70, step: 160, fill: hexA(far, 0.75), jag: 1 }));
      add(300, 0.42, 160, (ctx) => pillars(ctx, rng, 300, 260, mid, false), 0.95);
      add(220, 0.74, 300, (ctx) => pillars(ctx, rng, 220, 190, near, true));
      break;

    default:
      add(260, 0.2, 150, (ctx) => ridge(ctx, rng, 260, { base: 140, amp: 40, step: 160, fill: hexA(far, 0.7) }));
      break;
  }

  return layers;
}

/** Sky is a gradient plus a sun disc; cheap and re-drawn every frame. */
export function drawSky(ctx: CanvasRenderingContext2D, stage: StageDef, w: number, h: number, camX: number, time: number): void {
  const p = stage.palette;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, p.skyTop);
  g.addColorStop(0.72, p.skyBottom);
  g.addColorStop(1, shade(p.skyBottom, 0.08));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const sunX = w * 0.72 - camX * 0.02;
  const sunY = h * 0.3;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, h * 0.62);
  glow.addColorStop(0, hexA(p.sun, 0.5));
  glow.addColorStop(0.35, hexA(p.sun, 0.14));
  glow.addColorStop(1, hexA(p.sun, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = hexA(p.sun, 0.85);
  ctx.beginPath();
  ctx.arc(sunX, sunY, h * 0.045 + Math.sin(time * 0.01) * 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
