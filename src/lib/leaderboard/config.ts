import { isValidIsoDate, parseSheetDate } from "./dates";
import { OC_GROUP, type Alias, type GroupGoals, type LeaderboardConfig, type Rows } from "./types";

export const CONFIG_TAB = "Config";
export const ALIASES_TAB = "Name Aliases";
export const IGNORE_KEYWORD = "IGNORE";

/** Rules agreed on 2026-11-15. The Config tab is seeded with these and can then be edited. */
export const DEFAULT_CONFIG: LeaderboardConfig = {
  startDate: "2026-09-01",
  points: { approval: 1, open: 1, referral: 1 },
  autoMatchThreshold: 0.9,
  groups: [
    { id: "OGX", signups: 30, approvals: 4, opens: 0, referrals: 0, revenue: 0 },
    { id: "IGT", signups: 20, approvals: 4, opens: 2, referrals: 0, revenue: 0 },
    { id: "IGV", signups: 20, approvals: 7, opens: 4, referrals: 0, revenue: 0 },
    { id: "Back office", signups: 15, approvals: 0, opens: 0, referrals: 4, revenue: 0 },
    { id: OC_GROUP, signups: 10, approvals: 0, opens: 0, referrals: 0, revenue: 2000 },
  ],
  departmentGroups: {
    OGTa: "OGX",
    OGTe: "OGX",
    OGV: "OGX",
    IGT: "IGT",
    IGV: "IGV",
    TM: "Back office",
    IM: "Back office",
    PM: "Back office",
    BD: "Back office",
    MKT: "Back office",
    "F&L": "Back office",
  },
};

/**
 * Members kept off the leaderboard (organisers and the like). Their activity is still matched, so it
 * never lands in the review queue; they simply do not appear in the standings.
 */
export const HIDDEN_MEMBERS = ["Med Salah Touati", "Aymen Zouaoui", "Mokthar Barketallah", "Sarra Souissi", "Maryem Lefi"];

const nameKey = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const HIDDEN_KEYS = new Set(HIDDEN_MEMBERS.map(nameKey));

/** True for a member who should never be shown, whatever the spelling, case or accents. */
export function isHiddenMember(name: string): boolean {
  return HIDDEN_KEYS.has(nameKey(name));
}

/** "OGTa", "ogta ", "OGT A" → "OGTA". Used to compare department codes. */
export function normalizeDepartment(code: string): string {
  return code.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/[^A-Z0-9&]/g, "");
}

const SETTING_LABELS = {
  startDate: "Start date",
  approval: "Points per approval",
  open: "Points per open",
  referral: "Points per referral",
  threshold: "Name auto-match threshold",
} as const;

const GROUP_HEADER = ["Group", "Signups goal", "Approvals goal", "Opens goal", "Referrals goal", "Revenue goal (DT)"];
const DEPARTMENT_HEADER = ["Department", "Group"];

/** Rows written to a fresh Config tab. Bold rows are returned so the tab can be styled. */
export function configToRows(config: LeaderboardConfig): { rows: Rows; headerRows: number[] } {
  const rows: Rows = [
    ["MAP Leaderboard settings", "", "Edit values here or from the admin side. The leaderboard picks up changes on its next refresh."],
    [],
    ["Setting", "Value", "Notes"],
    [SETTING_LABELS.startDate, config.startDate, "Only approvals, opens, signups, revenue and referrals on or after this date count. Format YYYY-MM-DD."],
    [SETTING_LABELS.approval, config.points.approval, "Points earned per approval."],
    [SETTING_LABELS.open, config.points.open, "Points earned per open (uses \"Number of Openings\")."],
    [SETTING_LABELS.referral, config.points.referral, "Points earned per approved referral."],
    [SETTING_LABELS.threshold, config.autoMatchThreshold, "0 to 1. Names at least this similar to one member are matched automatically; others wait for review."],
    [],
    GROUP_HEADER,
    ...config.groups.map((g) => [g.id, g.signups, g.approvals, g.opens, g.referrals, g.revenue]),
    ["", "", "", "", "", "", `Eligible = signups goal AND every other goal above 0. Members with OC = yes in the Departments tab always use the "${OC_GROUP}" group.`],
    DEPARTMENT_HEADER,
    ...Object.entries(config.departmentGroups).map(([dept, group]) => [dept, group]),
  ];
  const headerRows = rows.flatMap((r, i) => (r[0] === "Setting" || r[0] === "Group" || r[0] === "Department" || i === 0 ? [i] : []));
  return { rows, headerRows };
}

function text(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = text(v).replace(/[\s ]/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Reads the Config tab. Missing or invalid values fall back to the defaults, with a warning. */
export function parseConfigRows(rows: Rows): { config: LeaderboardConfig; warnings: string[] } {
  const warnings: string[] = [];
  const config: LeaderboardConfig = structuredClone(DEFAULT_CONFIG);
  if (!rows.length) {
    warnings.push(`The "${CONFIG_TAB}" tab is empty, so default settings are used.`);
    return { config, warnings };
  }

  type Section = "none" | "settings" | "groups" | "departments";
  let section: Section = "none";
  const groups: GroupGoals[] = [];
  const departments: Record<string, string> = {};
  let sawGroups = false;
  let sawDepartments = false;

  const number = (label: string, v: unknown, min: number, max: number): number | null => {
    const n = toNumber(v);
    if (n === null || n < min || n > max) {
      warnings.push(`Config: "${label}" must be a number between ${min} and ${max}; got "${text(v)}". Using the default.`);
      return null;
    }
    return n;
  };

  rows.forEach((row, index) => {
    const first = text(row[0]);
    const lower = first.toLowerCase();
    if (lower === "setting") return void (section = "settings");
    if (lower === "group") return void ((section = "groups"), (sawGroups = true));
    if (lower === "department") return void ((section = "departments"), (sawDepartments = true));
    if (!first) return; // blank or note row

    if (section === "settings") {
      const value = row[1];
      switch (lower) {
        case SETTING_LABELS.startDate.toLowerCase(): {
          const date = parseSheetDate(value ?? null);
          if (date && isValidIsoDate(date)) config.startDate = date;
          else warnings.push(`Config: "Start date" must be a date like 2026-09-01; got "${text(value)}". Using ${config.startDate}.`);
          break;
        }
        case SETTING_LABELS.approval.toLowerCase(): {
          const n = number(first, value, 0, 1000);
          if (n !== null) config.points.approval = n;
          break;
        }
        case SETTING_LABELS.open.toLowerCase(): {
          const n = number(first, value, 0, 1000);
          if (n !== null) config.points.open = n;
          break;
        }
        case SETTING_LABELS.referral.toLowerCase(): {
          const n = number(first, value, 0, 1000);
          if (n !== null) config.points.referral = n;
          break;
        }
        case SETTING_LABELS.threshold.toLowerCase(): {
          const n = number(first, value, 0.5, 1);
          if (n !== null) config.autoMatchThreshold = n;
          break;
        }
        default:
          warnings.push(`Config row ${index + 1}: unknown setting "${first}" is ignored.`);
      }
    } else if (section === "groups") {
      const values = [1, 2, 3, 4, 5].map((c) => (text(row[c]) === "" ? 0 : number(`${first} – ${GROUP_HEADER[c]}`, row[c], 0, 1_000_000)));
      if (values.some((v) => v === null)) {
        const fallback = DEFAULT_CONFIG.groups.find((g) => g.id.toLowerCase() === lower);
        if (fallback) groups.push({ ...fallback });
        return;
      }
      const [signups, approvals, opens, referrals, revenue] = values as number[];
      groups.push({ id: first, signups, approvals, opens, referrals, revenue });
    } else if (section === "departments") {
      const group = text(row[1]);
      if (group) departments[first] = group;
    }
  });

  if (sawGroups && groups.length) config.groups = groups;
  else warnings.push("Config: no group goals table found, so default goals are used.");
  if (sawDepartments && Object.keys(departments).length) config.departmentGroups = departments;
  else warnings.push("Config: no department → group table found, so default departments are used.");

  const groupIds = new Set(config.groups.map((g) => g.id.toLowerCase()));
  for (const [dept, group] of Object.entries(config.departmentGroups))
    if (!groupIds.has(group.toLowerCase())) warnings.push(`Config: department "${dept}" points to group "${group}", which is not in the group goals table.`);
  if (!groupIds.has(OC_GROUP.toLowerCase())) warnings.push(`Config: there is no "${OC_GROUP}" group, so OC members fall back to their department's group.`);

  return { config, warnings };
}

export const ALIAS_HEADER = [
  "Name as written in the sheets",
  `Member (exact name from the Departments tab, or ${IGNORE_KEYWORD})`,
  "Added on",
  "Notes",
];

export function parseAliasRows(rows: Rows): Alias[] {
  return rows
    .slice(1)
    .map((row) => ({ rawName: text(row[0]), target: text(row[1]) }))
    .filter((r) => r.rawName && r.target)
    .map((r) => ({ rawName: r.rawName, member: r.target.toUpperCase() === IGNORE_KEYWORD ? null : r.target }));
}
