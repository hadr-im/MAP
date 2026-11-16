/** A cell as returned by the Sheets API with UNFORMATTED_VALUE + SERIAL_NUMBER dates. */
export type CellValue = string | number | boolean | null | undefined;
export type Rows = CellValue[][];

export const OC_GROUP = "OC";

export type CountMetric = "approvals" | "opens" | "referrals";
export type Metric = "signups" | CountMetric | "revenue";

export interface GroupGoals {
  /** Group name, e.g. "OGX", "IGT", "IGV", "Back office", "OC". */
  id: string;
  signups: number;
  approvals: number;
  opens: number;
  referrals: number;
  /** Revenue goal in DT. */
  revenue: number;
}

export interface LeaderboardConfig {
  /** Only records on or after this date count. YYYY-MM-DD. */
  startDate: string;
  points: { approval: number; open: number; referral: number };
  /** 0–1. Names at least this similar to a member are matched automatically. */
  autoMatchThreshold: number;
  groups: GroupGoals[];
  /** Department code (as written in the Departments tab) → group id. */
  departmentGroups: Record<string, string>;
}

export interface Member {
  name: string;
  department: string;
  isOC: boolean;
}

export type Source =
  | "signups"
  | "ogxApprovals"
  | "igvApprovals"
  | "igtApprovals"
  | "igvOpens"
  | "igtOpens"
  | "ocRevenue"
  | "referrals";

export interface ActivityRecord {
  source: Source;
  metric: Metric;
  /** Member name exactly as written in the sheet. */
  rawName: string;
  /** YYYY-MM-DD */
  date: string;
  /** 1 for a counted item, the number of openings, or the DT amount. */
  amount: number;
  /** 1-based sheet row, for tracing a number back to the sheet. */
  row: number;
}

export interface Alias {
  /** Name as written in a data sheet. */
  rawName: string;
  /** Member name from the Departments tab, or null to ignore this name. */
  member: string | null;
}

export interface ParseResult {
  records: ActivityRecord[];
  warnings: string[];
  /** Rows skipped because the member was "Unassigned" or empty. */
  unassigned: number;
}
