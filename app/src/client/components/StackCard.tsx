import { useState } from "react";
import { GlassCard, SectionTitle } from "./ui";
import { StackedArea, Segmented } from "./viz";
import { stackByDay, type SplitBy, type View, type Metric } from "../view";
import type { Palette } from "../filters";

const SPLITS: { value: SplitBy; label: string }[] = [
  { value: "model", label: "Model" },
  { value: "engine", label: "Engine" },
  { value: "machine", label: "Machine" },
];

// A stacked day-by-day area of the current metric, split by model, engine or
// machine (switchable in the card).
export function StackCard({
  view,
  palette,
  metric,
  title,
  subtitle,
  initial = "model",
  height,
}: {
  view: View;
  palette: Palette;
  metric: Metric;
  title?: string;
  subtitle?: string;
  initial?: SplitBy;
  height?: number;
}) {
  const [by, setBy] = useState<SplitBy>(initial);
  const order = by === "model" ? palette.models : by === "engine" ? palette.engines : palette.machines;
  const { rows, series } = stackByDay(view, by, metric, order);
  const color = (k: string) => (by === "machine" ? palette.color(`machine:${k}`) : palette.color(k));
  const what = metric === "cost" ? "Spend" : "Tokens";
  return (
    <GlassCard>
      <div className="flex flex-wrap items-start gap-3">
        <SectionTitle title={title ?? `${what} by ${by}, day by day`} subtitle={subtitle} />
        <div className="ml-auto">
          <Segmented label="Split by" value={by} options={SPLITS} onChange={setBy} />
        </div>
      </div>
      <div className="mt-4">
        <StackedArea rows={rows} series={series} metric={metric} color={color} height={height} />
      </div>
    </GlassCard>
  );
}
