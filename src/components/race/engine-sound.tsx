"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Synthesised engine note: pitch and volume follow scroll speed while a track separator is on screen.
 * Off by default (browsers only allow audio after a tap); the button turns it on.
 */
export function EngineSound() {
  const [on, setOn] = useState(false);
  const audio = useRef<{ ctx: AudioContext; gain: GainNode; oscs: OscillatorNode[]; filter: BiquadFilterNode } | null>(null);

  useEffect(() => {
    if (!on) return;
    let a = audio.current;
    if (!a) {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      filter.Q.value = 6;
      const oscs = (["sawtooth", "square", "sawtooth"] as OscillatorType[]).map((type, i) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = 60 * (i === 2 ? 2 : 1);
        o.detune.value = i === 1 ? 7 : i === 2 ? -5 : 0;
        o.connect(filter);
        o.start();
        return o;
      });
      filter.connect(gain).connect(ctx.destination);
      a = audio.current = { ctx, gain, oscs, filter };
    }
    const { ctx, gain, oscs, filter } = a;
    void ctx.resume();

    // Only rev while a track is visible.
    const visible = new Set<Element>();
    const io = new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))));
    document.querySelectorAll("[data-sep]").forEach((el) => io.observe(el));

    let lastY = window.scrollY;
    let lastT = performance.now();
    let speed = 0;
    let frame = 0;
    const tick = () => {
      const now = performance.now();
      const dy = Math.abs(window.scrollY - lastY);
      const dt = Math.max(1, now - lastT);
      lastY = window.scrollY;
      lastT = now;
      speed += ((dy / dt) * 1000 - speed) * 0.15; // px/s, smoothed
      const t = ctx.currentTime;
      const rev = Math.min(1, speed / 3000);
      const active = visible.size > 0;
      const base = 55 + rev * 190;
      oscs[0].frequency.setTargetAtTime(base, t, 0.08);
      oscs[1].frequency.setTargetAtTime(base, t, 0.08);
      oscs[2].frequency.setTargetAtTime(base * 2, t, 0.08);
      filter.frequency.setTargetAtTime(500 + rev * 2400, t, 0.1);
      gain.gain.setTargetAtTime(active ? 0.015 + rev * 0.09 : 0, t, active ? 0.08 : 0.25);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      void ctx.suspend();
    };
  }, [on]);

  useEffect(() => () => void audio.current?.ctx.close(), []);

  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      aria-pressed={on}
      className={cn(
        "fixed right-4 bottom-4 z-40 flex h-11 items-center gap-2 rounded-[2px] border px-3.5 text-sm font-semibold shadow-[0_8px_24px_rgb(0_0_0/0.45)] transition-colors duration-[180ms]",
        on ? "border-chalk bg-chalk text-asphalt-900" : "border-kerb bg-asphalt-800 text-chalk hover:bg-asphalt-700",
      )}
    >
      {on ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
      Engine sound {on ? "on" : "off"}
    </button>
  );
}
