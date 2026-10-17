import { useEffect, useRef, useState } from "react";
import { useFilters, useView } from "../filters";
import { metricOf, type Metric } from "../view";
import type { Filters } from "../view";
import { fmtMoney, fmtTokens } from "../../shared/format";

export function MetricToggle({ value, onChange }: { value: Metric; onChange: (m: Metric) => void }) {
  return (
    <div role="radiogroup" aria-label="Plot" className="inline-flex rounded-[10px] border border-white/10 bg-white/[0.03] p-0.5">
      {(["cost", "tokens"] as const).map((m) => (
        <button
          key={m}
          role="radio"
          aria-checked={value === m}
          onClick={() => onChange(m)}
          className={`rounded-[8px] px-3 py-1.5 text-[12px] font-semibold transition ${
            value === m ? "bg-mint/15 text-mint shadow-[0_0_18px_-6px_var(--color-mint)]" : "text-subtle hover:text-ink"
          }`}
        >
          {m === "cost" ? "$ Cost" : "◆ Tokens"}
        </button>
      ))}
    </div>
  );
}

interface Option {
  key: string;
  label: string;
  color: string;
  value: number;
  hint?: string;
}

function CheckMenu({
  title,
  dim,
  options,
}: {
  title: string;
  dim: keyof Filters;
  options: Option[];
}) {
  const { filters, toggle, setOff, metric } = useFilters();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const off = new Set(filters[dim]);
  const on = options.filter((o) => !off.has(o.key)).length;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (options.length === 0) return null;
  const partial = on < options.length;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-[10px] border px-3 py-1.5 text-[12px] font-semibold transition ${
          partial ? "border-amber/40 bg-amber/10 text-amber" : "border-white/10 bg-white/[0.03] text-subtle hover:text-ink"
        }`}
      >
        <span className="flex -space-x-1">
          {options.slice(0, 4).map((o) => (
            <span
              key={o.key}
              className="h-2.5 w-2.5 rounded-full ring-2 ring-bg"
              style={{ background: o.color, opacity: off.has(o.key) ? 0.25 : 1 }}
            />
          ))}
        </span>
        {title}
        <span className="tabular-nums text-faint">
          {on}/{options.length}
        </span>
        <span className="text-[10px] text-faint">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 w-[min(320px,calc(100vw-32px))] rounded-xl border border-white/10 bg-[#141721f2] p-2 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2 px-2 pb-2 pt-1 text-[11px]">
            <span className="uppercase tracking-wider text-faint">{title}</span>
            <button className="ml-auto text-mint/80 hover:text-mint" onClick={() => setOff(dim, [])}>
              All
            </button>
            <button className="text-subtle hover:text-ink" onClick={() => setOff(dim, options.map((o) => o.key))}>
              None
            </button>
          </div>
          <div className="max-h-[320px] space-y-0.5 overflow-y-auto">
            {options.map((o) => (
              <label
                key={o.key}
                className="group flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-white/[0.05]"
              >
                <input
                  type="checkbox"
                  checked={!off.has(o.key)}
                  onChange={() => toggle(dim, o.key)}
                  className="h-3.5 w-3.5 shrink-0 accent-[var(--color-mint)]"
                />
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: o.color }} />
                <span className="min-w-0 flex-1 truncate text-ink" title={o.hint ?? o.label}>
                  {o.label}
                </span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setOff(dim, options.filter((x) => x.key !== o.key).map((x) => x.key));
                  }}
                  className="hidden text-[11px] text-mint/80 hover:text-mint group-hover:inline"
                >
                  only
                </button>
                <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-faint group-hover:hidden">
                  {metric === "cost" ? fmtMoney(o.value) : fmtTokens(o.value)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// One row above the charts: what to plot (cost or tokens) and which engines,
// machines and models are included. Values in the menus are all-time and
// unfiltered, so a box you uncheck still shows what it would add back.
export function FilterBar() {
  const v = useView();
  const { metric, setMetric, filters, reset } = useFilters();
  if (!v) return null;
  const { palette, stats } = v;
  const all = allTime(stats);
  const machineInfo = new Map(stats.cube.machines.map((m) => [m.id, m]));
  const anyOff = filters.engines.length + filters.machines.length + filters.models.length > 0;

  return (
    <div className="glass sticky top-0 z-20 mb-5 flex flex-wrap items-center gap-2 !rounded-xl px-3 py-2.5">
      <MetricToggle value={metric} onChange={setMetric} />
      <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
      <CheckMenu
        title="Engines"
        dim="engines"
        options={palette.engines.map((e) => ({ ...e, color: palette.color(e.key), value: all.engine.get(e.key) ?? 0 }))}
      />
      <CheckMenu
        title="Machines"
        dim="machines"
        options={palette.machines.map((m) => {
          const info = machineInfo.get(m.key);
          return {
            ...m,
            color: palette.color(`machine:${m.key}`),
            value: all.machine.get(m.key) ?? 0,
            hint: info?.platform ? `${m.label} · ${info.platform}/${info.arch ?? "?"}` : m.label,
          };
        })}
      />
      <CheckMenu
        title="Models"
        dim="models"
        options={palette.models.map((m) => ({ ...m, color: palette.color(m.key), value: all.model.get(m.key) ?? 0 }))}
      />
      {anyOff && (
        <button onClick={reset} className="ml-auto text-[12px] text-mint/80 hover:text-mint">
          Reset filters
        </button>
      )}
    </div>
  );

  function allTime(s: typeof stats) {
    const engine = new Map<string, number>();
    const machine = new Map<string, number>();
    const model = new Map<string, number>();
    for (const r of s.cube.rows) {
      const m = s.cube.models[r[1]];
      const val =
        metric === "cost"
          ? r[8]
          : metricOf({ cost: r[8], tokens: { input: r[3], cacheRead: r[4], cacheCreate: r[5], cacheCreate1h: r[6], output: r[7] } }, "tokens");
      const mk = `${m.engine}:${m.model}`;
      engine.set(m.engine, (engine.get(m.engine) ?? 0) + val);
      model.set(mk, (model.get(mk) ?? 0) + val);
      const id = s.cube.machines[r[2]].id;
      machine.set(id, (machine.get(id) ?? 0) + val);
    }
    return { engine, machine, model };
  }
}
