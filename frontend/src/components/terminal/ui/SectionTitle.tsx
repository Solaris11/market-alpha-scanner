export function SectionTitle({ eyebrow, title, meta }: { eyebrow?: string; title: string; meta?: string }) {
  return (
    <div className="flex min-w-0 items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">{eyebrow}</div> : null}
        <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-slate-50">{title}</h2>
      </div>
      {meta ? <div className="shrink-0 text-xs text-slate-400">{meta}</div> : null}
    </div>
  );
}
