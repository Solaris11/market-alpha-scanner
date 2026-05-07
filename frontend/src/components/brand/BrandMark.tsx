export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col">
      <img alt="TradeVeto" className={`${compact ? "h-8 max-w-[136px]" : "h-9 max-w-[232px]"} w-auto object-contain`} src="/logo.svg" />
      {compact ? null : <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">AI Market Intelligence</div>}
    </div>
  );
}
