import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import { emptyCounts, evaluate, resolveGroup, type Counts } from "./scoring";
import type { GroupGoals, Member } from "./types";

const goals = (id: string) => DEFAULT_CONFIG.groups.find((g) => g.id === id)!;
const counts = (c: Partial<Counts>): Counts => ({ ...emptyCounts(), ...c });
const points = DEFAULT_CONFIG.points;
/** A group as the goals used to be set, for the rules that are not about today's numbers. */
const custom = (g: Partial<GroupGoals>): GroupGoals => ({ id: "Test", signups: 0, approvals: 0, opens: 0, referrals: 0, revenue: 0, ...g });

describe("evaluate – each department's own approvals goal", () => {
  it("OGV: 9 approvals out of 6 = 150%", () => {
    const r = evaluate(counts({ approvals: 9 }), goals("OGV"), points);
    expect(r.eligible).toBe(true);
    expect(r.score).toBeCloseTo(1.5);
  });

  it("OGTa: 4 approvals out of 4 qualifies exactly", () => {
    const r = evaluate(counts({ approvals: 4 }), goals("OGTa"), points);
    expect(r.eligible).toBe(true);
    expect(r.score).toBeCloseTo(1);
  });

  it("IGT: 1 approval out of 2 is half way", () => {
    const r = evaluate(counts({ approvals: 1 }), goals("IGT"), points);
    expect(r.eligible).toBe(false);
    expect(r.score).toBeCloseTo(0.5);
  });

  it("Back office: 5 referrals out of 4 = 125%", () => {
    const r = evaluate(counts({ referrals: 5 }), goals("Back office"), points);
    expect(r.eligible).toBe(true);
    expect(r.score).toBeCloseTo(1.25);
  });

  it("OC: 3000 DT out of 2000 = 150%", () => {
    const r = evaluate(counts({ revenue: 3000 }), goals("OC"), points);
    expect(r.eligible).toBe(true);
    expect(r.score).toBeCloseTo(1.5);
    expect(r.progress.map((p) => p.metric)).toEqual(["revenue"]);
  });

  it("leaves signups and opens out while their goals are zero", () => {
    const r = evaluate(counts({ signups: 50, approvals: 6, opens: 9 }), goals("OGV"), points);
    expect(r.progress.map((p) => p.metric)).toEqual(["approvals"]);
  });
});

describe("evaluate – eligibility", () => {
  it("requires every goal a group sets, not just a high score", () => {
    const r = evaluate(counts({ approvals: 20, opens: 3 }), custom({ approvals: 7, opens: 4 }), points);
    expect(r.eligible).toBe(false);
    expect(r.progress.find((p) => p.metric === "opens")).toMatchObject({ value: 3, goal: 4, met: false });
  });

  it("requires the signup goal when there is one, even though signups give no points", () => {
    const r = evaluate(counts({ signups: 29, approvals: 10 }), custom({ signups: 30, approvals: 4 }), points);
    expect(r.eligible).toBe(false);
    expect(r.score).toBeCloseTo(2.5);
  });

  it("never qualifies anyone in a group with no goals at all", () => {
    const r = evaluate(counts({ approvals: 99 }), custom({}), points);
    expect(r.eligible).toBe(false);
    expect(r.progress).toEqual([]);
  });

  it("measures readiness with each goal capped at 100% and approvals weighted double", () => {
    // signups 15/30 = 50% (weight 1), approvals 8/4 capped at 100% (weight 2) → (0.5 + 2) / 3
    expect(evaluate(counts({ signups: 15, approvals: 8 }), custom({ signups: 30, approvals: 4 }), points).readiness).toBeCloseTo(0.8333);
  });

  it("puts earned approvals ahead of surplus signups", () => {
    const both = custom({ signups: 30, approvals: 4 });
    const allSignups = evaluate(counts({ signups: 60, approvals: 0 }), both, points).readiness;
    const allApprovals = evaluate(counts({ signups: 0, approvals: 4 }), both, points).readiness;
    expect(allApprovals).toBeGreaterThan(allSignups);
  });

  it("respects custom point values", () => {
    const r = evaluate(counts({ approvals: 7, opens: 4 }), custom({ approvals: 7, opens: 4 }), { approval: 2, open: 1, referral: 1 });
    expect(r.points).toBe(18);
    expect(r.score).toBeCloseTo(1);
  });
});

describe("resolveGroup", () => {
  const member = (department: string, isOC = false): Member => ({ name: "X", department, isOC });

  it("gives each department its own group, ignoring case", () => {
    expect(resolveGroup(member("OGTa"), DEFAULT_CONFIG)?.id).toBe("OGTa");
    expect(resolveGroup(member("ogte"), DEFAULT_CONFIG)?.id).toBe("OGTe");
    expect(resolveGroup(member("ogv"), DEFAULT_CONFIG)?.id).toBe("OGV");
    expect(resolveGroup(member("F&L"), DEFAULT_CONFIG)?.id).toBe("Back office");
  });

  it("BD and PM are back office unless they are OC", () => {
    expect(resolveGroup(member("PM"), DEFAULT_CONFIG)?.id).toBe("Back office");
    expect(resolveGroup(member("BD"), DEFAULT_CONFIG)?.id).toBe("Back office");
    expect(resolveGroup(member("PM", true), DEFAULT_CONFIG)?.id).toBe("OC");
  });

  it("OC comes first for an OC member", () => {
    expect(resolveGroup(member("IGT", true), DEFAULT_CONFIG)?.id).toBe("OC");
  });

  it("returns null for departments without a group", () => {
    expect(resolveGroup(member("EWA"), DEFAULT_CONFIG)).toBeNull();
  });
});
