import type { PublicDriver, PublicLeaderboard } from "./public";
import type { Metric } from "./types";

export type Interval = { kind: "units"; metric: Metric; units: number } | { kind: "level" };

const POINT_KEY = { approvals: "approval", opens: "open", referrals: "referral" } as const;
const EPS = 1e-9;

/**
 * The smallest single push that moves `self` past `target`, in the unit they're short of:
 * { metric: "approvals", units: 1 } reads "+1 approval to pass …".
 * Qualifying members are compared on progress (readiness); grid members on score.
 * Returns null when no single metric can close the gap.
 */
export function intervalTo(self: PublicDriver, target: PublicDriver, points: PublicLeaderboard["points"]): Interval | null {
  if (self.eligible !== target.eligible) return null;

  if (!self.eligible) {
    const gap = target.readiness - self.readiness;
    if (gap <= EPS) return { kind: "level" };
    const goals = self.progress.filter((p) => p.goal > 0);
    let best: Interval | null = null;
    for (const p of goals) {
      if (p.value >= p.goal) continue;
      const perUnit = 1 / (goals.length * p.goal);
      const units = Math.floor(gap / perUnit + EPS) + 1;
      if (p.value + units > p.goal + EPS) continue; // a goal stops counting once it's met
      if (!best || (best.kind === "units" && units < best.units)) best = { kind: "units", metric: p.metric, units };
    }
    return best;
  }

  const gap = target.score - self.score;
  if (gap <= EPS) return { kind: "level" };
  const countGoals = self.progress.filter((p) => p.metric in POINT_KEY && p.goal > 0);
  const revenue = self.progress.find((p) => p.metric === "revenue" && p.goal > 0);
  const mixed = countGoals.length > 0 && Boolean(revenue);
  let best: Interval | null = null;
  const consider = (metric: Metric, units: number) => {
    if (!best || (best.kind === "units" && units < best.units)) best = { kind: "units", metric, units };
  };

  if (countGoals.length) {
    const needed = countGoals.reduce((sum, p) => sum + p.goal * points[POINT_KEY[p.metric as keyof typeof POINT_KEY]], 0);
    for (const p of countGoals) {
      const pts = points[POINT_KEY[p.metric as keyof typeof POINT_KEY]];
      if (pts <= 0 || needed <= 0) continue;
      const perUnit = (pts / needed) / (mixed ? 2 : 1);
      consider(p.metric, Math.floor(gap / perUnit + EPS) + 1);
    }
  }
  if (revenue) {
    const perDt = 1 / revenue.goal / (mixed ? 2 : 1);
    consider("revenue", Math.floor(gap / perDt + EPS) + 1);
  }
  return best;
}
