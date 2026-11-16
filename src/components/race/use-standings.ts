"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PublicLeaderboard } from "@/lib/leaderboard/public";

export type Movement = "up" | "down";

const STORAGE_KEY = "map-s2-positions";
const REFRESH_MS = 60_000;

type Positions = Record<string, number>;
interface Stored {
  stamp: string;
  positions: Positions;
  previous: Positions | null;
}

const positionsOf = (data: PublicLeaderboard): Positions => Object.fromEntries(data.drivers.map((d) => [d.id, d.position]));
const stampOf = (data: PublicLeaderboard) =>
  data.dataUpdatedAt ?? data.drivers.map((d) => `${d.id}:${d.position}`).join("|");

/**
 * Places gained/lost since the previous data update this browser saw.
 * Kept per data stamp, so reloading the same data keeps showing the same arrows.
 */
function deltasFor(data: PublicLeaderboard): Record<string, number> {
  const stamp = stampOf(data);
  const current = positionsOf(data);
  let previous: Positions | null = null;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Stored | null;
    previous = stored?.stamp === stamp ? stored.previous : (stored?.positions ?? null);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ stamp, positions: current, previous } satisfies Stored));
  } catch {}
  if (!previous) return {};
  const deltas: Record<string, number> = {};
  for (const [id, pos] of Object.entries(current)) if (previous[id] !== undefined) deltas[id] = previous[id] - pos;
  return deltas;
}

const NO_DELTAS: Record<string, number> = {};
const deltaCache = new Map<string, Record<string, number>>();
const noopSubscribe = () => () => {};

/** Live standings: polls once a minute while the tab is visible. */
export function useStandings(initial: PublicLeaderboard) {
  const [data, setData] = useState(initial);
  const [moved, setMoved] = useState<Record<string, Movement> | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const current = useRef(initial);

  // localStorage is an external store: read it through useSyncExternalStore (empty on the server).
  const deltas = useSyncExternalStore(
    noopSubscribe,
    () => {
      const stamp = stampOf(data);
      if (!deltaCache.has(stamp)) deltaCache.set(stamp, deltasFor(data));
      return deltaCache.get(stamp)!;
    },
    () => NO_DELTAS,
  );

  useEffect(() => {
    const signature = (d: PublicLeaderboard) => d.drivers.map((x) => `${x.id}:${x.position}:${x.score}:${x.readiness}`).join("|");
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/standings", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as PublicLeaderboard;
        if (signature(next) === signature(current.current)) return;

        const before = positionsOf(current.current);
        const movement: Record<string, Movement> = {};
        let up = 0;
        let down = 0;
        for (const d of next.drivers) {
          const was = before[d.id];
          if (was === undefined || was === d.position) continue;
          movement[d.id] = was > d.position ? "up" : "down";
          if (was > d.position) up++;
          else down++;
        }
        const newlyQualified = next.drivers.filter((d) => d.eligible).length - current.current.drivers.filter((d) => d.eligible).length;

        current.current = next;
        setMoved(movement);
        setData(next);
        setAnnouncement(
          [
            "Standings updated.",
            up ? `${up} moved up.` : null,
            down ? `${down} moved down.` : null,
            newlyQualified > 0 ? `${newlyQualified} reached the grid.` : null,
          ]
            .filter(Boolean)
            .join(" "),
        );
      } catch {
        // Network blips are fine; the next poll tries again.
      }
    };
    const timer = window.setInterval(poll, REFRESH_MS);
    const onVisible = () => !document.hidden && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return { data, deltas, moved, announcement };
}
