// Rewrites the "Config" tab from DEFAULT_CONFIG in src/lib/leaderboard/config.ts.
// Use it when the goals or the department → group mapping change in code and the sheet has to follow.
// Prints the old and new goals and asks for --yes before writing, since it overwrites the whole tab.
//
// Usage: pnpm sheets:config          (shows what would change)
//        pnpm sheets:config --yes    (writes it)
export {};
process.loadEnvFile(".env.local");

async function main() {
  const { CONFIG_TAB, DEFAULT_CONFIG, configToRows, parseConfigRows } = await import("@/lib/leaderboard/config");
  const { batchGet, listTabs, styleTab, tabRange, writeRows } = await import("@/lib/server/google-sheets");
  const { getServerEnv } = await import("@/lib/server/env");

  const sheetId = getServerEnv().mapDataSheetId;
  const [currentRows] = await batchGet(sheetId, [tabRange(CONFIG_TAB, "A:G")]);
  const { config: live } = parseConfigRows(currentRows);

  const goals = (g: { id: string; signups: number; approvals: number; opens: number; referrals: number; revenue: number }) =>
    `${g.id}: signups ${g.signups}, approvals ${g.approvals}, opens ${g.opens}, referrals ${g.referrals}, revenue ${g.revenue}`;

  console.log("In the sheet now:");
  for (const g of live.groups) console.log("   " + goals(g));
  console.log("\nAbout to write:");
  for (const g of DEFAULT_CONFIG.groups) console.log("   " + goals(g));
  console.log("\nDepartments → groups:");
  for (const [dept, group] of Object.entries(DEFAULT_CONFIG.departmentGroups)) console.log(`   ${dept} → ${group}`);

  if (!process.argv.includes("--yes")) {
    console.log(`\nNothing written. Re-run with --yes to replace the "${CONFIG_TAB}" tab.`);
    return;
  }

  const { rows, headerRows } = configToRows(DEFAULT_CONFIG);
  // The old tab may have more rows than the new one, so clear the extra lines rather than leave them.
  const padded = [...rows, ...Array.from({ length: Math.max(0, currentRows.length - rows.length) }, () => ["", "", "", "", "", "", ""])];
  await writeRows(sheetId, CONFIG_TAB, "A1", padded);

  const tab = (await listTabs(sheetId)).find((t) => t.title === CONFIG_TAB);
  if (tab) await styleTab(sheetId, CONFIG_TAB, tab.sheetId, headerRows, 7);
  console.log(`\nWrote the "${CONFIG_TAB}" tab. The leaderboard picks it up on its next refresh.`);
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
