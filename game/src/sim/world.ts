/**
 * The simulation.
 *
 * Steps at a fixed 60 Hz and consumes nothing but `Command`s, so it is
 * deterministic given a seed — replays, and later an input-relay netcode,
 * come for free. Rendering never reaches in here; it reads the state and
 * drains the event queues below.
 */

import { clamp, sign } from '../core/math';
import { Rng } from '../core/rng';
import { getCharacter } from '../data/characters';
import { getProjectile } from '../data/projectiles';
import { SHARED } from './actions';
import type {
  Action,
  CharacterDef,
  Command,
  Fighter,
  Frame,
  HitDef,
  Pickup,
  Projectile,
  SpawnDef,
  StageDef,
  Team,
} from './types';
import { emptyCommand } from '../core/input';
import { decideAi } from './ai';

export const TICK = 1 / 60;
const GRAVITY = 0.62;
const GROUND_FRICTION = 0.74;
const AIR_DRAG = 0.985;
/** Accumulated fall points that put a fighter on the floor. */
const KNOCKDOWN = 22;
const COMBO_WINDOW = 90;

export interface FxEvent {
  kind: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  color: string;
  count: number;
  facing: number;
}

export interface DamageNumber {
  x: number;
  y: number;
  z: number;
  value: number;
  life: number;
  crit: boolean;
  color: string;
  vy: number;
  vx: number;
}

export type WorldPhase = 'intro' | 'fight' | 'waveClear' | 'stageClear' | 'gameOver';

let nextUid = 1;

export class World {
  stage: StageDef;
  rng: Rng;
  fighters: Fighter[] = [];
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];

  tick = 0;
  phase: WorldPhase = 'intro';
  phaseTimer = 90;

  waveIndex = 0;
  /** Enemies still owed to the current wave but not yet on screen. */
  spawnQueue: { charId: string; level: number; from: 'left' | 'right'; boss: boolean }[] = [];
  spawnTimer = 0;
  bannerText = '';
  bannerTimer = 0;

  /** Cosmetic channels drained by the renderer every frame. */
  fx: FxEvent[] = [];
  sfx: string[] = [];
  damageNumbers: DamageNumber[] = [];
  shake = 0;
  flash: { color: string; life: number } | null = null;
  slowmo = 0;
  zoomRequest = 1;

  camX = 0;
  camY = 0;
  camZoom = 1;

  /** Team 0 is the player side. */
  score = 0;
  comboBest = 0;
  /** Kept on the world, not on the fighter: on a loss the player's corpse is
   *  culled before the results screen reads its stats. */
  playerKos = 0;

  /** Number of on-screen enemies allowed at once — keeps phones honest. */
  maxConcurrent = 5;

  constructor(stage: StageDef, seed = 12345) {
    this.stage = stage;
    this.rng = new Rng(seed);
  }

  // -- setup ---------------------------------------------------------------

  /**
   * Health of a wave enemy relative to that character's playable stat line.
   *
   * The roster doubles as the enemy cast, and a fighter built to survive a
   * player-versus-player match is a brick wall when four of them come at you
   * at once — early tuning had a single mook soaking forty combo chains. Wave
   * enemies are fodder; only the stage boss keeps a real health pool.
   */
  private static readonly MOOK_HP = 0.2;
  private static readonly BOSS_HP = 0.42;

  addFighter(
    charId: string,
    team: Team,
    mode: 'player' | 'ai',
    pad: number,
    x: number,
    z: number,
    level = 1,
    boss = false,
  ): Fighter {
    const def = getCharacter(charId);
    const hpScale = mode === 'ai' ? level * (boss ? World.BOSS_HP : World.MOOK_HP) : 1;
    const fighter: Fighter = {
      uid: nextUid++,
      charId,
      def,
      team,
      mode,
      pad,
      x,
      y: 0,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      facing: team === 0 ? 1 : -1,
      hp: def.hp * hpScale,
      hpMax: def.hp * hpScale,
      hpGhost: def.hp * hpScale,
      mp: def.mp,
      mpMax: def.mp,
      action: def.actions.stand,
      frameIdx: 0,
      frameTime: 0,
      hitstop: 0,
      hitstun: 0,
      blockstun: 0,
      invuln: 0,
      fallPoints: 0,
      guard: 100,
      guardMax: 100,
      comboCount: 0,
      comboTimer: 0,
      hitList: [],
      cooldowns: {},
      burn: 0,
      freeze: 0,
      shock: 0,
      poison: 0,
      holding: 0,
      heldBy: 0,
      weapon: null,
      weaponUses: 0,
      ghosts: [],
      lives: mode === 'player' ? 3 : 1,
      respawnTimer: 0,
      dead: false,
      cmd: emptyCommand(),
      damageDealt: 0,
      kos: 0,
      // Enemy damage rises with the stage but stays under a player's own
      // numbers — being swarmed is the pressure, not per-hit damage.
      vars: { level, dmgScale: mode === 'ai' ? 0.4 + level * 0.26 : 1, boss: boss ? 1 : 0, armorBuff: 0 },
    };
    this.fighters.push(fighter);
    return fighter;
  }

  startStage(): void {
    this.waveIndex = 0;
    this.phase = 'intro';
    this.phaseTimer = 100;
    this.bannerText = this.stage.nameTh;
    this.bannerTimer = 140;
  }

  private beginWave(): void {
    const wave = this.stage.waves[this.waveIndex];
    if (!wave) {
      this.phase = 'stageClear';
      this.phaseTimer = 200;
      return;
    }
    const from = wave.from ?? 'both';
    this.spawnQueue = wave.enemies.map((charId, i) => ({
      charId,
      level: wave.level ?? 1,
      from: from === 'both' ? (i % 2 === 0 ? 'right' : 'left') : from,
      boss: !!wave.boss,
    }));
    this.spawnTimer = 20;
    this.maxConcurrent = wave.boss ? 2 : 5;
    if (wave.bannerTh) {
      this.bannerText = wave.bannerTh;
      this.bannerTimer = 120;
    }
    this.phase = 'fight';
  }

  private enemiesAlive(): number {
    return this.fighters.filter((f) => f.team !== 0 && !f.dead).length;
  }

  private playersAlive(): number {
    return this.fighters.filter((f) => f.team === 0 && (!f.dead || f.lives > 0)).length;
  }

  // -- main step -----------------------------------------------------------

  step(commands: Map<number, Command>): void {
    this.tick++;
    this.fx.length = 0;
    this.sfx.length = 0;

    this.shake *= 0.86;
    if (this.shake < 0.05) this.shake = 0;
    if (this.flash) {
      this.flash.life--;
      if (this.flash.life <= 0) this.flash = null;
    }
    if (this.slowmo > 0) this.slowmo--;
    this.zoomRequest += (1 - this.zoomRequest) * 0.08;

    this.updatePhase();

    for (const f of this.fighters) {
      if (f.mode === 'player') {
        f.cmd = commands.get(f.pad) ?? emptyCommand();
      } else if (this.phase === 'fight' || this.phase === 'waveClear') {
        f.cmd = decideAi(this, f);
      } else {
        f.cmd = emptyCommand();
      }
    }

    for (const f of this.fighters) this.stepFighter(f);
    this.stepProjectiles();
    this.stepPickups();
    this.resolveBodies();
    this.resolveHits();
    this.cullDead();
    this.updateDamageNumbers();
    this.updateCamera();
  }

  private updatePhase(): void {
    if (this.bannerTimer > 0) this.bannerTimer--;

    switch (this.phase) {
      case 'intro':
        if (--this.phaseTimer <= 0) this.beginWave();
        break;
      case 'fight': {
        // Trickle in queued enemies so the screen never floods.
        if (this.spawnQueue.length > 0) {
          if (--this.spawnTimer <= 0 && this.enemiesAlive() < this.maxConcurrent) {
            const s = this.spawnQueue.shift()!;
            const x =
              s.from === 'left'
                ? clamp(this.camX - 200, 40, this.stage.width - 40)
                : clamp(this.camX + 1160, 40, this.stage.width - 40);
            const z = this.rng.range(this.stage.zFar + 10, this.stage.zNear - 10);
            const e = this.addFighter(s.charId, 1, 'ai', -1, x, z, s.level, s.boss);
            e.facing = x > this.camX + 480 ? -1 : 1;
            this.spawnTimer = 34;
          }
        } else if (this.enemiesAlive() === 0) {
          this.waveIndex++;
          this.phase = this.waveIndex >= this.stage.waves.length ? 'stageClear' : 'waveClear';
          this.phaseTimer = this.phase === 'stageClear' ? 220 : 70;
          if (this.phase === 'waveClear') {
            this.bannerText = 'เคลียร์!';
            this.bannerTimer = 60;
          }
        }
        if (this.playersAlive() === 0) {
          this.phase = 'gameOver';
          this.phaseTimer = 240;
        }
        break;
      }
      case 'waveClear':
        if (--this.phaseTimer <= 0) this.beginWave();
        break;
      default:
        if (this.phaseTimer > 0) this.phaseTimer--;
        break;
    }
  }

  // -- fighter -------------------------------------------------------------

  private stepFighter(f: Fighter): void {
    if (f.hitstop > 0) {
      f.hitstop--;
      return;
    }

    if (f.dead) {
      this.stepDeadFighter(f);
      return;
    }

    // Ghost bar chases the real bar — the classic "how much did that cost me"
    // read that a plain bar cannot give.
    if (f.hpGhost > f.hp) f.hpGhost = Math.max(f.hp, f.hpGhost - f.hpMax * 0.0035 - 0.25);
    else f.hpGhost = f.hp;

    f.mp = Math.min(f.mpMax, f.mp + f.def.mpRegen * TICK);
    for (const k of Object.keys(f.cooldowns)) {
      if (f.cooldowns[k] > 0) f.cooldowns[k]--;
    }

    if (f.hitstun > 0) f.hitstun--;
    if (f.blockstun > 0) f.blockstun--;
    if (f.invuln > 0) f.invuln--;
    if (f.comboTimer > 0 && --f.comboTimer === 0) f.comboCount = 0;
    if (f.fallPoints > 0 && f.hitstun === 0) f.fallPoints = Math.max(0, f.fallPoints - 0.35);
    if (f.guard < f.guardMax && f.action.id !== 'defend') f.guard = Math.min(f.guardMax, f.guard + 0.5);
    if (f.vars.armorBuff > 0) f.vars.armorBuff--;

    this.stepStatus(f);

    // Frozen fighters skip their turn entirely but still fall and get hit.
    if (f.freeze > 0) {
      this.setAction(f, 'frozen', true);
    } else if (f.hitstun === 0 && f.heldBy === 0) {
      this.handleInput(f);
    }

    this.advanceAction(f);
    this.integrate(f);
    this.updateGhosts(f);
  }

  private stepDeadFighter(f: Fighter): void {
    this.integrate(f);
    if (f.respawnTimer > 0 && --f.respawnTimer === 0 && f.lives > 0) {
      f.dead = false;
      f.hp = f.hpMax;
      f.hpGhost = f.hpMax;
      f.mp = f.mpMax * 0.5;
      f.y = 180;
      f.vy = 0;
      f.x = clamp(this.camX + 480, 60, this.stage.width - 60);
      f.invuln = 90;
      f.fallPoints = 0;
      this.setAction(f, 'jumpAir', true);
      this.emit('respawn', f.x, 40, f.z, 1.4, f.def.look.aura, 20, f.facing);
    }
  }

  private stepStatus(f: Fighter): void {
    if (f.burn > 0) {
      f.burn--;
      if (f.burn % 12 === 0) {
        this.damage(f, 3, '#ff8a3c', false);
        this.emit('ember', f.x, f.def.height * 0.5, f.z, 0.6, '#ff8a3c', 3, f.facing);
      }
    }
    if (f.poison > 0) {
      f.poison--;
      if (f.poison % 16 === 0) {
        this.damage(f, 4, '#a8e05a', false);
        this.emit('poisonPuff', f.x, f.def.height * 0.6, f.z, 0.6, '#a8e05a', 3, f.facing);
      }
    }
    if (f.freeze > 0) {
      f.freeze--;
      if (f.freeze === 0) this.emit('frostShatter', f.x, f.def.height * 0.5, f.z, 1.1, '#dff6ff', 14, f.facing);
    }
    if (f.shock > 0) {
      f.shock--;
      if (f.shock % 5 === 0) this.emit('spark', f.x, f.def.height * 0.6, f.z, 0.5, '#eaf6ff', 2, f.facing);
    }
  }

  /** True when a fresh input may interrupt whatever the fighter is doing. */
  private canAct(f: Fighter): boolean {
    if (f.hitstun > 0 || f.freeze > 0 || f.heldBy !== 0) return false;
    const tag = f.action.tag;
    return tag === 'system' || tag === 'movement' || f.action.id === 'defend';
  }

  private cancelInto(f: Fighter): string[] {
    const fr = f.action.frames[f.frameIdx];
    return fr?.cancel ?? [];
  }

  private handleInput(f: Fighter): void {
    const c = f.cmd;
    const airborne = f.y > 0.5;

    // Skill buttons take priority: on mobile they are the whole special game.
    if (c.skill >= 0) {
      const id = f.def.skills[c.skill];
      if (id && this.trySpecial(f, id)) return;
    }

    const chain = this.cancelInto(f);
    if (chain.length > 0 && c.attack) {
      for (const id of chain) {
        if (f.def.actions[id]) {
          this.setAction(f, id, true);
          return;
        }
      }
    }

    if (!this.canAct(f)) return;

    // Grabbing: holding an opponent replaces the normal button map.
    if (f.holding !== 0) {
      const victim = this.byUid(f.holding);
      if (!victim || victim.dead) {
        f.holding = 0;
      } else {
        if (c.attack) this.setAction(f, 'holdPunch', true);
        else if (c.jump || c.defend) this.throwHeld(f);
        return;
      }
    }

    if (c.defendHeld && !airborne) {
      if (f.action.id !== 'defend') this.setAction(f, 'defend', true);
    } else if (f.action.id === 'defend') {
      this.setAction(f, 'stand', true);
    }
    if (f.action.id === 'defend') {
      // Tapping a direction while blocking rolls out of pressure.
      if (c.jump && c.mx !== 0) {
        f.facing = c.mx > 0 ? 1 : -1;
        this.setAction(f, 'rollBack', true);
      }
      return;
    }

    if (c.attack) {
      if (airborne) {
        this.setAction(f, c.mz > 0 ? 'attackAirDown' : 'attackAir', true);
      } else if (f.weapon) {
        this.setAction(f, c.mz > 0 ? 'weaponThrow' : 'weaponSwing', true);
        f.weaponUses--;
        if (f.weaponUses <= 0) f.weapon = null;
      } else if (f.action.id === 'run') {
        this.setAction(f, 'attackRun', true);
      } else if (c.defendHeld) {
        this.setAction(f, 'grab', true);
      } else {
        this.setAction(f, 'attack1', true);
      }
      return;
    }

    if (c.jump) {
      if (!airborne) {
        this.setAction(f, 'jump', true);
        f.vy = f.def.jump;
        f.vx = c.mx * f.def.walkSpeed * 1.5;
        f.vz = c.mz * f.def.zSpeed;
        f.vars.airJumpsLeft = f.def.airJumps;
        return;
      }
      if ((f.vars.airJumpsLeft ?? 0) > 0) {
        f.vars.airJumpsLeft--;
        f.vy = f.def.jump * 0.86;
        if (c.mx !== 0) f.vx = c.mx * f.def.walkSpeed * 1.7;
        this.setAction(f, 'jumpAir', true);
        this.emit('airJump', f.x, f.y + 6, f.z, 1, f.def.look.aura, 10, f.facing);
        return;
      }
    }

    if (c.run && !airborne && c.mx !== 0) {
      f.facing = c.mx > 0 ? 1 : -1;
      this.setAction(f, 'run', true);
      return;
    }

    if (airborne) return;

    // Ground locomotion.
    if (c.mx !== 0 || c.mz !== 0) {
      const running = f.action.id === 'run' && c.mx !== 0;
      if (!running && f.action.id !== 'walk') this.setAction(f, 'walk', true);
      if (running && c.mx !== 0 && sign(c.mx) !== f.facing) {
        // Turning while running drops you back to a walk, as it should.
        this.setAction(f, 'runStop', true);
      }
    } else if (f.action.id === 'walk') {
      this.setAction(f, 'stand', true);
    } else if (f.action.id === 'run') {
      this.setAction(f, 'runStop', true);
    }
  }

  private trySpecial(f: Fighter, id: string): boolean {
    const act = f.def.actions[id];
    if (!act) return false;
    if (!this.canAct(f) && !this.cancelInto(f).includes(id)) {
      // Supers may be cancelled into from any non-hitstun state — the classic
      // "get out of jail" that makes meter feel valuable.
      if (!(act.tag === 'super' && f.hitstun === 0 && f.action.tag !== 'reaction')) return false;
    }
    if ((f.cooldowns[id] ?? 0) > 0) return false;
    const cost = act.mpCost ?? 0;
    if (f.mp < cost) {
      this.emit('mpFail', f.x, f.def.height * 0.75, f.z, 0.7, '#6fa8dc', 4, f.facing);
      return false;
    }
    f.mp -= cost;
    if (act.cooldown) f.cooldowns[id] = act.cooldown;
    this.setAction(f, id, true);
    return true;
  }

  private throwHeld(f: Fighter): void {
    const victim = this.byUid(f.holding);
    this.setAction(f, 'throwFwd', true);
    if (!victim) {
      f.holding = 0;
      return;
    }
    victim.heldBy = 0;
    f.holding = 0;
    victim.vx = f.facing * 11;
    victim.vy = 8;
    victim.vz = 0;
    victim.hitstun = 40;
    victim.fallPoints = KNOCKDOWN;
    this.setAction(victim, 'thrown', true);
    this.damage(victim, 18 * (f.vars.dmgScale ?? 1), '#ffffff', true, f);
    this.shake = Math.max(this.shake, 5);
    this.sfx.push('throw');
  }

  setAction(f: Fighter, id: string, reset: boolean): void {
    const act: Action = f.def.actions[id] ?? SHARED[id] ?? f.def.actions.stand;
    if (f.action.id === act.id && !reset) return;
    f.action = act;
    f.frameIdx = 0;
    f.frameTime = 0;
    f.hitList.length = 0;
    this.enterFrame(f, act.frames[0]);
  }

  private enterFrame(f: Fighter, fr: Frame | undefined): void {
    if (!fr) return;
    const dir = f.facing;
    if (fr.vx !== undefined) f.vx = fr.vx * dir;
    if (fr.vy !== undefined) f.vy = fr.vy;
    if (fr.vz !== undefined) f.vz = fr.vz;
    if (fr.dvx !== undefined) f.vx += fr.dvx * dir;
    if (fr.dvy !== undefined) f.vy += fr.dvy;
    if (fr.mp) f.mp = clamp(f.mp - fr.mp, 0, f.mpMax);
    if (fr.heal) {
      f.hp = Math.min(f.hpMax, f.hp + fr.heal);
      this.pushNumber(f.x, f.def.height * 0.9, f.z, fr.heal, '#6fe08a', false);
    }
    if (fr.invuln) f.invuln = Math.max(f.invuln, fr.dur + 1);
    if (fr.sfx) this.sfx.push(fr.sfx);
    if (fr.flash) this.flash = { color: fr.flash, life: 8 };
    if (fr.slowmo) this.slowmo = Math.max(this.slowmo, Math.round(fr.slowmo * 60));
    if (fr.zoom) this.zoomRequest = fr.zoom;
    if (fr.fx) {
      for (const e of fr.fx) {
        this.emit(
          e.kind,
          f.x + (e.x ?? 0) * dir,
          f.y + (e.y ?? 0),
          f.z + (e.z ?? 0),
          e.scale ?? 1,
          e.color ?? f.def.look.aura,
          e.count ?? 1,
          dir,
        );
      }
    }
    if (fr.spawn) {
      for (const s of fr.spawn) this.spawnProjectile(f, s);
    }
  }

  private advanceAction(f: Fighter): void {
    const act = f.action;
    const fr = act.frames[f.frameIdx];
    if (!fr) {
      this.setAction(f, act.next ?? 'stand', true);
      return;
    }

    // Movement-tagged actions honour the stick while they play.
    if (act.mobile && f.hitstun === 0 && f.freeze === 0) this.applyMovement(f);

    f.frameTime++;
    if (f.frameTime < fr.dur) return;

    f.frameTime = 0;
    f.frameIdx++;
    if (f.frameIdx >= act.frames.length) {
      if (act.loop) {
        f.frameIdx = 0;
        this.enterFrame(f, act.frames[0]);
      } else {
        const nextId = act.next ?? 'stand';
        // Landing takes priority over whatever an air action wanted next.
        this.setAction(f, f.y > 0.5 && nextId === 'stand' ? 'jumpAir' : nextId, true);
      }
      return;
    }
    this.enterFrame(f, act.frames[f.frameIdx]);
  }

  private applyMovement(f: Fighter): void {
    const c = f.cmd;
    const airborne = f.y > 0.5;
    const running = f.action.id === 'run';
    const speed = running ? f.def.runSpeed : f.def.walkSpeed;

    if (airborne) {
      // Light air control, not a second walk.
      if (c.mx !== 0) f.vx += c.mx * 0.28;
      f.vx = clamp(f.vx, -f.def.runSpeed * 1.1, f.def.runSpeed * 1.1);
      return;
    }

    if (running) {
      f.vx = f.facing * speed;
      f.vz = c.mz * f.def.zSpeed * 0.6;
      return;
    }

    if (c.mx !== 0) {
      f.vx = c.mx * speed;
      if (f.action.turnable !== false) f.facing = c.mx > 0 ? 1 : -1;
    } else {
      f.vx *= 0.6;
    }
    f.vz = c.mz * f.def.zSpeed;
  }

  private integrate(f: Fighter): void {
    const fr = f.action.frames[f.frameIdx];
    const floating = fr?.float ?? false;

    f.x += f.vx;
    f.z += f.vz;
    if (!floating) {
      f.y += f.vy;
      f.vy -= GRAVITY;
    }

    const airborne = f.y > 0.5;
    if (airborne) {
      f.vx *= AIR_DRAG;
      f.vz *= 0.9;
    } else if (!f.action.mobile) {
      f.vx *= GROUND_FRICTION;
      f.vz *= GROUND_FRICTION;
    }

    // Floor.
    if (f.y <= 0 && f.vy <= 0) {
      const landedHard = f.vy < -11 || f.action.tag === 'reaction';
      f.y = 0;
      f.vy = 0;
      f.vars.airJumpsLeft = f.def.airJumps;

      if (f.dead) {
        f.vx *= 0.5;
      } else if (f.action.tag === 'reaction' && (f.fallPoints >= KNOCKDOWN || f.action.id === 'thrown' || f.action.id === 'fall')) {
        if (f.action.id !== 'down' && f.action.id !== 'getup') {
          this.setAction(f, 'down', true);
          f.fallPoints = 0;
          f.hitstun = 0;
          f.comboCount = 0;
          this.shake = Math.max(this.shake, 3.5);
          this.emit('dust', f.x, 0, f.z, 1.3, '#d8c8a8', 12, f.facing);
        }
      } else if (f.action.id === 'jumpAir' || f.action.id === 'jump' || f.action.tag === 'reaction') {
        this.setAction(f, landedHard ? 'landHard' : 'land', true);
      } else if (f.action.id === 'attackAir' || f.action.id === 'attackAirDown') {
        this.setAction(f, 'landHard', true);
      }
    }

    f.x = clamp(f.x, 30, this.stage.width - 30);
    f.z = clamp(f.z, this.stage.zFar, this.stage.zNear);

    // Being held pins you to your captor.
    if (f.heldBy !== 0) {
      const holder = this.byUid(f.heldBy);
      if (holder && !holder.dead) {
        f.x = holder.x + holder.facing * (holder.def.half + f.def.half + 2);
        f.z = holder.z;
        f.y = holder.y;
        f.facing = (-holder.facing) as 1 | -1;
        this.setAction(f, 'held', false);
      } else {
        f.heldBy = 0;
      }
    }
  }

  private updateGhosts(f: Fighter): void {
    const fast = Math.abs(f.vx) > 7 || f.action.tag === 'super';
    if (fast && this.tick % 2 === 0) {
      f.ghosts.push({ x: f.x, y: f.y, z: f.z, facing: f.facing, pose: f.action.frames[f.frameIdx]?.pose ?? 'stand', t: 14 });
      if (f.ghosts.length > 8) f.ghosts.shift();
    }
    for (let i = f.ghosts.length - 1; i >= 0; i--) {
      if (--f.ghosts[i].t <= 0) f.ghosts.splice(i, 1);
    }
  }

  // -- collision -----------------------------------------------------------

  /** Soft body separation so fighters do not stack on the same pixel. */
  private resolveBodies(): void {
    for (let i = 0; i < this.fighters.length; i++) {
      const a = this.fighters[i];
      if (a.dead || a.heldBy !== 0) continue;
      for (let j = i + 1; j < this.fighters.length; j++) {
        const b = this.fighters[j];
        if (b.dead || b.heldBy !== 0) continue;
        if (Math.abs(a.z - b.z) > a.def.depth + b.def.depth) continue;
        if (Math.abs(a.y - b.y) > 50) continue;
        const minX = a.def.half + b.def.half;
        const dx = b.x - a.x;
        const pen = minX - Math.abs(dx);
        if (pen <= 0) continue;
        const dir = dx === 0 ? (a.uid < b.uid ? -1 : 1) : sign(dx);
        const wa = 1 / a.def.weight;
        const wb = 1 / b.def.weight;
        const total = wa + wb;
        a.x -= dir * pen * (wa / total) * 0.5;
        b.x += dir * pen * (wb / total) * 0.5;
      }
    }
  }

  private hitboxWorld(f: Fighter, h: HitDef) {
    const b = h.box;
    const x0 = f.facing > 0 ? f.x + b.x : f.x - b.x - b.w;
    const zw = b.zw ?? f.def.depth + 8;
    return {
      x0,
      x1: x0 + b.w,
      y0: f.y + b.y,
      y1: f.y + b.y + b.h,
      z0: f.z - zw,
      z1: f.z + zw,
    };
  }

  private resolveHits(): void {
    for (const a of this.fighters) {
      if (a.dead || a.hitstop > 0) continue;
      const fr = a.action.frames[a.frameIdx];
      const h = fr?.hit;
      if (!h) continue;
      const box = this.hitboxWorld(a, h);

      for (const b of this.fighters) {
        if (b === a || b.dead) continue;
        if (b.team === a.team) continue;
        if (h.once && a.hitList.includes(b.uid)) continue;
        if (!h.once && a.hitList.includes(b.uid) && this.tick % 6 !== 0) continue;
        if (b.invuln > 0) continue;

        const bx0 = b.x - b.def.half;
        const bx1 = b.x + b.def.half;
        const by0 = b.y;
        const by1 = b.y + b.def.height;
        const bz0 = b.z - b.def.depth;
        const bz1 = b.z + b.def.depth;
        if (box.x1 < bx0 || box.x0 > bx1) continue;
        if (box.y1 < by0 || box.y0 > by1) continue;
        if (box.z1 < bz0 || box.z0 > bz1) continue;

        if (!a.hitList.includes(b.uid)) a.hitList.push(b.uid);
        this.applyHit(a, b, h);
      }
    }
  }

  /** Grabs are the one hit that changes the relationship between two fighters. */
  private tryGrab(a: Fighter, b: Fighter): boolean {
    if (a.action.id !== 'grab') return false;
    if (b.def.weight > a.def.weight * 1.6) return false;
    if (b.y > 8) return false;
    a.holding = b.uid;
    b.heldBy = a.uid;
    b.hitstun = 0;
    this.setAction(a, 'hold', true);
    this.setAction(b, 'held', true);
    this.sfx.push('grab');
    return true;
  }

  applyHit(a: Fighter, b: Fighter, h: HitDef): void {
    if (this.tryGrab(a, b)) return;

    const dir = (a.x <= b.x ? 1 : -1) as 1 | -1;
    const scale = a.vars.dmgScale ?? 1;
    const blocking =
      (b.action.id === 'defend' || b.action.id === 'defendHit') &&
      h.blockable !== false &&
      !h.unblockable &&
      // You cannot block what comes from behind.
      sign(a.x - b.x) === b.facing;

    if (blocking) {
      const guardDmg = h.guard ?? 10;
      b.guard -= guardDmg;
      const chip = Math.max(1, h.dmg * 0.12) * scale;
      this.damage(b, chip, '#9fc8ff', false, a);
      b.blockstun = Math.max(b.blockstun, (h.hitstun ?? 12) * 0.6);
      b.vx = dir * (h.kbx ?? 3) * 0.35;
      a.hitstop = Math.max(a.hitstop, Math.round((h.hitstop ?? 3) * 0.7));
      b.hitstop = Math.max(b.hitstop, Math.round((h.hitstop ?? 3) * 0.7));
      this.emit('guardSpark', b.x + dir * -b.def.half, b.y + b.def.height * 0.6, b.z, 0.9, '#9fc8ff', 6, dir);
      this.sfx.push('block');
      this.shake = Math.max(this.shake, (h.shake ?? 2) * 0.4);
      if (b.guard <= 0) {
        b.guard = b.guardMax;
        this.setAction(b, 'defendBreak', true);
        b.hitstun = 30;
        this.sfx.push('break');
        this.emit('guardbreak', b.x, b.y + b.def.height * 0.6, b.z, 1.4, '#ffd166', 16, dir);
      } else {
        this.setAction(b, 'defendHit', true);
      }
      return;
    }

    // Vacuum effects pull rather than push — used by cyclones and drains.
    if (h.vacuum) {
      const pull = sign(a.x - b.x) * h.vacuum;
      b.vx += pull;
      b.vz += sign(a.z - b.z) * h.vacuum * 0.4;
    }

    const dmg = h.dmg * scale;
    const superArmor = (b.action.frames[b.frameIdx]?.armor ?? false) || b.vars.armorBuff > 0;
    const mitigated = b.vars.armorBuff > 0 ? dmg * 0.6 : dmg;
    this.damage(b, mitigated, this.elementColor(h.element), dmg >= 30, a);

    if (h.lifesteal) {
      a.hp = Math.min(a.hpMax, a.hp + mitigated * h.lifesteal);
      this.emit('lifesteal', a.x, a.def.height * 0.6, a.z, 0.8, '#b57bff', 4, a.facing);
    }

    a.damageDealt += mitigated;
    a.comboCount++;
    a.comboTimer = COMBO_WINDOW;
    this.comboBest = Math.max(this.comboBest, a.comboCount);
    this.score += Math.round(mitigated);

    if (!superArmor) {
      b.fallPoints += h.fall ?? 6;
      b.hitstun = Math.max(b.hitstun, h.hitstun ?? 12);
      if (!h.vacuum) {
        b.vx = dir * (h.kbx ?? 3);
        if (h.kby) b.vy = h.kby;
        if (h.kbz) b.vz = dir * h.kbz;
      }
      const knockdown = h.launcher || b.fallPoints >= KNOCKDOWN || b.y > 6;
      if (knockdown) {
        if (!h.kby && h.launcher) b.vy = 6;
        this.setAction(b, b.y > 2 || (h.kby ?? 0) > 0 ? 'launched' : 'hurtHeavy', true);
      } else {
        this.setAction(b, dmg >= 16 ? 'hurtHeavy' : 'hurt', true);
      }
      b.holding = 0;
      b.guard = Math.min(b.guardMax, b.guard + 12);
    } else {
      this.emit('armorSpark', b.x, b.y + b.def.height * 0.6, b.z, 0.9, '#ffd166', 6, dir);
    }

    this.applyElement(b, h);

    const stop = h.hitstop ?? 4;
    a.hitstop = Math.max(a.hitstop, stop);
    b.hitstop = Math.max(b.hitstop, stop);
    this.shake = Math.max(this.shake, h.shake ?? 2);

    const hx = (a.x + b.x) / 2 + dir * 6;
    const hy = b.y + b.def.height * (0.45 + this.rng.range(0, 0.25));
    this.emit('impact', hx, hy, b.z, 0.7 + Math.min(1.4, dmg / 30), this.elementColor(h.element), 1, dir);
    this.emit(this.elementBurst(h.element), hx, hy, b.z, 0.8 + dmg / 40, this.elementColor(h.element), 6 + Math.round(dmg / 4), dir);
    if (h.sfx) this.sfx.push(h.sfx);

    if (b.hp <= 0) this.kill(b, a);
  }

  private applyElement(b: Fighter, h: HitDef): void {
    switch (h.element) {
      case 'fire':
        b.burn = Math.max(b.burn, 110);
        break;
      case 'ice':
        b.freeze = Math.max(b.freeze, 70);
        break;
      case 'shock':
        b.shock = Math.max(b.shock, 60);
        break;
      case 'poison':
        b.poison = Math.max(b.poison, 200);
        break;
      default:
        break;
    }
  }

  private elementColor(e: HitDef['element']): string {
    switch (e) {
      case 'fire': return '#ff8a3c';
      case 'ice': return '#9fdcff';
      case 'shock': return '#cfe8ff';
      case 'wind': return '#6ff0c0';
      case 'dark': return '#c88bff';
      case 'holy': return '#ffe9a8';
      case 'poison': return '#c8ff8a';
      default: return '#ffe9c4';
    }
  }

  private elementBurst(e: HitDef['element']): string {
    switch (e) {
      case 'fire': return 'fireBurst';
      case 'ice': return 'frostBurst';
      case 'shock': return 'shockBurst';
      case 'dark': return 'darkBurst';
      case 'poison': return 'poisonBurst';
      default: return 'hitSpark';
    }
  }

  /**
   * `source` is who gets the credit. Without it a killing blow resolves here
   * first, marks the victim dead, and the caller's own `kill()` then no-ops —
   * which silently zeroed every KO count and kill bonus.
   */
  damage(f: Fighter, amount: number, color: string, crit: boolean, source: Fighter | null = null): void {
    if (amount <= 0 || f.dead) return;
    f.hp = Math.max(0, f.hp - amount);
    this.pushNumber(f.x, f.def.height * (0.7 + this.rng.range(0, 0.3)), f.z, Math.round(amount), color, crit);
    if (f.hp <= 0 && !f.dead) this.kill(f, source);
  }

  private kill(f: Fighter, killer: Fighter | null): void {
    if (f.dead) return;
    f.dead = true;
    f.hp = 0;
    f.holding = 0;
    f.heldBy = 0;
    f.vy = 7;
    f.vx = (killer ? sign(f.x - killer.x) : 1) * 4;
    this.setAction(f, 'dead', true);
    this.emit('koBurst', f.x, f.def.height * 0.5, f.z, 1.8, f.def.look.aura, 26, f.facing);
    this.sfx.push('ko');
    this.shake = Math.max(this.shake, 7);
    this.flash = { color: '#ffffff', life: 5 };
    if (killer) {
      killer.kos++;
      this.score += 250;
      if (killer.team === 0) this.playerKos++;
    }
    if (f.team === 0) {
      f.lives--;
      if (f.lives > 0) f.respawnTimer = 150;
    } else {
      this.maybeDrop(f);
    }
  }

  private maybeDrop(f: Fighter): void {
    const drops = this.stage.drops;
    if (drops.length === 0 || !this.rng.chance(0.38)) return;
    this.pickups.push({
      uid: nextUid++,
      kind: this.rng.pick(drops),
      x: f.x,
      y: f.def.height * 0.5,
      z: f.z,
      vx: this.rng.range(-2, 2),
      vy: 6,
      vz: 0,
      life: 900,
      dead: false,
    });
  }

  private cullDead(): void {
    for (let i = this.fighters.length - 1; i >= 0; i--) {
      const f = this.fighters[i];
      if (!f.dead) continue;
      if (f.team === 0 && f.lives > 0) continue;
      // Leave the corpse for a beat, then clear it.
      f.vars.corpse = (f.vars.corpse ?? 0) + 1;
      if (f.vars.corpse > 150) this.fighters.splice(i, 1);
    }
  }

  // -- projectiles ---------------------------------------------------------

  spawnProjectile(owner: Fighter, s: SpawnDef): void {
    const pdef = getProjectile(s.kind);
    const count = s.count ?? 1;
    const spread = (s.spread ?? 0) * (Math.PI / 180);
    const dir = owner.facing;

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const ang = t * spread;
      const jitter = s.jitter ?? 0;
      const speed = pdef.speed;
      const baseVx = s.vx !== undefined ? s.vx : speed * Math.cos(ang);
      const baseVy = s.vy !== undefined ? s.vy : speed * Math.sin(ang) * 0.55;

      const p: Projectile = {
        uid: nextUid++,
        kind: s.kind,
        owner: owner.uid,
        team: owner.team,
        x: owner.x + (s.x ?? 0) * dir + this.rng.range(-jitter, jitter),
        y: owner.y + (s.y ?? 0) + this.rng.range(-jitter, jitter) * 0.5,
        z: owner.z + (s.z ?? 0),
        vx: baseVx * dir,
        vy: baseVy,
        vz: 0,
        facing: dir,
        life: pdef.life,
        hit: pdef.hit,
        power: pdef.power,
        hitList: [],
        style: pdef.style,
        color: pdef.color,
        scale: pdef.scale,
        age: 0,
        gravity: pdef.gravity,
        homing: pdef.homing,
        target: 0,
        dead: false,
      };
      // Ground-anchored shots ignore whatever height they were spawned at.
      if (pdef.style === 'geyser' || pdef.style === 'wave') p.y = 0;
      if (pdef.style === 'beam') {
        p.vx = 0;
        p.vy = 0;
      }
      if (pdef.style === 'meteor') p.vy = Math.max(2, baseVy);
      this.projectiles.push(p);
    }
    this.emit('muzzle', owner.x + (s.x ?? 0) * dir, owner.y + (s.y ?? 0), owner.z, 1, pdef.color, 5, dir);
  }

  private stepProjectiles(): void {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      const pdef = getProjectile(p.kind);
      p.age++;
      p.life--;
      if (p.life <= 0) {
        this.expireProjectile(p, pdef.burst);
        continue;
      }

      if (p.homing > 0) {
        const t = this.nearestEnemy(p.x, p.z, p.team);
        if (t) {
          const tx = t.x - p.x;
          const ty = t.y + t.def.height * 0.5 - p.y;
          const len = Math.hypot(tx, ty) || 1;
          p.vx += (tx / len) * p.homing * 6;
          p.vy += (ty / len) * p.homing * 6;
          const sp = Math.hypot(p.vx, p.vy) || 1;
          const want = pdef.speed;
          p.vx = (p.vx / sp) * want;
          p.vy = (p.vy / sp) * want;
        }
      }

      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.vy -= p.gravity;

      // Mines settle on the floor and wait.
      if (pdef.style === 'mine' && p.y <= 0) {
        p.y = 0;
        p.vx *= 0.6;
        p.vy = 0;
      } else if (p.y < -4 && pdef.style !== 'beam' && pdef.style !== 'geyser') {
        this.expireProjectile(p, pdef.burst);
        continue;
      }

      if (p.x < -80 || p.x > this.stage.width + 80) {
        p.dead = true;
        continue;
      }

      this.projectileHits(p, pdef.pierce);
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (this.projectiles[i].dead) this.projectiles.splice(i, 1);
    }
  }

  private projectileHits(p: Projectile, pierce: number): void {
    const pdef = getProjectile(p.kind);
    const h = p.hit;
    const halfW = h.box.w / 2;
    const halfH = h.box.h / 2;
    const zw = h.box.zw ?? 14;
    const x0 = p.x - halfW;
    const x1 = p.x + halfW;
    const y0 = pdef.style === 'beam' || pdef.style === 'geyser' ? p.y : p.y - halfH;
    const y1 = y0 + h.box.h;

    for (const b of this.fighters) {
      if (b.dead || b.team === p.team || b.invuln > 0) continue;
      if (p.hitList.includes(b.uid)) continue;
      const bx0 = b.x - b.def.half;
      const bx1 = b.x + b.def.half;
      if (x1 < bx0 || x0 > bx1) continue;
      if (y1 < b.y || y0 > b.y + b.def.height) continue;
      if (Math.abs(b.z - p.z) > zw + b.def.depth) continue;

      p.hitList.push(b.uid);
      const owner = this.byUid(p.owner);
      this.applyProjectileHit(owner, b, h, p);
      if (p.hitList.length > pierce) {
        this.expireProjectile(p, pdef.burst);
        return;
      }
    }

    // Blasts clash: the stronger one survives with reduced power.
    if (pdef.power >= 10) {
      for (const q of this.projectiles) {
        if (q === p || q.dead || q.team === p.team) continue;
        if (Math.abs(q.x - p.x) > 26 || Math.abs(q.y - p.y) > 26) continue;
        if (Math.abs(q.z - p.z) > 22) continue;
        const qdef = getProjectile(q.kind);
        this.emit('clash', (p.x + q.x) / 2, (p.y + q.y) / 2, p.z, 1.3, '#ffffff', 14, 1);
        this.sfx.push('clash');
        this.shake = Math.max(this.shake, 3);
        if (p.power > q.power) {
          p.power -= qdef.power;
          q.dead = true;
        } else if (q.power > p.power) {
          q.power -= pdef.power;
          p.dead = true;
        } else {
          p.dead = true;
          q.dead = true;
        }
        return;
      }
    }
  }

  private applyProjectileHit(owner: Fighter | null, b: Fighter, h: HitDef, p: Projectile): void {
    // Reuse the melee resolver by borrowing the owner's facing/position through
    // a lightweight proxy — projectiles and fists should feel identical to hit.
    const proxy = owner ?? this.fighters[0];
    if (!proxy) return;
    const savedX = proxy.x;
    const savedFacing = proxy.facing;
    proxy.x = p.x - p.facing * 20;
    proxy.facing = p.facing;
    this.applyHit(proxy, b, h);
    proxy.x = savedX;
    proxy.facing = savedFacing;
  }

  private expireProjectile(p: Projectile, burst?: string): void {
    if (p.dead) return;
    p.dead = true;
    if (burst) this.emit(burst, p.x, p.y, p.z, p.scale * 1.4, p.color, 12, p.facing);
  }

  // -- pickups -------------------------------------------------------------

  private stepPickups(): void {
    for (const it of this.pickups) {
      it.life--;
      it.x += it.vx;
      it.y += it.vy;
      it.vy -= GRAVITY * 0.6;
      if (it.y <= 0) {
        it.y = 0;
        it.vy = 0;
        it.vx *= 0.7;
      }
      if (it.life <= 0) {
        it.dead = true;
        continue;
      }
      for (const f of this.fighters) {
        if (f.dead || f.team !== 0) continue;
        if (Math.abs(f.x - it.x) > f.def.half + 16) continue;
        if (Math.abs(f.z - it.z) > f.def.depth + 14) continue;
        if (f.y > 40) continue;
        this.consume(f, it.kind);
        it.dead = true;
        break;
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      if (this.pickups[i].dead) this.pickups.splice(i, 1);
    }
  }

  private consume(f: Fighter, kind: string): void {
    switch (kind) {
      case 'heal':
        f.hp = Math.min(f.hpMax, f.hp + f.hpMax * 0.25);
        this.pushNumber(f.x, f.def.height, f.z, Math.round(f.hpMax * 0.25), '#6fe08a', false);
        this.emit('healRing', f.x, 10, f.z, 1.2, '#6fe08a', 10, f.facing);
        this.sfx.push('pickupHeal');
        break;
      case 'mana':
        f.mp = Math.min(f.mpMax, f.mp + f.mpMax * 0.4);
        this.emit('healRing', f.x, 10, f.z, 1.2, '#6fb8ff', 10, f.facing);
        this.sfx.push('pickupMana');
        break;
      default:
        f.weapon = kind;
        f.weaponUses = kind === 'knife' ? 8 : 12;
        this.sfx.push('pickupWeapon');
        break;
    }
  }

  // -- helpers -------------------------------------------------------------

  byUid(uid: number): Fighter | null {
    if (uid === 0) return null;
    return this.fighters.find((f) => f.uid === uid) ?? null;
  }

  nearestEnemy(x: number, z: number, team: Team): Fighter | null {
    let best: Fighter | null = null;
    let bestD = Infinity;
    for (const f of this.fighters) {
      if (f.dead || f.team === team) continue;
      const d = Math.abs(f.x - x) + Math.abs(f.z - z) * 0.5;
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  players(): Fighter[] {
    return this.fighters.filter((f) => f.team === 0);
  }

  emit(kind: string, x: number, y: number, z: number, scale: number, color: string, count: number, facing: number): void {
    this.fx.push({ kind, x, y, z, scale, color, count, facing });
  }

  private pushNumber(x: number, y: number, z: number, value: number, color: string, crit: boolean): void {
    this.damageNumbers.push({
      x,
      y,
      z,
      value,
      life: 48,
      crit,
      color,
      vy: crit ? 2.4 : 1.7,
      vx: this.rng.range(-0.7, 0.7),
    });
    if (this.damageNumbers.length > 60) this.damageNumbers.shift();
  }

  private updateDamageNumbers(): void {
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const d = this.damageNumbers[i];
      d.y += d.vy;
      d.x += d.vx;
      d.vy *= 0.92;
      if (--d.life <= 0) this.damageNumbers.splice(i, 1);
    }
  }

  private updateCamera(): void {
    const ps = this.players().filter((f) => !f.dead);
    let tx = this.camX + 480;
    if (ps.length > 0) {
      tx = ps.reduce((s, f) => s + f.x, 0) / ps.length;
      // Lead the camera slightly toward the nearest threat so incoming enemies
      // are on screen before they are in range.
      const threat = this.nearestEnemy(tx, 60, 0);
      if (threat && Math.abs(threat.x - tx) < 520) tx += (threat.x - tx) * 0.18;
    }
    const target = clamp(tx - 480, 0, Math.max(0, this.stage.width - 960));
    this.camX += (target - this.camX) * 0.09;
    this.camZoom += (this.zoomRequest - this.camZoom) * 0.12;
  }
}
