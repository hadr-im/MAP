const RED_TONE = {
  lamp: "bg-signal",
  halo: "bg-[radial-gradient(circle,rgb(225_6_0/0.45),transparent_70%)]",
  tint: "bg-signal/10",
  bar: "bg-signal",
};

/** Four red pairs, then a fifth pair in green — the reds stay lit, as on a gantry. */
export const LAMP_TONES = [
  RED_TONE,
  RED_TONE,
  RED_TONE,
  RED_TONE,
  {
    lamp: "bg-improved",
    halo: "bg-[radial-gradient(circle,rgb(61_220_132/0.45),transparent_70%)]",
    tint: "bg-improved/10",
    bar: "bg-improved",
  },
];

/**
 * Five housings of two lamps, every lamp dark, with the loading bar empty at 0%.
 * This is both the resting frame the page waits on and the first frame the start sequence animates
 * from, so there is no jump between them. The animation drives it through the data attributes.
 */
export function StartLights() {
  return (
    <div className="flex items-end gap-1.5 sm:gap-5" aria-hidden>
      {LAMP_TONES.map((tone, panel) => (
        <div key={panel} data-pair className="flex w-[clamp(38px,14vw,116px)] flex-col gap-4 sm:gap-7">
          {/* the housing: dark, square-shouldered, with the lamps recessed into it */}
          <div data-panel className="relative flex flex-col items-center gap-2.5 rounded-[2px] border border-chalk/15 bg-[#0c0c0c] px-1.5 py-2.5 will-change-transform sm:gap-4 sm:px-4 sm:py-5">
            <span data-tint className={`pointer-events-none absolute inset-0 rounded-[2px] opacity-0 ${tone.tint}`} />
            <span data-go-tint className="pointer-events-none absolute inset-0 rounded-[2px] bg-improved/10 opacity-0" />
            {[0, 1].map((lamp) => (
              <span key={lamp} className="relative block size-7 rounded-full border border-chalk/10 bg-[#161616] sm:size-13">
                <span data-halo className={`pointer-events-none absolute -inset-2.5 rounded-full opacity-0 ${tone.halo}`} />
                <span data-go-halo className="pointer-events-none absolute -inset-2.5 rounded-full bg-[radial-gradient(circle,rgb(61_220_132/0.45),transparent_70%)] opacity-0" />
                <span data-lamp className={`absolute inset-[2px] rounded-full opacity-0 ${tone.lamp}`}>
                  {/* the filament's first instant, hotter than the steady colour */}
                  <span data-hot className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_42%,#fff_0%,transparent_62%)] opacity-0" />
                  {/* go: every lamp turns green together */}
                  <span data-go className="absolute inset-0 rounded-full bg-improved opacity-0" />
                </span>
              </span>
            ))}
          </div>
          {/* the slanted plate under each panel is one fifth of the loading bar */}
          <span data-base className="relative block h-[5px] -skew-x-[20deg] overflow-hidden border border-chalk/20 will-change-transform">
            <span data-fill className={`absolute inset-0 origin-left scale-x-0 will-change-transform ${tone.bar}`}>
              <span data-done className="absolute inset-0 bg-improved opacity-0" />
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** The counter under the lights. Starts at zero and is driven by the sequence. */
export function StartCount() {
  return (
    <p className="flex items-baseline gap-1" aria-hidden>
      <span data-count className="display num text-[clamp(1.5rem,5vw,2.25rem)] leading-none text-chalk">
        0
      </span>
      <span className="text-sm text-chalk-dim">%</span>
    </p>
  );
}
