import { describe, expect, it } from "vitest";
import { displayName, driverCodes } from "./public";

describe("displayName", () => {
  it("fixes casing typed into the sheets", () => {
    expect(displayName("aya fatteki")).toBe("Aya Fatteki");
    expect(displayName("GHARBI  ahmed")).toBe("Gharbi Ahmed");
    expect(displayName("dorsaf Mariam ben hassine")).toBe("Dorsaf Mariam Ben Hassine");
  });
});

describe("driverCodes", () => {
  it("uses the surname and keeps codes unique", () => {
    expect(driverCodes(["Aymen Zouaoui", "Emna Riahi", "Dorra Ben Lazreg", "Zied Zouari"])).toEqual(["ZOU", "RIA", "LAZ", "ZZO"]);
  });

  it("handles single names and accents", () => {
    expect(driverCodes(["Chaima", "Sahar Saïdi"])).toEqual(["CHA", "SAI"]);
  });
});
