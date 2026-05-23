"use client";

import Link from "next/link";
import { BrainCircuit, Clock3, KeyRound, LockKeyhole, RadioTower, Route, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { UtilityCard, UtilityHero, UtilityMetricGrid, UtilityStatusRows, UtilityTimeline } from "@/components/utility/CinematicUtilitySurface";
import { AuthModal } from "./AuthModal";

type PublicAuthMode = "login" | "register";

const APP_ENTRY_URL = "/terminal";

const modeCopy = {
  login: {
    cta: "Sign in",
    eyebrow: "Early access members",
    modalMode: "login" as const,
    openLabel: "Open sign-in",
    supporting: "Use the same email and password you created for early access. If you are already signed in, TradeVeto will take you back to the terminal.",
    tactical: "Resume your market intelligence workflow without losing watchlists, alerts, paper context, or decision memory.",
    title: "Sign in to TradeVeto",
  },
  register: {
    cta: "Create early access account",
    eyebrow: "Founding member access",
    modalMode: "register" as const,
    openLabel: "Open early access signup",
    supporting: "TradeVeto is launching as a controlled paid early-access research platform. Create an account, then continue into onboarding, risk disclosure, and the research terminal.",
    tactical: "Create an account that starts with risk acknowledgement, a scanner walkthrough, watchlist setup, and research-only guardrails.",
    title: "Join TradeVeto Early Access",
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
    <section className="relative overflow-hidden px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(34,211,238,0.12),transparent_30rem),radial-gradient(circle_at_84%_12%,rgba(167,139,250,0.12),transparent_28rem)]" />
      <div className="relative mx-auto max-w-7xl space-y-5">
        <UtilityHero
          eyebrow={copy.eyebrow}
          metrics={[
            { detail: "Founding member signup is open unless an operator explicitly pauses early access.", label: "Access", tone: "cyan", value: "Early" },
            { detail: "No broker execution or personalized advice.", label: "Mode", tone: "emerald", value: "Research" },
            { detail: "Onboarding, support, feedback, and first useful actions stay measured.", label: "Launch", tone: "violet", value: "Founding" },
            { detail: loading ? "Checking session state now." : "Ready for secure entry.", label: "Session", tone: loading ? "amber" : "emerald", value: loading ? "Checking" : "Stable" },
          ]}
          right={<AuthAccessConsole cta={copy.cta} mode={mode} />}
          subtitle={copy.supporting}
          title={copy.title}
          tone={mode === "register" ? "violet" : "cyan"}
        >
          <p className="max-w-3xl text-sm leading-6 text-slate-300">{copy.tactical}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
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
        </UtilityHero>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <UtilityCard eyebrow="Trust gate" icon={<ShieldCheck className="h-5 w-5" />} title="Research access without execution pressure" tone="emerald">
            <UtilityStatusRows
              items={[
                { detail: "TradeVeto opens into market awareness, not a brokerage execution path.", label: "Financial advice boundary", tone: "emerald", value: "Explicit" },
                { detail: "The platform is still evolving, so source freshness, provider limits, and product gaps remain visible.", label: "Evolving platform", tone: "violet", value: "Disclosed" },
                { detail: "Risk-first wording carries through login, onboarding, support, and account surfaces.", label: "Research posture", tone: "cyan", value: "Calm" },
              ]}
            />
          </UtilityCard>
          <UtilityCard eyebrow="Workflow continuity" icon={<Route className="h-5 w-5" />} title="The utility layer now belongs to the intelligence system" tone="cyan">
            <UtilityTimeline
              items={[
                { detail: "Sign in or create an early access account through a stable overlay with no route reset.", label: "Secure entry", tone: "cyan" },
                { detail: "Continue into Terminal with watchlists, alerts, decision memory, and Strategy Labs context intact.", label: "Context restored", tone: "emerald" },
                { detail: "Use support, account, and settings as operational surfaces inside the same cinematic world.", label: "Operational control", tone: "violet" },
              ]}
            />
          </UtilityCard>
        </div>
      </div>

      {authOpen ? <AuthModal initialInviteCode={initialInviteCode} initialMode={copy.modalMode} onClose={() => setAuthOpen(false)} /> : null}
    </section>
  );
}

function AuthAccessConsole({ cta, mode }: { cta: string; mode: PublicAuthMode }) {
  const nodes = [
    { Icon: KeyRound, label: mode === "register" ? "Founding Pass" : "Credentials", tone: "text-cyan-200" },
    { Icon: LockKeyhole, label: "Secure Session", tone: "text-emerald-200" },
    { Icon: BrainCircuit, label: "Decision Memory", tone: "text-violet-200" },
    { Icon: RadioTower, label: "Alerts", tone: "text-amber-200" },
    { Icon: Clock3, label: "Freshness", tone: "text-cyan-200" },
    { Icon: Sparkles, label: "Onboarding", tone: "text-violet-200" },
  ];
  return (
    <div className="visual-card poster-panel relative overflow-hidden rounded-3xl border border-cyan-300/16 bg-slate-950/58 p-4 shadow-2xl shadow-black/25">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Start here</div>
          <h2 className="mt-2 text-2xl font-black text-white">{cta}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {mode === "register"
              ? "Profile creation, optional invite validation, research disclosure, and Terminal entry are part of one controlled workflow."
              : "Authentication restores your operational context: watchlist, alerts, account state, and research memory."}
          </p>
        </div>
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-cyan-300/25 bg-cyan-300/10 shadow-[0_0_40px_rgba(34,211,238,0.18)]">
          <ShieldCheck className="h-7 w-7 text-cyan-100" />
        </div>
      </div>
      <div className="relative mt-5 min-h-64 overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.14),transparent_45%),linear-gradient(135deg,rgba(2,6,23,0.92),rgba(15,23,42,0.6))] p-4">
        <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/20" />
        <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-300/10" />
        <div className="absolute left-1/2 top-1/2 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-cyan-300/30 bg-slate-950/90 shadow-[0_0_48px_rgba(34,211,238,0.22)]">
          <img alt="" className="h-10 w-10" src="/icon.svg" />
        </div>
        {nodes.map((node, index) => {
          const angle = (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
          const x = Math.cos(angle) * 42 + 50;
          const y = Math.sin(angle) * 38 + 50;
          return (
            <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center" key={node.label} style={{ left: `${x}%`, top: `${y}%` }}>
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-slate-950/82">
                <node.Icon className={`h-5 w-5 ${node.tone}`} />
              </div>
              <div className="mt-1 max-w-24 text-[9px] font-black uppercase leading-3 tracking-[0.12em] text-slate-300">{node.label}</div>
            </div>
          );
        })}
      </div>
      <UtilityMetricGrid
        metrics={[
          { detail: "Controlled paid early access", label: "Launch", tone: "violet", value: "Founding" },
          { detail: "Not financial advice", label: "Boundary", tone: "emerald", value: "Research" },
        ]}
      />
    </div>
  );
}
