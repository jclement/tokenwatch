import { useState } from "react";
import { LegendDot, COLORS } from "./ui";
import { TokenSplitBar } from "./charts";
import { fmtTokens } from "../../shared/format";
import type { TokenTotals } from "../../shared/pricing";

const TYPES = [
  {
    color: COLORS.cyan,
    label: "Fresh input",
    key: "input" as const,
    hint: "Brand-new text you send the model. Full price.",
  },
  {
    color: COLORS.amber,
    label: "Cache writes",
    key: "cacheCreate" as const,
    hint: "Stashing context so future turns are cheap. ~1.25× input price, paid once.",
  },
  {
    color: COLORS.lime,
    label: "Cache reads",
    key: "cacheRead" as const,
    hint: "Re-using stashed context. ~10× cheaper than fresh input — the good kind.",
  },
  {
    color: COLORS.coral,
    label: "Output",
    key: "output" as const,
    hint: "What the model writes back. The most expensive token, per token.",
  },
];

// The shared "where it went" block: a token-split bar, a legend, and an
// expandable glossary explaining what each token type means and costs.
export function WhereItWent({ t }: { t: TokenTotals }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="my-4">
        <TokenSplitBar t={t} />
      </div>
      <div className="space-y-2.5">
        {TYPES.map((ty) => (
          <div key={ty.key} title={ty.hint}>
            <LegendDot color={ty.color} label={ty.label} value={fmtTokens(t[ty.key])} />
          </div>
        ))}
      </div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-[12px] text-mint/80 hover:text-mint"
      >
        {open ? "Hide" : "What do these mean?"}
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg bg-white/[0.03] p-3 text-[12px] leading-snug text-subtle">
          {TYPES.map((ty) => (
            <div key={ty.key} className="flex gap-2">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: ty.color }} />
              <span>
                <span className="font-semibold text-ink">{ty.label}.</span> {ty.hint}
              </span>
            </div>
          ))}
          <p className="pt-1 text-faint">
            Costs are <span className="text-ink">sticker price</span> — the retail value of these tokens at
            à-la-carte API rates. On a subscription you didn't pay this; it's what you consumed.
          </p>
        </div>
      )}
    </div>
  );
}
