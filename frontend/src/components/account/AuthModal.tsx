"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  initialMode = "login",
  onClose,
  resetToken = "",
}: {
  initialMode?: AuthMode;
  onClose: () => void;
  resetToken?: string;
}) {
  const [mode, setMode] = useState<AuthMode>(resetToken ? "reset" : initialMode);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

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
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
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

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-black/70 p-6 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div className="relative z-[10001] max-h-[calc(100vh-48px)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/50 ring-1 ring-cyan-300/10" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Market Alpha</div>
            <h2 className="mt-1 text-xl font-semibold text-slate-50">{title}</h2>
          </div>
          <button className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400 transition hover:border-cyan-300/50 hover:text-cyan-100" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {(mode === "login" || mode === "register") && googleEnabled ? (
            <>
              <button
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-slate-100 transition hover:border-cyan-300/40 hover:bg-white/[0.07]"
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
          {mode === "register" ? <RegisterForm onSuccess={onClose} /> : null}
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
    </div>,
    document.body,
  );
}
