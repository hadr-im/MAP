import { cn } from "@/lib/utils";

/** Wordmark: three speed slashes fading back, then MAP set expanded. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="flex gap-[3px]" aria-hidden>
        <span className="h-5 w-1.5 -skew-x-[24deg] bg-chalk" />
        <span className="h-5 w-1.5 -skew-x-[24deg] bg-chalk/55" />
        <span className="h-5 w-1.5 -skew-x-[24deg] bg-chalk/25" />
      </span>
      <span className="wide text-lg">MAP</span>
      <span className="num text-xs text-chalk-dim">S2</span>
    </span>
  );
}
