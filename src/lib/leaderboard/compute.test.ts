import { describe, expect, it } from "vitest";
import { buildLeaderboard } from "./compute";
import { DEFAULT_CONFIG } from "./config";
import type { ActivityRecord, Member, Metric, Source } from "./types";

const config = { ...DEFAULT_CONFIG, startDate: "2026-09-01" };

let row = 1;
function rec(rawName: string, metric: Metric, n = 1, date = "2026-10-01", amount = 1): ActivityRecord[] {
  const source: Source = metric === "signups" ? "signups" : metric === "revenue" ? "ocRevenue" : metric === "referrals" ? "referrals" : metric === "opens" ? "igvOpens" : "ogxApprovals";
  return Array.from({ length: n }, () => ({ source, metric, rawName, date, amount, row: row++ }));
}

const members: Member[] = [
  { name: "Rami Trabelsi", department: "OGTa", isOC: false },
  { name: "Emna Riahi", department: "OGTa", isOC: true },
  { name: "Doua Mani", department: "TM", isOC: false },
  { name: "Helmy Chelly", department: "OGTa", isOC: false },
  { name: "Someone Else", department: "EWA", isOC: false },
];

describe("buildLeaderboard", () => {
  it("ranks eligible members by score and puts the rest after them", () => {
    const records = [
      ...rec("rami trabelsi", "signups", 30),
      ...rec("rami trabelsi", "approvals", 6), // 150%
      ...rec("Amna Riahi", "signups", 10), // auto-matched to Emna Riahi (OC)
      ...rec("Amna Riahi", "revenue", 1, "2026-10-01", 3000), // 150%
      ...rec("Doua Mani", "signups", 15),
      ...rec("Doua Mani", "referrals", 5), // 125%
      ...rec("Helmy Chelly", "signups", 10), // not enough signups
      ...rec("Helmy Chelly", "approvals", 9),
    ];
    const r = buildLeaderboard({ config, members, records, aliases: [] });
    const ranked = r.standings.filter((s) => s.eligible).map((s) => [s.name, s.rank, Math.round(s.score * 100)]);
    // Emna and Aymen tie on 150%; revenue then points break the tie, but ranks stay distinct only when they differ.
    expect(ranked).toEqual([
      ["Emna Riahi", 1, 150],
      ["Rami Trabelsi", 2, 150],
      ["Doua Mani", 3, 125],
    ]);
    expect(r.standings.find((s) => s.name === "Helmy Chelly")).toMatchObject({ eligible: false, rank: null });
    expect(r.autoMatched).toEqual([expect.objectContaining({ rawName: "Amna Riahi", member: "Emna Riahi", occurrences: 11 })]);
    expect(r.warnings.join(" ")).toMatch(/EWA/);
  });

  it("only counts records on or after the start date", () => {
    const records = [...rec("Doua Mani", "signups", 15, "2026-08-31"), ...rec("Doua Mani", "referrals", 4)];
    const doua = buildLeaderboard({ config, members, records, aliases: [] }).standings.find((s) => s.name === "Doua Mani")!;
    expect(doua.counts.signups).toBe(0);
    expect(doua.counts.referrals).toBe(4);
  });

  it("holds back unmatched names for review and applies aliases once confirmed", () => {
    const records = [...rec("Chaima Khabouchi", "approvals", 3)];
    const withChaima = [...members, { name: "Chaima", department: "OGTa", isOC: false }];

    const before = buildLeaderboard({ config, members: withChaima, records, aliases: [] });
    expect(before.namesToReview).toEqual([expect.objectContaining({ rawName: "Chaima Khabouchi", occurrences: 3, sources: ["ogxApprovals"] })]);
    expect(before.namesToReview[0].candidates[0].member).toBe("Chaima");

    const after = buildLeaderboard({ config, members: withChaima, records, aliases: [{ rawName: "Chaima Khabouchi", member: "Chaima" }] });
    expect(after.namesToReview).toEqual([]);
    expect(after.standings.find((s) => s.name === "Chaima")!.counts.approvals).toBe(3);
  });

  it("gives equal results the same rank", () => {
    const records = [
      ...rec("Rami Trabelsi", "signups", 30), ...rec("Rami Trabelsi", "approvals", 4),
      ...rec("Helmy Chelly", "signups", 30), ...rec("Helmy Chelly", "approvals", 4),
    ];
    const r = buildLeaderboard({ config, members, records, aliases: [] });
    expect(r.standings.filter((s) => s.eligible).map((s) => s.rank)).toEqual([1, 1]);
  });

  it("qualifies an OC member through their own department when the OC goals are missed", () => {
    // Emna is OC in OGTa: no revenue, so the OC route fails, but OGX's 30 signups and 4 approvals are met.
    const records = [...rec("Emna Riahi", "signups", 30), ...rec("Emna Riahi", "approvals", 4)];
    const emna = buildLeaderboard({ config, members, records, aliases: [] }).standings.find((s) => s.name === "Emna Riahi")!;
    expect(emna).toMatchObject({ eligible: true, group: "OGX" });
  });

  it("qualifies an OC member on the OC goals alone", () => {
    const records = [...rec("Emna Riahi", "signups", 10), ...rec("Emna Riahi", "revenue", 1, "2026-10-01", 2000)];
    const emna = buildLeaderboard({ config, members, records, aliases: [] }).standings.find((s) => s.name === "Emna Riahi")!;
    expect(emna).toMatchObject({ eligible: true, group: "OC" });
  });

  it("leaves hidden members out of the standings", () => {
    const withHidden = [...members, { name: "Sarra Souissi", department: "OGTa", isOC: false }];
    const r = buildLeaderboard({ config, members: withHidden, records: rec("Sarra Souissi", "signups", 30), aliases: [] });
    expect(r.standings.some((s) => s.name === "Sarra Souissi")).toBe(false);
    expect(r.namesToReview).toEqual([]);
  });
});
