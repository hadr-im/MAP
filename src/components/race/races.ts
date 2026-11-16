import type { CarSpec } from "./race-sim";

/** Liveries from the page palette: the podium metals plus ivory and slate. The car doing the passing is always gold. */
const GOLD = "#d6ad55";
const SILVER = "#aeb5bd";
const BRONZE = "#b87952";
const IVORY = "#f3efe6";
const SLATE = "#6f767e";
const INK = "#141414";

/*
 * The three races between the page sections. In each, a car in the other lane runs ahead at the
 * same pace, and a faster car starts well back, catches the leader in its lane and pulls out to pass
 * with the passing lane clear. Checked frame by frame in race-sim.test.ts.
 */
export const RACES: Record<"one" | "two" | "three", CarSpec[]> = {
  one: [
    { livery: SILVER, accent: INK, lane: 0, pace: 1, gap: 0 },
    { livery: BRONZE, accent: INK, lane: 1, pace: 1, gap: -0.24 },
    { livery: GOLD, accent: INK, lane: 0, pace: 1.25, gap: 0.3 },
  ],
  two: [
    { livery: IVORY, accent: INK, lane: 1, pace: 1, gap: 0 },
    { livery: SLATE, accent: IVORY, lane: 0, pace: 1, gap: -0.26 },
    { livery: GOLD, accent: INK, lane: 1, pace: 1.27, gap: 0.32 },
  ],
  three: [
    { livery: BRONZE, accent: INK, lane: 0, pace: 1, gap: 0 },
    { livery: SILVER, accent: INK, lane: 1, pace: 1, gap: -0.22 },
    { livery: GOLD, accent: INK, lane: 0, pace: 1.24, gap: 0.28 },
  ],
};
