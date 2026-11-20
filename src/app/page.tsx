import { Suspense } from "react";
import { LeaderboardView } from "@/components/race/leaderboard-view";
import { StartCount, StartLights } from "@/components/race/start-lights";
import { getPublicLeaderboard } from "@/lib/server/leaderboard";

export default function Home() {
  return (
    <Suspense fallback={<WaitingForTiming />}>
      <Standings />
    </Suspense>
  );
}

async function Standings() {
  const data = await getPublicLeaderboard();
  return <LeaderboardView data={data} />;
}

/**
 * Shown while the sheets load. It is the start sequence's own first frame — the gantry dark and the
 * bar at zero — so when the data arrives the lights simply begin, with nothing to transition from.
 */
function WaitingForTiming() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-9 overflow-hidden px-3" role="status" aria-label="Loading the standings">
      <StartLights />
      <StartCount />
    </div>
  );
}
