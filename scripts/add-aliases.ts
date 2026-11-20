// Writes confirmed name decisions into the "Name Aliases" tab, so a spelling is matched the same way
// on every refresh and stops coming back for review.
//
// Each entry is [name as written in an activity sheet, the member it belongs to], or IGNORE to drop it.
// Members must be spelled exactly as in the Departments tab; the script checks that before writing and
// skips anything already recorded, so it is safe to run again.
//
// Usage: pnpm sheets:aliases
export {};
process.loadEnvFile(".env.local");

/** Approved from the review queue. `member: IGNORE` drops the rows instead of crediting anyone. */
const IGNORE = "IGNORE";
const DECISIONS: { rawName: string; member: string; note: string }[] = [
  { rawName: "Ryhem Benslimene", member: "rihem ben slimen", note: "Approved 2026-11-20. Surname written without the space." },
  { rawName: "Zaineb kouki", member: "zeyneb kouki", note: "Approved 2026-11-20. Zaineb / Zeyneb." },
  { rawName: "Yassine Chatti", member: "Med Yassine Chatti", note: "Approved 2026-11-20. First name Med left off." },
  { rawName: "Amine Touati", member: "Med Amine Touati", note: "Approved 2026-11-20. First name Med left off." },
  { rawName: "Ismail", member: "Ismail Ben Chattia", note: "Approved 2026-11-20. Surname left off." },
  { rawName: "Chaima Khabouchi", member: "Chaima", note: "Approved 2026-11-20. Departments tab holds the first name only." },
  { rawName: "nadin chegham", member: "nadine jgham", note: "Approved 2026-11-20. Chegham / Jgham, same person." },
  { rawName: "Heithem Hnia", member: IGNORE, note: "Approved 2026-11-20. Not a member." },
  { rawName: "Med Amine Othmen", member: IGNORE, note: "Approved 2026-11-20. A different person from Med Amine Touati." },
];

async function main() {
  const { ALIAS_HEADER, ALIASES_TAB } = await import("@/lib/leaderboard/config");
  const { nameKey } = await import("@/lib/leaderboard/names");
  const { loadSnapshot } = await import("@/lib/server/data");
  const { appendRows, batchGet, tabRange, writeRows } = await import("@/lib/server/google-sheets");
  const { getServerEnv } = await import("@/lib/server/env");

  const sheetId = getServerEnv().mapDataSheetId;
  const snapshot = await loadSnapshot();

  // Members, by comparison key, so a decision can name them in any case or word order.
  const memberByKey = new Map(snapshot.members.map((m) => [nameKey(m.name), m.name]));
  const existing = new Set(snapshot.aliases.map((a) => nameKey(a.rawName)));

  const today = new Date().toISOString().slice(0, 10);
  const rows: (string | number)[][] = [];
  for (const d of DECISIONS) {
    const member = d.member === IGNORE ? IGNORE : memberByKey.get(nameKey(d.member));
    if (!member) {
      console.log(`  ✗ "${d.rawName}": "${d.member}" is not in the Departments tab — skipped.`);
      continue;
    }
    if (existing.has(nameKey(d.rawName))) {
      console.log(`  = "${d.rawName}" is already recorded — skipped.`);
      continue;
    }
    rows.push([d.rawName, member, today, d.note]);
    console.log(`  + "${d.rawName}" → ${member}`);
  }

  if (!rows.length) {
    console.log("\nNothing to write.");
    return;
  }

  // A tab that has never been filled needs its header first; appending to an empty sheet would lose it.
  const [current] = await batchGet(sheetId, [tabRange(ALIASES_TAB, "A1:D1")]);
  if (!current.length) {
    await writeRows(sheetId, ALIASES_TAB, "A1", [ALIAS_HEADER]);
    console.log(`\nWrote the header row to "${ALIASES_TAB}".`);
  }

  await appendRows(sheetId, ALIASES_TAB, rows);
  console.log(`\nWrote ${rows.length} alias${rows.length === 1 ? "" : "es"} to "${ALIASES_TAB}". They apply on the next refresh.`);
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
