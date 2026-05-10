export type DecisionTone = "enter" | "wait" | "watch" | "avoid" | "exit" | "neutral";

export function decisionTone(value: unknown): DecisionTone {
  const text = String(value ?? "").toUpperCase();
  if (text === "ENTER" || text.includes("BUY")) return "enter";
  if (text === "WAIT_PULLBACK" || text.includes("PULLBACK")) return "wait";
  if (text === "WATCH" || text.includes("HOLD")) return "watch";
  if (text === "AVOID") return "avoid";
  if (text === "EXIT" || text.includes("SELL")) return "exit";
  return "neutral";
}

export function decisionBadgeClass(value: unknown) {
  const tone = decisionTone(value);
  if (tone === "enter") return "border-emerald-300/40 bg-emerald-400/15 text-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.15)]";
  if (tone === "wait") return "border-amber-300/40 bg-amber-400/15 text-amber-100";
  if (tone === "watch") return "border-cyan-300/30 bg-cyan-400/10 text-cyan-100";
  if (tone === "avoid") return "border-amber-300/35 bg-amber-400/12 text-amber-100";
  if (tone === "exit") return "border-rose-300/30 bg-rose-400/10 text-rose-100";
  return "border-slate-600/70 bg-slate-900/80 text-slate-200";
}

export function pnlClass(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) return "text-slate-300";
  return parsed > 0 ? "text-emerald-300" : "text-rose-300";
}
