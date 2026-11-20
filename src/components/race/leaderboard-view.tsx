"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import type { PublicLeaderboard } from "@/lib/leaderboard/public";
import { Brand } from "./brand";
import { METRIC_LABEL, formatDay, formatNumber } from "./format";
import { Hero } from "./hero";
import { StandingsTable } from "./standings-table";
import { TopTen } from "./top-ten";
import { RACES } from "./races";
import { LAMP_TONES, StartCount, StartLights } from "./start-lights";
import { TrackSeparator } from "./track-separator";
import { useStandings } from "./use-standings";

gsap.registerPlugin(useGSAP);

const { one: RACE_ONE, two: RACE_TWO, three: RACE_THREE } = RACES;

/**
 * What this page load asked for, read once from the classes the inline script set.
 * In development React mounts, unmounts and remounts, which kills the first run of the sequence; the
 * classes are gone by then, so without this the intro would show as a flash and never play again.
 */
let introRequest: { intro: boolean; lights: boolean } | null = null;

export function LeaderboardView({ data: initial }: { data: PublicLeaderboard }) {
  const root = useRef<HTMLDivElement>(null);
  const { data, deltas, announcement } = useStandings(initial);

  /* ============ Loader (once per session) + hero entrance (every visit) ============ */
  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const html = document.documentElement;
      introRequest ??= { intro: html.classList.contains("intro"), lights: html.classList.contains("lights") };
      const { intro: playIntro, lights: playLights } = introRequest;
      delete html.dataset.podium;
      const podiumReady = () => void (html.dataset.podium = "ready"); // trophies grow in after this
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        html.classList.remove("intro", "lights");
        podiumReady();
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!playIntro) {
          podiumReady();
          return;
        }

        const steps = q("[data-step]");
        const byPlace = [3, 2, 0, 1].map((i) => steps[i]).filter(Boolean); // DOM order is P2, P1, P3, P4 → rise P4, P3, P2, P1
        const entrance = gsap.timeline({ paused: playLights, defaults: { ease: "expo.out" } });
        entrance
          .from(q("[data-hero-nav]"), { autoAlpha: 0, y: -16, duration: 0.6 }, 0.1)
          // the tall line rises into place, then the stretched serif line slides in from the left
          .from(q("[data-hl-1]"), { y: 70, autoAlpha: 0, duration: 1 }, 0.15)
          .from(q("[data-hl-2]"), { x: -160, autoAlpha: 0, duration: 1.1 }, 0.45)
          // the podium rises, P4 first, P1 last; then the trophies grow in
          .from(byPlace, { scaleY: 0, transformOrigin: "50% 100%", duration: 1, stagger: 0.12, ease: "power4.out" }, 0.7)
          .from(q("[data-step-content]"), { autoAlpha: 0, y: 10, duration: 0.5, stagger: 0.06, ease: "power3.out" }, 1.3)
          .from(q("[data-prizes] li"), { autoAlpha: 0, y: 8, duration: 0.5, stagger: 0.06, ease: "power3.out" }, 1.45)
          .add(podiumReady, 1.35);

        let cleanup = () => {};
        if (playLights) {
          /*
           * The start procedure, about 2.7s: four panels draw in, each pair strikes red in turn, a
           * held beat, then the reds clear and the last panel comes up green — go. The screen lifts
           * away as the hero's entrance begins underneath. Any input skips to the "out" label.
           */
          const loader = q("[data-loader]")[0];
          const panels = q("[data-panel]");
          const bases = q("[data-base]");
          const skipHint = q("[data-skip]")[0];
          const pairs = q("[data-pair]");
          const counter = q("[data-count]")[0];

          gsap.set(loader, { display: "flex" });

          /** The green pair lands here every time; the reds are already lit and stay lit. */
          const GREEN_AT = 2;
          const BETWEEN = 0.32;
          const FIRST_LIGHT = GREEN_AT - (LAMP_TONES.length - 1) * BETWEEN;
          const lights = gsap.timeline({ defaults: { ease: "power2.out" } });
          lights
            .fromTo(panels, { yPercent: -14, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.55, stagger: 0.06, ease: "expo.out" }, 0)
            .fromTo(bases, { scaleX: 0, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 1, duration: 0.45, stagger: 0.06 }, 0.12)
            .to(skipHint, { autoAlpha: 1, duration: 0.4 }, 0.6)
            // the count runs from the first segment filling to the green pair striking
            .fromTo(
              { v: 0 },
              { v: 0 },
              {
                v: 100,
                duration: GREEN_AT - (FIRST_LIGHT - BETWEEN),
                ease: "none",
                onUpdate() {
                  counter.textContent = String(Math.round(this.targets()[0].v));
                },
              },
              FIRST_LIGHT - BETWEEN,
            );

          /*
           * One pair at a time. A real lamp has no wind-up: it is simply on, over-bright for an
           * instant while the filament settles, and the housing around it catches the colour. So the
           * fill snaps on in two frames, a white core burns off over a fifth of a second, and the
           * halo overshoots before easing back to its steady level. Nothing bounces or scales up.
           */
          pairs.forEach((pair, i) => {
            const at = FIRST_LIGHT + i * BETWEEN;
            const lamp = pair.querySelectorAll("[data-lamp]");
            const hot = pair.querySelectorAll("[data-hot]");
            const halo = pair.querySelectorAll("[data-halo]");
            lights
              .to(pair.querySelector("[data-fill]"), { scaleX: 1, duration: BETWEEN, ease: "none" }, at - BETWEEN)
              .to(lamp, { autoAlpha: 1, duration: 0.03, ease: "none" }, at)
              .fromTo(hot, { autoAlpha: 0.95 }, { autoAlpha: 0, duration: 0.22, ease: "power2.out" }, at)
              .fromTo(halo, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.09, ease: "none" }, at)
              .to(halo, { autoAlpha: 0.72, duration: 0.35, ease: "power2.out" }, at + 0.09)
              .fromTo(pair.querySelector("[data-tint]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 }, at);
          });

          lights
            .addLabel("out", GREEN_AT)
            // go: the whole grid turns green together — every lamp, every halo, every bar segment
            .to(q("[data-go]"), { autoAlpha: 1, duration: 0.3, stagger: 0.04 }, "out+=0.18")
            .to(q("[data-go-halo]"), { autoAlpha: 0.72, duration: 0.3, stagger: 0.04 }, "out+=0.18")
            .to(q("[data-go-tint]"), { autoAlpha: 1, duration: 0.3, stagger: 0.04 }, "out+=0.18")
            .to([...q("[data-halo]"), ...q("[data-tint]")], { autoAlpha: 0, duration: 0.3 }, "out+=0.18")
            .to(q("[data-done]"), { autoAlpha: 1, duration: 0.3, stagger: 0.04 }, "out+=0.18")
            .to(skipHint, { autoAlpha: 0, duration: 0.2 }, "out+=0.18")
            // and the screen lifts, flat, with no fade
            .to(loader, { yPercent: -100, duration: 0.75, ease: "power4.inOut" }, "out+=0.62")
            .add(() => entrance.play(), "out+=0.79")
            .set(loader, { display: "none" });

          const skip = () => {
            if (lights.time() < lights.labels.out) lights.seek("out");
          };
          const inputs = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
          inputs.forEach((e) => window.addEventListener(e, skip, { passive: true }));
          const safety = window.setTimeout(() => lights.progress(1), 4500);
          cleanup = () => {
            window.clearTimeout(safety);
            inputs.forEach((e) => window.removeEventListener(e, skip));
          };
        }
        // Start states are applied, so the page can be revealed (under the loader if it's showing).
        html.classList.remove("intro", "lights");
        return () => cleanup();
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="relative overflow-x-clip">
      <Loader />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <Hero data={data} />
      {/* flush to the hero: that section already ends in its own space */}
      <TrackSeparator cars={RACE_ONE} className="mt-0" />
      <TopTen data={data} />
      <TrackSeparator cars={RACE_TWO} reverse />
      <StandingsTable data={data} />
      <TrackSeparator cars={RACE_THREE} />
      <Rules data={data} />

      <footer className="border-t border-kerb">
        {/* three tracks so the credit sits in the true centre, whatever the brand's width */}
        <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-3 px-4 py-5 text-sm text-chalk-dim sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-4 md:px-8">
          <Brand />
          <p className="flex items-center gap-1.5 sm:col-start-2">
            Made with
            <svg viewBox="0 0 24 22" className="size-3.5 fill-signal" role="img" aria-label="love">
              <path d="M12 21.6 2.8 12.2A6.1 6.1 0 0 1 12 4.3a6.1 6.1 0 0 1 9.2 7.9L12 21.6Z" />
            </svg>
            by the IM department
          </p>
        </div>
      </footer>

    </div>
  );
}

/* ================= Loader: F1 start lights ================= */

/**
 * The start sequence, over the page. It renders the same resting frame the page waits on, then the
 * timeline lights it: each pair strikes and stays on, the last one green. The lamps light the way
 * real ones do — instantly, with a hot first instant that settles — and everything that moves is a
 * transform or an opacity, so it stays smooth on a mid-range phone.
 */
function Loader() {
  return (
    <div data-loader className="loader fixed inset-0 z-50 flex-col items-center justify-center gap-9 overflow-hidden bg-asphalt-900 px-3 will-change-transform" role="presentation">
      <StartLights />
      <StartCount />
      <p data-skip className="text-[11px] tracking-[0.25em] text-chalk-dim uppercase opacity-0">Tap to skip</p>
    </div>
  );
}

/* ================= How to qualify ================= */

function Rules({ data }: { data: PublicLeaderboard }) {
  const departmentsByGroup = new Map<string, Set<string>>();
  for (const d of data.drivers) {
    if (!d.group || d.isOC) continue;
    departmentsByGroup.set(d.group, (departmentsByGroup.get(d.group) ?? new Set()).add(d.department));
  }
  const p = data.points;
  const samePoints = p.approval === p.open && p.open === p.referral;

  return (
    <section id="qualify" className="scroll-mt-4" aria-labelledby="rules">
      <div className="mx-auto max-w-[1400px] px-4 py-12 md:px-8 lg:grid lg:grid-cols-12 lg:gap-16 lg:py-14">
        <div className="lg:col-span-5">
          <h2 id="rules" className="wide text-[clamp(2.25rem,7vw,4.5rem)] leading-[0.9]">
            How to qualify
          </h2>
          <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-chalk">Hit every goal your group sets and you&apos;re on the grid.</p>
          <p className="mt-4 max-w-[58ch] leading-relaxed text-chalk-dim">
            {samePoints
              ? `Each approval, open and referral is worth ${p.approval} point${p.approval === 1 ? "" : "s"}`
              : `An approval is worth ${p.approval} points, an open ${p.open} and a referral ${p.referral}`}
            , and your score is your points divided by your goal. Signups earn nothing on their own; they open the gate. Counting starts {formatDay(data.startDate)}.
          </p>
        </div>

        <div className="mt-8 lg:col-span-7 lg:mt-0">
          <ul>
            {data.groups.map((g) => {
              const depts = g.id === "OC" ? [] : [...(departmentsByGroup.get(g.id) ?? [])].sort();
              // every goal is shown the same way: the figure, then its unit
              const others = (["approvals", "opens", "referrals", "revenue"] as const)
                .filter((m) => g[m] > 0)
                .map((m) => ({ metric: m, value: formatNumber(g[m]), unit: g[m] === 1 ? METRIC_LABEL[m].one : METRIC_LABEL[m].many }));
              return (
                <li className="grid gap-2 border-t border-kerb py-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)] sm:items-baseline sm:gap-x-14" key={g.id}>
                  <div>
                    <h3 className="display text-xl leading-none">{g.id}</h3>
                    <p className="mt-1.5 text-sm text-chalk-dim">{g.id === "OC" ? "OCs from any department, who can qualify on these goals or their own department's" : depts.join(", ")}</p>
                  </div>

                  {/* one line of goals on a phone; on a wide screen they take their own grid columns */}
                  <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1 sm:contents">
                    {/* the gate: the number people are actually checking for */}
                    <p className="num text-chalk sm:text-right">
                      <span className="text-2xl font-bold">{formatNumber(g.signups)}</span>
                      <span className="ml-1.5 text-sm text-chalk-dim">signups</span>
                    </p>

                    {others.length ? (
                      <ul className="flex flex-wrap gap-x-8 gap-y-1 sm:gap-x-10">
                        {others.map((o) => (
                          <li key={o.metric} className="num text-chalk">
                            <span className="text-2xl font-bold">{o.value}</span>
                            <span className="ml-1.5 text-sm text-chalk-dim">{o.unit}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-chalk-dim">No other goal</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
