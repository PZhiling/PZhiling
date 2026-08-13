/**
 * Enemy AI.
 *
 * Produces a `Command` per tick, exactly like a human pad — the simulation
 * cannot tell the difference. Behaviour is driven by archetype so a zoner
 * actually plays keep-away instead of walking into your fists, which is what
 * makes a wave of mixed enemies feel designed rather than random.
 *
 * A short decision timer keeps each enemy committed to a plan for a beat.
 * Without it, several AIs sharing one frame budget produce twitchy garbage.
 */

import { emptyCommand } from '../core/input';
import { clamp, sign } from '../core/math';
import type { Command, Fighter } from './types';
import type { World } from './world';

/** Preferred fighting distance per archetype, in world units. */
const IDEAL_RANGE: Record<string, number> = {
  rushdown: 34,
  assassin: 38,
  grappler: 30,
  allrounder: 46,
  tank: 40,
  technical: 92,
  zoner: 260,
};

/** How often the AI is willing to press a special, per archetype. */
const SPECIAL_BIAS: Record<string, number> = {
  rushdown: 0.5,
  assassin: 0.55,
  grappler: 0.45,
  allrounder: 0.5,
  tank: 0.42,
  technical: 0.62,
  zoner: 0.78,
};

export function decideAi(world: World, f: Fighter): Command {
  const cmd = emptyCommand();
  if (f.dead || f.hitstun > 0 || f.freeze > 0 || f.heldBy !== 0) return cmd;

  const target = pickTarget(world, f);
  if (!target) return cmd;

  const dx = target.x - f.x;
  const dz = target.z - f.z;
  const adx = Math.abs(dx);
  const adz = Math.abs(dz);
  const facingTarget = sign(dx) === f.facing || dx === 0;

  // Difficulty knob: higher-level enemies think more often and hesitate less.
  const level = f.vars.level ?? 1;
  const reaction = Math.max(4, Math.round(16 - level * 5));
  f.vars.think = (f.vars.think ?? 0) - 1;
  if (f.vars.think <= 0) {
    f.vars.think = reaction;
    f.vars.plan = choosePlan(world, f, target, adx, adz);
  }
  const plan = f.vars.plan ?? 0;

  const ideal = IDEAL_RANGE[f.def.archetype] ?? 46;
  const rng = world.rng;

  // Always line up on the same depth lane first — attacks are depth-limited,
  // so a wrong lane means every swing whiffs.
  if (adz > f.def.depth * 0.8) cmd.mz = sign(dz);

  switch (plan) {
    case PLAN_APPROACH: {
      cmd.mx = sign(dx);
      // Run in when far, walk when close, so they do not skid past you.
      if (adx > 220 && f.y <= 0.5) cmd.run = true;
      if (adx < ideal * 1.1 && adz < f.def.depth * 1.2) f.vars.plan = PLAN_ATTACK;
      break;
    }
    case PLAN_ATTACK: {
      if (!facingTarget) cmd.mx = sign(dx);
      if (adx > ideal * 1.6) {
        f.vars.plan = PLAN_APPROACH;
        break;
      }
      // Jump-in against a blocking target; ground chain otherwise.
      if (target.action.id === 'defend' && rng.chance(0.35)) {
        cmd.jump = true;
        f.vars.plan = PLAN_JUMPIN;
        break;
      }
      const bias = SPECIAL_BIAS[f.def.archetype] ?? 0.5;
      if (rng.chance(bias * 0.35)) {
        cmd.skill = pickSkill(world, f, adx);
      } else {
        cmd.attack = true;
      }
      break;
    }
    case PLAN_JUMPIN: {
      cmd.mx = sign(dx);
      if (f.y > 20) cmd.attack = true;
      if (f.y <= 0.5) f.vars.plan = PLAN_ATTACK;
      break;
    }
    case PLAN_ZONE: {
      // Hold the preferred range: back off when crowded, close when too far.
      if (adx < ideal * 0.55) cmd.mx = -sign(dx);
      else if (adx > ideal * 1.25) cmd.mx = sign(dx);
      if (!facingTarget && adx > 8) f.facing = (sign(dx) || 1) as 1 | -1;
      if (adz < f.def.depth * 1.4 && rng.chance(0.6)) {
        cmd.skill = pickSkill(world, f, adx);
      }
      break;
    }
    case PLAN_RETREAT: {
      cmd.mx = -sign(dx);
      if (f.y <= 0.5 && rng.chance(0.08)) cmd.run = true;
      if (rng.chance(0.05)) cmd.skill = pickSkill(world, f, adx);
      break;
    }
    case PLAN_BLOCK: {
      cmd.defendHeld = true;
      cmd.defend = true;
      if (!facingTarget) f.facing = (sign(dx) || 1) as 1 | -1;
      break;
    }
    default:
      break;
  }

  // Reflex layer: react to what is actually incoming, regardless of the plan.
  if (incomingThreat(world, f) && f.y <= 0.5) {
    const dodgeChance = clamp(0.2 + level * 0.22, 0, 0.75);
    if (rng.chance(dodgeChance)) {
      if (f.def.archetype === 'zoner' || f.def.archetype === 'technical') {
        cmd.mz = f.z > (world.stage.zNear + world.stage.zFar) / 2 ? -1 : 1;
      } else {
        cmd.defendHeld = true;
        cmd.defend = true;
        cmd.attack = false;
      }
    }
  }

  return cmd;
}

const PLAN_APPROACH = 0;
const PLAN_ATTACK = 1;
const PLAN_ZONE = 2;
const PLAN_RETREAT = 3;
const PLAN_BLOCK = 4;
const PLAN_JUMPIN = 5;

function choosePlan(world: World, f: Fighter, target: Fighter, adx: number, adz: number): number {
  const rng = world.rng;
  const hpFrac = f.hp / f.hpMax;
  const arch = f.def.archetype;

  // Low health: back off and look for a special, unless it is a tank.
  if (hpFrac < 0.28 && arch !== 'tank' && arch !== 'grappler' && rng.chance(0.45)) {
    return PLAN_RETREAT;
  }
  // Being combo'd: try to block on wake-up.
  if (f.comboCount === 0 && target.comboCount >= 3 && rng.chance(0.5)) return PLAN_BLOCK;

  if (arch === 'zoner') {
    return adx < 120 && rng.chance(0.55) ? PLAN_RETREAT : PLAN_ZONE;
  }
  if (arch === 'technical') {
    if (adx > 200) return PLAN_APPROACH;
    return rng.chance(0.5) ? PLAN_ZONE : PLAN_ATTACK;
  }
  if (adx > 150 || adz > f.def.depth * 1.5) return PLAN_APPROACH;
  if (rng.chance(0.12)) return PLAN_BLOCK;
  return PLAN_ATTACK;
}

/** Choose the skill whose range best matches the current distance. */
function pickSkill(world: World, f: Fighter, adx: number): number {
  const skills = f.def.skills;
  const mpFrac = f.mp / f.mpMax;

  // Save the super (always the last slot) for when it will not be wasted.
  const superIdx = skills.length - 1;
  const superAct = f.def.actions[skills[superIdx]];
  if (superAct && f.mp >= (superAct.mpCost ?? 0) && (f.cooldowns[skills[superIdx]] ?? 0) <= 0) {
    if (adx < 200 && world.rng.chance(0.5)) return superIdx;
  }

  const usable: number[] = [];
  for (let i = 0; i < Math.min(3, skills.length); i++) {
    const act = f.def.actions[skills[i]];
    if (!act) continue;
    if ((f.cooldowns[skills[i]] ?? 0) > 0) continue;
    if (f.mp < (act.mpCost ?? 0)) continue;
    usable.push(i);
  }
  if (usable.length === 0) return -1;
  // Keep a little meter in reserve so they are never fully passive.
  if (mpFrac < 0.2 && world.rng.chance(0.6)) return -1;
  return world.rng.pick(usable);
}

/** Is a hostile projectile or an active attack about to land on this fighter? */
function incomingThreat(world: World, f: Fighter): boolean {
  for (const p of world.projectiles) {
    if (p.dead || p.team === f.team) continue;
    const closing = (p.x - f.x) * p.vx < 0;
    if (!closing) continue;
    if (Math.abs(p.x - f.x) < 150 && Math.abs(p.z - f.z) < 30) return true;
  }
  for (const o of world.fighters) {
    if (o.dead || o.team === f.team) continue;
    const fr = o.action.frames[o.frameIdx];
    if (!fr?.hit) continue;
    if (Math.abs(o.x - f.x) < 90 && Math.abs(o.z - f.z) < 24) return true;
  }
  return false;
}

function pickTarget(world: World, f: Fighter): Fighter | null {
  let best: Fighter | null = null;
  let bestScore = Infinity;
  for (const o of world.fighters) {
    if (o.dead || o.team === f.team) continue;
    // Prefer whoever is closest, but stay on a target you already chose.
    const d = Math.abs(o.x - f.x) + Math.abs(o.z - f.z) * 1.5;
    const sticky = o.uid === f.vars.targetUid ? -60 : 0;
    const score = d + sticky;
    if (score < bestScore) {
      bestScore = score;
      best = o;
    }
  }
  if (best) f.vars.targetUid = best.uid;
  return best;
}
