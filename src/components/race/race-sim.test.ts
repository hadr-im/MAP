import { describe, expect, it } from "vitest";
import { RACES } from "./races";
import { pose, type Course } from "./race-sim";

/** Desktop and phone bands, with the car sizes the CSS clamps produce there. */
const COURSES: Record<string, Course> = {
  desktop: { W: 1900, H: 56, L: 44, h: 44 * (92 / 240) },
  laptop: { W: 1040, H: 44, L: 33, h: 33 * (92 / 240) },
  phone: { W: 375, H: 40, L: 28, h: 28 * (92 / 240) },
};

describe("track separator races", () => {
  for (const [raceName, cars] of Object.entries(RACES)) {
    for (const [courseName, m] of Object.entries(COURSES)) {
      it(`${raceName} never puts two cars on top of each other (${courseName})`, () => {
        for (let step = 0; step <= 1000; step++) {
          const p = step / 1000;
          const poses = cars.map((_, i) => pose(cars, i, p, m, false));
          for (let a = 0; a < cars.length; a++)
            for (let b = a + 1; b < cars.length; b++) {
              const overlapX = Math.abs(poses[a].x - poses[b].x) < m.L;
              const overlapY = Math.abs(poses[a].y - poses[b].y) < m.h;
              expect(overlapX && overlapY, `cars ${a} and ${b} overlap at p=${p}`).toBe(false);
            }
        }
      });
    }
  }
});
