"use client";

import { useEffect, useState, type ReactNode } from "react";

export function ResponsiveAdvancedDetails({
  children,
  className = "",
  defaultDesktopOpen = true,
  eyebrow = "Advanced",
  summary,
  title,
}: {
  children: ReactNode;
  className?: string;
  defaultDesktopOpen?: boolean;
  eyebrow?: string;
  summary?: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    function syncOpenState() {
      setOpen(defaultDesktopOpen && query.matches);
    }

    syncOpenState();
    query.addEventListener("change", syncOpenState);
    return () => query.removeEventListener("change", syncOpenState);
  }, [defaultDesktopOpen]);

  return (
    <details
      className={`min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:p-4 ${className}`}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-1 text-left">
        <span className="min-w-0">
          <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</span>
          <span className="mt-1 block text-sm font-semibold text-slate-100">{title}</span>
          {summary ? <span className="mt-1 block text-xs leading-5 text-slate-500">{summary}</span> : null}
        </span>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
          {open ? "hide" : "show"}
        </span>
      </summary>
      <div className="mt-3 min-w-0 space-y-4">{children}</div>
    </details>
  );
}
