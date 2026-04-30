"use client";

import { useState, type FormEvent } from "react";
import { AuthInput } from "./LoginForm";

type ForgotPasswordResponse = {
  message?: string;
  ok?: boolean;
};

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        body: JSON.stringify({ email }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as ForgotPasswordResponse | null;
      setMessage(payload?.message ?? "If an account exists for that email, a reset link will be available shortly.");
    } catch {
      setMessage("If an account exists for that email, a reset link will be available shortly.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <AuthInput autoComplete="email" label="Email" onChange={setEmail} type="email" value={email} />
      {message ? <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">{message}</div> : null}
      <button className="h-11 w-full rounded-xl bg-cyan-300 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50" disabled={busy} type="submit">
        {busy ? "Submitting..." : "Send reset link"}
      </button>
    </form>
  );
}
