"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PublicDriver, PublicLeaderboard } from "@/lib/leaderboard/public";
import { Brand } from "./brand";
import { Trophies, type Metal } from "./trophies";

/** Index = place − 1. Module-level so the trophy scene is built once. */
const METALS: Metal[] = ["gold", "silver", "bronze", "iron"];
const PRIZES = [
  "100% Natco covered",
  "50% Natco covered",
  "Free product",
  "Free bracelet",
];
const CUPS = ["Gold cup", "Silver cup", "Bronze cup", "Iron cup"];

/**
 * Block heights: P1 clearly tallest, P4 lowest so it never competes with the top three.
 * Also capped by viewport height so the whole composition fits on laptop screens.
 */
const BLOCK_HEIGHT = [
  "clamp(214px,min(31vw,40svh),405px)",
  "clamp(162px,min(23.2vw,30svh),304px)",
  "clamp(129px,min(18.1vw,23.5svh),238px)",
  "clamp(100px,min(13.8vw,17.9svh),181px)",
];

/**
 * One design system for the podium: dark neutral blocks, each with a thin metal top edge and a faint
 * wash of its own metal. Gold carries the strongest wash; slate (fourth) the faintest.
 */
const RANK = [
  {
    metal: "var(--color-gold)",
    wash: "rgb(214 173 85 / 0.22)",
    numeral: "text-gold",
  },
  {
    metal: "var(--color-silver)",
    wash: "rgb(174 181 189 / 0.12)",
    numeral: "text-silver",
  },
  {
    metal: "var(--color-bronze)",
    wash: "rgb(184 121 82 / 0.12)",
    numeral: "text-bronze",
  },
  {
    metal: "var(--color-slate)",
    wash: "rgb(111 118 126 / 0.07)",
    numeral: "text-slate",
  },
];

/** Who stands where, by how many steps are filled. P1 takes the middle as soon as there are three. */
const ORDER_BY_COUNT = [[], [0], [1, 0], [1, 0, 2], [1, 0, 2, 3]];

export function Hero({ data }: { data: PublicLeaderboard }) {
  const podium = useRef<HTMLDivElement>(null);
  /** Only members who have actually qualified take a step; an unearned place stays empty. */
  const winners = data.drivers.filter((d) => d.eligible).slice(0, 4);
  const order = ORDER_BY_COUNT[winners.length];

  return (
    <section
      data-hero
      className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-asphalt-900"
      aria-labelledby="hero-title"
    >
      <Stage />

      <nav
        data-intro
        data-hero-nav
        className="relative mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-5 md:px-8"
      >
        <Link href="/" aria-label="MAP S2 standings, home">
          <Brand />
        </Link>
      </nav>

      {/* centred composition: heading, subtitle, then the podium with clear space between them */}
      {/* on a wide screen the nav leaves a lot of room above, so the block sits a little below centre */}
      <div className="relative mx-auto my-auto w-[min(88vw,1100px)] py-4 sm:py-8 lg:translate-y-[4vh]">
        <h1 id="hero-title" className="sr-only">
          Welcome to the MAP Race. Your championship awaits.
        </h1>
        <Headline />

        {/* pulled up so P1 and its cup rise over the tail of the subtitle */}
        <div
          data-intro
          className="relative z-10 mx-auto w-full sm:w-[82%]"
          // room on a phone, where the cup would crowd the subtitle; the overlap is only wanted on a wide screen
          style={{ marginTop: "clamp(-18px, 86px - 13vw, 86px)" }}
        >
          {winners.length ? (
            <>
              <div ref={podium} data-podium className="relative">
                <Trophies container={podium} metals={METALS.slice(0, winners.length)} />
                <ol className="grid items-end gap-[3%]" style={{ gridTemplateColumns: `repeat(${winners.length}, minmax(0, 1fr))` }}>
                  {order.map((index) => (
                    <PodiumBlock key={index} index={index} driver={winners[index]} order={order} />
                  ))}
                </ol>
              </div>

              <ul
                data-prizes
                className="mt-4 grid gap-[3%] text-center"
                style={{ gridTemplateColumns: `repeat(${winners.length}, minmax(0, 1fr))` }}
                aria-label="Rewards"
              >
                {order.map((index) => (
                  <li
                    key={index}
                    className="text-[clamp(0.58rem,0.88vw,0.75rem)] leading-relaxed text-balance text-chalk uppercase"
                    style={{ fontFamily: "var(--font-wide-face)" }}
                  >
                    <span className="sr-only">{CUPS[index]}: </span>
                    {PRIZES[index]}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyPodium />
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Drawn as SVG text so both lines span exactly the same width at any size.
 * Line one: heavy condensed display, stretched tall. Line two: wide racing face, stretched wider.
 * Big Shoulders caps are ~0.79em, Michroma caps ~0.72em; the spacing below is worked out from those.
 */
function Headline() {
  const display = {
    fontFamily: "var(--font-display-face)",
    fontWeight: 900,
    fontVariationSettings: '"opsz" 72',
  } as const;
  const wide = {
    fontFamily: "var(--font-wide-face)",
    fontWeight: 400,
  } as const;
  return (
    <svg
      data-intro
      viewBox="0 0 1000 214"
      className="block h-auto w-full overflow-visible"
      aria-hidden
    >
      <g data-hl-1 className="fill-chalk">
        <text
          transform="translate(0 130) scale(1 1.7)"
          textLength="1000"
          lengthAdjust="spacingAndGlyphs"
          style={{ ...display, fontSize: 96 }}
        >
          WELCOME TO THE MAP RACE
        </text>
      </g>
      <g data-hl-2 className="fill-chalk/85">
        <text
          x="2"
          y="206"
          textLength="996"
          lengthAdjust="spacingAndGlyphs"
          style={{ ...wide, fontSize: 38 }}
        >
          YOUR CHAMPIONSHIP AWAITS
        </text>
      </g>
    </svg>
  );
}

function PodiumBlock({
  index,
  driver,
  order,
}: {
  index: number;
  driver: PublicDriver;
  order: number[];
}) {
  const place = index + 1;
  const rank = RANK[index];
  return (
    <li className="flex flex-col" style={{ order: order.indexOf(index) }}>
      {/* where the cup floats: same height for every place, so the cups share one scale */}
      <div
        data-trophy-anchor={index}
        className="h-[min(9vw,100px)]"
        aria-hidden
      />
      {/* the bar is narrower than its column, so the podium keeps its overall width */}
      <div
        data-step={index}
        className="relative mx-auto w-[82%] origin-bottom"
        style={{
          height: BLOCK_HEIGHT[index],
          // the foot of each bar sinks to just under the page colour, so it melts into the floor
          background: `linear-gradient(180deg, ${rank.wash} 0%, transparent 55%), linear-gradient(180deg, #1e1e1e 0%, #151515 100%)`,
        }}
      >
        <span
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: rank.metal }}
          aria-hidden
        />
        {/* side edges in the step's own metal, gone by halfway down */}
        <span
          className="absolute inset-y-0 left-0 w-px"
          style={{
            background: `linear-gradient(180deg, ${rank.metal} 0%, transparent 50%)`,
          }}
          aria-hidden
        />
        <span
          className="absolute inset-y-0 right-0 w-px"
          style={{
            background: `linear-gradient(180deg, ${rank.metal} 0%, transparent 50%)`,
          }}
          aria-hidden
        />
        <div
          data-step-content
          className="flex h-full flex-col items-center px-1.5 pt-4 text-center sm:px-3 sm:pt-6"
        >
          <span
            className={`display text-[clamp(2.25rem,5.2vw,4.25rem)] leading-[0.8] ${rank.numeral}`}
            aria-hidden
          >
            {place}
          </span>
          <span className="sr-only">{`P${place}, ${CUPS[index]}, reward: ${PRIZES[index]}. ${driver.name}, ${driver.department}, qualified.`}</span>
          <span className="mt-3 w-full sm:mt-4" aria-hidden>
            <span className="display text-[clamp(0.7rem,1.4vw,1.25rem)] leading-tight tracking-[0.07em] text-balance text-chalk">{driver.name}</span>
          </span>
        </div>
      </div>
    </li>
  );
}

/**
 * Nobody has qualified yet. Rather than four blanks pretending to be a podium, the steps are drawn as
 * empty outlines — the shape of what is waiting — with the prizes still named underneath.
 */
function EmptyPodium() {
  const steps = [1, 0, 2, 3];
  return (
    <div className="relative">
      <ol className="grid grid-cols-4 items-end gap-[3%]" aria-hidden>
        {steps.map((index) => (
          <li key={index} className="flex flex-col" style={{ order: steps.indexOf(index) }}>
            <div className="h-[min(9vw,100px)]" />
            <div
              className="relative mx-auto w-[82%] border border-dashed"
              style={{ height: BLOCK_HEIGHT[index], borderColor: "rgb(243 239 230 / 0.12)" }}
            >
              <span className="absolute inset-x-0 top-0 h-px" style={{ background: RANK[index].metal, opacity: 0.45 }} />
              <span
                className="display absolute inset-x-0 top-4 text-center text-[clamp(2.25rem,5.2vw,4.25rem)] leading-[0.8] text-chalk/10 sm:top-6"
              >
                {index + 1}
              </span>
            </div>
          </li>
        ))}
      </ol>

      {/* one line, in the subtitle's racing face, sized so it never wraps */}
      <p
        className="mt-10 mb-10 text-center text-[clamp(0.62rem,1.35vw,1rem)] text-balance text-chalk/70 uppercase sm:mt-12 sm:mb-16 sm:whitespace-nowrap"
        style={{ fontFamily: "var(--font-wide-face)" }}
      >
        Podium&apos;s gathering dust. Wipe it down and claim your prize.
      </p>
    </div>
  );
}

/* ================= Stage: gold light rays, dark, quiet, a touch of grain ================= */

/** WebGL, so it never runs on the server and stays out of the first JS payload. */
const LightRays = dynamic(() => import("@/components/LightRays"), {
  ssr: false,
});

/** Narrow screens get shorter, sparser rays and a lower pixel ratio: cheaper on mid-range phones. */
const useMedia = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const sync = () => setMatches(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, [query]);
  return matches;
};

function Stage() {
  const isPhone = useMedia("(max-width: 639px)");
  const isTablet = useMedia("(max-width: 1023px)");
  const stillness = useMedia("(prefers-reduced-motion: reduce)");

  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
      {/* the ceremony's key light: gold rays down the centre, behind everything */}
      <div className="absolute inset-0">
        <LightRays
          raysOrigin="top-center"
          raysColor="#D6AD55"
          // reduced motion: hold the rays still rather than remove them
          raysSpeed={stillness ? 0 : 0.45}
          // a phone screen is narrow and tall: tighter, sharper, denser rays, or they wash into a gradient
          lightSpread={isPhone ? 0.55 : 0.8}
          rayLength={isPhone ? 2.2 : isTablet ? 1.9 : 2.3}
          rayDensity={isPhone ? 1.1 : isTablet ? 0.8 : 1}
          raySharpness={isPhone ? 0.45 : 0.3}
          glow={0.5}
          haze={0.35}
          atmosphere={0}
          intensity={isPhone ? 0.9 : 0.75}
          fadeDistance={0.9}
          opacity={isPhone ? 0.72 : 0.62}
          // the beam leans toward the pointer and flares on click; reduced motion keeps it still
          followMouse={!stillness}
          mouseInfluence={0.18}
          cursorShadow={false}
          clickPulse={!stillness}
          noiseAmount={0}
          intro={!stillness}
          maxDevicePixelRatio={isPhone ? 1.35 : 1.5}
        />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_38%,#0a0a0a_100%)]" />
      <div className="grain absolute inset-0 opacity-[0.06] mix-blend-overlay" />
    </div>
  );
}
