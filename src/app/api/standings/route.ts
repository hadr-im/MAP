import { getPublicLeaderboard } from "@/lib/server/leaderboard";

/** Public standings for the page's once-a-minute refresh. Same cached data as the page itself. */
export async function GET() {
  const data = await getPublicLeaderboard();
  return Response.json(data, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } });
}
