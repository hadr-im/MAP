import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import { emptyCounts, evaluate, resolveGroup, type Counts } from "./scoring";
import type { Member } from "./types";

const goals = (id: string) => DEFAULT_CONFIG.groups.find((g) => g.id === id)!;
const counts = (c: Partial<Counts>): Counts => ({ ...emptyCounts(), ...c });
const points = DEFAULT_CONFIG.points;

describe("evaluate – the examples agreed with the user", () => {
  it("OGX: 6 approvals out of 4 = 150%", () => {
    const r = evaluate(counts({ signups: 30, approvals: 6 }), goals("OGX"), points);
    expect(r.eligible).toBe(true);
    expect(r.score).toBeCloseTo(1.5);
  });

  it("Back office: 5 referrals out of 4 = 125%", () => {
    const r = evaluate(counts({ signups: 15, referrals: 5 }), goals("Back office"), points);
    expect(r.eligible).toBe(true);
    expect(r.score).toBeCloseTo(1.25);
  });

  it("OC: 3000 DT out of 2000 = 150%", () => {
    const r = evaluate(counts({ signups: 10, revenue: 3000 }), goals("OC"), points);
    expect(r.eligible).toBe(true);
    expect(r.score).toBeCloseTo(1.5);
    expect(r.progress.map((p) => p.metric)).toEqual(["signups", "revenue"]);
  });

  it("IGV: (9 approvals + 5 opens) ÷ (7 + 4)", () => {
    const r = evaluate(counts({ signups: 20, approvals: 9, opens: 5 }), goals("IGV"), points);
    expect(r.eligible).toBe(true);
    expect(r.score).toBeCloseTo(14 / 11);
    expect(r.points).toBe(14);
  });

  it("IGT: (5 approvals + 4 opens) ÷ (4 + 2) = 150%", () => {
    expect(evaluate(counts({ signups: 20, approvals: 5, opens: 4 }), goals("IGT"), points).score).toBeCloseTo(1.5);
  });
});

describe("evaluate – eligibility", () => {
  it("requires every goal, not just a high score", () => {
    const r = evaluate(counts({ signups: 20, approvals: 20, opens: 3 }), goals("IGV"), points);
    expect(r.eligible).toBe(false);
    expect(r.progress.find((p) => p.metric === "opens")).toMatchObject({ value: 3, goal: 4, met: false });
  });

  it("requires the signup goal even though signups give no points", () => {
    const r = evaluate(counts({ signups: 29, approvals: 10 }), goals("OGX"), points);
    expect(r.eligible).toBe(false);
    expect(r.score).toBeCloseTo(2.5);
  });

  it("measures readiness with each goal capped at 100% and approvals weighted double", () => {
    // signups 15/30 = 50% (weight 1), approvals 8/4 capped at 100% (weight 2) → (0.5 + 2) / 3
    expect(evaluate(counts({ signups: 15, approvals: 8 }), goals("OGX"), points).readiness).toBeCloseTo(0.8333);
  });

  it("puts earned approvals ahead of surplus signups", () => {
    const allSignups = evaluate(counts({ signups: 60, approvals: 0 }), goals("OGX"), points).readiness;
    const allApprovals = evaluate(counts({ signups: 0, approvals: 4 }), goals("OGX"), points).readiness;
    expect(allApprovals).toBeGreaterThan(allSignups);
  });

  it("respects custom point values", () => {
    const r = evaluate(counts({ signups: 20, approvals: 7, opens: 4 }), goals("IGV"), { approval: 2, open: 1, referral: 1 });
    expect(r.points).toBe(18);
    expect(r.score).toBeCloseTo(1);
  });
});

describe("resolveGroup", () => {
  const member = (department: string, isOC = false): Member => ({ name: "X", department, isOC });

  it("maps departments to groups, ignoring case", () => {
    expect(resolveGroup(member("OGTa"), DEFAULT_CONFIG)?.id).toBe("OGX");
    expect(resolveGroup(member("ogte"), DEFAULT_CONFIG)?.id).toBe("OGX");
    expect(resolveGroup(member("F&L"), DEFAULT_CONFIG)?.id).toBe("Back office");
  });

  it("BD and PM are back office unless they are OC", () => {
    expect(resolveGroup(member("PM"), DEFAULT_CONFIG)?.id).toBe("Back office");
    expect(resolveGroup(member("BD"), DEFAULT_CONFIG)?.id).toBe("Back office");
    expect(resolveGroup(member("PM", true), DEFAULT_CONFIG)?.id).toBe("OC");
  });

  it("OC replaces the department goal", () => {
    expect(resolveGroup(member("IGT", true), DEFAULT_CONFIG)?.id).toBe("OC");
  });

  it("returns null for departments without a group", () => {
    expect(resolveGroup(member("EWA"), DEFAULT_CONFIG)).toBeNull();
  });
});
