"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import {
  clearSymbolCardReturn,
  currentAppPath,
  readSymbolCardReturn,
  type SymbolCardReturnState,
} from "@/lib/symbol/symbol-card-return";

export function SymbolPageReturnControl() {
  const router = useRouter();
  const [returnState, setReturnState] = useState<SymbolCardReturnState | null>(null);

  useEffect(() => {
    const state = readSymbolCardReturn();
    if (!state) {
      setReturnState(null);
      return;
    }
    if (!sameSymbolDestination(currentAppPath(), state.destination)) {
      clearSymbolCardReturn();
      setReturnState(null);
      return;
    }
    setReturnState(state);
  }, []);

  if (!returnState) return null;

  const closeToPreviousWorkflow = (): void => {
    const target = returnState.returnPath;
    clearSymbolCardReturn();
    if (target && target !== currentAppPath()) {
      router.push(target);
      return;
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/terminal");
  };

  return (
    <div className="fixed right-[max(0.75rem,var(--tv-safe-area-right))] top-[calc(var(--tv-safe-area-top)+0.75rem)] z-[var(--tv-z-critical-overlay)] flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-cyan-300/25 bg-slate-950/92 p-1.5 shadow-2xl shadow-black/45 backdrop-blur-xl">
      <button
        aria-label="Close symbol page and return to previous workflow"
        className="tv-mobile-touch-target inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-100 transition hover:border-cyan-200/70 hover:text-white"
        data-symbol-page-close="true"
        onClick={closeToPreviousWorkflow}
        type="button"
      >
        <X className="h-4 w-4" />
        Close
      </button>
      <button
        aria-label="Return to previous workflow"
        className="tv-mobile-touch-target hidden min-h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100 sm:inline-flex"
        onClick={closeToPreviousWorkflow}
        type="button"
      >
        <ArrowLeft className="h-4 w-4" />
        Previous workflow
      </button>
    </div>
  );
}

function sameSymbolDestination(current: string, destination: string): boolean {
  const currentPath = current.split("#", 1)[0] ?? current;
  const destinationPath = destination.split("#", 1)[0] ?? destination;
  return currentPath === destinationPath;
}
