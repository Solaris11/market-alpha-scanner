import type { ComponentPropsWithoutRef } from "react";

type GlassPanelProps = ComponentPropsWithoutRef<"section">;

export function GlassPanel({ children, className = "", ...props }: GlassPanelProps) {
  return (
    <section className={`visual-card poster-panel tv-card-motion tv-governed-panel min-w-0 max-w-full rounded-2xl border border-white/10 bg-slate-950/60 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl ${className}`} {...props}>
      {children}
    </section>
  );
}
