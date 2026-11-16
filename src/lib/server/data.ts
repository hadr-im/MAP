import "server-only";
import { buildLeaderboard, type LeaderboardResult } from "@/lib/leaderboard/compute";
import { ALIAS_HEADER, ALIASES_TAB, CONFIG_TAB, DEFAULT_CONFIG, configToRows, parseAliasRows, parseConfigRows } from "@/lib/leaderboard/config";
import { TAB_SPECS, columnLetter, parseActivityTab, parseDepartments, signupColumns } from "@/lib/leaderboard/parsers";
import type { ActivityRecord, LeaderboardConfig, Rows, Source } from "@/lib/leaderboard/types";
import { getServerEnv } from "./env";
import { addTab, batchGet, listTabs, styleTab, tabRange, writeRows, type WritableTab } from "./google-sheets";

const DEPARTMENTS_TAB = "Departments";

/** Creates the Config and Name Aliases tabs (with defaults) if they don't exist yet. Safe to call repeatedly. */
export async function ensureSettingsTabs(existing?: string[]): Promise<WritableTab[]> {
  const { mapDataSheetId } = getServerEnv();
  const titles = existing ?? (await listTabs(mapDataSheetId)).map((t) => t.title);
  const created: WritableTab[] = [];

  const create = async (tab: WritableTab, rows: Rows, boldRows: number[], columns: number) => {
    if (titles.includes(tab)) return;
    let sheetId: number;
    try {
      sheetId = await addTab(mapDataSheetId, tab);
    } catch (err) {
      if (err instanceof Error && /already exists/i.test(err.message)) return; // created by a parallel request
      throw err;
    }
    await writeRows(mapDataSheetId, tab, "A1", rows);
    await styleTab(mapDataSheetId, tab, sheetId, boldRows, columns);
    created.push(tab);
  };

  const { rows, headerRows } = configToRows(DEFAULT_CONFIG);
  await create(CONFIG_TAB, rows, headerRows, 7);
  await create(ALIASES_TAB, [ALIAS_HEADER], [0], ALIAS_HEADER.length);
  return created;
}

export interface SheetsSnapshot {
  config: LeaderboardConfig;
  members: ReturnType<typeof parseDepartments>["members"];
  records: ActivityRecord[];
  aliases: ReturnType<typeof parseAliasRows>;
  /** From the "Updated …" footer in OGX Approvals. */
  dataUpdatedAt: string | null;
  recordCounts: Record<Source, number>;
  unassignedRows: number;
  warnings: string[];
}

/** Downloads everything the leaderboard needs. Lead contact details are never requested. */
export async function loadSnapshot(): Promise<SheetsSnapshot> {
  const env = getServerEnv();
  const warnings: string[] = [];

  const [mapTabs, mirrorTabs] = await Promise.all([listTabs(env.mapDataSheetId), listTabs(env.leadsMirrorSheetId)]);
  const mapTitles = mapTabs.map((t) => t.title);
  const mirrorTitles = mirrorTabs.map((t) => t.title);

  try {
    mapTitles.push(...(await ensureSettingsTabs(mapTitles)));
  } catch (err) {
    warnings.push(`Couldn't create the ${CONFIG_TAB} / ${ALIASES_TAB} tabs (${err instanceof Error ? err.message : err}). Default settings are used.`);
  }
  const hasConfig = mapTitles.includes(CONFIG_TAB);
  const hasAliases = mapTitles.includes(ALIASES_TAB);

  const mapSpecs = [TAB_SPECS.ogxApprovals, TAB_SPECS.igvApprovals, TAB_SPECS.igtApprovals, TAB_SPECS.igvOpens, TAB_SPECS.igtOpens, TAB_SPECS.ocRevenue, TAB_SPECS.referrals];
  const presentSpecs = mapSpecs.filter((spec) => {
    if (mapTitles.includes(spec.tab)) return true;
    warnings.push(`The "${spec.tab}" tab is missing from the MAP data spreadsheet, so it is not counted.`);
    return false;
  });

  const signupsTab = TAB_SPECS.signups.tab;
  const hasSignups = mirrorTitles.includes(signupsTab);
  const hasDepartments = mirrorTitles.includes(DEPARTMENTS_TAB);
  if (!hasSignups) warnings.push(`The "${signupsTab}" tab is missing from the leads spreadsheet, so signups are not counted.`);
  if (!hasDepartments) warnings.push(`The "${DEPARTMENTS_TAB}" tab is missing from the leads spreadsheet, so there are no members to rank.`);

  const mapRanges = presentSpecs.map((s) => tabRange(s.tab, "A:Z"));
  if (hasConfig) mapRanges.push(tabRange(CONFIG_TAB, "A:G"));
  if (hasAliases) mapRanges.push(tabRange(ALIASES_TAB, "A:B"));
  const mirrorRanges: string[] = [];
  if (hasDepartments) mirrorRanges.push(tabRange(DEPARTMENTS_TAB, "A:C"));
  if (hasSignups) mirrorRanges.push(tabRange(signupsTab, "1:1"));

  const [mapValues, mirrorValues] = await Promise.all([
    batchGet(env.mapDataSheetId, mapRanges),
    batchGet(env.leadsMirrorSheetId, mirrorRanges),
  ]);
  const departmentRows = hasDepartments ? mirrorValues[0] : [];
  const signupHeader = hasSignups ? mirrorValues[hasDepartments ? 1 : 0] : [];

  const records: ActivityRecord[] = [];
  const recordCounts = Object.fromEntries(Object.keys(TAB_SPECS).map((k) => [k, 0])) as Record<Source, number>;
  let unassignedRows = 0;
  let dataUpdatedAt: string | null = null;

  presentSpecs.forEach((spec, i) => {
    const parsed = parseActivityTab(mapValues[i], spec);
    records.push(...parsed.records);
    recordCounts[spec.source] = parsed.records.length;
    unassignedRows += parsed.unassigned;
    warnings.push(...parsed.warnings);
    dataUpdatedAt ??= parsed.updatedAt;
  });

  const { config, warnings: configWarnings } = hasConfig
    ? parseConfigRows(mapValues[presentSpecs.length])
    : { config: structuredClone(DEFAULT_CONFIG), warnings: [] };
  warnings.push(...configWarnings);
  const aliases = hasAliases ? parseAliasRows(mapValues[presentSpecs.length + (hasConfig ? 1 : 0)]) : [];

  const { members, warnings: departmentWarnings } = parseDepartments(departmentRows);
  warnings.push(...departmentWarnings);

  if (hasSignups) {
    const { columns, warning } = signupColumns(signupHeader[0] ?? []);
    if (warning) warnings.push(warning);
    if (columns.length) {
      const letters = columns.map(columnLetter);
      const columnValues = await batchGet(env.leadsMirrorSheetId, letters.map((l) => tabRange(signupsTab, `${l}:${l}`)));
      const height = Math.max(...columnValues.map((c) => c.length));
      const rows: Rows = Array.from({ length: height }, (_, r) => columnValues.map((col) => col[r]?.[0] ?? null));
      const parsed = parseActivityTab(rows, TAB_SPECS.signups);
      records.push(...parsed.records);
      recordCounts.signups = parsed.records.length;
      warnings.push(...parsed.warnings);
    }
  }

  return { config, members, records, aliases, dataUpdatedAt, recordCounts, unassignedRows, warnings };
}

export interface LeaderboardData extends LeaderboardResult {
  config: LeaderboardConfig;
  dataUpdatedAt: string | null;
  fetchedAt: string;
}

export async function loadLeaderboard(): Promise<LeaderboardData> {
  const snapshot = await loadSnapshot();
  const result = buildLeaderboard(snapshot);
  return {
    ...result,
    warnings: [...snapshot.warnings, ...result.warnings],
    config: snapshot.config,
    dataUpdatedAt: snapshot.dataUpdatedAt,
    fetchedAt: new Date().toISOString(),
  };
}
