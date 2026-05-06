export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col">
      <img alt="Market Alpha" className={`${compact ? "h-7 max-w-[122px]" : "h-8 max-w-[220px]"} w-auto object-contain`} src="/logo.svg" />
      {compact ? null : <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">AI Trading Terminal</div>}
    </div>
  );
}
