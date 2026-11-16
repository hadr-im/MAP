import type { Alias } from "./types";

/** Spelling variants that should count as the same word. */
const WORD_VARIANTS: Record<string, string> = {
  med: "mohamed",
  mohammed: "mohamed",
  mohamad: "mohamed",
  mohammad: "mohamed",
  mouhamed: "mohamed",
  muhammad: "mohamed",
};

/** Small words that are often dropped or added ("Hamsa El Mabrouk" = "Hamsa Mabrouk"). */
const PARTICLES = new Set(["el", "al"]);

/** Lowercase, accent-free, punctuation-free name words with variants unified. */
export function nameTokens(raw: string): string[] {
  const words = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => WORD_VARIANTS[w] ?? w);
  const meaningful = words.filter((w) => !PARTICLES.has(w));
  return meaningful.length ? meaningful : words;
}

/** Order-insensitive key: "Tasnim Hasni" and "hasni  TASNIM" share a key. */
export function nameKey(raw: string): string {
  return [...nameTokens(raw)].sort().join(" ");
}

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (!la || !lb) return 0;
  const range = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const aHit = new Array<boolean>(la).fill(false);
  const bHit = new Array<boolean>(lb).fill(false);
  let matches = 0;
  for (let i = 0; i < la; i++) {
    for (let j = Math.max(0, i - range); j <= Math.min(lb - 1, i + range); j++) {
      if (!bHit[j] && a[i] === b[j]) {
        aHit[i] = bHit[j] = true;
        matches++;
        break;
      }
    }
  }
  if (!matches) return 0;
  let transpositions = 0;
  for (let i = 0, k = 0; i < la; i++) {
    if (!aHit[i]) continue;
    while (!bHit[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const jaro = (matches / la + matches / lb + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < Math.min(4, la, lb) && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Sørensen–Dice similarity of letter pairs; tolerant of merged/split words ("Benlazreg" vs "Ben Lazreg"). */
export function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const pairs = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const p = a.slice(i, i + 2);
    pairs.set(p, (pairs.get(p) ?? 0) + 1);
  }
  let shared = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const p = b.slice(i, i + 2);
    const n = pairs.get(p) ?? 0;
    if (n > 0) {
      shared++;
      pairs.set(p, n - 1);
    }
  }
  return (2 * shared) / (a.length - 1 + b.length - 1);
}

/** Pairs up words between two names (any order) and weights each pair by word length. */
function wordSimilarity(a: string[], b: string[]): number {
  const pairs: { i: number; j: number; s: number }[] = [];
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) pairs.push({ i, j, s: jaroWinkler(a[i], b[j]) });
  pairs.sort((x, y) => y.s - x.s);
  const usedA = new Set<number>();
  const usedB = new Set<number>();
  let weighted = 0;
  for (const { i, j, s } of pairs) {
    if (usedA.has(i) || usedB.has(j)) continue;
    usedA.add(i);
    usedB.add(j);
    weighted += s * (a[i].length + b[j].length);
  }
  const total = a.reduce((n, w) => n + w.length, 0) + b.reduce((n, w) => n + w.length, 0);
  return total ? weighted / total : 0;
}

/**
 * Cap for "one name is part of the other" ("Chaima" vs "Chaima Khabouchi").
 * Kept below any sensible auto-match threshold: a partial name is a strong hint, never proof.
 */
const PARTIAL_NAME_CAP = 0.85;

/** How well every word of the shorter name is found in the longer one (only when word counts differ). */
function partialNameSimilarity(a: string[], b: string[]): number {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length === long.length) return 0;
  let weighted = 0;
  let total = 0;
  for (const word of short) {
    weighted += Math.max(...long.map((w) => jaroWinkler(word, w))) * word.length;
    total += word.length;
  }
  return total ? (weighted / total) * PARTIAL_NAME_CAP : 0;
}

/** 0–1 similarity between two person names. */
export function nameSimilarity(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return 0;
  if (nameKey(a) === nameKey(b)) return 1;
  const compactA = [...ta].sort().join("");
  const compactB = [...tb].sort().join("");
  return Math.max(wordSimilarity(ta, tb), diceSimilarity(compactA, compactB), partialNameSimilarity(ta, tb));
}

export type MatchStatus = "alias" | "exact" | "auto" | "ignored" | "review";

export interface NameMatch {
  status: MatchStatus;
  /** Matched member name (from the Departments tab), when status is alias/exact/auto. */
  member: string | null;
  /** Similarity of the chosen member (1 for alias/exact). */
  score: number;
  /** Best candidates, most similar first (for the admin review screen). */
  candidates: { member: string; score: number }[];
}

/** Two candidates closer than this are treated as ambiguous and sent to review. */
const AMBIGUITY_MARGIN = 0.05;

export interface NameMatcher {
  match(rawName: string): NameMatch;
  /** Problems found in the aliases (e.g. an alias pointing to a non-member). */
  warnings: string[];
}

export function createNameMatcher(memberNames: string[], aliases: Alias[], autoThreshold: number): NameMatcher {
  const warnings: string[] = [];
  const byKey = new Map<string, string[]>();
  for (const name of memberNames) {
    const key = nameKey(name);
    byKey.set(key, [...(byKey.get(key) ?? []), name]);
  }
  for (const [key, names] of byKey)
    if (names.length > 1 && key) warnings.push(`Departments tab lists the same name more than once: ${names.join(", ")}.`);

  const aliasByKey = new Map<string, string | null>();
  for (const alias of aliases) {
    const key = nameKey(alias.rawName);
    if (!key) continue;
    if (alias.member === null) {
      aliasByKey.set(key, null);
      continue;
    }
    const target = byKey.get(nameKey(alias.member))?.[0];
    if (target) aliasByKey.set(key, target);
    else warnings.push(`Name Aliases: "${alias.member}" (for "${alias.rawName}") is not in the Departments tab, so this alias is ignored.`);
  }

  const memo = new Map<string, NameMatch>();

  function compute(rawName: string): NameMatch {
    const key = nameKey(rawName);
    const ranked = memberNames
      .map((member) => ({ member, score: nameSimilarity(rawName, member) }))
      .sort((x, y) => y.score - x.score)
      .slice(0, 3)
      .map((c) => ({ member: c.member, score: Math.round(c.score * 1000) / 1000 }));

    if (aliasByKey.has(key)) {
      const member = aliasByKey.get(key) ?? null;
      return { status: member ? "alias" : "ignored", member, score: 1, candidates: ranked };
    }
    const exact = byKey.get(key);
    if (exact?.length === 1) return { status: "exact", member: exact[0], score: 1, candidates: ranked };

    const [best, second] = ranked;
    const clearWinner = best && best.score >= autoThreshold && (!second || best.score - second.score >= AMBIGUITY_MARGIN);
    if (clearWinner && !exact) return { status: "auto", member: best.member, score: best.score, candidates: ranked };
    return { status: "review", member: null, score: best?.score ?? 0, candidates: ranked };
  }

  return {
    warnings,
    match(rawName) {
      let result = memo.get(rawName);
      if (!result) {
        result = compute(rawName);
        memo.set(rawName, result);
      }
      return result;
    },
  };
}
