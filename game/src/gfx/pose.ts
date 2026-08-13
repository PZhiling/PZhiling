/**
 * Pose library.
 *
 * Fighters are drawn from a small skeleton rather than from sprite sheets, so
 * one pose serves all 15 characters and each one still reads differently
 * through its `Look` (proportions, palette, hair, weapon, aura).
 *
 * Angle convention: degrees, 0 points straight down, positive rotates forward
 * (toward the direction the fighter faces). Elbow and knee angles are relative
 * to their parent bone.
 */

export interface Pose {
  /** Root offset in body units (1 = one body height), x is forward. */
  rx: number;
  ry: number;
  /** Torso tilt. */
  lean: number;
  head: number;
  /** 0 = standing tall, 1 = fully crouched. */
  crouch: number;
  /** [shoulder, elbow] for the arm away from / nearest the camera. */
  armFar: [number, number];
  armNear: [number, number];
  /** [hip, knee]. */
  legFar: [number, number];
  legNear: [number, number];
  /** Extra rotation of the held weapon. */
  wpn: number;
  /** Whole-body rotation about the hips — spin kicks, flips, tumbles. */
  spin: number;
  /** Non-uniform scale, for squash-and-stretch on jumps and impacts. */
  sx: number;
  sy: number;
}

type PoseInit = Partial<Pose>;

const BASE: Pose = {
  rx: 0,
  ry: 0,
  lean: 0,
  head: 0,
  crouch: 0,
  armFar: [10, 15],
  armNear: [-10, 15],
  legFar: [6, 4],
  legNear: [-6, 4],
  wpn: 0,
  spin: 0,
  sx: 1,
  sy: 1,
};

function p(init: PoseInit): Pose {
  return { ...BASE, ...init };
}

export const POSES: Record<string, Pose> = {
  // ---- idle / locomotion -------------------------------------------------
  stand: p({ armFar: [14, 22], armNear: [-14, 24], legFar: [7, 5], legNear: [-7, 5] }),
  stand2: p({
    ry: 0.012,
    lean: -1.5,
    head: -2,
    armFar: [10, 30],
    armNear: [-10, 32],
    legFar: [6, 3],
    legNear: [-6, 3],
  }),
  walk1: p({
    lean: 3,
    armFar: [-26, 18],
    armNear: [24, 20],
    legFar: [26, 6],
    legNear: [-24, 30],
    ry: 0.008,
  }),
  walk2: p({ lean: 4, armFar: [0, 16], armNear: [0, 16], legFar: [4, 2], legNear: [-2, 8] }),
  walk3: p({
    lean: 3,
    armFar: [26, 20],
    armNear: [-26, 18],
    legFar: [-24, 30],
    legNear: [26, 6],
    ry: 0.008,
  }),
  walk4: p({ lean: 4, armFar: [0, 16], armNear: [0, 16], legFar: [-2, 8], legNear: [4, 2] }),
  run1: p({
    lean: 15,
    head: -8,
    armFar: [-58, 62],
    armNear: [52, 58],
    legFar: [46, 12],
    legNear: [-40, 74],
    ry: 0.02,
  }),
  run2: p({
    lean: 17,
    head: -9,
    armFar: [-12, 50],
    armNear: [10, 50],
    legFar: [8, 6],
    legNear: [-6, 40],
  }),
  run3: p({
    lean: 15,
    head: -8,
    armFar: [52, 58],
    armNear: [-58, 62],
    legFar: [-40, 74],
    legNear: [46, 12],
    ry: 0.02,
  }),
  crouch: p({ crouch: 0.75, lean: 12, armFar: [30, 50], armNear: [-24, 46], legFar: [30, 80], legNear: [-26, 84] }),

  // ---- air ---------------------------------------------------------------
  jumpPrep: p({ crouch: 0.85, lean: 16, armFar: [-40, 20], armNear: [-44, 22], legFar: [22, 86], legNear: [-20, 88], sy: 0.9, sx: 1.08 }),
  jumpRise: p({
    ry: 0.02,
    lean: -6,
    armFar: [-96, 26],
    armNear: [-104, 22],
    legFar: [30, 46],
    legNear: [-14, 22],
    sy: 1.07,
    sx: 0.94,
  }),
  jumpApex: p({ lean: 2, armFar: [-70, 40], armNear: [-76, 38], legFar: [34, 58], legNear: [-20, 34] }),
  jumpFall: p({
    lean: 10,
    armFar: [-52, 60],
    armNear: [-58, 56],
    legFar: [-16, 30],
    legNear: [26, 62],
    sy: 1.04,
  }),
  land: p({ crouch: 0.7, lean: 14, armFar: [42, 44], armNear: [-38, 40], legFar: [26, 78], legNear: [-24, 80], sy: 0.88, sx: 1.1 }),
  dash: p({
    lean: 26,
    head: -14,
    armFar: [-80, 30],
    armNear: [70, 40],
    legFar: [56, 16],
    legNear: [-46, 70],
  }),
  airStall: p({ lean: -4, armFar: [-120, 14], armNear: [-124, 12], legFar: [10, 24], legNear: [-8, 22] }),

  // ---- basic attacks -----------------------------------------------------
  punch1: p({ lean: 9, armFar: [-30, 26], armNear: [86, 6], legFar: [16, 8], legNear: [-16, 14], rx: 0.02 }),
  punch2: p({ lean: 13, armFar: [92, 4], armNear: [-42, 34], legFar: [-14, 12], legNear: [22, 10], rx: 0.05 }),
  punch3: p({ lean: 18, head: 6, armFar: [98, 2], armNear: [-56, 40], legFar: [30, 10], legNear: [-24, 26], rx: 0.09 }),
  hook: p({ lean: 16, spin: -8, armFar: [-20, 20], armNear: [70, 62], legFar: [20, 8], legNear: [-18, 18], rx: 0.04 }),
  uppercut: p({
    lean: -16,
    head: 10,
    armFar: [-8, 20],
    armNear: [128, 18],
    legFar: [12, 40],
    legNear: [-18, 16],
    ry: 0.03,
    rx: 0.03,
  }),
  kick: p({ lean: -14, armFar: [-46, 30], armNear: [-30, 34], legFar: [96, 6], legNear: [-14, 10], rx: 0.05 }),
  kickHigh: p({ lean: -22, armFar: [-60, 26], armNear: [-40, 30], legFar: [126, 4], legNear: [-10, 8], rx: 0.05 }),
  sweep: p({ crouch: 0.85, lean: 20, spin: -6, armFar: [60, 30], armNear: [-70, 40], legFar: [104, 4], legNear: [-30, 96], rx: 0.06 }),
  spinKick: p({ spin: 32, lean: -8, armFar: [-90, 20], armNear: [90, 20], legFar: [110, 6], legNear: [-30, 40] }),
  aerialKick: p({ lean: 24, armFar: [-70, 30], armNear: [-56, 26], legFar: [92, 4], legNear: [-30, 62] }),
  stomp: p({ lean: -6, armFar: [-100, 24], armNear: [-104, 20], legFar: [10, 4], legNear: [12, 4], sy: 1.05 }),
  elbow: p({ lean: 20, armFar: [-14, 120], armNear: [58, 128], legFar: [22, 12], legNear: [-20, 22], rx: 0.04 }),
  headbutt: p({ lean: 30, head: 16, armFar: [-40, 60], armNear: [-36, 62], legFar: [26, 14], legNear: [-24, 30], rx: 0.06 }),

  // ---- weapon swings -----------------------------------------------------
  slashWind: p({ lean: -16, spin: -6, armFar: [-40, 30], armNear: [-116, 40], legFar: [-16, 14], legNear: [22, 18], wpn: -50 }),
  slash1: p({ lean: 16, armFar: [-16, 30], armNear: [66, 10], legFar: [26, 8], legNear: [-22, 20], wpn: 22, rx: 0.05 }),
  slash2: p({ lean: 22, spin: 8, armFar: [10, 24], armNear: [104, 8], legFar: [-18, 16], legNear: [28, 12], wpn: 60, rx: 0.07 }),
  stab: p({ lean: 12, armFar: [-30, 26], armNear: [80, 2], legFar: [40, 8], legNear: [-30, 34], wpn: 84, rx: 0.11 }),
  overhead: p({ lean: 24, armFar: [88, 6], armNear: [84, 8], legFar: [20, 10], legNear: [-18, 24], wpn: 40, rx: 0.05 }),
  guardSword: p({ lean: -6, armFar: [30, 70], armNear: [40, 76], legFar: [12, 20], legNear: [-14, 24], wpn: -20, crouch: 0.2 }),

  // ---- casting -----------------------------------------------------------
  castWind: p({ lean: -14, head: -6, armFar: [-56, 84], armNear: [-62, 88], legFar: [16, 16], legNear: [-18, 22], crouch: 0.2 }),
  castPush: p({ lean: 16, armFar: [78, 8], armNear: [82, 6], legFar: [30, 10], legNear: [-26, 28], rx: 0.05 }),
  castUp: p({ lean: -10, head: -18, armFar: [-150, 10], armNear: [-146, 12], legFar: [10, 12], legNear: [-10, 14], ry: 0.01 }),
  castDown: p({ lean: 22, crouch: 0.5, armFar: [46, 24], armNear: [50, 22], legFar: [24, 56], legNear: [-22, 60] }),
  channel: p({ lean: -4, armFar: [-34, 96], armNear: [-30, 100], legFar: [12, 10], legNear: [-12, 10], ry: 0.008 }),
  summon: p({ lean: -8, head: -10, armFar: [-110, 30], armNear: [-40, 70], legFar: [14, 14], legNear: [-16, 18] }),
  superCast: p({ lean: -20, head: -14, armFar: [-132, 24], armNear: [-128, 26], legFar: [18, 18], legNear: [-20, 22], ry: 0.03, sy: 1.05 }),

  // ---- defense / reactions ----------------------------------------------
  guard: p({ crouch: 0.28, lean: -8, armFar: [40, 92], armNear: [34, 96], legFar: [14, 26], legNear: [-16, 30] }),
  guardHit: p({ crouch: 0.4, lean: -16, armFar: [50, 100], armNear: [44, 104], legFar: [10, 34], legNear: [-22, 38], rx: -0.03 }),
  hurt1: p({ lean: -18, head: -12, armFar: [-34, 46], armNear: [-26, 50], legFar: [-14, 18], legNear: [16, 26], rx: -0.03 }),
  hurt2: p({ lean: -30, head: -20, armFar: [-58, 40], armNear: [-48, 44], legFar: [-26, 26], legNear: [24, 34], rx: -0.06 }),
  hurtUp: p({ lean: -12, head: -22, armFar: [-96, 30], armNear: [-88, 34], legFar: [-8, 20], legNear: [10, 24], ry: 0.02 }),
  tumble: p({ spin: 60, lean: -20, armFar: [-70, 50], armNear: [-60, 54], legFar: [-40, 50], legNear: [40, 46] }),
  lying: p({ spin: 88, ry: -0.34, lean: 0, armFar: [-50, 20], armNear: [-46, 24], legFar: [-20, 16], legNear: [18, 14] }),
  getup: p({ crouch: 0.82, lean: 30, armFar: [70, 30], armNear: [-60, 40], legFar: [40, 84], legNear: [-30, 90] }),
  frozen: p({ crouch: 0.1, lean: 0, armFar: [24, 40], armNear: [-20, 44], legFar: [8, 6], legNear: [-8, 6] }),

  // ---- grapple -----------------------------------------------------------
  grab: p({ lean: 10, armFar: [80, 16], armNear: [76, 20], legFar: [22, 10], legNear: [-20, 18], rx: 0.05 }),
  hold: p({ lean: 6, armFar: [70, 30], armNear: [66, 34], legFar: [16, 8], legNear: [-16, 12] }),
  throwWind: p({ lean: -22, armFar: [-90, 30], armNear: [-86, 34], legFar: [-14, 16], legNear: [18, 20] }),
  throwRelease: p({ lean: 30, armFar: [110, 8], armNear: [106, 10], legFar: [34, 10], legNear: [-28, 30], rx: 0.08 }),
  held: p({ lean: -14, spin: 10, armFar: [-60, 40], armNear: [-56, 44], legFar: [-16, 30], legNear: [14, 34], ry: 0.03 }),

  // ---- flavour -----------------------------------------------------------
  taunt: p({ lean: -6, head: -10, armFar: [-140, 40], armNear: [-30, 60], legFar: [10, 8], legNear: [-10, 8] }),
  victory: p({ lean: -8, head: -12, armFar: [-150, 16], armNear: [-24, 70], legFar: [12, 8], legNear: [-14, 10], ry: 0.01 }),
  intro: p({ lean: 8, head: 4, armFar: [-30, 80], armNear: [40, 70], legFar: [18, 10], legNear: [-18, 14] }),
  dead: p({ spin: 90, ry: -0.36, armFar: [-60, 10], armNear: [-56, 12], legFar: [-14, 10], legNear: [12, 8] }),
};

/** Linear blend between two poses; used to smooth every frame transition. */
export function blendPose(a: Pose, b: Pose, t: number, out: Pose): Pose {
  const m = (x: number, y: number) => x + (y - x) * t;
  out.rx = m(a.rx, b.rx);
  out.ry = m(a.ry, b.ry);
  out.lean = m(a.lean, b.lean);
  out.head = m(a.head, b.head);
  out.crouch = m(a.crouch, b.crouch);
  out.armFar[0] = m(a.armFar[0], b.armFar[0]);
  out.armFar[1] = m(a.armFar[1], b.armFar[1]);
  out.armNear[0] = m(a.armNear[0], b.armNear[0]);
  out.armNear[1] = m(a.armNear[1], b.armNear[1]);
  out.legFar[0] = m(a.legFar[0], b.legFar[0]);
  out.legFar[1] = m(a.legFar[1], b.legFar[1]);
  out.legNear[0] = m(a.legNear[0], b.legNear[0]);
  out.legNear[1] = m(a.legNear[1], b.legNear[1]);
  out.wpn = m(a.wpn, b.wpn);
  out.spin = m(a.spin, b.spin);
  out.sx = m(a.sx, b.sx);
  out.sy = m(a.sy, b.sy);
  return out;
}

export function clonePose(src: Pose): Pose {
  return {
    ...src,
    armFar: [src.armFar[0], src.armFar[1]],
    armNear: [src.armNear[0], src.armNear[1]],
    legFar: [src.legFar[0], src.legFar[1]],
    legNear: [src.legNear[0], src.legNear[1]],
  };
}

export function getPose(id: string): Pose {
  return POSES[id] ?? POSES.stand;
}
