export function CompactLegalNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`text-[11px] font-semibold text-slate-500 ${className}`}>
      Research only. Not financial advice.
    </div>
  );
}
