// Absurd-but-defensible equivalences. Ported from FunFacts.swift / Eco.

export interface FunFact {
  icon: string;
  big: string;
  unit: string;
  caption: string;
  accent: string;
}

const WORDS_PER_TOKEN = 0.75;
const CHARS_PER_TOKEN = 4.0;

export function n(d: number): string {
  if (d >= 1000) return Math.round(d).toLocaleString("en-US");
  if (d >= 10) return `${Math.round(d)}`;
  if (d >= 1) return d.toFixed(1);
  return d.toFixed(2);
}

// ~15 wpm × 6-hour school day = 5,400 words per kid.
export function thirdGraders(tokens: number): number {
  return (tokens * WORDS_PER_TOKEN) / 5_400;
}

export function perspectiveFacts(tokens: number, output: number, cost: number, days: number): FunFact[] {
  const words = tokens * WORDS_PER_TOKEN;
  const outWords = output * WORDS_PER_TOKEN;
  const chars = tokens * CHARS_PER_TOKEN;
  const d = Math.max(1, days);
  return [
    { icon: "📚", big: n(outWords / 90_000), unit: "novels", caption: "of original prose the model wrote back to you. You skimmed maybe two.", accent: "coral" },
    { icon: "⏱️", big: n(words / 200 / 60 / 24 / 365), unit: "years", caption: "to read every token aloud, nonstop, without sleeping or eating. Don't.", accent: "cyan" },
    { icon: "📖", big: n(words / 587_287), unit: "War and Peaces", caption: "Tolstoy wrote one. You commissioned this many, by accident.", accent: "amber" },
    { icon: "🗼", big: n((words / 500) * 0.0001 / 330), unit: "Eiffel Towers", caption: "tall, if you printed it all at 500 words a page and stacked it.", accent: "lime" },
    { icon: "⌨️", big: n(words / 60 / 60 / 24), unit: "days", caption: "of you typing nonstop at a brisk 60 wpm to match the output. Coffee won't help.", accent: "mint" },
    { icon: "☕️", big: n(cost / 5.5), unit: "lattes", caption: "you could have bought instead. They'd have kept you warmer than the GPUs.", accent: "amber" },
    { icon: "🌎", big: n((chars * 0.0025) / 1000 / 40_075), unit: "laps of Earth", caption: "if every character were a 2.5mm grain of rice laid end to end.", accent: "cyan" },
    { icon: "💸", big: `$${n(cost / d)}`, unit: "per active day", caption: "on average. Compounding daily, like a very bad savings account.", accent: "coral" },
  ];
}

// ---- Environmental ----------------------------------------------------------

const WH_PER_1K = 1.5;
const LITERS_PER_KWH = 2.0;
const CO2_KG_PER_KWH = 0.4;
const HOME_KWH_PER_YEAR = 10_585.0;
const PHONE_CHARGE_KWH = 0.012;
const CO2_KG_PER_MILE = 0.4;
const TREE_KG_PER_YEAR = 21.0;
const DELOREAN_KWH = 336.0;
const RAINFOREST_T_PER_ACRE_YEAR = 2.5;

export function ecoKwh(tokens: number): number {
  return (tokens * WH_PER_1K) / 1000 / 1000;
}
export function acresRainforest(tokens: number): number {
  return (ecoKwh(tokens) * CO2_KG_PER_KWH) / 1000 / RAINFOREST_T_PER_ACRE_YEAR;
}

export function ecoFacts(tokens: number): FunFact[] {
  const kwh = ecoKwh(tokens);
  const water = kwh * LITERS_PER_KWH;
  const co2 = kwh * CO2_KG_PER_KWH;
  return [
    { icon: "⚡️", big: n(kwh), unit: "kWh", caption: `of electricity — enough to run an average home for ${n(kwh / HOME_KWH_PER_YEAR)} years. You absolute unit.`, accent: "amber" },
    { icon: "💧", big: n(water), unit: "liters", caption: `of water boiled off for cooling. That's ${n(water / 65)} hot showers, vaporized.`, accent: "cyan" },
    { icon: "🌫️", big: n(co2), unit: "kg CO₂", caption: `released. About ${n(co2 / CO2_KG_PER_MILE)} miles in a gas car. The glaciers send their regards.`, accent: "coral" },
    { icon: "🌳", big: n(co2 / TREE_KG_PER_YEAR), unit: "tree-years", caption: "of a tree's entire annual carbon work, just to break even. Plant accordingly.", accent: "lime" },
    { icon: "🔋", big: n(kwh / PHONE_CHARGE_KWH), unit: "phone charges", caption: "Your phone could die and rise again this many times on what you torched.", accent: "mint" },
    { icon: "🚗", big: n(kwh / DELOREAN_KWH), unit: "time jumps", caption: "at Doc Brown's 1.21 gigawatts a pop. Great Scott.", accent: "amber" },
  ];
}
