export function TradeLegalNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs leading-5 text-slate-400 ${className}`}>
      Research signal only. You are responsible for all trading decisions.
    </div>
  );
}
