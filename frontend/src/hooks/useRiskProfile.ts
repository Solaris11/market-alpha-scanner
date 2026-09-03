"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import { DEFAULT_USER_RISK_PROFILE, normalizeRiskProfile, type UserRiskProfile } from "@/lib/trading/risk-veto";

export const RISK_PROFILE_STORAGE_KEY = "market_alpha_risk_profile";

export type RiskProfileActions = {
  resetRiskProfile: () => void;
  updateRiskProfile: (patch: Partial<UserRiskProfile>) => void;
};

type RiskProfileResponse = {
  authenticated?: boolean;
  error?: string;
  exists?: boolean;
  profile?: unknown;
};

export function useRiskProfile(): { profile: UserRiskProfile; actions: RiskProfileActions } {
  const { authenticated, loading, user } = useCurrentUser();
  const [profile, setProfile] = useState<UserRiskProfile>(DEFAULT_USER_RISK_PROFILE);
  const [accountProfileReadyUserId, setAccountProfileReadyUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // The value the account row is already known to hold. Without it the load
  // effect's setProfile() re-triggers the save effect and every page load
  // writes back the profile it has just read.
  const serverSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    setProfile(readRiskProfileStorage());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || loading) return;
    if (!authenticated || !user) {
      serverSyncedRef.current = null;
      setAccountProfileReadyUserId(null);
      setProfile(readRiskProfileStorage());
      return;
    }

    let cancelled = false;
    const userId = user.id;
    serverSyncedRef.current = null;
    setAccountProfileReadyUserId(null);
    async function loadAccountRiskProfile() {
      const localProfile = readRiskProfileStorage();
      try {
        const payload = await requestAccountRiskProfile(userId);
        const nextProfile = payload?.exists
          ? mergeServerProfile(payload.profile, localProfile)
          : await saveRiskProfile(localProfile);
        if (!cancelled) {
          // mergeServerProfile() overlays the local maxPositionSizePercent, so
          // the account row is only in sync when that overlay changed nothing.
          const serverProfile = payload?.exists ? normalizeRiskProfile(objectValue(payload.profile)) : nextProfile;
          serverSyncedRef.current = serializeProfile(serverProfile) === serializeProfile(nextProfile)
            ? serializeProfile(nextProfile)
            : null;
          setProfile(nextProfile);
          setAccountProfileReadyUserId(userId);
          writeRiskProfileStorage(nextProfile);
        }
      } catch {
        if (!cancelled) setProfile(localProfile);
      }
    }

    void loadAccountRiskProfile();
    return () => {
      cancelled = true;
    };
  }, [authenticated, loaded, loading, user]);

  useEffect(() => {
    if (!loaded || loading) return;
    writeRiskProfileStorage(profile);
    if (authenticated && user && accountProfileReadyUserId === user.id) {
      const serialized = serializeProfile(profile);
      // Nothing changed since the account row was read or last written, so a
      // PUT here would only echo the value the server already holds.
      if (serverSyncedRef.current === serialized) return undefined;
      const timeout = window.setTimeout(() => {
        serverSyncedRef.current = serialized;
        void saveRiskProfile(profile).catch(() => {
          if (serverSyncedRef.current === serialized) serverSyncedRef.current = null;
        });
      }, 250);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [accountProfileReadyUserId, authenticated, loaded, loading, profile, user]);

  return {
    actions: {
      resetRiskProfile: () => setProfile(DEFAULT_USER_RISK_PROFILE),
      updateRiskProfile: (patch: Partial<UserRiskProfile>) => setProfile((current) => normalizeRiskProfile({ ...current, ...patch })),
    },
    profile,
  };
}

/**
 * Two components on /terminal mount this hook independently
 * (RiskTolerantOpportunityRadar, and AICopilotPanel through useTradePlanEngine),
 * so without this every page load issued the same GET twice. Concurrent readers
 * of the same account share one request; a later mount still gets a fresh read.
 */
let inFlightAccountRiskProfile: { promise: Promise<RiskProfileResponse | null>; userId: string } | null = null;

function requestAccountRiskProfile(userId: string): Promise<RiskProfileResponse | null> {
  if (inFlightAccountRiskProfile && inFlightAccountRiskProfile.userId === userId) {
    return inFlightAccountRiskProfile.promise;
  }
  const promise = (async () => {
    const response = await fetch("/api/user/risk-profile", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as RiskProfileResponse | null;
    if (!response.ok) throw new Error(payload?.error ?? "Failed to load risk profile.");
    return payload;
  })();
  const entry = { promise, userId };
  inFlightAccountRiskProfile = entry;
  void promise.catch(() => undefined).finally(() => {
    if (inFlightAccountRiskProfile === entry) inFlightAccountRiskProfile = null;
  });
  return promise;
}

function serializeProfile(profile: UserRiskProfile): string {
  return JSON.stringify(normalizeRiskProfile(profile));
}

function readRiskProfileStorage(): UserRiskProfile {
  if (typeof window === "undefined") return DEFAULT_USER_RISK_PROFILE;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RISK_PROFILE_STORAGE_KEY) ?? "null") as Partial<UserRiskProfile> | null;
    return normalizeRiskProfile(parsed);
  } catch {
    return DEFAULT_USER_RISK_PROFILE;
  }
}

function writeRiskProfileStorage(profile: UserRiskProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RISK_PROFILE_STORAGE_KEY, JSON.stringify(normalizeRiskProfile(profile)));
}

async function saveRiskProfile(profile: UserRiskProfile): Promise<UserRiskProfile> {
  const response = await csrfFetch("/api/user/risk-profile", {
    body: JSON.stringify(normalizeRiskProfile(profile)),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
  const payload = (await response.json().catch(() => null)) as RiskProfileResponse | null;
  if (!response.ok) throw new Error(payload?.error ?? "Failed to save risk profile.");
  return mergeServerProfile(payload?.profile, profile);
}

function mergeServerProfile(value: unknown, localProfile: UserRiskProfile): UserRiskProfile {
  return normalizeRiskProfile({
    ...objectValue(value),
    maxPositionSizePercent: localProfile.maxPositionSizePercent,
  });
}

function objectValue(value: unknown): Partial<UserRiskProfile> {
  return value && typeof value === "object" ? (value as Partial<UserRiskProfile>) : {};
}
