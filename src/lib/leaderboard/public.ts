import type { LeaderboardResult } from "./compute";
import type { GroupGoals, Metric } from "./types";

/** What the public page receives. No name-matching details, warnings or lead data. */
export interface PublicDriver {
  /** Stable across refreshes (derived from the member's name), so rows can be animated between updates. */
  id: string;
  /** Place in the whole session: grid members first by rank, then everyone else by progress. */
  position: number;
  name: string;
  /** Three-letter broadcast code, e.g. "ZOU". */
  code: string;
  department: string;
  group: string | null;
  isOC: boolean;
  eligible: boolean;
  rank: number | null;
  score: number;
  readiness: number;
  points: number;
  progress: { metric: Metric; value: number; goal: number }[];
  /** The other route an OC member can qualify by: their own department's goals. */
  alternate?: { group: string; progress: { metric: Metric; value: number; goal: number }[] };
}

export interface PublicLeaderboard {
  startDate: string;
  dataUpdatedAt: string | null;
  fetchedAt: string;
  drivers: PublicDriver[];
  totals: Record<Metric, number>;
  groups: GroupGoals[];
  points: { approval: number; open: number; referral: number };
}

const SMALL_WORDS = new Set(["ben", "bel", "el", "al", "bou"]);

/** "aya fatteki" → "Aya Fatteki", "GHARBI ahmed" → "Gharbi Ahmed"; "Ben" stays readable mid-name. */
export function displayName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((word, i) =>
      word
        .split("-")
        .map((part) => {
          const lower = part.toLocaleLowerCase("fr");
          if (i > 0 && SMALL_WORDS.has(lower)) return lower.charAt(0).toLocaleUpperCase("fr") + lower.slice(1);
          return lower.charAt(0).toLocaleUpperCase("fr") + lower.slice(1);
        })
        .join("-"),
    )
    .join(" ");
}

function lettersOf(word: string): string {
  return word.normalize("NFD").replace(/\p{M}/gu, "").replace(/[^A-Za-z]/g, "").toUpperCase();
}

/** Unique three-letter codes from surnames, like a timing screen: ZOU, RIA, … */
export function driverCodes(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    const words = name.trim().split(/\s+/).map(lettersOf).filter(Boolean);
    const surname = words.filter((w) => !SMALL_WORDS.has(w.toLowerCase())).at(-1) ?? words.at(-1) ?? "XXX";
    const first = words[0] ?? surname;
    const candidates = [
      surname.slice(0, 3),
      first.charAt(0) + surname.slice(0, 2),
      surname.charAt(0) + surname.slice(-2),
      first.slice(0, 3),
    ].map((c) => c.padEnd(3, "X"));
    let code = candidates.find((c) => !used.has(c));
    for (let n = 2; !code; n++) code = `${surname.slice(0, 2)}${n}`;
    used.add(code);
    return code;
  });
}

/** "Aya Fatteki" → "aya-fatteki"; duplicates get -2, -3… */
export function stableIds(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const base =
      name
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "member";
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

export function toPublicLeaderboard(
  result: Pick<LeaderboardResult, "standings" | "startDate">,
  meta: { dataUpdatedAt: string | null; fetchedAt: string; groups: GroupGoals[]; points: PublicLeaderboard["points"] },
): PublicLeaderboard {
  const codes = driverCodes(result.standings.map((s) => s.name));
  const ids = stableIds(result.standings.map((s) => s.name));
  const totals: Record<Metric, number> = { signups: 0, approvals: 0, opens: 0, referrals: 0, revenue: 0 };
  const drivers = result.standings.map((s, i): PublicDriver => {
    for (const key of Object.keys(totals) as Metric[]) totals[key] += s.counts[key];
    return {
      id: ids[i],
      position: i + 1,
      name: displayName(s.name),
      code: codes[i],
      department: s.department,
      group: s.group,
      isOC: s.isOC,
      eligible: s.eligible,
      rank: s.rank,
      score: s.score,
      readiness: s.readiness,
      points: s.points,
      progress: s.progress.map(({ metric, value, goal }) => ({ metric, value, goal })),
      ...(s.alternate
        ? { alternate: { group: s.alternate.group, progress: s.alternate.progress.map(({ metric, value, goal }) => ({ metric, value, goal })) } }
        : {}),
    };
  });
  return { startDate: result.startDate, dataUpdatedAt: meta.dataUpdatedAt, fetchedAt: meta.fetchedAt, drivers, totals, groups: meta.groups, points: meta.points };
}
