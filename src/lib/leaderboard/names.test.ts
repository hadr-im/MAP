import { describe, expect, it } from "vitest";
import { createNameMatcher, nameKey, nameSimilarity } from "./names";

describe("nameKey", () => {
  it("ignores case, extra spaces, accents and word order", () => {
    expect(nameKey("Hasni Tasnim")).toBe(nameKey("tasnim   HASNI"));
    expect(nameKey("Saïdi Sahar")).toBe(nameKey("sahar saidi"));
  });

  it("drops El/Al and unifies Med/Mohammed → Mohamed", () => {
    expect(nameKey("Hamsa El Mabrouk")).toBe(nameKey("Hamsa Mabrouk"));
    expect(nameKey("Med Yassine Chatti")).toBe(nameKey("Mohamed Yassine Chatti"));
    expect(nameKey("Mohammed Ali")).toBe(nameKey("mohamed ali"));
  });
});

describe("nameSimilarity (real mismatches from the sheets)", () => {
  it("scores spelling variants of the same person high", () => {
    expect(nameSimilarity("Tassnim Hasni", "Hasni Tasnim")).toBeGreaterThanOrEqual(0.9);
    expect(nameSimilarity("Amna Riahi", "Emna Riahi")).toBeGreaterThanOrEqual(0.9);
    expect(nameSimilarity("kenza hassani", "kenza hasseni")).toBeGreaterThanOrEqual(0.9);
  });

  it("scores different people low", () => {
    expect(nameSimilarity("Ahmed Attia", "Aymen Zouaoui")).toBeLessThan(0.7);
    expect(nameSimilarity("Helmy Chelly", "Malek Elfahem")).toBeLessThan(0.6);
  });
});

describe("createNameMatcher", () => {
  const roster = ["Emna Riahi", "Hamsa Mabrouk", "Chaima", "Dorra Ben Lazreg", "Med Yassine Chatti", "Youssef Touili", "Tassnim Hasni"];

  it("matches exact names after cleaning", () => {
    const m = createNameMatcher(roster, [], 0.9);
    expect(m.match("Youssef touili")).toMatchObject({ status: "exact", member: "Youssef Touili" });
    expect(m.match("Hamsa El Mabrouk")).toMatchObject({ status: "exact", member: "Hamsa Mabrouk" });
    expect(m.match("Mohamed Yassine Chatti")).toMatchObject({ status: "exact", member: "Med Yassine Chatti" });
  });

  it("auto-matches close spellings with a clear winner", () => {
    const m = createNameMatcher(roster, [], 0.9);
    expect(m.match("Amna Riahi")).toMatchObject({ status: "auto", member: "Emna Riahi" });
    expect(m.match("Hasni Tasnim")).toMatchObject({ status: "auto", member: "Tassnim Hasni" });
  });

  it("sends unsure names to review with the right suggestion first", () => {
    const m = createNameMatcher(roster, [], 0.9);
    const chaima = m.match("Chaima Khabouchi");
    expect(chaima.status).toBe("review");
    expect(chaima.candidates[0].member).toBe("Chaima");
    const dorra = m.match("Benlazreg Dorra");
    expect(dorra.candidates[0].member).toBe("Dorra Ben Lazreg");
  });

  it("never auto-picks between two similar members", () => {
    const m = createNameMatcher(["Yasmine Attig", "Yassmine Attig"], [], 0.9);
    expect(m.match("Yasmin Attig").status).toBe("review");
  });

  it("applies admin aliases, including IGNORE", () => {
    const m = createNameMatcher(roster, [
      { rawName: "Chaima Khabouchi", member: "Chaima" },
      { rawName: "deleted 6104535", member: null },
      { rawName: "Someone", member: "Not A Member" },
    ], 0.9);
    expect(m.match("chaima  khabouchi")).toMatchObject({ status: "alias", member: "Chaima" });
    expect(m.match("deleted 6104535")).toMatchObject({ status: "ignored", member: null });
    expect(m.warnings.join(" ")).toMatch(/Not A Member/);
  });

  it("warns about duplicate members", () => {
    const m = createNameMatcher(["Omar Hamdi", "omar  hamdi"], [], 0.9);
    expect(m.warnings[0]).toMatch(/more than once/);
    expect(m.match("Omar Hamdi").status).toBe("review");
  });
});
