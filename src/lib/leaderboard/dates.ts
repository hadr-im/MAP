import type { CellValue } from "./types";

const SHEETS_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null; // e.g. 31/02
  return date.toISOString().slice(0, 10);
}

/**
 * Converts a sheet cell to YYYY-MM-DD, or null when it isn't a date.
 * Handles real date cells (Sheets serial numbers), "2026-11-15[ 9:20:21]"
 * and "21/03/2026[ 10:20:30]" (day first, as used in these sheets).
 */
export function parseSheetDate(value: CellValue): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return new Date(SHEETS_EPOCH_UTC + Math.floor(value) * DAY_MS).toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  const s = value.trim();

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s.*)?$/.exec(s);
  if (m) return iso(+m[3], +m[2], +m[1]);

  return null;
}

export function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && parseSheetDate(s) === s;
}
