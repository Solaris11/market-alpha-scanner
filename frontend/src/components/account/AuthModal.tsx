"use client";

import { useEffect, useState } from "react";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { ResetPasswordForm } from "./ResetPasswordForm";

type AuthMode = "login" | "register" | "forgot" | "reset";

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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const title = mode === "register" ? "Create your account" : mode === "forgot" ? "Reset your password" : mode === "reset" ? "Choose a new password" : "Sign in";

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/50 ring-1 ring-cyan-300/10">
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
    </div>
  );
}
