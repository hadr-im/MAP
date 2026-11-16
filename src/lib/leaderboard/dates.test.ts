import { describe, expect, it } from "vitest";
import { isValidIsoDate, parseSheetDate } from "./dates";

describe("parseSheetDate", () => {
  it("reads Google Sheets serial numbers (real date cells)", () => {
    expect(parseSheetDate(45658)).toBe("2025-01-01");
    expect(parseSheetDate(45658.75)).toBe("2025-01-01"); // time of day is ignored
  });

  it("reads the year-first format used in OGX Approvals and the leads mirror", () => {
    expect(parseSheetDate("2026-11-15")).toBe("2026-11-15");
    expect(parseSheetDate("2026-01-26 9:20:21")).toBe("2026-01-26");
  });

  it("reads the day-first format used in IGV Approvals and Google Forms", () => {
    expect(parseSheetDate("21/03/2026")).toBe("2026-03-21");
    expect(parseSheetDate("03/04/2026")).toBe("2026-04-03");
    expect(parseSheetDate("15/11/2026 10:20:30")).toBe("2026-11-15");
  });

  it("rejects things that aren't dates", () => {
    for (const v of ["", "hello", "31/02/2026", "2026-13-01", "Updated 2026-11-15 21:15", null, undefined, true, 0])
      expect(parseSheetDate(v)).toBeNull();
  });

  it("validates ISO dates", () => {
    expect(isValidIsoDate("2026-09-01")).toBe(true);
    expect(isValidIsoDate("2026-9-1")).toBe(false);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
  });
});
