"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { F1Car } from "./f1-car";
import { pose, type CarSpec, type Course } from "./race-sim";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export type { CarSpec };

/**
 * A slim top view of a straight. Scroll position drives the race: each frame, every car's place,
 * lane and heading come from the tested race maths in race-sim.ts, so cars never drive through each
 * other and scrolling back plays the race in reverse.
 */
export function TrackSeparator({ cars, reverse = false, className }: { cars: CarSpec[]; reverse?: boolean; className?: string }) {
  const band = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = band.current!;
      const carEls = gsap.utils.toArray<HTMLElement>("[data-car]", el);
      const trails = gsap.utils.toArray<HTMLElement>("[data-trail]", el);
      const trailTo = trails.map((t) => gsap.quickTo(t, "scaleX", { duration: 0.4, ease: "power2.out" }));
      const setX = carEls.map((c) => gsap.quickSetter(c, "x", "px"));
      const setY = carEls.map((c) => gsap.quickSetter(c, "y", "px"));
      const setR = carEls.map((c) => gsap.quickSetter(c, "rotation", "deg"));

      // Measured on every render (cheap: four reads), so the maths always matches what's on screen.
      const measure = (): Course => ({
        W: el.offsetWidth,
        H: el.offsetHeight,
        L: carEls[0]?.offsetWidth || 40,
        h: carEls[0]?.offsetHeight || 15,
      });
      const render = (p: number) => {
        const m = measure();
        const poses = cars.map((_, i) => pose(cars, i, p, m, reverse));
        poses.forEach((q, i) => {
          setX[i](q.x);
          setY[i](q.y);
          setR[i](q.rotation);
        });
      };

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const race = { p: 0 };
        render(0);
        gsap.set(carEls, { autoAlpha: 1 });
        gsap.to(race, {
          p: 1,
          ease: "none",
          onUpdate: () => render(race.p),
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: 1.1, // the field glides a moment behind the scroll, like momentum
            onRefresh: () => render(race.p),
            onUpdate: (self) => {
              const speed = Math.min(1, Math.abs(self.getVelocity()) / 2400);
              trailTo.forEach((to) => to(0.15 + speed));
            },
          },
        });
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        const park = () => render(0.32);
        park();
        gsap.set(carEls, { autoAlpha: 1 });
        window.addEventListener("resize", park);
        return () => window.removeEventListener("resize", park);
      });
    },
    { scope: band, dependencies: [cars, reverse], revertOnUpdate: true },
  );

  return (
    <div
      ref={band}
      data-sep
      // breathing room around the band, so the sections it divides are not crowding it
      className={cn("relative my-[clamp(18px,3.2vw,40px)] h-[clamp(40px,4.2vw,56px)] overflow-hidden bg-[#141414]", className)}
      aria-hidden
    >
      {/* kerbs: light grey against dark grey, so the track reads as kerbing and stays out of the palette */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-[repeating-linear-gradient(90deg,rgb(243_239_230/0.3)_0_16px,rgb(120_120_120/0.22)_16px_32px)]" />
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-[repeating-linear-gradient(90deg,rgb(243_239_230/0.3)_0_16px,rgb(120_120_120/0.22)_16px_32px)]" />
      {/* lane line */}
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[repeating-linear-gradient(90deg,rgb(243_239_230/0.18)_0_20px,transparent_20px_40px)]" />
      {/* finish line: a chequered band between two ivory lines */}
      <div className={cn("absolute top-[2px] bottom-[2px] flex opacity-70", reverse ? "left-[16%]" : "right-[16%]")}>
        <span className="w-px bg-chalk" />
        <span className="checker w-[18px] [--sq:6px]" />
        <span className="w-px bg-chalk" />
      </div>

      {cars.map((car, i) => (
        <div key={i} data-car className="invisible absolute top-0 left-0 w-[clamp(28px,3.2vw,44px)] opacity-0 will-change-transform">
          <div className={cn("relative", reverse && "-scale-x-100")}>
            <span
              data-trail
              className="absolute top-1/2 right-[88%] h-[36%] w-[230%] origin-right -translate-y-1/2 scale-x-[0.15] bg-[linear-gradient(90deg,transparent,rgb(244_239_230/0.16))]"
            />
            <F1Car livery={car.livery} accent={car.accent} className="relative block w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
