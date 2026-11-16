import type { SVGProps } from "react";

/** Top-down open-wheel race car, nose pointing right. Original artwork, 240×92. `livery` is the body colour. */
export function F1Car({ livery, accent = "#f2f4f8", number, ...props }: SVGProps<SVGSVGElement> & { livery: string; accent?: string; number?: string }) {
  return (
    <svg viewBox="0 0 240 92" fill="none" aria-hidden="true" {...props}>
      {/* soft shadow on the tarmac */}
      <ellipse cx="122" cy="50" rx="112" ry="34" fill="#000" opacity="0.35" />
      {/* rear wing */}
      <rect x="6" y="12" width="16" height="68" rx="2" fill={livery} />
      <rect x="4" y="10" width="20" height="4" fill={accent} />
      <rect x="4" y="78" width="20" height="4" fill={accent} />
      {/* rear tyres */}
      <rect x="30" y="4" width="36" height="20" rx="5" fill="#0b0c0f" />
      <rect x="30" y="68" width="36" height="20" rx="5" fill="#0b0c0f" />
      <path d="M36 7v14M44 7v14M52 7v14M60 7v14M36 71v14M44 71v14M52 71v14M60 71v14" stroke="#1d2129" strokeWidth="2" />
      {/* suspension */}
      <path d="M66 40 52 24M60 42 44 24M66 52 52 68M60 50 44 68M178 41l4-17M196 42l-2-18M178 51l4 17M196 50l-2 18" stroke="#2a313f" strokeWidth="2" />
      {/* body + sidepods */}
      <path d="M22 40h20c10-10 26-15 46-16l60-1c14 0 22 8 30 14l40 4c6 1 6 9 0 10l-40 4c-8 6-16 14-30 14l-60-1c-20-1-36-6-46-16H22z" fill={livery} />
      {/* engine cover spine + livery stripe */}
      <path d="M40 44h112v4H40z" fill={accent} opacity="0.85" />
      {/* sidepod inlets */}
      <path d="M134 26h10l-3 7h-8zM134 66h10l-3-7h-8z" fill="#0b0c0f" />
      {/* cockpit, helmet, halo */}
      <ellipse cx="150" cy="46" rx="15" ry="8" fill="#0b0c0f" />
      <circle cx="148" cy="46" r="5.5" fill={accent} />
      <path d="M164 46c0-10-16-12-28-8M164 46c0 10-16 12-28 8" stroke="#0b0c0f" strokeWidth="3" strokeLinecap="round" />
      {/* nose */}
      <path d="M176 40l46 3c4 0 4 6 0 6l-46 3z" fill={livery} />
      {/* front tyres */}
      <rect x="172" y="6" width="32" height="18" rx="5" fill="#0b0c0f" />
      <rect x="172" y="68" width="32" height="18" rx="5" fill="#0b0c0f" />
      {/* front wing */}
      <path d="M218 10h10l8 6v60l-8 6h-10l4-6V16z" fill={livery} />
      <path d="M216 8h14v4h-14zM216 80h14v4h-14z" fill={accent} />
      {number ? (
        <text x="96" y="50" textAnchor="middle" fontSize="12" fontWeight="800" fill="#0b0c0f" fontFamily="var(--font-jetbrains)">
          {number}
        </text>
      ) : null}
    </svg>
  );
}
