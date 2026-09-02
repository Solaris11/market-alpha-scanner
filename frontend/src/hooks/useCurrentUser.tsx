"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clearCsrfToken, csrfFetch } from "@/lib/client/csrf-fetch";

export type CurrentUser = {
  createdAt: string;
  displayName: string | null;
  email: string;
  emailVerified: boolean;
  id: string;
  lastLoginAt: string | null;
  onboardingCompleted: boolean;
  profileImageUrl: string | null;
  riskExperienceLevel: string | null;
  role: "user" | "admin";
  state: string;
  timezone: string | null;
};

export type CurrentUserEntitlement = {
  authenticated: boolean;
  betaAccess: boolean;
  betaAccessLabel: string | null;
  isAdmin: boolean;
  isPremium: boolean;
  legalStatus?: {
    allAccepted: boolean;
    privacyAccepted: boolean;
    riskAccepted: boolean;
    termsAccepted: boolean;
  };
  plan: "anonymous" | "free" | "premium" | "admin";
};

type AuthMeResponse = {
  authenticated?: boolean;
  entitlement?: CurrentUserEntitlement;
  user?: CurrentUser;
};

type AuthMutationResponse = {
  error?: string;
  message?: string;
  ok?: boolean;
  user?: CurrentUser;
};

type RegisterInput = {
  displayName: string;
  email: string;
  inviteCode?: string;
  password: string;
  organicLandingPath?: string;
  organicSearchEngine?: string;
  organicSource?: string;
  referralCode?: string;
  referralShareId?: string;
};

type CurrentUserContextValue = {
  /**
   * Adopt a user object the caller already has from an authoritative response,
   * without a round trip. Two frontend containers run behind the proxy and each
   * keeps its own session-user cache, so a refresh right after a write can be
   * answered by the process that has not seen the write yet.
   */
  applyUser: (next: CurrentUser) => void;
  authenticated: boolean;
  entitlement: CurrentUserEntitlement;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  user: CurrentUser | null;
};

const ANONYMOUS_ENTITLEMENT: CurrentUserEntitlement = {
  authenticated: false,
  betaAccess: false,
  betaAccessLabel: null,
  isAdmin: false,
  isPremium: false,
  plan: "anonymous",
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [entitlement, setEntitlement] = useState<CurrentUserEntitlement>(ANONYMOUS_ENTITLEMENT);
  const [loading, setLoading] = useState(true);

  const applyUser = useCallback((next: CurrentUser) => {
    setUser(next);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const payload = (await response.json()) as AuthMeResponse;
      const nextUser = payload.authenticated && payload.user ? payload.user : null;
      setUser(nextUser);
      setEntitlement(nextUser ? payload.entitlement ?? freeEntitlement() : ANONYMOUS_ENTITLEMENT);
    } catch {
      setUser(null);
      setEntitlement(ANONYMOUS_ENTITLEMENT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    await authRequest("/api/auth/login", { email, password });
    clearCsrfToken();
    await refresh();
  }, [refresh]);

  const register = useCallback(async (input: RegisterInput) => {
    await authRequest("/api/auth/register", input);
    clearCsrfToken();
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await csrfFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    clearCsrfToken();
    setUser(null);
    setEntitlement(ANONYMOUS_ENTITLEMENT);
    setLoading(false);
  }, []);

  const value = useMemo<CurrentUserContextValue>(() => ({
    applyUser,
    authenticated: Boolean(user),
    entitlement,
    loading,
    login,
    logout,
    refresh,
    register,
    user,
  }), [applyUser, entitlement, loading, login, logout, refresh, register, user]);

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

function freeEntitlement(): CurrentUserEntitlement {
  return {
    authenticated: true,
    betaAccess: false,
    betaAccessLabel: null,
    isAdmin: false,
    isPremium: false,
    plan: "free",
  };
}

export function useCurrentUser(): CurrentUserContextValue {
  const context = useContext(CurrentUserContext);
  if (!context) {
    throw new Error("useCurrentUser must be used inside CurrentUserProvider.");
  }
  return context;
}

async function authRequest(url: string, body: unknown): Promise<AuthMutationResponse> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as AuthMutationResponse | null;
  if (!response.ok || !payload?.ok || !payload.user) {
    throw new Error(payload?.message ?? payload?.error ?? "Unable to authenticate.");
  }
  return payload;
}
