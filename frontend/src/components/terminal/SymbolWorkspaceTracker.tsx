"use client";

import { useEffect } from "react";
import { useWorkspacePreferences } from "@/hooks/useWorkspacePreferences";

export function SymbolWorkspaceTracker({ symbol }: { symbol: string }) {
  const { actions } = useWorkspacePreferences();

  useEffect(() => {
    actions.setMobileLastViewedSymbol(symbol);
  }, [actions, symbol]);

  return null;
}
