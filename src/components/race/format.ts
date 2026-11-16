import type { PublicDriver } from "@/lib/leaderboard/public";
import type { Metric } from "@/lib/leaderboard/types";

const int = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export const formatNumber = (n: number) => int.format(n);
export const percent = (ratio: number) => Math.round(ratio * 100);

export const METRIC_LABEL: Record<Metric, { one: string; many: string }> = {
  signups: { one: "signup", many: "signups" },
  approvals: { one: "approval", many: "approvals" },
  opens: { one: "open", many: "opens" },
  referrals: { one: "referral", many: "referrals" },
  revenue: { one: "DT", many: "DT" },
};

export const METRIC_TITLE: Record<Metric, string> = {
  signups: "Signups",
  approvals: "Approvals",
  opens: "Opens",
  referrals: "Referrals",
  revenue: "Revenue",
};

export function formatMetric(metric: Metric, n: number): string {
  if (metric === "revenue") return `${formatNumber(n)} DT`;
  const label = METRIC_LABEL[metric];
  return `${formatNumber(n)} ${n === 1 ? label.one : label.many}`;
}

/** "11 signups and 1 approval": what a qualifying member still needs. */
export function missingList(driver: PublicDriver): string {
  const parts = driver.progress.filter((p) => p.value < p.goal).map((p) => formatMetric(p.metric, Math.ceil(p.goal - p.value)));
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : (parts[0] ?? "");
}

/** "11 signups and 1 approval to go". */
export function missingText(driver: PublicDriver): string {
  const list = missingList(driver);
  return list ? `${list} to go` : "";
}

export function formatDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** "2026-11-15 22:20" (sheet footer) → "15 Nov, 22:20". */
export function formatStamp(stamp: string | null): string | null {
  if (!stamp) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/.exec(stamp.trim());
  if (!m) return stamp;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}, ${m[4].padStart(2, "0")}:${m[5]}`;
}

export function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}
