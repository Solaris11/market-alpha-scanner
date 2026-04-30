"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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

  useEffect(() => {
    setProfile(readRiskProfileStorage());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || loading) return;
    if (!authenticated || !user) {
      setAccountProfileReadyUserId(null);
      setProfile(readRiskProfileStorage());
      return;
    }

    let cancelled = false;
    const userId = user.id;
    setAccountProfileReadyUserId(null);
    async function loadAccountRiskProfile() {
      const localProfile = readRiskProfileStorage();
      try {
        const response = await fetch("/api/user/risk-profile", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as RiskProfileResponse | null;
        if (!response.ok) throw new Error(payload?.error ?? "Failed to load risk profile.");
        const nextProfile = payload?.exists
          ? mergeServerProfile(payload.profile, localProfile)
          : await saveRiskProfile(localProfile);
        if (!cancelled) {
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
      const timeout = window.setTimeout(() => {
        void saveRiskProfile(profile).catch(() => undefined);
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
  const response = await fetch("/api/user/risk-profile", {
    body: JSON.stringify(normalizeRiskProfile(profile)),
    cache: "no-store",
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
