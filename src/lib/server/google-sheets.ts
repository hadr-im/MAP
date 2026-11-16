import "server-only";
import { JWT } from "google-auth-library";
import { ALIASES_TAB, CONFIG_TAB } from "@/lib/leaderboard/config";
import type { Rows } from "@/lib/leaderboard/types";
import { getServerEnv } from "./env";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

/** The only tabs the app may ever change, and only in the MAP data spreadsheet. */
export const WRITABLE_TABS = [CONFIG_TAB, ALIASES_TAB] as const;
export type WritableTab = (typeof WRITABLE_TABS)[number];

let client: JWT | undefined;
function auth(): JWT {
  if (!client) {
    const env = getServerEnv();
    client = new JWT({
      email: env.serviceAccountEmail,
      key: env.privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  return client;
}

/** A1 range for a tab, quoting the name: tabRange("OGX Approvals", "A:D") → 'OGX Approvals'!A:D */
export function tabRange(tab: string, range?: string): string {
  const quoted = `'${tab.replace(/'/g, "''")}'`;
  return range ? `${quoted}!${range}` : quoted;
}

async function call<T>(url: string, method: "GET" | "POST" | "PUT" = "GET", data?: object): Promise<T> {
  try {
    const res = await auth().request<T>({ url, method, data });
    return res.data;
  } catch (err) {
    // Rebuild the error so request details (headers, tokens) never end up in logs.
    const e = err as { status?: number; response?: { status?: number; data?: { error?: { message?: string } } }; message?: string };
    const status = e.status ?? e.response?.status;
    const message = e.response?.data?.error?.message ?? e.message ?? "Unknown error";
    throw new Error(`Google Sheets request failed${status ? ` (${status})` : ""}: ${message}`);
  }
}

export interface TabInfo {
  title: string;
  sheetId: number;
}

export async function listTabs(spreadsheetId: string): Promise<TabInfo[]> {
  const data = await call<{ sheets?: { properties: TabInfo }[] }>(
    `${API}/${spreadsheetId}?fields=${encodeURIComponent("sheets.properties(title,sheetId)")}`,
  );
  return (data.sheets ?? []).map((s) => s.properties);
}

/** Reads several ranges at once. Dates come back as serial numbers so their format can't be misread. */
export async function batchGet(spreadsheetId: string, ranges: string[]): Promise<Rows[]> {
  if (!ranges.length) return [];
  const params = new URLSearchParams({
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
    majorDimension: "ROWS",
  });
  for (const range of ranges) params.append("ranges", range);
  const data = await call<{ valueRanges?: { values?: Rows }[] }>(`${API}/${spreadsheetId}/values:batchGet?${params}`);
  return ranges.map((_, i) => data.valueRanges?.[i]?.values ?? []);
}

function assertWritable(spreadsheetId: string, tab: string): asserts tab is WritableTab {
  if (spreadsheetId !== getServerEnv().mapDataSheetId || !(WRITABLE_TABS as readonly string[]).includes(tab)) {
    throw new Error(`Refusing to write to "${tab}": the app may only change the ${WRITABLE_TABS.join(" and ")} tabs of the MAP data spreadsheet.`);
  }
}

/** Creates a tab and returns its sheetId. */
export async function addTab(spreadsheetId: string, title: WritableTab): Promise<number> {
  assertWritable(spreadsheetId, title);
  const data = await call<{ replies: { addSheet: { properties: TabInfo } }[] }>(
    `${API}/${spreadsheetId}:batchUpdate`,
    "POST",
    { requests: [{ addSheet: { properties: { title } } }] },
  );
  return data.replies[0].addSheet.properties.sheetId;
}

/** Overwrites cells starting at `startCell`. Values are stored as typed (no formula evaluation). */
export async function writeRows(spreadsheetId: string, tab: WritableTab, startCell: string, rows: Rows): Promise<void> {
  assertWritable(spreadsheetId, tab);
  const range = tabRange(tab, startCell);
  await call(`${API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, "PUT", {
    range,
    majorDimension: "ROWS",
    values: rows.map((r) => r.map((c) => c ?? "")),
  });
}

/** Adds rows under the existing ones. */
export async function appendRows(spreadsheetId: string, tab: WritableTab, rows: Rows): Promise<void> {
  assertWritable(spreadsheetId, tab);
  const range = tabRange(tab, "A1");
  await call(
    `${API}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    "POST",
    { majorDimension: "ROWS", values: rows.map((r) => r.map((c) => c ?? "")) },
  );
}

/** Bold header rows, freeze the first row and size columns to fit. Only for the app's own tabs. */
export async function styleTab(spreadsheetId: string, tab: WritableTab, sheetId: number, boldRows: number[], columns: number): Promise<void> {
  assertWritable(spreadsheetId, tab);
  const requests: object[] = boldRows.map((row) => ({
    repeatCell: {
      range: { sheetId, startRowIndex: row, endRowIndex: row + 1 },
      cell: { userEnteredFormat: { textFormat: { bold: true } } },
      fields: "userEnteredFormat.textFormat.bold",
    },
  }));
  requests.push(
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
    { autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: columns } } },
  );
  await call(`${API}/${spreadsheetId}:batchUpdate`, "POST", { requests });
}
