"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mobileRouteModesForPath } from "@/lib/navigation";
import { useNavigationIntent } from "@/components/terminal/NavigationPerformance";

export function MobileModeRail() {
  const pathname = usePathname();
  const modes = mobileRouteModesForPath(pathname);
  if (!modes.length) return null;

  return (
    <section aria-label="Mobile view modes" className="mb-4 xl:hidden">
      <div className="visual-card rounded-[1.25rem] border border-cyan-300/14 bg-slate-950/72 p-2 shadow-xl shadow-cyan-950/10 backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between gap-3 px-2">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">View Mode</div>
          <div className="text-[10px] font-semibold text-slate-500">Overview first, detail on tap</div>
        </div>
        <div className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {modes.map((mode) => (
            <ModeLink href={`${pathname}${mode.href}`} key={mode.key} label={mode.label} summary={mode.summary} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ModeLink({ href, label, summary }: { href: string; label: string; summary: string }) {
  const navigationIntent = useNavigationIntent(href, label);
  return (
    <Link
      className="tv-tap-motion min-h-14 min-w-[7.25rem] snap-start rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
      href={href}
      onClick={navigationIntent.onClick}
      onFocus={navigationIntent.onFocus}
      onPointerEnter={navigationIntent.onPointerEnter}
    >
      <span className="block text-sm font-semibold text-slate-50">{label}</span>
      <span className="mt-1 block text-[10px] leading-4 text-slate-500">{summary}</span>
    </Link>
  );
}
