/** Pure race maths for the track separators: positions, lane changes and heading from scroll progress. */

export interface CarSpec {
  livery: string;
  accent?: string;
  /** Home lane: 0 = upper, 1 = lower. */
  lane: 0 | 1;
  /** Speed relative to the others. A faster car catches the one ahead in its lane and pulls out to pass. */
  pace: number;
  /** Start position as a fraction of the band's width: positive = behind the entry edge, negative = already on the straight. */
  gap: number;
}

/** Band width/height and car length/height, in px. */
export interface Course {
  W: number;
  H: number;
  L: number;
  h: number;
}

export interface Pose {
  x: number;
  y: number;
  rotation: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp = (min: number, max: number, v: number) => Math.min(max, Math.max(min, v));

/** Distance from the entry edge to the car's tail at progress p (0–1). */
export function along(c: CarSpec, p: number, m: Course): number {
  return -m.L - c.gap * m.W + p * c.pace * (1.6 * m.W + 4 * m.L);
}

/**
 * How far into the passing lane a car should be (0–1), given how far ahead (tail to tail) the slower car is.
 * Pulls out ~2.8 lengths behind, fully out while alongside, back in once ~2.4 lengths clear.
 */
export function overtake(gapAhead: number, L: number): number {
  if (gapAhead > 2.8 * L || gapAhead < -2.4 * L) return 0;
  if (gapAhead > 1.5 * L) return smooth((2.8 * L - gapAhead) / (1.3 * L));
  if (gapAhead < -1.1 * L) return smooth((gapAhead + 2.4 * L) / (1.3 * L));
  return 1;
}

/** 0 = in its home lane, 1 = fully in the other lane. */
export function laneShift(cars: CarSpec[], i: number, p: number, m: Course): number {
  const me = cars[i];
  const mine = along(me, p, m);
  let s = 0;
  cars.forEach((other, j) => {
    if (j === i || other.lane !== me.lane || other.pace >= me.pace) return;
    s = Math.max(s, overtake(along(other, p, m) - mine, m.L));
  });
  return s;
}

export const laneY = (lane: 0 | 1, m: Course) => m.H * (lane === 0 ? 0.3 : 0.7) - m.h / 2;

/** Where car i is drawn at progress p: left edge x, top y, and heading in degrees. */
export function pose(cars: CarSpec[], i: number, p: number, m: Course, reverse: boolean): Pose {
  const c = cars[i];
  const d = along(c, p, m);
  const home = laneY(c.lane, m);
  const passing = laneY(c.lane === 0 ? 1 : 0, m);
  const s = laneShift(cars, i, p, m);
  // Heading follows lateral movement: steer into the lane change, straighten out after.
  const slope = (laneShift(cars, i, p + 0.002, m) - laneShift(cars, i, p - 0.002, m)) / 0.004;
  const rotation = clamp(-9, 9, slope * Math.sign(passing - home) * 0.6) * (reverse ? -1 : 1);
  return { x: reverse ? m.W - d - m.L : d, y: home + s * (passing - home), rotation };
}
