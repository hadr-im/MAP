// Creates the Config and Name Aliases tabs in the MAP data spreadsheet if they don't exist.
// Usage: pnpm sheets:setup
export {};
process.loadEnvFile(".env.local");

async function main() {
  const { ensureSettingsTabs } = await import("@/lib/server/data");
  const created = await ensureSettingsTabs();
  console.log(created.length ? `✓ Created: ${created.join(", ")}` : "✓ Config and Name Aliases tabs already exist; nothing changed.");
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
