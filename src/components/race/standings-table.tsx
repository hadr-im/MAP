"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { PublicDriver, PublicLeaderboard } from "@/lib/leaderboard/public";
import type { Metric } from "@/lib/leaderboard/types";
import { cn } from "@/lib/utils";
import { formatNumber, normalizeSearch, percent } from "./format";
import { SelectField } from "./select-field";

gsap.registerPlugin(useGSAP);

const PAGE_SIZE = 12;
const ALL_METRICS: Metric[] = ["signups", "approvals", "opens", "referrals", "revenue"];
const METRIC_HEAD: Record<Metric, string> = { signups: "Signups", approvals: "Approvals", opens: "Opens", referrals: "Referrals", revenue: "Revenue" };
type Status = "all" | "qualified";

export function StandingsTable({ data }: { data: PublicLeaderboard }) {
  const root = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState<Status>("all");
  const [page, setPage] = useState(1);

  const departments = useMemo(() => [...new Set(data.drivers.map((d) => d.department))].sort(), [data.drivers]);
  /** Only metrics some group actually sets a goal for: a column of dashes helps no one. */
  const metrics = useMemo(() => {
    const used = new Set(data.groups.flatMap((g) => ALL_METRICS.filter((m) => g[m] > 0)));
    return ALL_METRICS.filter((m) => used.has(m));
  }, [data.groups]);
  const q = normalizeSearch(query);
  const filtered = data.drivers.filter(
    (d) =>
      (department === "all" || (department === "OC" ? d.isOC : d.department === department)) &&
      (status === "all" || d.eligible) &&
      (!q || normalizeSearch(d.name).includes(q)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const update = (fn: () => void) => {
    fn();
    setPage(1);
  };

  // New page or filter: rows slide in quickly (answers the user's action).
  useGSAP(
    () => {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(gsap.utils.toArray("[data-table-row]", root.current), { autoAlpha: 0, x: -16, duration: 0.3, stagger: 0.02, ease: "power2.out" });
    },
    { scope: root, dependencies: [current, department, status], revertOnUpdate: true },
  );

  const goTo = (p: number) => {
    setPage(p);
    root.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  return (
    <section ref={root} id="standings" className="mx-auto max-w-[1400px] scroll-mt-4 px-4 py-16 md:px-8 md:py-24" aria-labelledby="standings-title">
      <h2 id="standings-title" className="wide text-[clamp(2.25rem,7vw,4.5rem)] leading-[0.9]">
        Full standings
      </h2>
      <p className="mt-3 max-w-[56ch] text-chalk-dim">Every member, every goal. Find your name and see exactly what stands between you and the grid.</p>

      {/* ---------- controls ---------- */}
      <div className="mt-8 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="relative">
          <span className="sr-only">Search by name</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-chalk-dim" aria-hidden />
          <input
            id="find-member"
            type="search"
            value={query}
            onChange={(e) => update(() => setQuery(e.target.value))}
            placeholder="Search your name"
            autoComplete="off"
            className="h-11 w-full rounded-[2px] border border-kerb bg-asphalt-800 pr-10 pl-9 text-base text-chalk placeholder:text-chalk-dim focus-visible:border-chalk [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button type="button" onClick={() => update(() => setQuery(""))} className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center text-chalk-dim hover:text-chalk" aria-label="Clear search">
              <X className="size-4" />
            </button>
          ) : null}
        </label>

        <SelectField
          label="Department"
          value={department}
          onChange={(value) => update(() => setDepartment(value))}
          options={[
            { value: "all", label: "All departments" },
            ...departments.map((d) => ({ value: d, label: d })),
            ...(data.drivers.some((d) => d.isOC) ? [{ value: "OC", label: "OC members" }] : []),
          ]}
          className="md:w-48"
        />

        <div role="group" aria-label="Status" className="flex h-11 rounded-[2px] border border-kerb bg-asphalt-800 p-1">
          {(["all", "qualified"] as Status[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => update(() => setStatus(s))}
              className={cn("flex-1 rounded-[2px] px-3 text-sm font-semibold capitalize transition-colors duration-150 md:flex-none", status === s ? "bg-chalk text-asphalt-900" : "text-chalk-dim hover:text-chalk")}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-chalk-dim" aria-live="polite">
        {filtered.length === data.drivers.length ? `${formatNumber(filtered.length)} members` : `${formatNumber(filtered.length)} of ${formatNumber(data.drivers.length)} members match`}
      </p>

      {rows.length ? (
        <>
          {/* ---------- desktop table ---------- */}
          <div className="mt-4 hidden overflow-x-auto border border-kerb md:block">
            <table className="w-full min-w-[60rem] border-collapse text-left">
              <thead className="bg-asphalt-800 text-sm text-chalk-dim">
                <tr>
                  <th scope="col" className="py-3 pr-2 pl-5 font-medium">Pos</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Member</th>
                  {metrics.map((m) => (
                    <th key={m} scope="col" className="px-3 py-3 text-right font-medium">
                      {METRIC_HEAD[m]}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-3 pr-5 text-right font-medium">Progress</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} data-table-row className={cn("border-t border-kerb transition-colors duration-[180ms] hover:bg-asphalt-700", d.eligible && "bg-improved/[0.06]")}>
                    <td className="py-3 pr-2 pl-5">
                      <Position driver={d} />
                    </td>
                    <td className="py-3 pr-4">
                      <MemberCell driver={d} />
                    </td>
                    {metrics.map((m) => (
                      <td key={m} className="num px-3 py-3 text-right text-sm">
                        <MetricCell driver={d} metric={m} />
                      </td>
                    ))}
                    <td className="num px-3 py-3 pr-5 text-right font-bold">
                      {percent(d.eligible ? d.score : d.readiness)}
                      <span className="text-xs font-normal text-chalk-dim">%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ---------- phone cards ---------- */}
          <ol className="mt-4 space-y-2 md:hidden">
            {rows.map((d) => (
              <li key={d.id} data-table-row className={cn("border border-kerb p-4", d.eligible ? "bg-improved/[0.07]" : "bg-asphalt-800")}>
                <div className="flex items-start gap-3">
                  <Position driver={d} />
                  <div className="min-w-0 flex-1">
                    <MemberCell driver={d} />
                  </div>
                  <div className="text-right">
                    <p className="num text-xl font-bold">
                      {percent(d.eligible ? d.score : d.readiness)}
                      <span className="text-xs font-normal text-chalk-dim">%</span>
                    </p>
                  </div>
                </div>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {goalsOf(d).map((p) => (
                    <li key={p.metric} className={cn("num rounded-[2px] border px-2 py-1 text-xs", p.value >= p.goal ? "border-improved/50 text-improved" : "border-kerb text-chalk")}>
                      <span className="font-sans text-chalk-dim">{METRIC_HEAD[p.metric]} </span>
                      {formatNumber(p.value)}/{formatNumber(p.goal)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <Pagination page={current} pages={pages} onChange={goTo} />
        </>
      ) : (
        <div className="mt-4 border border-dashed border-kerb px-5 py-10 text-center">
          <p className="font-semibold">No one matches these filters.</p>
          <p className="mt-1 text-sm text-chalk-dim">Check the spelling or widen the filters to get back on track.</p>
          <button
            type="button"
            onClick={() => update(() => (setQuery(""), setDepartment("all"), setStatus("all")))}
            className="mt-4 h-10 rounded-[2px] border border-kerb px-4 text-sm font-semibold hover:bg-asphalt-700"
          >
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}

function Position({ driver: d }: { driver: PublicDriver }) {
  return (
    <span className={cn("num block w-14 text-2xl leading-none font-bold", d.eligible ? "text-gold" : "text-chalk")}>
      <span className="align-top text-[0.6em]">#</span>
      {d.position}
    </span>
  );
}

function MemberCell({ driver: d }: { driver: PublicDriver }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate font-semibold">{d.name}</span>
      <span className="mt-0.5 block truncate text-xs text-chalk-dim">
        Department: {d.department}
        {d.isOC ? ", OC" : ""}
      </span>
    </span>
  );
}

/**
 * Every goal a member can be judged on, in metric order. An OC member has two routes, so their own
 * department's goals are listed alongside the OC ones; where both set the same metric, the lower goal wins.
 */
function goalsOf(d: PublicDriver): PublicDriver["progress"] {
  const all = [...d.progress, ...(d.alternate?.progress ?? [])];
  return ALL_METRICS.flatMap((metric) => {
    const entries = all.filter((p) => p.metric === metric);
    if (!entries.length) return [];
    return [entries.reduce((a, b) => (b.goal < a.goal ? b : a))];
  });
}

function MetricCell({ driver: d, metric }: { driver: PublicDriver; metric: Metric }) {
  // An OC member can qualify two ways; where both set a goal for a metric, the lower one is shown.
  const entries = [...d.progress, ...(d.alternate?.progress ?? [])].filter((x) => x.metric === metric);
  if (!entries.length) return <span className="text-kerb" aria-label="No goal">—</span>;
  const value = entries[0].value;
  const goal = Math.min(...entries.map((x) => x.goal));
  const met = value >= goal;
  return (
    <span className={met ? "text-improved" : "text-chalk"}>
      {formatNumber(value)}
      <span className="text-chalk-dim">/{formatNumber(goal)}</span>
      {met ? <span className="sr-only"> (goal met)</span> : null}
    </span>
  );
}

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  return (
    <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Pages">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="flex h-10 items-center gap-1 rounded-[2px] border border-kerb px-3 text-sm font-semibold hover:bg-asphalt-700 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronLeft className="size-4" aria-hidden /> Previous
      </button>
      <ol className="hidden gap-1 sm:flex">
        {numbers.map((n) => (
          <li key={n}>
            <button
              type="button"
              onClick={() => onChange(n)}
              aria-current={n === page ? "page" : undefined}
              className={cn("num size-10 rounded-[2px] text-sm font-bold", n === page ? "bg-chalk text-asphalt-900" : "text-chalk-dim hover:bg-asphalt-700 hover:text-chalk")}
            >
              {n}
            </button>
          </li>
        ))}
      </ol>
      <p className="num text-sm text-chalk-dim sm:hidden">
        {page} / {pages}
      </p>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === pages}
        className="flex h-10 items-center gap-1 rounded-[2px] border border-kerb px-3 text-sm font-semibold hover:bg-asphalt-700 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        Next <ChevronRight className="size-4" aria-hidden />
      </button>
    </nav>
  );
}
