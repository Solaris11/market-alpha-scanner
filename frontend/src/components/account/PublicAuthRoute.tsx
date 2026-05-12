"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AuthModal } from "./AuthModal";

type PublicAuthMode = "login" | "register";

const APP_ENTRY_URL = "/terminal";

const modeCopy = {
  login: {
    cta: "Sign in",
    eyebrow: "Existing beta users",
    modalMode: "login" as const,
    openLabel: "Open sign-in",
    supporting: "Use the same email and password you created during closed beta access. If you are already signed in, TradeVeto will take you back to the terminal.",
    title: "Sign in to TradeVeto",
  },
  register: {
    cta: "Create beta account",
    eyebrow: "Closed beta access",
    modalMode: "register" as const,
    openLabel: "Open beta signup",
    supporting: "TradeVeto is invite-only while the beta cohort is controlled. Use your invite code to create an account, then continue into the research terminal.",
    title: "Join the TradeVeto closed beta",
  },
} as const;

export function PublicAuthRoute({ initialInviteCode = "", mode }: { initialInviteCode?: string; mode: PublicAuthMode }) {
  const { authenticated, loading } = useCurrentUser();
  const [authOpen, setAuthOpen] = useState(true);
  const copy = modeCopy[mode];

  useEffect(() => {
    if (!loading && authenticated) window.location.assign(APP_ENTRY_URL);
  }, [authenticated, loading]);

  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        <div>
          <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">{copy.eyebrow}</div>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">{copy.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">{copy.supporting}</p>
          <div className="mt-6 grid gap-3 text-sm leading-6 text-slate-300 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Invite-only</div>
              <p className="mt-2 text-slate-400">Public signup is closed. Beta access requires a valid invite code.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Research only</div>
              <p className="mt-2 text-slate-400">TradeVeto is market research software, not financial advice or broker execution.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">Controlled beta</div>
              <p className="mt-2 text-slate-400">Access is intentionally limited while onboarding, support, and trust loops are measured.</p>
            </div>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950 shadow-[0_0_32px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
              disabled={loading}
              onClick={() => setAuthOpen(true)}
              type="button"
            >
              {loading ? "Checking session..." : copy.openLabel}
            </button>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-slate-100 transition hover:border-cyan-300/40 hover:bg-white/[0.075]" href={mode === "register" ? "/login" : "/register"}>
              {mode === "register" ? "Already have access?" : "Need to create an account?"}
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/25">
          <div className="rounded-2xl border border-cyan-300/15 bg-slate-950/80 p-5">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Start here</div>
            <h2 className="mt-3 text-2xl font-semibold text-white">{copy.cta}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {mode === "register"
                ? "Enter your beta invite code during signup. After account creation, accepted users continue into the TradeVeto terminal."
                : "Sign in to continue your closed-beta research workflow, watchlist, replay, and Strategy Labs access."}
            </p>
            <div className="mt-5 grid gap-2 text-xs text-slate-300">
              <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">No open public signup.</div>
              <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">No trade execution or financial advice.</div>
              <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">Invite flow supports shared beta links.</div>
            </div>
          </div>
        </div>
      </div>

      {authOpen ? <AuthModal initialInviteCode={initialInviteCode} initialMode={copy.modalMode} onClose={() => setAuthOpen(false)} /> : null}
    </section>
  );
}
