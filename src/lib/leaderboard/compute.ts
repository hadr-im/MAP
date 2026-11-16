import { isHiddenMember } from "./config";
import { createNameMatcher } from "./names";
import { emptyCounts, evaluate, resolveGroups, type Counts, type GoalProgress } from "./scoring";
import type { ActivityRecord, Alias, LeaderboardConfig, Member, Source } from "./types";

export interface MemberStanding {
  name: string;
  department: string;
  isOC: boolean;
  /** Group whose goals this member is judged on, or null if the department has no group. */
  group: string | null;
  counts: Counts;
  eligible: boolean;
  progress: GoalProgress[];
  /** The other way an OC member may qualify: their own department's goals. Absent for everyone else. */
  alternate?: { group: string; progress: GoalProgress[]; eligible: boolean };
  points: number;
  /** 1.25 = 125%. */
  score: number;
  /** Average progress toward each goal (each capped at 100%). */
  readiness: number;
  /** Position among eligible members (ties share a rank); null when not eligible. */
  rank: number | null;
}

export interface NameToReview {
  rawName: string;
  occurrences: number;
  sources: Source[];
  candidates: { member: string; score: number }[];
}

export interface AutoMatchedName {
  rawName: string;
  member: string;
  score: number;
  occurrences: number;
}

export interface LeaderboardResult {
  startDate: string;
  standings: MemberStanding[];
  /** Names that couldn't be matched safely; their records don't count until resolved. */
  namesToReview: NameToReview[];
  /** Names matched by similarity (not exact); shown to the admin to double-check. */
  autoMatched: AutoMatchedName[];
  /** Records ignored through an IGNORE alias. */
  ignoredRecords: number;
  warnings: string[];
}

export interface BuildInput {
  config: LeaderboardConfig;
  members: Member[];
  records: ActivityRecord[];
  aliases: Alias[];
}

export function buildLeaderboard({ config, members, records, aliases }: BuildInput): LeaderboardResult {
  const warnings: string[] = [];
  const matcher = createNameMatcher(
    members.map((m) => m.name),
    aliases,
    config.autoMatchThreshold,
  );
  warnings.push(...matcher.warnings);

  const countsByMember = new Map<string, Counts>(members.map((m) => [m.name, emptyCounts()]));
  const review = new Map<string, NameToReview>();
  const auto = new Map<string, AutoMatchedName>();
  let ignoredRecords = 0;

  for (const record of records) {
    if (record.date < config.startDate) continue;
    const match = matcher.match(record.rawName);
    if (match.status === "ignored") {
      ignoredRecords++;
      continue;
    }
    if (!match.member) {
      const entry = review.get(record.rawName) ?? { rawName: record.rawName, occurrences: 0, sources: [], candidates: match.candidates };
      entry.occurrences++;
      if (!entry.sources.includes(record.source)) entry.sources.push(record.source);
      review.set(record.rawName, entry);
      continue;
    }
    if (match.status === "auto") {
      const entry = auto.get(record.rawName) ?? { rawName: record.rawName, member: match.member, score: match.score, occurrences: 0 };
      entry.occurrences++;
      auto.set(record.rawName, entry);
    }
    const counts = countsByMember.get(match.member)!;
    counts[record.metric] += record.amount;
  }

  const ungrouped = new Set<string>();
  // hidden members still match their records above; they are only left out of the standings
  const standings: MemberStanding[] = members
    .filter((member) => !isHiddenMember(member.name))
    .map((member) => {
      const counts = countsByMember.get(member.name) ?? emptyCounts();
      const routes = resolveGroups(member, config);
      if (!routes.length) {
        ungrouped.add(member.department);
        return { ...member, group: null, counts, eligible: false, progress: [], points: 0, score: 0, readiness: 0, rank: null };
      }
      /**
       * An OC member has two routes and either one qualifies them, so take the route that puts them
       * on the grid (the better-scoring one if both do) and otherwise the one they are closest to.
       */
      const evaluated = routes.map((goals) => ({ goals, result: evaluate(counts, goals, config.points) }));
      const qualifying = evaluated.filter((r) => r.result.eligible);
      const best = (qualifying.length ? qualifying : evaluated).reduce((a, b) =>
        (qualifying.length ? b.result.score > a.result.score : b.result.readiness > a.result.readiness) ? b : a,
      );
      const other = evaluated.find((r) => r !== best);
      return {
        ...member,
        group: best.goals.id,
        counts,
        ...best.result,
        ...(other ? { alternate: { group: other.goals.id, progress: other.result.progress, eligible: other.result.eligible } } : {}),
        rank: null,
      };
    });
  if (ungrouped.size)
    warnings.push(`These departments have no group in the Config tab, so their members can't be ranked: ${[...ungrouped].sort().join(", ")}.`);

  const eligible = standings
    .filter((s) => s.eligible)
    .sort((a, b) => b.score - a.score || b.counts.revenue - a.counts.revenue || b.points - a.points || a.name.localeCompare(b.name));
  eligible.forEach((s, i) => {
    const prev = eligible[i - 1];
    s.rank = prev && prev.score === s.score && prev.points === s.points && prev.counts.revenue === s.counts.revenue ? prev.rank : i + 1;
  });

  return {
    startDate: config.startDate,
    standings: [
      ...eligible,
      ...standings.filter((s) => !s.eligible).sort((a, b) => b.readiness - a.readiness || b.score - a.score || a.name.localeCompare(b.name)),
    ],
    namesToReview: [...review.values()].sort((a, b) => b.occurrences - a.occurrences),
    autoMatched: [...auto.values()].sort((a, b) => a.score - b.score),
    ignoredRecords,
    warnings,
  };
}
