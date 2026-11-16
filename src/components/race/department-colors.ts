/**
 * Categorical colours for the 3px department bar. Chosen to stay clear of the semantic
 * colours (purple fastest, green improved, yellow holding, red cut-off). Never the only signal:
 * the department name is always printed next to the bar.
 */
const KNOWN: Record<string, string> = {
  OGTA: "#3d8bff", // blue
  OGTE: "#7cc4ff", // sky
  OGV: "#2fc6d6", // cyan
  IGT: "#ff8a3d", // orange
  IGV: "#f472b6", // pink
  BD: "#c8b089", // sand
  PM: "#9aa8c7", // slate
  MKT: "#e6a07a", // peach
  IM: "#8aa1ff", // periwinkle
  "F&L": "#b9c2cf", // silver
  TM: "#6aa6b8", // steel teal
  EWA: "#d4b8ff", // lilac
};
const FALLBACK = ["#5b9cf0", "#ffa86b", "#7fd3e0", "#e79ac8", "#c5b796", "#a7b4d4"];

export function departmentColor(department: string): string {
  const key = department.toUpperCase().replace(/\s+/g, "");
  if (KNOWN[key]) return KNOWN[key];
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
