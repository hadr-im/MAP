import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { toPublicLeaderboard, type PublicLeaderboard } from "@/lib/leaderboard/public";
import { loadLeaderboard, type LeaderboardData } from "./data";

/** Tag for everything read from Google Sheets; revalidate it after admin changes or on "Refresh now". */
export const SHEETS_CACHE_TAG = "google-sheets";

/** Full leaderboard data (admin use), cached for about a minute so pages don't hit the Google API on every view. */
export async function getLeaderboard(): Promise<LeaderboardData> {
  "use cache";
  cacheTag(SHEETS_CACHE_TAG);
  cacheLife("minutes");
  return loadLeaderboard();
}

/** The public subset: standings and rules only. */
export async function getPublicLeaderboard(): Promise<PublicLeaderboard> {
  const data = await getLeaderboard();
  return toPublicLeaderboard(data, {
    dataUpdatedAt: data.dataUpdatedAt,
    fetchedAt: data.fetchedAt,
    groups: data.config.groups,
    points: data.config.points,
  });
}
