"use client";

import { useEffect, useState } from "react";
import { DEFAULT_USER_RISK_PROFILE, normalizeRiskProfile, type UserRiskProfile } from "@/lib/trading/risk-veto";

export const RISK_PROFILE_STORAGE_KEY = "market_alpha_risk_profile";

export type RiskProfileActions = {
  resetRiskProfile: () => void;
  updateRiskProfile: (patch: Partial<UserRiskProfile>) => void;
};

export function useRiskProfile(): { profile: UserRiskProfile; actions: RiskProfileActions } {
  const [profile, setProfile] = useState<UserRiskProfile>(DEFAULT_USER_RISK_PROFILE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setProfile(readRiskProfileStorage());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    writeRiskProfileStorage(profile);
  }, [loaded, profile]);

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
