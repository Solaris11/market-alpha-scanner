type Metric = {
  label: string;
  value: string | number;
  meta?: string;
};

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <section className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
      {metrics.map((metric) => (
        <div className="terminal-panel min-w-0 rounded-2xl px-3 py-2 ring-1 ring-white/5" key={metric.label}>
          <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{metric.label}</div>
          <div className="mt-1 truncate font-mono text-sm font-semibold text-slate-100">{metric.value}</div>
          {metric.meta ? <div className="mt-0.5 truncate text-[11px] text-slate-500">{metric.meta}</div> : null}
        </div>
      ))}
    </section>
  );
}
