// Prints the leaderboard computed from the live sheets (member names and numbers only).
// Usage: pnpm sheets:preview
export {};
process.loadEnvFile(".env.local");

const pct = (r: number) => `${Math.round(r * 100)}%`;

async function main() {
  const { loadSnapshot } = await import("@/lib/server/data");
  const { buildLeaderboard } = await import("@/lib/leaderboard/compute");

  const snapshot = await loadSnapshot();
  const result = buildLeaderboard(snapshot);
  const { config } = snapshot;

  console.log(`Start date: ${config.startDate}   Data updated: ${snapshot.dataUpdatedAt ?? "?"}   Members: ${snapshot.members.length}`);
  console.log("Rows read (all dates):", snapshot.recordCounts, `  Unassigned rows: ${snapshot.unassignedRows}`);

  const eligible = result.standings.filter((s) => s.eligible);
  console.log(`\n=== Eligible: ${eligible.length} ===`);
  for (const s of eligible) console.log(`#${s.rank}  ${s.name} (${s.department}${s.isOC ? ", OC" : ""} → ${s.group})  ${pct(s.score)}`);

  console.log("\n=== Closest to eligible (top 15) ===");
  for (const s of result.standings.filter((x) => !x.eligible && x.group).slice(0, 15)) {
    const parts = s.progress.map((p) => `${p.metric} ${Math.round(p.value * 100) / 100}/${p.goal}`).join(", ");
    console.log(`   ${s.name} (${s.group})  ${parts}`);
  }

  console.log(`\n=== Names auto-matched (${result.autoMatched.length}) ===`);
  for (const a of result.autoMatched) console.log(`   "${a.rawName}" → ${a.member}  (${a.score.toFixed(2)}, ${a.occurrences} rows)`);

  console.log(`\n=== Names needing review (${result.namesToReview.length}) ===`);
  for (const n of result.namesToReview)
    console.log(`   "${n.rawName}"  ${n.occurrences} rows [${n.sources.join(", ")}]  → maybe ${n.candidates.map((c) => `${c.member} (${c.score.toFixed(2)})`).join(" / ")}`);

  const warnings = [...snapshot.warnings, ...result.warnings];
  console.log(`\n=== Warnings (${warnings.length}) ===`);
  for (const w of warnings) console.log("   ! " + w);
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
