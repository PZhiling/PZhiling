/**
 * Input layer.
 *
 * Everything downstream consumes a `Command` — a tiny, serialisable struct.
 * Keyboard, touch and AI all produce the same shape, which is what lets the
 * simulation stay unaware of where a decision came from (and what makes an
 * input-relay netcode a drop-in later).
 */

import type { Command } from '../sim/types';
import { clamp } from './math';

export function emptyCommand(): Command {
  return {
    mx: 0,
    mz: 0,
    attack: false,
    jump: false,
    defend: false,
    attackHeld: false,
    defendHeld: false,
    skill: -1,
    run: false,
  };
}

interface RawState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  attack: boolean;
  jump: boolean;
  defend: boolean;
  skills: [boolean, boolean, boolean, boolean];
}

function emptyRaw(): RawState {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    attack: false,
    jump: false,
    defend: false,
    skills: [false, false, false, false],
  };
}

const DOUBLE_TAP_WINDOW = 16; // ticks

/**
 * Turns a held/released raw state into edge-triggered commands and detects the
 * double-tap that starts a run.
 */
export class PadState {
  raw: RawState = emptyRaw();
  private prev: RawState = emptyRaw();
  private lastTapDir = 0;
  private lastTapAge = 999;
  /** Set while a run is active, cleared by the sim when the run ends. */
  runLatched = false;

  poll(): Command {
    const cmd = emptyCommand();
    const r = this.raw;
    const p = this.prev;

    cmd.mx = (r.right ? 1 : 0) - (r.left ? 1 : 0);
    cmd.mz = (r.down ? 1 : 0) - (r.up ? 1 : 0);
    cmd.attack = r.attack && !p.attack;
    cmd.jump = r.jump && !p.jump;
    cmd.defend = r.defend && !p.defend;
    cmd.attackHeld = r.attack;
    cmd.defendHeld = r.defend;

    for (let i = 0; i < 4; i++) {
      if (r.skills[i] && !p.skills[i]) cmd.skill = i;
    }

    // Double-tap left/right starts a run, same as the original.
    this.lastTapAge++;
    const tappedRight = r.right && !p.right;
    const tappedLeft = r.left && !p.left;
    if (tappedRight || tappedLeft) {
      const dir = tappedRight ? 1 : -1;
      if (dir === this.lastTapDir && this.lastTapAge <= DOUBLE_TAP_WINDOW) {
        cmd.run = true;
        this.lastTapAge = 999;
        this.lastTapDir = 0;
      } else {
        this.lastTapDir = dir;
        this.lastTapAge = 0;
      }
    }
    if (cmd.mx === 0) this.runLatched = false;

    this.prev = {
      ...r,
      skills: [r.skills[0], r.skills[1], r.skills[2], r.skills[3]],
    };
    return cmd;
  }

  reset(): void {
    this.raw = emptyRaw();
    this.prev = emptyRaw();
    this.runLatched = false;
  }
}

const KEYMAP: Record<string, keyof RawState | `skill${0 | 1 | 2 | 3}`> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyJ: 'attack',
  KeyK: 'jump',
  KeyL: 'defend',
  Space: 'jump',
  KeyU: 'skill0',
  KeyI: 'skill1',
  KeyO: 'skill2',
  KeyP: 'skill3',
  Digit1: 'skill0',
  Digit2: 'skill1',
  Digit3: 'skill2',
  Digit4: 'skill3',
};

export class KeyboardSource {
  pad = new PadState();
  /** Non-gameplay keys the shell listens to (pause, confirm). */
  pressed = new Set<string>();
  private onDown = (e: KeyboardEvent) => this.set(e, true);
  private onUp = (e: KeyboardEvent) => this.set(e, false);

  attach(): void {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
  }

  private set(e: KeyboardEvent, down: boolean): void {
    const target = KEYMAP[e.code];
    if (down) this.pressed.add(e.code);
    else this.pressed.delete(e.code);
    if (!target) return;
    e.preventDefault();
    if (target.startsWith('skill')) {
      this.pad.raw.skills[Number(target.slice(5)) as 0 | 1 | 2 | 3] = down;
    } else {
      (this.pad.raw as any)[target] = down;
    }
  }
}

export interface TouchButtonRect {
  id: string;
  x: number;
  y: number;
  r: number;
}

export interface TouchLayout {
  stick: { x: number; y: number; r: number };
  buttons: TouchButtonRect[];
}

/**
 * Virtual gamepad. The stick is floating — it re-centres wherever the thumb
 * lands inside the left half, which on a phone is the difference between
 * playable and infuriating.
 */
export class TouchSource {
  pad = new PadState();
  layout: TouchLayout;
  /** Live stick vector in [-1, 1], for rendering the thumb. */
  stickX = 0;
  stickY = 0;
  stickActive = false;
  stickOriginX = 0;
  stickOriginY = 0;
  /** Buttons currently lit, for rendering. */
  lit = new Set<string>();
  /** Buttons that were tapped this frame but are not gameplay buttons. */
  uiTaps: string[] = [];

  private pointers = new Map<number, { id: string; x: number; y: number }>();
  private canvas: HTMLCanvasElement;
  /** Converts a client point into logical canvas space. */
  private toLogical: (cx: number, cy: number) => { x: number; y: number };

  constructor(
    canvas: HTMLCanvasElement,
    layout: TouchLayout,
    toLogical: (cx: number, cy: number) => { x: number; y: number },
  ) {
    this.canvas = canvas;
    this.layout = layout;
    this.toLogical = toLogical;
  }

  attach(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', this.onDown, { passive: false });
    c.addEventListener('pointermove', this.onMove, { passive: false });
    c.addEventListener('pointerup', this.onUp, { passive: false });
    c.addEventListener('pointercancel', this.onUp, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private hit(x: number, y: number): string | null {
    for (const b of this.layout.buttons) {
      const dx = x - b.x;
      const dy = y - b.y;
      // Generous hit radius: fingers are not precise and the visual circle is
      // only a hint about where the button is.
      if (dx * dx + dy * dy <= b.r * b.r * 1.9) return b.id;
    }
    return null;
  }

  private onDown = (e: PointerEvent) => {
    e.preventDefault();
    this.canvas.setPointerCapture?.(e.pointerId);
    const p = this.toLogical(e.clientX, e.clientY);
    const btn = this.hit(p.x, p.y);
    if (btn) {
      this.pointers.set(e.pointerId, { id: btn, x: p.x, y: p.y });
      this.press(btn, true);
      return;
    }
    // Anywhere in the left third becomes the stick.
    if (p.x < this.layout.stick.x + this.layout.stick.r * 2.6) {
      this.pointers.set(e.pointerId, { id: 'stick', x: p.x, y: p.y });
      this.stickActive = true;
      this.stickOriginX = p.x;
      this.stickOriginY = p.y;
      this.stickX = 0;
      this.stickY = 0;
    } else {
      this.pointers.set(e.pointerId, { id: 'screen', x: p.x, y: p.y });
      this.uiTaps.push('screen');
    }
  };

  private onMove = (e: PointerEvent) => {
    const rec = this.pointers.get(e.pointerId);
    if (!rec) return;
    e.preventDefault();
    const p = this.toLogical(e.clientX, e.clientY);
    if (rec.id !== 'stick') {
      // Let a finger slide between adjacent buttons rather than dropping input.
      const btn = this.hit(p.x, p.y);
      if (btn && btn !== rec.id) {
        this.press(rec.id, false);
        rec.id = btn;
        this.press(btn, true);
      }
      return;
    }
    const r = this.layout.stick.r;
    const dx = clamp((p.x - this.stickOriginX) / r, -1, 1);
    const dy = clamp((p.y - this.stickOriginY) / r, -1, 1);
    this.stickX = dx;
    this.stickY = dy;
    // A dead zone on each axis keeps a diagonal thumb from smearing depth
    // movement into every walk.
    this.pad.raw.left = dx < -0.32;
    this.pad.raw.right = dx > 0.32;
    this.pad.raw.up = dy < -0.42;
    this.pad.raw.down = dy > 0.42;
  };

  private onUp = (e: PointerEvent) => {
    const rec = this.pointers.get(e.pointerId);
    if (!rec) return;
    e.preventDefault();
    this.pointers.delete(e.pointerId);
    if (rec.id === 'stick') {
      this.stickActive = false;
      this.stickX = 0;
      this.stickY = 0;
      this.pad.raw.left = this.pad.raw.right = false;
      this.pad.raw.up = this.pad.raw.down = false;
    } else {
      this.press(rec.id, false);
    }
  };

  private press(id: string, down: boolean): void {
    if (down) this.lit.add(id);
    else this.lit.delete(id);
    switch (id) {
      case 'attack':
        this.pad.raw.attack = down;
        break;
      case 'jump':
        this.pad.raw.jump = down;
        break;
      case 'defend':
        this.pad.raw.defend = down;
        break;
      case 'skill0':
      case 'skill1':
      case 'skill2':
      case 'skill3':
        this.pad.raw.skills[Number(id.slice(5)) as 0 | 1 | 2 | 3] = down;
        break;
      default:
        if (down) this.uiTaps.push(id);
    }
  }

  /** Double-tap on the stick side also triggers a run on touch. */
  takeUiTaps(): string[] {
    const t = this.uiTaps;
    this.uiTaps = [];
    return t;
  }
}

/** Default landscape layout for a 960×540 logical canvas. */
export function defaultTouchLayout(w: number, h: number): TouchLayout {
  const pad = 26;
  const stickR = 54;
  return {
    stick: { x: pad + stickR, y: h - pad - stickR, r: stickR },
    buttons: [
      { id: 'attack', x: w - pad - 130, y: h - pad - 46, r: 38 },
      { id: 'jump', x: w - pad - 52, y: h - pad - 92, r: 34 },
      { id: 'defend', x: w - pad - 52, y: h - pad - 18, r: 30 },
      { id: 'skill0', x: w - pad - 214, y: h - pad - 30, r: 27 },
      { id: 'skill1', x: w - pad - 222, y: h - pad - 100, r: 27 },
      { id: 'skill2', x: w - pad - 158, y: h - pad - 136, r: 27 },
      { id: 'skill3', x: w - pad - 84, y: h - pad - 160, r: 27 },
      { id: 'pause', x: w - 30, y: 26, r: 18 },
    ],
  };
}
