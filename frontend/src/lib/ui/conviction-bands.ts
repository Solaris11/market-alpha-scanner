/**
 * The conviction bands the signal heatmap paints, and the key it prints.
 *
 * Colour was the only thing that grid encoded beyond the number on each tile,
 * and it had no key: a reader could see that some tiles were green and some
 * red without being told where the lines fall. Legend and tiles are now built
 * from this one array, so a threshold cannot be changed in one place and
 * explained wrongly in the other.
 *
 * It lives here rather than in the component so it can be tested without
 * pulling React and next/link into the test runner.
 */
export type ConvictionBand = {
  /** Inclusive lower bound. Bands are ordered high to low; the last is the catch-all. */
  floor: number;
  label: string;
  swatch: string;
  tile: string;
};

export const CONVICTION_BANDS: readonly ConvictionBand[] = [
  { floor: 80, label: "80+", swatch: "bg-emerald-400/80", tile: "bg-emerald-400/80 shadow-[0_0_16px_rgba(52,211,153,0.35)]" },
  { floor: 65, label: "65-79", swatch: "bg-cyan-400/75", tile: "bg-cyan-400/75" },
  { floor: 50, label: "50-64", swatch: "bg-amber-300/75", tile: "bg-amber-300/75" },
  { floor: 0, label: "<50", swatch: "bg-rose-400/75", tile: "bg-rose-400/75" },
] as const;

/**
 * gaugePercent can hand this a value outside 0-100, so the catch-all matters:
 * a tile with no colour class would read as a rendering fault rather than as a
 * low score.
 */
export function convictionTileClass(score: number): string {
  const band = CONVICTION_BANDS.find((candidate) => score >= candidate.floor);
  return (band ?? CONVICTION_BANDS[CONVICTION_BANDS.length - 1]).tile;
}
