"use client";

import { Search } from "lucide-react";

export const DISCOVERY_OPEN_EVENT = "tradeveto:open-discovery";

export function openGlobalDiscovery(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DISCOVERY_OPEN_EVENT));
}

export function DiscoveryCommandButton({ compact = false }: { compact?: boolean }) {
  return (
    <button
      aria-label="Open intelligence discovery search"
      className={
        compact
          ? "tv-tap-motion grid h-10 w-10 place-items-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.12)] transition hover:border-cyan-200/55 hover:bg-cyan-300/15"
          : "tv-tap-motion inline-flex min-h-10 items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-300/[0.11] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.12)] transition hover:-translate-y-0.5 hover:border-cyan-200/60 hover:bg-cyan-300/[0.16]"
      }
      data-discovery-command="true"
      onClick={openGlobalDiscovery}
      type="button"
    >
      <Search className={compact ? "h-4 w-4" : "h-4 w-4"} />
      {compact ? <span className="sr-only">Discover</span> : <span>Discover <span className="ml-1 text-cyan-200/60">⌘K</span></span>}
    </button>
  );
}
