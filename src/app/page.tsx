import { Suspense } from "react";
import { Brand } from "@/components/race/brand";
import { LeaderboardView } from "@/components/race/leaderboard-view";
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

/** Shown while the sheets load. */
function WaitingForTiming() {
  return (
    <div className="mx-auto flex min-h-svh max-w-7xl flex-col px-4 sm:px-6 lg:px-10" aria-busy="true">
      <div className="py-5">
        <Brand />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-5 pb-24">
        <div className="h-1 w-48 overflow-hidden bg-kerb">
          <div className="h-full w-1/3 animate-pulse bg-chalk" />
        </div>
        <p className="text-chalk-dim" role="status">
          Loading the timing data…
        </p>
      </div>
    </div>
  );
}
