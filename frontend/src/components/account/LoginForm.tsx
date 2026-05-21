"use client";

import { useState, type FormEvent } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function LoginForm({ onForgotPassword, onSuccess }: { onForgotPassword: () => void; onSuccess: () => void }) {
  const { login } = useCurrentUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      onSuccess();
    } catch {
      setError("Invalid email or password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <AuthInput autoComplete="email" label="Email" onChange={setEmail} type="email" value={email} />
      <AuthInput autoComplete="current-password" label="Password" onChange={setPassword} type="password" value={password} />
      {error ? <div className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">{error}</div> : null}
      <button className="h-12 w-full rounded-2xl bg-cyan-300 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.18)] transition hover:bg-cyan-200 disabled:opacity-50" disabled={busy} type="submit">
        {busy ? "Signing in..." : "Sign in"}
      </button>
      <button className="w-full text-xs text-slate-400 transition hover:text-cyan-100" onClick={onForgotPassword} type="button">
        Forgot password?
      </button>
    </form>
  );
}

export function AuthInput({
  autoComplete,
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  autoComplete?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-300">
      {label}
      <input
        autoComplete={autoComplete}
        className="mt-1 h-12 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 text-sm font-normal text-slate-100 outline-none ring-1 ring-white/5 transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:bg-slate-950 focus:ring-cyan-300/20"
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}
