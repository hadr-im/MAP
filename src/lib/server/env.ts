import "server-only";

export interface ServerEnv {
  serviceAccountEmail: string;
  privateKey: string;
  mapDataSheetId: string;
  leadsMirrorSheetId: string;
}

let cached: ServerEnv | undefined;

/** Reads secrets lazily so a missing value fails with a clear message, never at import time. */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const read = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing environment variable ${name}. Add it to .env.local.`);
    return value;
  };
  cached = {
    serviceAccountEmail: read("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    privateKey: read("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    mapDataSheetId: read("MAP_DATA_SHEET_ID"),
    leadsMirrorSheetId: read("LEADS_MIRROR_SHEET_ID"),
  };
  return cached;
}
