import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, configToRows, parseAliasRows, parseConfigRows } from "./config";
import type { Rows } from "./types";

describe("Config tab", () => {
  it("reads back exactly what it writes", () => {
    const { config, warnings } = parseConfigRows(configToRows(DEFAULT_CONFIG).rows);
    expect(warnings).toEqual([]);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("picks up edits made directly in the sheet", () => {
    const rows = configToRows(DEFAULT_CONFIG).rows;
    const startRow = rows.find((r) => r[0] === "Start date")!;
    startRow[1] = 46266; // a real date cell typed in Sheets = 2026-09-01
    rows.find((r) => r[0] === "OGTa")![2] = 5; // approvals goal 4 → 5
    rows.find((r) => r[0] === "Points per open")![1] = "2";
    const { config, warnings } = parseConfigRows(rows);
    expect(warnings).toEqual([]);
    expect(config.startDate).toBe("2026-09-01");
    expect(config.groups.find((g) => g.id === "OGTa")!.approvals).toBe(5);
    expect(config.points.open).toBe(2);
  });

  it("falls back to defaults with a warning on bad values", () => {
    const rows = configToRows(DEFAULT_CONFIG).rows;
    rows.find((r) => r[0] === "Start date")![1] = "next monday";
    rows.find((r) => r[0] === "Points per approval")![1] = "abc";
    const { config, warnings } = parseConfigRows(rows);
    expect(config.startDate).toBe(DEFAULT_CONFIG.startDate);
    expect(config.points.approval).toBe(1);
    expect(warnings).toHaveLength(2);
  });

  it("warns when a department points to a group that doesn't exist", () => {
    const rows: Rows = [...configToRows(DEFAULT_CONFIG).rows, ["EWA", "Revenue team"]];
    expect(parseConfigRows(rows).warnings.join(" ")).toMatch(/EWA.*Revenue team/);
  });

  it("uses defaults for an empty tab", () => {
    const { config, warnings } = parseConfigRows([]);
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(warnings).toHaveLength(1);
  });
});

describe("Name Aliases tab", () => {
  it("reads aliases and IGNORE entries, skipping the header and blanks", () => {
    expect(parseAliasRows([["Name", "Member"], ["Amna Riahi", "Emna Riahi"], ["deleted 6104535", "ignore"], ["", ""], ["half", ""]])).toEqual([
      { rawName: "Amna Riahi", member: "Emna Riahi" },
      { rawName: "deleted 6104535", member: null },
    ]);
  });
});
