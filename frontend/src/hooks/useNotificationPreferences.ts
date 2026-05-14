"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationFrequency,
  type NotificationPreferences,
  type NotificationSymbolScope,
} from "@/lib/trading/intelligence-feed";

type NotificationPreferencesResponse = {
  authenticated?: boolean;
  error?: string;
  preferences?: unknown;
};

export type NotificationPreferenceActions = {
  setDailyLimit: (dailyLimit: number) => void;
  setFrequency: (frequency: NotificationFrequency) => void;
  setQuietHours: (start: string | null, end: string | null) => void;
  setSymbolScope: (scope: NotificationSymbolScope) => void;
  toggleCategory: (category: NotificationCategory) => void;
  toggleChannel: (channel: NotificationChannel) => void;
  toggleSymbol: (symbol: string) => void;
};

export function useNotificationPreferences(initialPreferences?: NotificationPreferences | null): {
  actions: NotificationPreferenceActions;
  hydrated: boolean;
  preferences: NotificationPreferences;
  saving: boolean;
} {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => normalizeNotificationPreferences(initialPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES));
  const [dirty, setDirty] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPreferences(normalizeNotificationPreferences(initialPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES));
    setDirty(false);
    setHydrated(true);
  }, [initialPreferences]);

  useEffect(() => {
    if (!hydrated || !dirty) return undefined;
    const timeout = window.setTimeout(() => {
      setSaving(true);
      void saveNotificationPreferences(preferences)
        .then((saved) => {
          setPreferences(saved);
          setDirty(false);
        })
        .catch(() => undefined)
        .finally(() => setSaving(false));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [dirty, hydrated, preferences]);

  const actions = useMemo<NotificationPreferenceActions>(() => ({
    setDailyLimit: (dailyLimit: number) => updatePreferences(setPreferences, setDirty, (current) => ({ ...current, dailyLimit })),
    setFrequency: (frequency: NotificationFrequency) => updatePreferences(setPreferences, setDirty, (current) => ({ ...current, frequency })),
    setQuietHours: (start: string | null, end: string | null) => updatePreferences(setPreferences, setDirty, (current) => ({ ...current, quietHoursEnd: end, quietHoursStart: start })),
    setSymbolScope: (scope: NotificationSymbolScope) => updatePreferences(setPreferences, setDirty, (current) => ({ ...current, symbolScope: scope })),
    toggleCategory: (category: NotificationCategory) => updatePreferences(setPreferences, setDirty, (current) => ({
      ...current,
      categories: current.categories.includes(category) ? current.categories.filter((item) => item !== category) : [...current.categories, category],
    })),
    toggleChannel: (channel: NotificationChannel) => updatePreferences(setPreferences, setDirty, (current) => ({
      ...current,
      channels: current.channels.includes(channel) ? current.channels.filter((item) => item !== channel) : [...current.channels, channel],
    })),
    toggleSymbol: (symbol: string) => updatePreferences(setPreferences, setDirty, (current) => ({
      ...current,
      symbols: current.symbols.includes(symbol.toUpperCase()) ? current.symbols.filter((item) => item !== symbol.toUpperCase()) : [...current.symbols, symbol.toUpperCase()],
    })),
  }), []);

  return { actions, hydrated, preferences, saving };
}

function updatePreferences(
  setPreferences: Dispatch<SetStateAction<NotificationPreferences>>,
  setDirty: Dispatch<SetStateAction<boolean>>,
  updater: (current: NotificationPreferences) => unknown,
): void {
  setPreferences((current) => normalizeNotificationPreferences(updater(current)));
  setDirty(true);
}

async function saveNotificationPreferences(preferences: NotificationPreferences): Promise<NotificationPreferences> {
  const response = await csrfFetch("/api/user/notification-preferences", {
    body: JSON.stringify(normalizeNotificationPreferences(preferences)),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
  const payload = (await response.json().catch(() => null)) as NotificationPreferencesResponse | null;
  if (!response.ok) throw new Error(payload?.error ?? "Failed to save notification preferences.");
  return normalizeNotificationPreferences(payload?.preferences ?? preferences);
}
