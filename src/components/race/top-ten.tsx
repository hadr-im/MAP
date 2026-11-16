"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import type { PublicDriver, PublicLeaderboard } from "@/lib/leaderboard/public";
import { cn } from "@/lib/utils";
import { METRIC_TITLE, formatNumber, missingList, percent } from "./format";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const PRIZES = ["100% Natco covered", "50% Natco covered", "Free product", "Free bracelet"];

/**
 * One system shared with the podium: a dark row carrying its place's metal as a left edge and a faint
 * wash. P1 is the exception — a gold plate, the only filled row on the page.
 */
const PLACE = [
  { edge: "var(--color-gold)", wash: "rgb(214 173 85 / 0.10)", text: "var(--color-gold)" },
  { edge: "var(--color-silver)", wash: "rgb(174 181 189 / 0.07)", text: "var(--color-silver)" },
  // bronze and slate are lifted for small text only; at numeral size the token colours are used as they are
  { edge: "var(--color-bronze)", wash: "rgb(184 121 82 / 0.07)", text: "#c98a63" },
  { edge: "var(--color-slate)", wash: "rgb(111 118 126 / 0.05)", text: "#8e959d" },
];

export function TopTen({ data }: { data: PublicLeaderboard }) {
  const root = useRef<HTMLElement>(null);
  const top = data.drivers.slice(0, 10);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const rows = gsap.utils.toArray<HTMLElement>("[data-top-row]", root.current);
        gsap.set(rows, { autoAlpha: 0, x: -40 });
        ScrollTrigger.batch(rows, {
          start: "top 90%",
          once: true,
          onEnter: (els) => gsap.to(els, { autoAlpha: 1, x: 0, duration: 0.6, stagger: 0.07, ease: "power3.out", overwrite: true }),
        });
      });
    },
    { scope: root, dependencies: [data] },
  );

  return (
    <section ref={root} id="top-ten" className="mx-auto max-w-[1400px] px-4 py-16 md:px-8 md:py-24" aria-labelledby="top-ten-title">
      <div>
        <h2 id="top-ten-title" className="display text-[clamp(3rem,9vw,6rem)] leading-[0.85]">
          Top 10
        </h2>
        <p className="serif mt-2 text-[clamp(1.2rem,2.4vw,1.6rem)] text-chalk-dim">The front of the field, right now.</p>
      </div>

      <ol className="mt-10 space-y-1.5">
        {top.map((d, i) => (
          <TopRow key={d.id} driver={d} place={i + 1} />
        ))}
      </ol>
    </section>
  );
}

function TopRow({ driver: d, place }: { driver: PublicDriver; place: number }) {
  const leader = place === 1;
  const rank = PLACE[place - 1];
  const pct = percent(d.eligible ? d.score : d.readiness);
  const prize = place <= 4 ? PRIZES[place - 1] : null;
  /** Below the podium places, qualifying is what the edge marks. */
  const edge = rank?.edge ?? (d.eligible ? "rgb(243 239 230 / 0.45)" : "var(--color-kerb)");
  const { shared, routes } = splitRoutes(d);

  return (
    <li data-top-row>
      <div
        className="relative isolate overflow-hidden bg-asphalt-800 text-chalk"
        style={{
          // P1: gold light spilling from the edge into the dark, the way the hero is lit
          backgroundImage: leader
            ? "linear-gradient(90deg, rgb(214 173 85 / 0.17) 0%, rgb(214 173 85 / 0.07) 26%, rgb(214 173 85 / 0.02) 52%, transparent 70%)"
            : rank
              ? `linear-gradient(90deg, ${rank.wash}, transparent 60%)`
              : undefined,
        }}
      >
        {/* a hairline along the top in this place's metal: structure without a slab down the side */}
        <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, ${edge}, transparent 45%)` }} aria-hidden />
        <span className="checker absolute inset-0 -z-10 opacity-[0.04] [--sq:14px] [mask-image:linear-gradient(90deg,#000,transparent_45%)]" aria-hidden />

        <div
          className={cn(
            "grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 px-3.5 py-3 sm:grid-cols-[5rem_minmax(0,1fr)_minmax(18rem,30rem)_7rem] sm:gap-x-7 sm:px-4 sm:py-5 md:px-6",
          )}
        >
          <span
            className={cn("display num text-[clamp(1.9rem,5.5vw,3.6rem)] leading-[0.85]", place > 4 && "text-chalk-dim")}
            style={place <= 4 ? { color: rank.edge } : undefined}
          >
            <span className="align-top text-[0.42em]">#</span>
            {place}
          </span>

          <div className="min-w-0">
            <p className="flex items-center gap-2.5 text-lg font-bold sm:text-xl">
              <span className="truncate">{d.name}</span>
              {/* a hairline tag, not a filled badge: it states a fact without competing with the metals */}
              {!d.eligible ? (
                <span className="shrink-0 rounded-[2px] border border-chalk/15 px-1.5 py-px text-[10px] font-medium tracking-[0.06em] whitespace-nowrap text-chalk-dim uppercase">
                  Not qualified
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 truncate text-sm text-chalk-dim">
              Department: {d.department}
              {d.isOC ? ", OC" : ""}
            </p>
            {prize ? (
              <p className="serif mt-1 text-base" style={{ color: rank.text }}>
                {prize}
              </p>
            ) : null}
          </div>

          {/* timing tower: how far along each goal is, read at a glance. An OC member has two routes
              and either one qualifies them, so they sit side by side — no taller than a single route. */}
          <div className="col-span-3 mt-2.5 grid gap-2 sm:col-span-1 sm:mt-0 sm:gap-3">
            <Route progress={shared} tint={rank?.edge} />
            {routes.length > 1 ? (
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-3 sm:gap-x-5">
                <Route progress={routes[0]} tint={rank?.edge} />
                <span className="self-center text-xs text-chalk-dim">or</span>
                <Route progress={routes[1]} tint={rank?.edge} />
              </div>
            ) : (
              <Route progress={routes[0] ?? []} tint={rank?.edge} />
            )}
          </div>

          <div className="col-start-3 row-start-1 text-right sm:col-start-auto sm:row-start-auto">
            <p className="display num text-[clamp(1.8rem,3.6vw,2.6rem)] leading-none">
              {pct}
              <span className="text-base">%</span>
            </p>
            <p className={cn("mt-1 ml-auto max-w-[22ch] text-xs", d.eligible ? "text-chalk" : "text-chalk-dim")}>
              {d.eligible ? "Qualified" : d.group ? `Needs ${missingList(d)}` : "Still chasing"}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}

type Progress = PublicDriver["progress"];

/**
 * An OC member has two routes that both set a signup goal. Showing it twice would waste a line, so a
 * goal both routes share is listed once at its easier figure, and only what differs is set side by side.
 */
function splitRoutes(d: PublicDriver): { shared: Progress; routes: Progress[] } {
  if (!d.alternate) return { shared: [], routes: [d.progress] };
  const other = d.alternate.progress;
  const inBoth = (list: Progress, from: Progress) => list.filter((p) => from.some((q) => q.metric === p.metric));
  const shared = inBoth(d.progress, other).map((p) => {
    const twin = other.find((q) => q.metric === p.metric)!;
    return p.goal <= twin.goal ? p : twin;
  });
  const only = (list: Progress) => list.filter((p) => !shared.some((s) => s.metric === p.metric));
  return { shared, routes: [only(d.progress), only(other)] };
}

/** One way to qualify: every goal in that route, stacked. */
function Route({ progress, tint }: { progress: PublicDriver["progress"]; tint?: string }) {
  return (
    <dl className="grid min-w-0 content-start gap-2 sm:gap-3">
      {progress.map((p) => (
        <Meter key={p.metric} label={METRIC_TITLE[p.metric]} value={p.value} goal={p.goal} tint={tint} />
      ))}
    </dl>
  );
}

/** One goal: name, figures, and a rule that fills as it is met. */
function Meter({ label, value, goal, tint }: { label: string; value: number; goal: number; tint?: string }) {
  const met = value >= goal;
  const filled = Math.max(0, Math.min(1, goal > 0 ? value / goal : 0));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 sm:gap-3">
        <dt className="truncate text-xs font-light text-chalk-dim sm:text-[13px]">{label}</dt>
        <dd className={cn("num shrink-0 text-xs sm:text-[13px]", met ? "text-chalk" : "text-chalk-dim")}>
          <span className={cn(met && "font-semibold")}>{formatNumber(value)}</span>
          <span className="text-chalk-dim">/{formatNumber(goal)}</span>
        </dd>
      </div>
      <div className="mt-1.5 h-[3px] w-full bg-chalk/[0.07]" aria-hidden>
        <div
          className="h-full"
          style={{
            width: `${filled * 100}%`,
            background: met ? (tint ?? "var(--color-chalk)") : "rgb(243 239 230 / 0.38)",
          }}
        />
      </div>
    </div>
  );
}
