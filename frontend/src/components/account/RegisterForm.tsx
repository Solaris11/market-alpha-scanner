"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AuthInput } from "./LoginForm";

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const { register } = useCurrentUser();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const validationError = useMemo(() => {
    if (!displayName.trim()) return "Display name is required.";
    if (!email.trim()) return "Email is required.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return "";
  }, [confirmPassword, displayName, email, password]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      await register({ displayName, email, inviteCode: inviteCode.trim() || undefined, password });
      onSuccess();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <AuthInput autoComplete="name" label="Display name" onChange={setDisplayName} value={displayName} />
      <AuthInput autoComplete="email" label="Email" onChange={setEmail} type="email" value={email} />
      <AuthInput autoComplete="one-time-code" label="Invite code" onChange={setInviteCode} placeholder="Optional during invite-only beta" value={inviteCode} />
      <AuthInput autoComplete="new-password" label="Password" onChange={setPassword} type="password" value={password} />
      <AuthInput autoComplete="new-password" label="Confirm password" onChange={setConfirmPassword} type="password" value={confirmPassword} />
      {error ? <div className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">{error}</div> : null}
      <button className="h-11 w-full rounded-xl bg-cyan-300 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50" disabled={busy} type="submit">
        {busy ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
