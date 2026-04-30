"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AuthInput } from "./LoginForm";

type ResetPasswordResponse = {
  error?: string;
  ok?: boolean;
};

export function ResetPasswordForm({ onSuccess, token }: { onSuccess: () => void; token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const validationError = useMemo(() => {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return "";
  }, [confirmPassword, password]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        body: JSON.stringify({ token, newPassword: password }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as ResetPasswordResponse | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Unable to reset password.");
      setMessage("Password updated. Sign in with your new password.");
      onSuccess();
    } catch {
      setError("Reset link is invalid or expired.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <AuthInput autoComplete="new-password" label="New password" onChange={setPassword} type="password" value={password} />
      <AuthInput autoComplete="new-password" label="Confirm password" onChange={setConfirmPassword} type="password" value={confirmPassword} />
      {error ? <div className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">{message}</div> : null}
      <button className="h-11 w-full rounded-xl bg-cyan-300 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50" disabled={busy} type="submit">
        {busy ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
