/**
 * Game shell.
 *
 * Owns the screen state machine, the fixed-timestep loop and all the wiring
 * between input, simulation, renderer and audio. The simulation itself knows
 * nothing about any of this — it just takes commands and steps.
 */

import { assets } from './core/assets';
import { audio } from './core/audio';
import { defaultTouchLayout, KeyboardSource, TouchSource, type PadState } from './core/input';
import { getCharacter, ROSTER } from './data/characters';
import { STAGES } from './data/stages';
import { LOGICAL_H, LOGICAL_W, Renderer } from './gfx/renderer';
import { drawHud } from './ui/hud';
import {
  drawCharSelect,
  drawHowTo,
  drawPause,
  drawResults,
  drawRotateHint,
  drawStageSelect,
  drawTitle,
  type Pointer,
  type ResultsInfo,
} from './ui/screens';
import type { Command } from './sim/types';
import { TICK, World } from './sim/world';

type Screen = 'loading' | 'title' | 'howto' | 'charSelect' | 'stageSelect' | 'playing' | 'paused' | 'results';

interface Progress {
  unlocked: number;
  best: number[];
  charId: string;
  muted: boolean;
}

const SAVE_KEY = 'legend-fighters:progress:v1';

function loadProgress(): Progress {
  const fallback: Progress = { unlocked: 0, best: new Array(STAGES.length).fill(0), charId: ROSTER[0].id, muted: false };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<Progress>;
    return {
      unlocked: Math.min(Math.max(p.unlocked ?? 0, 0), STAGES.length - 1),
      best: Array.isArray(p.best) ? p.best : fallback.best,
      charId: getCharacter(p.charId ?? '').id,
      muted: !!p.muted,
    };
  } catch {
    return fallback;
  }
}

function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(p));
  } catch {
    // Private-mode browsers reject writes; progress is a nicety, not a
    // requirement, so failing silently is correct here.
  }
}

class Game {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private keyboard = new KeyboardSource();
  private touch: TouchSource;
  private world: World | null = null;

  private screen: Screen = 'loading';
  private progress = loadProgress();
  private selectedChar = 0;
  private selectedStage = 0;
  private time = 0;
  private acc = 0;
  private last = 0;
  private fps = 60;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private stageStartMs = 0;
  private results: ResultsInfo | null = null;
  /** True once a real touch has been seen; drives the on-screen pad. */
  private touchMode = false;

  private pointer: Pointer = { x: -999, y: -999, tapped: false, down: false };
  private pendingTap = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.touch = new TouchSource(
      canvas,
      defaultTouchLayout(LOGICAL_W, LOGICAL_H),
      (cx, cy) => this.renderer.toLogical(cx, cy),
    );
    this.selectedChar = Math.max(0, ROSTER.findIndex((c) => c.id === this.progress.charId));
    audio.setMuted(this.progress.muted);
  }

  async start(): Promise<void> {
    this.keyboard.attach();
    this.touch.attach();
    this.attachPointer();

    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.renderer.resize(), 120));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.screen === 'playing') this.screen = 'paused';
    });

    await assets.load();
    this.screen = 'title';
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  // -- input ---------------------------------------------------------------

  private attachPointer(): void {
    const move = (e: PointerEvent) => {
      const p = this.renderer.toLogical(e.clientX, e.clientY);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      if (e.pointerType === 'touch') this.touchMode = true;
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      move(e);
      this.pointer.down = true;
      // The first interaction is also what unlocks WebAudio.
      audio.unlock();
    });
    this.canvas.addEventListener('pointermove', move);
    this.canvas.addEventListener('pointerup', (e) => {
      move(e);
      this.pointer.down = false;
      this.pendingTap = true;
    });
    this.canvas.addEventListener('pointercancel', () => {
      this.pointer.down = false;
    });
  }

  /** Merges keyboard and touch into a single command for player 1. */
  private playerCommand(): Command {
    const kb = this.keyboard.pad.poll();
    const tp = this.touch.pad.poll();
    return {
      mx: tp.mx !== 0 ? tp.mx : kb.mx,
      mz: tp.mz !== 0 ? tp.mz : kb.mz,
      attack: kb.attack || tp.attack,
      jump: kb.jump || tp.jump,
      defend: kb.defend || tp.defend,
      attackHeld: kb.attackHeld || tp.attackHeld,
      defendHeld: kb.defendHeld || tp.defendHeld,
      skill: tp.skill >= 0 ? tp.skill : kb.skill,
      run: kb.run || tp.run,
    };
  }

  private drainPads(): void {
    // Menus do not consume pad input, but the edge detectors still need to be
    // stepped or the first in-game press would be swallowed.
    (this.keyboard.pad as PadState).poll();
    (this.touch.pad as PadState).poll();
  }

  // -- loop ----------------------------------------------------------------

  private frame = (now: number): void => {
    const dtMs = Math.min(now - this.last, 100);
    this.last = now;
    const dt = dtMs / 1000;
    this.time += dt * 60;

    this.fpsAcc += dtMs;
    this.fpsFrames++;
    if (this.fpsAcc >= 500) {
      this.fps = (this.fpsFrames * 1000) / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }

    this.pointer.tapped = this.pendingTap;
    this.pendingTap = false;

    if (this.isPortrait()) {
      this.renderer.clearUi();
      this.renderer.beginUi();
      drawRotateHint(this.renderer.ctx, this.time);
      this.renderer.endUi();
      requestAnimationFrame(this.frame);
      return;
    }

    this.update(dt);
    this.render(dt);
    requestAnimationFrame(this.frame);
  };

  private isPortrait(): boolean {
    return window.innerHeight > window.innerWidth * 1.05;
  }

  private update(dt: number): void {
    if (this.screen !== 'playing') {
      this.drainPads();
      return;
    }
    const world = this.world;
    if (!world) return;

    // Pause via the on-screen button or the keyboard.
    for (const tap of this.touch.takeUiTaps()) {
      if (tap === 'pause') this.screen = 'paused';
    }
    if (this.keyboard.pressed.has('Escape')) {
      this.keyboard.pressed.delete('Escape');
      this.screen = 'paused';
      return;
    }

    // Fixed timestep. Slow motion stretches wall-clock time without changing
    // the simulation rate, so hit detection stays frame-exact during supers.
    const rate = world.slowmo > 0 ? 0.35 : 1;
    this.acc += dt * rate;
    let steps = 0;
    while (this.acc >= TICK && steps < 5) {
      const cmds = new Map<number, Command>();
      cmds.set(0, this.playerCommand());
      world.step(cmds);
      this.consumeWorldEvents(world);
      this.acc -= TICK;
      steps++;
    }
    if (steps === 0) this.drainPads();

    if (world.phase === 'stageClear' && world.phaseTimer <= 0) this.finishStage(true);
    if (world.phase === 'gameOver' && world.phaseTimer <= 0) this.finishStage(false);
  }

  private consumeWorldEvents(world: World): void {
    for (const e of world.fx) {
      this.renderer.fx.emit(e.kind, e.x, e.y, e.z, e.scale, e.color, e.count, e.facing);
    }
    for (const id of world.sfx) audio.play(id);
  }

  private render(dt: number): void {
    const r = this.renderer;
    const ctx = r.ctx;

    switch (this.screen) {
      case 'loading':
        r.clearUi();
        r.beginUi();
        ctx.fillStyle = '#e8ecf6';
        ctx.font = '700 20px "Trebuchet MS", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('กำลังโหลด…', LOGICAL_W / 2, LOGICAL_H / 2);
        r.endUi();
        break;

      case 'title': {
        r.clearUi();
        r.beginUi();
        const action = drawTitle(ctx, this.pointer, this.time, this.progress.muted, this.progress.unlocked > 0);
        r.endUi();
        if (action === 'start') {
          audio.play('uiSelect');
          this.screen = 'charSelect';
        } else if (action === 'howto') {
          audio.play('uiSelect');
          this.screen = 'howto';
        } else if (action === 'mute') {
          this.progress.muted = !this.progress.muted;
          audio.setMuted(this.progress.muted);
          saveProgress(this.progress);
        }
        break;
      }

      case 'howto':
        r.clearUi();
        r.beginUi();
        if (drawHowTo(ctx, this.pointer, this.time)) {
          audio.play('uiBack');
          this.screen = 'title';
        }
        r.endUi();
        break;

      case 'charSelect': {
        r.clearUi();
        r.beginUi();
        const res = drawCharSelect(ctx, this.pointer, this.time, this.selectedChar);
        r.endUi();
        if (this.pointer.tapped && res.hovered !== this.selectedChar) {
          this.selectedChar = res.hovered;
          audio.play('uiMove');
        }
        if (res.confirmed) {
          audio.play('uiSelect');
          this.progress.charId = ROSTER[this.selectedChar].id;
          saveProgress(this.progress);
          this.screen = 'stageSelect';
        }
        if (res.back) {
          audio.play('uiBack');
          this.screen = 'title';
        }
        break;
      }

      case 'stageSelect': {
        r.clearUi();
        r.beginUi();
        const res = drawStageSelect(ctx, this.pointer, this.time, this.progress.unlocked, this.progress.best);
        r.endUi();
        if (res.picked >= 0) {
          audio.play('uiSelect');
          this.startStage(res.picked);
        }
        if (res.back) {
          audio.play('uiBack');
          this.screen = 'charSelect';
        }
        break;
      }

      case 'playing':
      case 'paused': {
        const world = this.world;
        if (!world) break;
        r.draw(world, this.screen === 'playing' ? dt : 0);
        r.beginUi();
        drawHud(ctx, world, this.touchMode, this.touch, this.fps);
        if (this.screen === 'paused') {
          const action = drawPause(ctx, this.pointer);
          if (action === 'resume') {
            audio.play('uiBack');
            this.screen = 'playing';
            this.last = performance.now();
          } else if (action === 'restart') {
            audio.play('uiSelect');
            this.startStage(this.selectedStage);
          } else if (action === 'quit') {
            audio.play('uiBack');
            audio.stopMusic();
            this.screen = 'stageSelect';
          }
        }
        r.endUi();
        break;
      }

      case 'results': {
        const world = this.world;
        if (world) r.draw(world, 0);
        else r.clearUi();
        r.beginUi();
        if (this.results) {
          const action = drawResults(ctx, this.pointer, this.time, this.results);
          if (action === 'next') {
            audio.play('uiSelect');
            this.startStage(Math.min(this.selectedStage + 1, STAGES.length - 1));
          } else if (action === 'retry') {
            audio.play('uiSelect');
            this.startStage(this.selectedStage);
          } else if (action === 'quit') {
            audio.play('uiBack');
            audio.stopMusic();
            this.screen = 'stageSelect';
          }
        }
        r.endUi();
        break;
      }
    }
  }

  // -- stage lifecycle -----------------------------------------------------

  private startStage(index: number): void {
    this.selectedStage = index;
    const stage = STAGES[index];
    const world = new World(stage, 0x51f3 + index * 7919);
    this.renderer.setStage(stage);
    this.renderer.fx.clear();

    const spawnX = 200;
    const spawnZ = (stage.zNear + stage.zFar) / 2;
    world.addFighter(ROSTER[this.selectedChar].id, 0, 'player', 0, spawnX, spawnZ);
    world.camX = Math.max(0, spawnX - 480);
    world.startStage();

    this.world = world;
    this.acc = 0;
    this.last = performance.now();
    this.stageStartMs = performance.now();
    this.screen = 'playing';
    audio.unlock();
    audio.playMusic(stage.id);
  }

  private finishStage(won: boolean): void {
    const world = this.world;
    if (!world) return;
    const stage = STAGES[this.selectedStage];

    this.results = {
      won,
      stage,
      score: world.score,
      bestCombo: world.comboBest,
      kos: world.playerKos,
      timeSec: (performance.now() - this.stageStartMs) / 1000,
      isLastStage: this.selectedStage >= STAGES.length - 1,
    };

    if (won) {
      this.progress.unlocked = Math.max(this.progress.unlocked, Math.min(this.selectedStage + 1, STAGES.length - 1));
      this.progress.best[this.selectedStage] = Math.max(this.progress.best[this.selectedStage] ?? 0, world.score);
      saveProgress(this.progress);
    }
    audio.stopMusic();
    this.screen = 'results';
  }
}

function boot(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Missing #game canvas');
  const game = new Game(canvas);
  void game.start();

  // Try to keep the screen awake during play; harmless where unsupported.
  const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<unknown> } };
  nav.wakeLock?.request('screen').catch(() => undefined);
}

boot();
