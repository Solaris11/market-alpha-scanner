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
  state: string;
  timezone: string | null;
};

export type CurrentUserEntitlement = {
  authenticated: boolean;
  isAdmin: boolean;
  isPremium: boolean;
  plan: "anonymous" | "free" | "premium" | "admin";
};

type AuthMeResponse = {
  authenticated?: boolean;
  entitlement?: CurrentUserEntitlement;
  user?: CurrentUser;
};

type AuthMutationResponse = {
  error?: string;
  ok?: boolean;
  user?: CurrentUser;
};

type RegisterInput = {
  displayName: string;
  email: string;
  password: string;
};

type CurrentUserContextValue = {
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
  isAdmin: false,
  isPremium: false,
  plan: "anonymous",
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [entitlement, setEntitlement] = useState<CurrentUserEntitlement>(ANONYMOUS_ENTITLEMENT);
  const [loading, setLoading] = useState(true);

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
    authenticated: Boolean(user),
    entitlement,
    loading,
    login,
    logout,
    refresh,
    register,
    user,
  }), [entitlement, loading, login, logout, refresh, register, user]);

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

function freeEntitlement(): CurrentUserEntitlement {
  return {
    authenticated: true,
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
    throw new Error(payload?.error ?? "Unable to authenticate.");
  }
  return payload;
}
