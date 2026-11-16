// Connection check for the Google service account.
// Reads only spreadsheet titles and tab names (no cell data) and never prints secrets.
// Usage: node scripts/check-google.mjs
import { JWT } from "google-auth-library";

try {
  process.loadEnvFile(".env.local");
} catch {
  console.error("✗ Could not read .env.local in the project root.");
  process.exit(1);
}

const env = process.env;
const problems = [];
const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "";
const key = (env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

if (!email.endsWith(".gserviceaccount.com")) problems.push("GOOGLE_SERVICE_ACCOUNT_EMAIL doesn't look like a service account email.");
if (!key.includes("-----BEGIN PRIVATE KEY-----") || !key.includes("-----END PRIVATE KEY-----"))
  problems.push("GOOGLE_PRIVATE_KEY is missing its BEGIN/END lines (copy the whole value, keep the double quotes).");
if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD === "CHANGE_ME") console.warn("! ADMIN_PASSWORD is still the placeholder (set it before using the admin side).");
for (const name of ["MAP_DATA_SHEET_ID", "LEADS_MIRROR_SHEET_ID", "SESSION_SECRET"])
  if (!env[name]) problems.push(`${name} is empty.`);

if (problems.length) {
  for (const p of problems) console.error("✗ " + p);
  process.exit(1);
}
console.log("✓ .env.local values look well-formed");

const client = new JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });

let failed = false;
for (const [label, id] of [
  ["MAP data", env.MAP_DATA_SHEET_ID],
  ["Leads mirror", env.LEADS_MIRROR_SHEET_ID],
]) {
  try {
    const { data } = await client.request({
      url: `https://sheets.googleapis.com/v4/spreadsheets/${id}`,
      params: { fields: "properties.title,sheets.properties(title,gridProperties(rowCount,columnCount))" },
    });
    console.log(`\n✓ ${label}: "${data.properties.title}"`);
    for (const s of data.sheets) {
      const g = s.properties.gridProperties ?? {};
      console.log(`    - ${s.properties.title}  (${g.rowCount ?? "?"} rows × ${g.columnCount ?? "?"} cols)`);
    }
  } catch (err) {
    failed = true;
    const status = err?.status ?? err?.response?.status;
    const msg = err?.response?.data?.error?.message ?? err?.message ?? String(err);
    const hint =
      status === 403 ? "→ Share this spreadsheet with the service account email, or enable the Google Sheets API." :
      status === 404 ? "→ Spreadsheet ID not found; check the ID in .env.local." :
      /invalid_grant|DECODER|PEM|private key/i.test(msg) ? "→ The private key value is malformed; re-copy it from the JSON file." : "";
    console.error(`\n✗ ${label}: ${status ?? ""} ${msg}\n  ${hint}`);
  }
}
process.exit(failed ? 1 : 0);
