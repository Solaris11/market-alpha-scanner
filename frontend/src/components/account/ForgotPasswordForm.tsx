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
      setMessage(payload?.message ?? "If that email exists, a reset link has been sent.");
    } catch {
      setMessage("If that email exists, a reset link has been sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <AuthInput autoComplete="email" label="Email" onChange={setEmail} type="email" value={email} />
      {message ? <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">{message}</div> : null}
      <button className="h-12 w-full rounded-2xl bg-cyan-300 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.18)] transition hover:bg-cyan-200 disabled:opacity-50" disabled={busy} type="submit">
        {busy ? "Submitting..." : "Send reset link"}
      </button>
    </form>
  );
}
