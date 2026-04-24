import { badgeTone } from "@/lib/format";

const TONES: Record<string, string> = {
  positive: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  accent: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  neutral: "border-slate-500/30 bg-slate-500/12 text-slate-200",
  negative: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  muted: "border-slate-600/30 bg-slate-800/40 text-slate-300",
};

export function Badge({ value }: { value: unknown }) {
  const tone = badgeTone(value);
  return (
    <span className={`inline-flex min-w-max items-center whitespace-nowrap rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${TONES[tone]}`}>
      {String(value ?? "N/A")}
    </span>
  );
}
