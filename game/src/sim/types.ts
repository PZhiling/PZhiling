/**
 * Simulation data model.
 *
 * Coordinate system (Little Fighter 2 style, "2.5D"):
 *   x — horizontal, along the stage. Positive is right.
 *   y — height above the floor. Positive is up. y = 0 means standing.
 *   z — depth into the arena. Small z is far from the camera, large z is near.
 *
 * Everything an action does is data, not code: frames carry velocities,
 * hitboxes, spawns and effects. That keeps the 15 characters readable and
 * makes a move editor (or a balance pass) a data change instead of a rewrite.
 */

export type Team = number;
export type Facing = 1 | -1;

/** Damage flavour. Drives both the numbers and how a hit looks and sounds. */
export type Element =
  | 'normal'
  | 'fire'
  | 'ice'
  | 'shock'
  | 'wind'
  | 'dark'
  | 'holy'
  | 'poison';

/** Local-space box, x measured forward of the fighter, y up from the feet. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Half-depth along z. Defaults to the fighter's own depth when omitted. */
  zw?: number;
}

export interface HitDef {
  box: Box;
  dmg: number;
  /** Knockback applied to the victim, in the attacker's facing direction. */
  kbx?: number;
  kby?: number;
  kbz?: number;
  /** Frames the victim cannot act. */
  hitstun?: number;
  /** Knockdown pressure. 20+ accumulated within a combo puts them on the floor. */
  fall?: number;
  /** Guard pressure. Breaks a block once the defender's meter empties. */
  guard?: number;
  blockable?: boolean;
  element?: Element;
  /** Freeze frames on connect — the single biggest contributor to "weight". */
  hitstop?: number;
  shake?: number;
  /** Hit every target once per action instead of once per interval. */
  once?: boolean;
  /** Ignores blocking entirely (grabs, unblockable supers). */
  unblockable?: boolean;
  /** Pulls the victim toward the attacker instead of away. */
  vacuum?: number;
  /** Marks the hit as a combo starter that leaves the victim airborne. */
  launcher?: boolean;
  /** Percentage of damage returned to the attacker as HP. */
  lifesteal?: number;
  sfx?: string;
}

export interface SpawnDef {
  kind: string;
  /** Offset from the fighter origin, x is forward-relative. */
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  /** Spawn several at once, fanned out over this many degrees. */
  count?: number;
  spread?: number;
  /** Randomised offsets, so repeated casts do not look stamped. */
  jitter?: number;
}

export interface FrameFx {
  kind: string;
  x?: number;
  y?: number;
  z?: number;
  scale?: number;
  color?: string;
  count?: number;
}

/** One animation frame of an action. */
export interface Frame {
  /** Duration in simulation ticks (the sim runs at 60 Hz). */
  dur: number;
  /** Named pose from the pose library, or an inline pose. */
  pose: string;
  /** Velocity *set* on the tick this frame starts (not additive). */
  vx?: number;
  vy?: number;
  vz?: number;
  /** Velocity added on the tick this frame starts. */
  dvx?: number;
  dvy?: number;
  hit?: HitDef;
  spawn?: SpawnDef[];
  fx?: FrameFx[];
  sfx?: string;
  /** Fighter is intangible for this frame. */
  invuln?: boolean;
  /** Fighter has super armour: takes damage but no hitstun. */
  armor?: boolean;
  /** Ignores gravity while this frame runs (hovering casts, air stalls). */
  float?: boolean;
  /** Drains MP when the frame starts. Negative values restore MP. */
  mp?: number;
  /** Heals the fighter when the frame starts. */
  heal?: number;
  /** Actions this frame can be cancelled into by a fresh input. */
  cancel?: string[];
  /** Screen-level flourish for the big moves. */
  flash?: string;
  slowmo?: number;
  /** Camera zoom multiplier requested by this frame. */
  zoom?: number;
}

export interface Action {
  id: string;
  frames: Frame[];
  /** Action entered when the last frame ends. Defaults to 'stand'. */
  next?: string;
  loop?: boolean;
  /** Movement input is honoured while this action runs. */
  mobile?: boolean;
  /** Facing may flip while this action runs. */
  turnable?: boolean;
  /** MP required to start. */
  mpCost?: number;
  /** Ticks before the action can be used again. */
  cooldown?: number;
  /** Category, used by the AI and the HUD. */
  tag?: 'basic' | 'special' | 'super' | 'movement' | 'reaction' | 'system';
  /** Human-readable name shown on the skill button. */
  name?: string;
  /** Short Thai description shown in character select. */
  desc?: string;
}

/** Per-character visual recipe consumed by the procedural renderer. */
export interface Look {
  /** Overall body scale. 1.0 is the reference fighter (~72px tall). */
  scale: number;
  /** Shoulder-to-hip ratio; heavies are wider. */
  build: number;
  skin: string;
  hair: string;
  hairStyle: 'short' | 'long' | 'pony' | 'spiky' | 'bald' | 'hood' | 'topknot' | 'braid';
  /** Primary, secondary and trim colours of the outfit. */
  primary: string;
  secondary: string;
  trim: string;
  /** Signature glow — auras, trails and impact flashes read from this. */
  aura: string;
  cape?: string;
  /** Drawn in the lead hand while idle. */
  weapon?: 'sword' | 'staff' | 'blade' | 'gauntlet' | 'spear' | 'fan' | 'claw' | 'none';
  /** Ambient particles that follow the fighter around. */
  ambient?: 'embers' | 'frost' | 'sparks' | 'petals' | 'shadow' | 'leaves' | 'motes' | 'none';
}

export interface CharacterDef {
  id: string;
  name: string;
  nameTh: string;
  /** One-line personality hook, shown in select. */
  titleTh: string;
  bioTh: string;
  archetype: 'rushdown' | 'grappler' | 'zoner' | 'allrounder' | 'technical' | 'tank' | 'assassin';
  hp: number;
  mp: number;
  /** MP regenerated per second. */
  mpRegen: number;
  walkSpeed: number;
  runSpeed: number;
  /** Sideways (depth) movement speed. LF2 depth movement is slower than walking. */
  zSpeed: number;
  jump: number;
  /** How many extra jumps the character has in the air. */
  airJumps: number;
  weight: number;
  /** Half-width and depth of the collision body. */
  half: number;
  depth: number;
  height: number;
  look: Look;
  /** Character-specific actions merged over the shared move set. */
  actions: Record<string, Action>;
  /** The four buttons shown on the mobile skill pad, in order. */
  skills: string[];
  /** Optional per-character defaults for shared moves (dash distance etc). */
  tuning?: Partial<Record<string, number>>;
}

export type FighterMode = 'player' | 'ai';

export interface Fighter {
  uid: number;
  charId: string;
  def: CharacterDef;
  team: Team;
  mode: FighterMode;
  /** Index into the input source array; -1 for AI. */
  pad: number;

  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: Facing;

  hp: number;
  hpMax: number;
  /** Trails behind hp and drains slowly — the classic "red damage" bar. */
  hpGhost: number;
  mp: number;
  mpMax: number;

  action: Action;
  frameIdx: number;
  frameTime: number;
  /** Ticks of hitstop remaining. The fighter is frozen but still rendered. */
  hitstop: number;
  hitstun: number;
  blockstun: number;
  invuln: number;
  /** Accumulated knockdown pressure; decays out of combat. */
  fallPoints: number;
  /** Guard meter; empties under pressure and re-fills while not blocking. */
  guard: number;
  guardMax: number;

  comboCount: number;
  comboTimer: number;

  /** uids already hit by the current action, so a swing does not multi-hit. */
  hitList: number[];
  cooldowns: Record<string, number>;

  /** Status effects, in ticks. */
  burn: number;
  freeze: number;
  shock: number;
  poison: number;

  /** Grab relationship. */
  holding: number;
  heldBy: number;

  /** Item carried in hand (weapon pickup). */
  weapon: string | null;
  weaponUses: number;

  /** Cosmetic history used for after-images. */
  ghosts: { x: number; y: number; z: number; facing: Facing; pose: string; t: number }[];

  /** Lives remaining in stage mode. */
  lives: number;
  respawnTimer: number;
  dead: boolean;

  /** Set by AI, read by the sim; players fill this from the input layer. */
  cmd: Command;

  /** Score bookkeeping. */
  damageDealt: number;
  kos: number;

  /** Character-specific scratch space (charge levels, stance flags). */
  vars: Record<string, number>;
}

export interface Command {
  /** -1, 0, 1 on each axis. */
  mx: number;
  mz: number;
  /** Edge-triggered button presses for this tick. */
  attack: boolean;
  jump: boolean;
  defend: boolean;
  /** Held state, used for charging and blocking. */
  attackHeld: boolean;
  defendHeld: boolean;
  /** Direct skill invocation (mobile buttons). Index into def.skills, or -1. */
  skill: number;
  /** True on the tick the run command was double-tapped. */
  run: boolean;
}

export interface Projectile {
  uid: number;
  kind: string;
  owner: number;
  team: Team;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: Facing;
  life: number;
  hit: HitDef;
  /** Projectile "health" — beams and blasts can clash and cancel out. */
  power: number;
  hitList: number[];
  /** Renderer hint. */
  style: string;
  color: string;
  scale: number;
  /** Ticks since spawn, for animation. */
  age: number;
  gravity: number;
  /** Homing strength, 0 for straight shots. */
  homing: number;
  target: number;
  /** Spawns another entity when it expires or connects. */
  onExpire?: SpawnDef;
  dead: boolean;
}

export interface Pickup {
  uid: number;
  kind: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  dead: boolean;
}

export interface StageWave {
  /** Character ids to spawn. */
  enemies: string[];
  /** Level multiplier applied to hp and damage. */
  level?: number;
  /** Spawn from the left edge, right edge, or both. */
  from?: 'left' | 'right' | 'both';
  /** Wave banner text. */
  bannerTh?: string;
  /** Marks the wave as the stage boss fight. */
  boss?: boolean;
}

export interface StageDef {
  id: string;
  nameTh: string;
  subtitleTh: string;
  /** Procedural backdrop recipe id. */
  theme: string;
  /** Stage length in world units. */
  width: number;
  /** Playable depth band. */
  zNear: number;
  zFar: number;
  /** Palette that drives sky, fog and lighting. */
  palette: {
    skyTop: string;
    skyBottom: string;
    sun: string;
    fog: string;
    ground: string;
    groundLine: string;
    /** Tint multiplied over every fighter — this is what sells "same engine,
     * different world". */
    ambient: string;
    ambientStrength: number;
  };
  weather: 'none' | 'snow' | 'rain' | 'embers' | 'petals' | 'sand' | 'ash' | 'fireflies' | 'stars';
  waves: StageWave[];
  /** Item drops available on this stage. */
  drops: string[];
  musicTh: string;
  /** Music prompt for Google Flow, kept beside the stage it belongs to. */
  musicPrompt: string;
}
