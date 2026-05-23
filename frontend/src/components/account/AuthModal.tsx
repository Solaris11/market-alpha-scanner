"use client";

import { BrainCircuit, Clock3, KeyRound, ShieldCheck, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { installMobileViewportCssVars } from "@/lib/client/mobile-viewport";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { ResetPasswordForm } from "./ResetPasswordForm";

type AuthMode = "login" | "register" | "forgot" | "reset";

type ProvidersResponse = {
  google?: {
    enabled?: boolean;
  };
};

export function AuthModal({
  initialInviteCode = "",
  initialMode = "login",
  onClose,
  resetToken = "",
}: {
  initialInviteCode?: string;
  initialMode?: AuthMode;
  onClose: () => void;
  resetToken?: string;
}) {
  const [mode, setMode] = useState<AuthMode>(resetToken ? "reset" : initialMode);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const cleanupViewport = installMobileViewportCssVars();
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      cleanupViewport();
    };
  }, []);

  useEffect(() => {
    async function loadProviders() {
      const response = await fetch("/api/auth/oauth-providers", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as ProvidersResponse | null;
      setGoogleEnabled(Boolean(payload?.google?.enabled));
    }
    void loadProviders().catch(() => setGoogleEnabled(false));
  }, []);

  const title = mode === "register" ? "Create your account" : mode === "forgot" ? "Reset your password" : mode === "reset" ? "Choose a new password" : "Sign in";
  const subtitle = mode === "register"
    ? "Account setup, optional founding invite validation, and research-only guardrails stay in one controlled flow."
    : mode === "forgot"
      ? "Request a reset link without exposing account details."
      : mode === "reset"
        ? "Choose a new password and return to the terminal."
        : "Restore your watchlist, alerts, decision memory, and research workflow.";

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1 }}
        className="tv-critical-overlay-root fixed inset-0 flex items-end justify-center bg-black/74 backdrop-blur-xl md:items-center"
        data-mobile-gesture-ignore="true"
        data-stable-overlay="true"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        role="presentation"
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
      >
        <motion.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative z-[10001] grid max-h-[var(--tv-mobile-overlay-available-height)] w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-cyan-300/16 bg-[radial-gradient(circle_at_14%_0%,rgba(34,211,238,0.18),transparent_30rem),radial-gradient(circle_at_90%_8%,rgba(167,139,250,0.13),transparent_26rem),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.94))] shadow-2xl shadow-black/55 ring-1 ring-white/10 lg:grid-cols-[0.82fr_1fr]"
          exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.98, y: reduceMotion ? 0 : 10 }}
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.985, y: reduceMotion ? 0 : 16 }}
          role="dialog"
          aria-modal="true"
          style={{ maxWidth: "min(62rem, calc(100vw - 1.5rem))" }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="relative hidden min-h-[32rem] overflow-hidden border-r border-white/10 p-5 lg:block">
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.13),transparent_45%)]" />
            <div className="relative">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">TradeVeto Early Access</div>
              <h2 className="mt-3 text-3xl font-black uppercase leading-none text-white">Access Control</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">{subtitle}</p>
            </div>
            <div className="relative mt-8 grid gap-3">
              <AuthSignal icon={<KeyRound className="h-5 w-5" />} label="Secure entry" text="Email, password, optional founding invite, or configured Google provider." />
              <AuthSignal icon={<BrainCircuit className="h-5 w-5" />} label="Context restored" text="Watchlists, alerts, account state, and memory remain attached." tone="violet" />
              <AuthSignal icon={<ShieldCheck className="h-5 w-5" />} label="Research boundary" text="No broker execution or personalized trade instruction." tone="emerald" />
              <AuthSignal icon={<Clock3 className="h-5 w-5" />} label="Launch telemetry" text="Onboarding, feedback, and support loops stay observable without collecting sensitive data." tone="amber" />
            </div>
            <div className="relative mt-5 rounded-3xl border border-cyan-300/16 bg-slate-950/54 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Operational state</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <MiniState label="Advice" value="Blocked" />
                <MiniState label="Mode" value="Research" />
                <MiniState label="Session" value="Stable" />
              </div>
            </div>
          </div>

          <div className="tv-native-scroll min-h-0 overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">TradeVeto Access</div>
                <h2 className="mt-1 text-2xl font-bold text-slate-50">{title}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
              </div>
              <button aria-label="Close authentication dialog" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-slate-400 transition hover:border-cyan-300/50 hover:text-cyan-100" onClick={onClose} type="button">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5 pb-[calc(1rem+var(--tv-safe-area-bottom)+var(--tv-keyboard-offset,0px))]">
              {(mode === "login" || mode === "register") && googleEnabled ? (
                <>
                  <button
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-slate-100 transition hover:border-cyan-300/40 hover:bg-white/[0.07]"
                    onClick={() => {
                      window.location.href = "/api/auth/google/start";
                    }}
                    type="button"
                  >
                    Continue with Google
                  </button>
                  <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <span className="h-px flex-1 bg-white/10" />
                    or continue with email
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                </>
              ) : null}

              {mode === "login" ? <LoginForm onForgotPassword={() => setMode("forgot")} onSuccess={onClose} /> : null}
              {mode === "register" ? <RegisterForm initialInviteCode={initialInviteCode} onSuccess={onClose} /> : null}
              {mode === "forgot" ? <ForgotPasswordForm /> : null}
              {mode === "reset" ? <ResetPasswordForm onSuccess={() => setMode("login")} token={resetToken} /> : null}

              <div className="border-t border-white/10 pt-3 text-center text-xs text-slate-400">
                {mode === "login" ? (
                  <button className="text-cyan-200 transition hover:text-cyan-100" onClick={() => setMode("register")} type="button">
                    Create an account
                  </button>
                ) : (
                  <button className="text-cyan-200 transition hover:text-cyan-100" onClick={() => setMode("login")} type="button">
                    Back to sign in
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

function AuthSignal({ icon, label, text, tone = "cyan" }: { icon: ReactNode; label: string; text: string; tone?: "amber" | "cyan" | "emerald" | "violet" }) {
  const toneClass = tone === "emerald" ? "border-emerald-300/20 text-emerald-100" : tone === "violet" ? "border-violet-300/20 text-violet-100" : tone === "amber" ? "border-amber-300/20 text-amber-100" : "border-cyan-300/20 text-cyan-100";
  return (
    <div className="grid grid-cols-[2.75rem_1fr] gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-3">
      <div className={`grid h-11 w-11 place-items-center rounded-2xl border bg-white/[0.045] ${toneClass}`}>{icon}</div>
      <div>
        <div className="text-sm font-bold text-slate-50">{label}</div>
        <p className="mt-1 text-xs leading-5 text-slate-400">{text}</p>
      </div>
    </div>
  );
}

function MiniState({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-2">
      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 truncate text-xs font-bold text-slate-100">{value}</div>
    </div>
  );
}
