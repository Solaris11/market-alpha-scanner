"use client";

import { useState, type FormEvent } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function AccountPill() {
  const { authenticated, loading, login, logout, user } = useCurrentUser();
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email);
      setEmail("");
      setExpanded(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-400">
        Checking account...
      </div>
    );
  }

  if (authenticated && user) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
        <div className="min-w-0">
          <div className="truncate font-semibold">{user.email}</div>
          <div className="text-[11px] text-emerald-200/80">Account saved</div>
        </div>
        <button className="rounded-full border border-emerald-200/20 px-2 py-1 text-[11px] transition hover:border-emerald-100/50" onClick={() => void logout()} type="button">
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0">
          <div className="font-semibold">Demo mode</div>
          <div className="max-w-sm text-[11px] leading-4 text-amber-100/80">Settings are saved only on this device. Sign in to save your watchlist and risk rules.</div>
        </div>
        <button className="rounded-full border border-amber-200/25 px-2 py-1 text-[11px] transition hover:border-amber-100/60" onClick={() => setExpanded((value) => !value)} type="button">
          Sign in
        </button>
      </div>
      {expanded ? (
        <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={submit}>
          <input
            className="h-8 min-w-0 flex-1 rounded-full border border-amber-100/20 bg-slate-950/70 px-3 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-100/60"
            onChange={(event) => setEmail(event.currentTarget.value)}
            placeholder="user@example.com"
            type="email"
            value={email}
          />
          <button className="h-8 rounded-full bg-amber-200 px-3 text-[11px] font-bold text-slate-950 disabled:opacity-50" disabled={busy} type="submit">
            {busy ? "Saving..." : "Continue"}
          </button>
          {error ? <div className="basis-full text-[11px] text-rose-200">{error}</div> : null}
        </form>
      ) : null}
    </div>
  );
}
