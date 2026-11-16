import { parseSheetDate } from "./dates";
import type { ActivityRecord, CellValue, Member, Metric, ParseResult, Rows, Source } from "./types";

function text(v: CellValue): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

/** "🙋Member Name" → "member name", "[FN] First Name" → "fn first name". */
export function normalizeHeader(v: CellValue): string {
  return text(v)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function findColumns(headers: string[], patterns: RegExp[]): number[] {
  for (const p of patterns) {
    const hits = headers.flatMap((h, i) => (p.test(h) ? [i] : []));
    if (hits.length) return hits;
  }
  return [];
}

/** Parses "1 500,50 DT", "1,500", "2000" or a number cell. */
export function parseAmount(v: CellValue): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = text(v).replace(/[\s ]/g, "").replace(/(dt|tnd|dinars?)$/i, "");
  if (!s) return null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ""); // 1,500 → 1500
  else if (/^\d+,\d+$/.test(s)) s = s.replace(",", "."); // 12,5 → 12.5
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const YES = /^(yes|oui|y|true|1|approved|ok|✅)$/i;
const NOT_APPROVED_STATUS = /reject|withdraw|break|cancel|declin/i;
const UNASSIGNED = /^(unassigned|n\/?a|none|-|—)$/i;
const FOOTER = /^updated\b/i;

interface TabSpec {
  source: Source;
  metric: Metric;
  tab: string;
  /** Member name column(s); with several, the first non-empty one is used. */
  member: RegExp[];
  date: RegExp[];
  /** Column holding the amount; when absent each row counts as 1. */
  amount?: { patterns: RegExp[]; whenBlank: number | null };
  /** Column that must say yes for the row to count. */
  approved?: RegExp[];
  /** Status column whose "rejected/withdrawn/…" values exclude the row. */
  status?: RegExp[];
}

export interface ActivityParseResult extends ParseResult {
  /** Text of an "Updated 2026-11-15 21:15" footer, if the tab has one. */
  updatedAt: string | null;
}

export function parseActivityTab(rows: Rows, spec: TabSpec): ActivityParseResult {
  const result: ActivityParseResult = { records: [], warnings: [], unassigned: 0, updatedAt: null };
  if (!rows.length) return result;

  const headers = rows[0].map(normalizeHeader);
  const memberCols = findColumns(headers, spec.member);
  const [dateCol] = findColumns(headers, spec.date);
  const [amountCol] = spec.amount ? findColumns(headers, spec.amount.patterns) : [];
  const [approvedCol] = spec.approved ? findColumns(headers, spec.approved) : [];
  const [statusCol] = spec.status ? findColumns(headers, spec.status) : [];

  const missing = [
    !memberCols.length && "member name",
    dateCol === undefined && "date",
    spec.amount && amountCol === undefined && "amount",
    spec.approved && approvedCol === undefined && "approved (yes/no)",
  ].filter(Boolean);
  if (missing.length) {
    result.warnings.push(`"${spec.tab}": couldn't find the ${missing.join(", ")} column, so this tab is not counted.`);
    return result;
  }

  let undated = 0;
  let badAmount = 0;
  rows.slice(1).forEach((row, i) => {
    const sheetRow = i + 2;
    const rawName = memberCols.map((c) => text(row[c])).find(Boolean) ?? "";
    if (FOOTER.test(rawName)) {
      result.updatedAt = rawName.replace(FOOTER, "").trim() || null;
      return;
    }
    if (!rawName || UNASSIGNED.test(rawName)) {
      if (row.some((c) => text(c))) result.unassigned++;
      return;
    }
    if (statusCol !== undefined && NOT_APPROVED_STATUS.test(text(row[statusCol]))) return;
    if (approvedCol !== undefined && !YES.test(text(row[approvedCol]))) return;

    const date = parseSheetDate(row[dateCol!] ?? null);
    if (!date) {
      undated++;
      return;
    }

    let amount = 1;
    if (spec.amount) {
      const cell = row[amountCol!];
      const parsed = text(cell) === "" ? spec.amount.whenBlank : parseAmount(cell ?? null);
      if (parsed === null) {
        badAmount++;
        return;
      }
      amount = parsed;
    }
    result.records.push({ source: spec.source, metric: spec.metric, rawName, date, amount, row: sheetRow });
  });

  if (undated) result.warnings.push(`"${spec.tab}": ${undated} row(s) have a member but no readable date, so they are not counted.`);
  if (badAmount) result.warnings.push(`"${spec.tab}": ${badAmount} row(s) have an amount that isn't a number, so they are not counted.`);
  return result;
}

export const TAB_SPECS = {
  ogxApprovals: { source: "ogxApprovals", metric: "approvals", tab: "OGX Approvals", member: [/^member$/, /member/], date: [/approved on/, /date/] },
  igvApprovals: { source: "igvApprovals", metric: "approvals", tab: "IGV Approvals", member: [/ep buddy/, /member/], date: [/approval date/, /date/], status: [/^status$/] },
  igtApprovals: { source: "igtApprovals", metric: "approvals", tab: "IGT Approvals", member: [/ep buddy/, /member/], date: [/approval date/, /date/], status: [/^status$/] },
  igvOpens: { source: "igvOpens", metric: "opens", tab: "IGV Opens", member: [/member name/, /member/], date: [/closing date/, /date/], amount: { patterns: [/number of openings/, /opening/], whenBlank: 1 } },
  igtOpens: { source: "igtOpens", metric: "opens", tab: "IGT Opens", member: [/member name/, /member/], date: [/closing date/, /date/], amount: { patterns: [/number of openings/, /opening/], whenBlank: 1 } },
  ocRevenue: { source: "ocRevenue", metric: "revenue", tab: "OC Revenus", member: [/member name/, /member/], date: [/closing date/, /date/], amount: { patterns: [/amount/, /revenue/, /montant/], whenBlank: null } },
  referrals: { source: "referrals", metric: "referrals", tab: "Referrals", member: [/member name/], date: [/horodateur/, /timestamp/, /date/], approved: [/approved/, /approuv/, /accepted/] },
  signups: { source: "signups", metric: "signups", tab: "Eps Leads Mirror", member: [/member name/], date: [/submitted at/, /date/] },
} satisfies Record<Source, TabSpec>;

/** Departments tab: name | department | OC (yes/no). No header row; a header-looking row is skipped. */
export function parseDepartments(rows: Rows): { members: Member[]; warnings: string[] } {
  const members: Member[] = [];
  const warnings: string[] = [];
  let noDepartment = 0;
  for (const row of rows) {
    const name = text(row[0]);
    const department = text(row[1]);
    if (!name) continue;
    if (/^(name|member|full name)/i.test(name) && /^dep/i.test(department)) continue;
    if (!department) {
      noDepartment++;
      continue;
    }
    members.push({ name, department, isOC: YES.test(text(row[2])) });
  }
  if (noDepartment) warnings.push(`Departments tab: ${noDepartment} member(s) have no department, so they are left out.`);
  return { members, warnings };
}

export function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Which columns of the big signups tab to download (date + member names only, no personal lead data). */
export function signupColumns(headerRow: CellValue[]): { columns: number[]; warning: string | null } {
  const headers = headerRow.map(normalizeHeader);
  const members = findColumns(headers, TAB_SPECS.signups.member);
  const [date] = findColumns(headers, TAB_SPECS.signups.date);
  if (!members.length || date === undefined)
    return { columns: [], warning: `"${TAB_SPECS.signups.tab}": couldn't find the "Submitted at" and "Member Name" columns, so signups are not counted.` };
  return { columns: [date, ...members], warning: null };
}

export type { ActivityRecord };
