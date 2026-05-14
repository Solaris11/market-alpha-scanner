"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import {
  applyWorkspaceMode,
  DEFAULT_WORKSPACE_PREFERENCES,
  normalizeWorkspacePreferences,
  type WorkspaceFavoriteAction,
  type WorkspaceMode,
  type WorkspaceModuleId,
  type WorkspacePreferences,
  type WorkspaceRiskStyle,
  type WorkspaceTimeframe,
} from "@/lib/trading/workspace-preferences";

export const WORKSPACE_PREFERENCES_STORAGE_KEY = "tradeveto_workspace_preferences";
export const WORKSPACE_PREFERENCES_EVENT = "tradeveto-workspace-preferences-change";

type WorkspacePreferencesResponse = {
  authenticated?: boolean;
  error?: string;
  preferences?: unknown;
};

export type WorkspacePreferenceActions = {
  moveModule: (moduleId: WorkspaceModuleId, direction: "down" | "up") => void;
  resetWorkspace: () => void;
  setFavoriteActions: (actions: WorkspaceFavoriteAction[]) => void;
  setMobileLastViewedSymbol: (symbol: string | null) => void;
  setMobilePreferredOverview: (moduleId: WorkspaceModuleId) => void;
  setPreferredRiskStyle: (style: WorkspaceRiskStyle) => void;
  setPreferredTimeframes: (timeframes: WorkspaceTimeframe[]) => void;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  toggleFavoriteModule: (moduleId: WorkspaceModuleId) => void;
  toggleFavoriteSymbol: (symbol: string) => void;
  toggleModuleVisibility: (moduleId: WorkspaceModuleId) => void;
  togglePinnedMobileCard: (moduleId: WorkspaceModuleId) => void;
};

export function useWorkspacePreferences(initialPreferences?: WorkspacePreferences | null): {
  actions: WorkspacePreferenceActions;
  hydrated: boolean;
  preferences: WorkspacePreferences;
} {
  const { authenticated, loading, user } = useCurrentUser();
  const [preferences, setPreferences] = useState<WorkspacePreferences>(() => normalizeWorkspacePreferences(initialPreferences ?? DEFAULT_WORKSPACE_PREFERENCES));
  const [accountPreferencesReadyUserId, setAccountPreferencesReadyUserId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const localPreferences = readWorkspacePreferencesStorage();
    setPreferences(normalizeWorkspacePreferences({ ...(initialPreferences ?? {}), ...localPreferences }));
    setHydrated(true);
  }, [initialPreferences]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const syncPreferences = () => {
      const nextPreferences = readWorkspacePreferencesStorage();
      setPreferences((current) => (samePreferences(current, nextPreferences) ? current : nextPreferences));
    };
    window.addEventListener(WORKSPACE_PREFERENCES_EVENT, syncPreferences);
    window.addEventListener("storage", syncPreferences);
    return () => {
      window.removeEventListener(WORKSPACE_PREFERENCES_EVENT, syncPreferences);
      window.removeEventListener("storage", syncPreferences);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || loading) return;
    if (!authenticated || !user) {
      setAccountPreferencesReadyUserId(null);
      setPreferences(readWorkspacePreferencesStorage());
      return;
    }

    let cancelled = false;
    const userId = user.id;
    setAccountPreferencesReadyUserId(null);

    async function loadAccountWorkspacePreferences() {
      const localPreferences = readWorkspacePreferencesStorage();
      try {
        const response = await fetch("/api/user/workspace-preferences", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as WorkspacePreferencesResponse | null;
        if (!response.ok) throw new Error(payload?.error ?? "Failed to load workspace preferences.");
        const serverPreferences = normalizeWorkspacePreferences(payload?.preferences);
        const nextPreferences = mergeWorkspacePreferences(serverPreferences, localPreferences);
        if (!cancelled) {
          setPreferences(nextPreferences);
          setAccountPreferencesReadyUserId(userId);
          writeWorkspacePreferencesStorage(nextPreferences);
        }
      } catch {
        if (!cancelled) setPreferences(localPreferences);
      }
    }

    void loadAccountWorkspacePreferences();
    return () => {
      cancelled = true;
    };
  }, [authenticated, hydrated, loading, user]);

  useEffect(() => {
    if (!hydrated || loading) return;
    writeWorkspacePreferencesStorage(preferences);
    if (authenticated && user && accountPreferencesReadyUserId === user.id) {
      const timeout = window.setTimeout(() => {
        void saveWorkspacePreferences(preferences).catch(() => undefined);
      }, 300);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [accountPreferencesReadyUserId, authenticated, hydrated, loading, preferences, user]);

  const updatePreferences = useCallback((updater: (current: WorkspacePreferences) => WorkspacePreferences) => {
    setPreferences((current) => normalizeWorkspacePreferences(updater(current)));
  }, []);

  const actions = useMemo<WorkspacePreferenceActions>(() => ({
    moveModule: (moduleId: WorkspaceModuleId, direction: "down" | "up") => updatePreferences((current) => moveModule(current, moduleId, direction)),
    resetWorkspace: () => setPreferences(DEFAULT_WORKSPACE_PREFERENCES),
    setFavoriteActions: (actions: WorkspaceFavoriteAction[]) => updatePreferences((current) => ({ ...current, favoriteActions: actions })),
    setMobileLastViewedSymbol: (symbol: string | null) => updatePreferences((current) => ({ ...current, mobileLastViewedSymbol: symbol })),
    setMobilePreferredOverview: (moduleId: WorkspaceModuleId) => updatePreferences((current) => ({ ...current, mobilePreferredOverview: moduleId })),
    setPreferredRiskStyle: (style: WorkspaceRiskStyle) => updatePreferences((current) => ({ ...current, preferredRiskStyle: style })),
    setPreferredTimeframes: (timeframes: WorkspaceTimeframe[]) => updatePreferences((current) => ({ ...current, preferredTimeframes: timeframes })),
    setWorkspaceMode: (mode: WorkspaceMode) => updatePreferences((current) => applyWorkspaceMode(current, mode)),
    toggleFavoriteModule: (moduleId: WorkspaceModuleId) => updatePreferences((current) => ({
      ...current,
      favoriteModules: toggleValue(current.favoriteModules, moduleId, 5),
    })),
    toggleFavoriteSymbol: (symbol: string) => updatePreferences((current) => ({
      ...current,
      favoriteSymbols: toggleValue(current.favoriteSymbols, symbol, 16),
    })),
    toggleModuleVisibility: (moduleId: WorkspaceModuleId) => updatePreferences((current) => ({
      ...current,
      hiddenModules: toggleValue(current.hiddenModules, moduleId, 8),
    })),
    togglePinnedMobileCard: (moduleId: WorkspaceModuleId) => updatePreferences((current) => ({
      ...current,
      pinnedMobileCards: toggleValue(current.pinnedMobileCards, moduleId, 6),
    })),
  }), [updatePreferences]);

  return {
    actions,
    hydrated,
    preferences,
  };
}

function readWorkspacePreferencesStorage(): WorkspacePreferences {
  if (typeof window === "undefined") return DEFAULT_WORKSPACE_PREFERENCES;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WORKSPACE_PREFERENCES_STORAGE_KEY) ?? "null") as unknown;
    return normalizeWorkspacePreferences(parsed);
  } catch {
    return DEFAULT_WORKSPACE_PREFERENCES;
  }
}

function writeWorkspacePreferencesStorage(preferences: WorkspacePreferences): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeWorkspacePreferences(preferences);
  const serialized = JSON.stringify(normalized);
  if (window.localStorage.getItem(WORKSPACE_PREFERENCES_STORAGE_KEY) === serialized) return;
  window.localStorage.setItem(WORKSPACE_PREFERENCES_STORAGE_KEY, serialized);
  window.dispatchEvent(new Event(WORKSPACE_PREFERENCES_EVENT));
}

async function saveWorkspacePreferences(preferences: WorkspacePreferences): Promise<WorkspacePreferences> {
  const response = await csrfFetch("/api/user/workspace-preferences", {
    body: JSON.stringify(normalizeWorkspacePreferences(preferences)),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
  const payload = (await response.json().catch(() => null)) as WorkspacePreferencesResponse | null;
  if (!response.ok) throw new Error(payload?.error ?? "Failed to save workspace preferences.");
  return normalizeWorkspacePreferences(payload?.preferences ?? preferences);
}

function mergeWorkspacePreferences(serverPreferences: WorkspacePreferences, localPreferences: WorkspacePreferences): WorkspacePreferences {
  const localHasSignals =
    localPreferences.favoriteSymbols.length > 0 ||
    localPreferences.mobileLastViewedSymbol !== null ||
    localPreferences.hiddenModules.length > 0 ||
    localPreferences.workspaceMode !== DEFAULT_WORKSPACE_PREFERENCES.workspaceMode;
  if (!localHasSignals) return serverPreferences;
  return normalizeWorkspacePreferences({
    ...serverPreferences,
    favoriteSymbols: localPreferences.favoriteSymbols.length ? localPreferences.favoriteSymbols : serverPreferences.favoriteSymbols,
    hiddenModules: localPreferences.hiddenModules.length ? localPreferences.hiddenModules : serverPreferences.hiddenModules,
    mobileLastViewedSymbol: localPreferences.mobileLastViewedSymbol ?? serverPreferences.mobileLastViewedSymbol,
    workspaceMode: localPreferences.workspaceMode,
  });
}

function moveModule(preferences: WorkspacePreferences, moduleId: WorkspaceModuleId, direction: "down" | "up"): WorkspacePreferences {
  const moduleOrder = [...preferences.moduleOrder];
  const currentIndex = moduleOrder.indexOf(moduleId);
  if (currentIndex === -1) return preferences;
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= moduleOrder.length) return preferences;
  const nextOrder = [...moduleOrder];
  nextOrder[currentIndex] = moduleOrder[nextIndex] as WorkspaceModuleId;
  nextOrder[nextIndex] = moduleId;
  return { ...preferences, moduleOrder: nextOrder };
}

function toggleValue<T extends string>(items: T[], value: T, limit: number): T[] {
  if (items.includes(value)) return items.filter((item) => item !== value);
  return [...items, value].slice(-limit);
}

function samePreferences(left: WorkspacePreferences, right: WorkspacePreferences): boolean {
  return JSON.stringify(normalizeWorkspacePreferences(left)) === JSON.stringify(normalizeWorkspacePreferences(right));
}
