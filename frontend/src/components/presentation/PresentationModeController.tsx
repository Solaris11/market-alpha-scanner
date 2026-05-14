"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { shouldEnablePresentationMode } from "@/lib/ui/visual-polish";

const STORAGE_KEY = "tradeveto:presentation-mode";

export function PresentationModeController() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const search = searchParams.toString();
    const queryEnabled = shouldEnablePresentationMode(search);
    if (queryEnabled) window.localStorage.setItem(STORAGE_KEY, "true");
    const storageEnabled = window.localStorage.getItem(STORAGE_KEY) === "true";
    const nextEnabled = queryEnabled || storageEnabled;

    setEnabled(nextEnabled);
    document.documentElement.dataset.tradevetoPresentation = nextEnabled ? "true" : "false";
    document.documentElement.classList.toggle("tradeveto-presentation-mode", nextEnabled);

    return () => {
      document.documentElement.classList.remove("tradeveto-presentation-mode");
      document.documentElement.dataset.tradevetoPresentation = "false";
    };
  }, [pathname, searchParams]);

  function exitPresentationMode() {
    window.localStorage.removeItem(STORAGE_KEY);
    document.documentElement.classList.remove("tradeveto-presentation-mode");
    document.documentElement.dataset.tradevetoPresentation = "false";
    setEnabled(false);
  }

  if (!enabled) return null;

  return (
    <div className="tv-presentation-badge fixed bottom-4 left-4 z-[9600] hidden items-center gap-2 rounded-full border border-cyan-300/25 bg-slate-950/90 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-cyan-100 shadow-2xl shadow-black/35 backdrop-blur-xl sm:flex" data-presentation-control>
      <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.85)]" />
      Presentation Mode
      <button className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100" onClick={exitPresentationMode} type="button">
        Exit
      </button>
    </div>
  );
}

