import { normalizeDepartment } from "./config";
import { OC_GROUP, type CountMetric, type GroupGoals, type LeaderboardConfig, type Member, type Metric } from "./types";

export type Counts = Record<Metric, number>;

export const emptyCounts = (): Counts => ({ signups: 0, approvals: 0, opens: 0, referrals: 0, revenue: 0 });

const COUNT_METRICS: { metric: CountMetric; points: keyof LeaderboardConfig["points"] }[] = [
  { metric: "approvals", points: "approval" },
  { metric: "opens", points: "open" },
  { metric: "referrals", points: "referral" },
];

/** The group whose goals a member is measured against first: OC for OC members, else their department's. */
export function resolveGroup(member: Member, config: LeaderboardConfig): GroupGoals | null {
  return resolveGroups(member, config)[0] ?? null;
}

/**
 * Every set of goals a member may qualify through. Everyone has one: their department's group.
 * OC members have two — the OC goals or their own department's — and either one puts them on the grid.
 */
export function resolveGroups(member: Member, config: LeaderboardConfig): GroupGoals[] {
  const find = (id: string) => config.groups.find((g) => g.id.toLowerCase() === id.toLowerCase()) ?? null;
  const dept = normalizeDepartment(member.department);
  const entry = Object.entries(config.departmentGroups).find(([code]) => normalizeDepartment(code) === dept);
  const departmentGoals = entry ? find(entry[1]) : null;
  const ocGoals = member.isOC ? find(OC_GROUP) : null;
  return [ocGoals, departmentGoals].filter((g): g is GroupGoals => g !== null);
}

export interface GoalProgress {
  metric: Metric;
  value: number;
  goal: number;
  /** value ÷ goal, e.g. 1.25 for 125%. */
  ratio: number;
  met: boolean;
}

export interface Evaluation {
  eligible: boolean;
  /** Signups first, then the group's other goals (only goals above 0). */
  progress: GoalProgress[];
  /** Points from approvals, opens and referrals. */
  points: number;
  /** Ranking score as a ratio (1.25 = 125%). */
  score: number;
  /** How close to qualifying: average of each goal's progress, each capped at 100%. 1 = every goal met. */
  readiness: number;
}

/**
 * Eligible = signup goal met AND every other goal above 0 met.
 * Score = earned points ÷ goal points for approvals/opens/referrals (summed when a group has
 * several, e.g. IGV: (approvals + opens) ÷ (7 + 4)), or revenue ÷ revenue goal.
 * If a group ever has both kinds, the two ratios are averaged. Signups never add to the score.
 */
export function evaluate(counts: Counts, goals: GroupGoals, points: LeaderboardConfig["points"]): Evaluation {
  const progress: GoalProgress[] = [];
  const add = (metric: Metric, goal: number) => {
    const value = counts[metric];
    progress.push({ metric, value, goal, ratio: goal > 0 ? value / goal : 0, met: value >= goal });
  };
  // A goal of 0 is not a goal: it is left out entirely, so nothing shows "0/0" or counts as met.
  if (goals.signups > 0) add("signups", goals.signups);

  let earned = 0;
  let needed = 0;
  for (const { metric, points: key } of COUNT_METRICS) {
    if (goals[metric] <= 0) continue;
    add(metric, goals[metric]);
    earned += counts[metric] * points[key];
    needed += goals[metric] * points[key];
  }
  if (goals.revenue > 0) add("revenue", goals.revenue);

  const ratios: number[] = [];
  if (needed > 0) ratios.push(earned / needed);
  if (goals.revenue > 0) ratios.push(counts.revenue / goals.revenue);
  const score = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;

  // Signups are the gate, not the race: approvals, opens, referrals and revenue count double here,
  // so someone with their approvals in hand ranks above someone sitting on signups alone.
  const withGoal = progress.filter((p) => p.goal > 0);
  const weightOf = (metric: Metric) => (metric === "signups" ? 1 : 2);
  const weighted = withGoal.reduce((sum, p) => sum + Math.min(1, p.ratio) * weightOf(p.metric), 0);
  const totalWeight = withGoal.reduce((sum, p) => sum + weightOf(p.metric), 0);
  const readiness = totalWeight ? weighted / totalWeight : 1;

  // A group with no goals at all can't be qualified for; otherwise everyone in it would pass on day one.
  return { eligible: progress.length > 0 && progress.every((p) => p.met), progress, points: earned, score, readiness };
}
