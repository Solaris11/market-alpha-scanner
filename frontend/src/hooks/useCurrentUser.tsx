"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CurrentUser = {
  createdAt: string;
  displayName: string | null;
  email: string;
  id: string;
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

type CurrentUserContextValue = {
  authenticated: boolean;
  loading: boolean;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
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

  const login = useCallback(async (email: string) => {
    const response = await fetch("/api/auth/dev-login", {
      body: JSON.stringify({ email }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as AuthMutationResponse | null;
    if (!response.ok || !payload?.ok || !payload.user) {
      throw new Error(payload?.error ?? "Unable to sign in.");
    }
    setUser(payload.user);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { cache: "no-store", method: "POST" }).catch(() => undefined);
    setUser(null);
    setLoading(false);
  }, []);

  const value = useMemo<CurrentUserContextValue>(() => ({
    authenticated: Boolean(user),
    loading,
    login,
    logout,
    user,
  }), [loading, login, logout, user]);

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): CurrentUserContextValue {
  const context = useContext(CurrentUserContext);
  if (!context) {
    throw new Error("useCurrentUser must be used inside CurrentUserProvider.");
  }
  return context;
}
