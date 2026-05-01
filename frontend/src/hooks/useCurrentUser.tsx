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

type AuthMeResponse = {
  authenticated?: boolean;
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
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  user: CurrentUser | null;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const payload = (await response.json()) as AuthMeResponse;
      setUser(payload.authenticated && payload.user ? payload.user : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const payload = await authRequest("/api/auth/login", { email, password });
    clearCsrfToken();
    setUser(payload.user ?? null);
    setLoading(false);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const payload = await authRequest("/api/auth/register", input);
    clearCsrfToken();
    setUser(payload.user ?? null);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await csrfFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    clearCsrfToken();
    setUser(null);
    setLoading(false);
  }, []);

  const value = useMemo<CurrentUserContextValue>(() => ({
    authenticated: Boolean(user),
    loading,
    login,
    logout,
    refresh,
    register,
    user,
  }), [loading, login, logout, refresh, register, user]);

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
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
