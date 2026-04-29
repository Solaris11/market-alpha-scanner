export function GlassPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-slate-950/60 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl ${className}`}>
      {children}
    </section>
  );
}
