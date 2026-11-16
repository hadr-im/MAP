import { describe, expect, it } from "vitest";
import { intervalTo } from "./intervals";
import type { PublicDriver } from "./public";

const points = { approval: 1, open: 1, referral: 1 };

function driver(partial: Partial<PublicDriver> & Pick<PublicDriver, "progress">): PublicDriver {
  return {
    id: "x",
    position: 1,
    name: "X",
    code: "XXX",
    department: "OGTa",
    group: "OGX",
    isOC: false,
    eligible: false,
    rank: null,
    score: 0,
    readiness: 0,
    points: 0,
    ...partial,
  };
}

describe("intervalTo – qualifying (progress)", () => {
  // OGX: signups /30 and approvals /4 → readiness = average of both, each capped at 100%.
  const ahead = driver({ readiness: (19 / 30 + 1) / 2, progress: [{ metric: "signups", value: 19, goal: 30 }, { metric: "approvals", value: 6, goal: 4 }] });

  it("finds the cheapest single push", () => {
    // self: 18/30 signups, 4/4 approvals → only signups can move; 1 more only draws level, 2 pass.
    const self = driver({ readiness: (18 / 30 + 1) / 2, progress: [{ metric: "signups", value: 18, goal: 30 }, { metric: "approvals", value: 4, goal: 4 }] });
    expect(intervalTo(self, ahead, points)).toEqual({ kind: "units", metric: "signups", units: 2 });
  });

  it("prefers an approval when one approval is worth more than many signups", () => {
    // self: 30/30 signups, 3/4 approvals = 87.5%; target at 90%. Signups are maxed, so it must be an approval.
    const target = driver({ readiness: 0.9, progress: [] });
    const self = driver({ readiness: (1 + 0.75) / 2, progress: [{ metric: "signups", value: 30, goal: 30 }, { metric: "approvals", value: 3, goal: 4 }] });
    expect(intervalTo(self, target, points)).toEqual({ kind: "units", metric: "approvals", units: 1 });
  });

  it("reports a tie as level", () => {
    const self = driver({ readiness: ahead.readiness, progress: ahead.progress });
    expect(intervalTo(self, ahead, points)).toEqual({ kind: "level" });
  });

  it("returns null across the cut-off", () => {
    expect(intervalTo(driver({ progress: [] }), driver({ eligible: true, progress: [] }), points)).toBeNull();
  });
});

describe("intervalTo – grid (score)", () => {
  it("counts approvals for OGX", () => {
    const p1 = driver({ eligible: true, score: 6 / 4, progress: [] });
    const self = driver({ eligible: true, score: 5 / 4, progress: [{ metric: "signups", value: 30, goal: 30 }, { metric: "approvals", value: 5, goal: 4 }] });
    expect(intervalTo(self, p1, points)).toEqual({ kind: "units", metric: "approvals", units: 2 });
  });

  it("counts DT for OC revenue", () => {
    const p1 = driver({ eligible: true, score: 3000 / 2000, progress: [] });
    const self = driver({ eligible: true, score: 2500 / 2000, progress: [{ metric: "signups", value: 10, goal: 10 }, { metric: "revenue", value: 2500, goal: 2000 }] });
    expect(intervalTo(self, p1, points)).toEqual({ kind: "units", metric: "revenue", units: 501 });
  });
});
