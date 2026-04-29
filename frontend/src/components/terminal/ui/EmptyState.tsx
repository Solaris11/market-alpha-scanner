export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center">
      <div className="text-sm font-semibold text-slate-200">{title}</div>
      <div className="mt-1 text-sm text-slate-400">{message}</div>
    </div>
  );
}
