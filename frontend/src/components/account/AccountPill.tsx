"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AccountMenu } from "./AccountMenu";
import { AuthModal } from "./AuthModal";

export function AccountPill() {
  const { authenticated, loading } = useCurrentUser();
  const [authOpen, setAuthOpen] = useState(false);
  const [resetToken, setResetToken] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("resetToken") ?? "";
    if (token) {
      setResetToken(token);
      setAuthOpen(true);
      params.delete("resetToken");
      const nextSearch = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
    }
  }, []);

  if (loading) {
    return (
      <div className="max-w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-400">
        Checking account...
      </div>
    );
  }

  if (authenticated) {
    return <AccountMenu />;
  }

  return (
    <>
      <div className="max-w-full rounded-2xl border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <div className="font-semibold">Demo mode</div>
            <div className="max-w-full text-[11px] leading-4 text-amber-100/80 sm:max-w-sm">Settings are saved only on this device. Sign in to save your watchlist and risk rules.</div>
          </div>
          <button className="rounded-full border border-amber-200/25 px-3 py-1 text-[11px] font-semibold transition hover:border-amber-100/60" onClick={() => setAuthOpen(true)} type="button">
            Sign in
          </button>
        </div>
      </div>
      {authOpen ? (
        <AuthModal
          onClose={() => {
            setAuthOpen(false);
            setResetToken("");
          }}
          resetToken={resetToken}
        />
      ) : null}
    </>
  );
}
