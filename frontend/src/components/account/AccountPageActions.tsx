"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import { AuthModal } from "./AuthModal";

export function AccountSignInCta() {
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);

  function handleClose() {
    setAuthOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15"
        onClick={() => setAuthOpen(true)}
        type="button"
      >
        Sign in
      </button>
      {authOpen ? <AuthModal onClose={handleClose} /> : null}
    </>
  );
}

export function AccountLogoutButton() {
  const router = useRouter();
  const { logout } = useCurrentUser();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    await logout();
    router.push("/terminal");
    router.refresh();
  }

  return (
    <button
      className="rounded-full border border-rose-300/35 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-200/70 hover:bg-rose-400/15 disabled:cursor-wait disabled:opacity-60"
      disabled={busy}
      onClick={() => void handleLogout()}
      type="button"
    >
      {busy ? "Logging out..." : "Logout"}
    </button>
  );
}

type BillingActionButtonProps = {
  disabledReason?: string;
  label?: string;
  mode: "checkout" | "portal";
};

type BillingResponse = {
  message?: string;
  ok?: boolean;
  url?: string;
};

export function BillingActionButton({ disabledReason, label, mode }: BillingActionButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonLabel = label ?? (mode === "checkout" ? "Upgrade to Premium" : "Manage Subscription");

  async function handleBillingAction() {
    if (disabledReason) {
      setError(disabledReason);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await csrfFetch(`/api/stripe/${mode}`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as BillingResponse | null;
      if (!response.ok || !payload?.url) {
        setError(payload?.message ?? "Billing is temporarily unavailable.");
        return;
      }
      window.location.assign(payload.url);
    } catch {
      setError("Billing is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-500"
        disabled={busy || Boolean(disabledReason)}
        onClick={() => void handleBillingAction()}
        type="button"
      >
        {busy ? "Opening Stripe..." : buttonLabel}
      </button>
      {disabledReason ? <p className="mt-2 text-xs leading-5 text-amber-200">{disabledReason}</p> : null}
      {error ? <p className="mt-2 text-xs leading-5 text-rose-200">{error}</p> : null}
    </div>
  );
}

type VerificationResponse = {
  error?: string;
  message?: string;
  ok?: boolean;
};

export function SendVerificationEmailButton({ disabled = false }: { disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await csrfFetch("/api/auth/send-verification-email", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as VerificationResponse | null;
      if (!response.ok || !payload?.ok) {
        setError(payload?.error === "email_not_configured" ? "Email verification is not configured. Contact support." : payload?.message ?? "Unable to send verification email.");
        return;
      }
      setMessage(payload.message === "Email is already verified." ? payload.message : "Verification email sent. Check your inbox and spam/junk folder.");
    } catch {
      setError("Unable to send verification email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || busy}
        onClick={() => void handleSend()}
        type="button"
      >
        {busy ? "Sending..." : "Send verification email"}
      </button>
      <p className="mt-2 text-xs leading-5 text-slate-400">Didn&apos;t receive the email? Check your spam/junk folder.</p>
      {message ? <p className="mt-2 text-xs leading-5 text-emerald-200">{message}</p> : null}
      {error ? <p className="mt-2 text-xs leading-5 text-rose-200">{error}</p> : null}
    </div>
  );
}

export function LegalReviewButton() {
  return (
    <button
      className="rounded-full border border-amber-300/35 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-200/70 hover:bg-amber-400/15"
      onClick={() => window.dispatchEvent(new Event("ma:open-legal-acknowledgement"))}
      type="button"
    >
      Review and accept legal documents
    </button>
  );
}

type DeleteAccountResponse = {
  error?: string;
  message?: string;
  ok?: boolean;
};

export function DeleteAccountButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (confirmation !== "DELETE") return;
    setBusy(true);
    setError(null);
    try {
      const response = await csrfFetch("/api/account", { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as DeleteAccountResponse | null;
      if (!response.ok || !payload?.ok) {
        setError(payload?.error === "subscription_active" ? "Cancel your active subscription before deleting your account." : payload?.message ?? "Unable to delete account.");
        return;
      }
      router.push("/terminal");
      router.refresh();
    } catch {
      setError("Unable to delete account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        className="rounded-full border border-rose-300/35 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-200/70 hover:bg-rose-400/15"
        onClick={() => setOpen(true)}
        type="button"
      >
        Delete account
      </button>
      {open ? (
        <div className="mt-4 rounded-xl border border-rose-300/25 bg-rose-400/[0.08] p-4">
          <div className="text-sm font-semibold text-rose-100">Confirm account deletion</div>
          <p className="mt-2 text-xs leading-5 text-rose-100/75">Type DELETE to permanently delete your Market Alpha account data. Active subscriptions must be canceled first.</p>
          <input
            className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-rose-300/50"
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="DELETE"
            value={confirmation}
          />
          {error ? <p className="mt-2 text-xs text-rose-100">{error}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-full border border-rose-300/35 bg-rose-400/15 px-4 py-2 text-sm font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={confirmation !== "DELETE" || busy}
              onClick={() => void handleDelete()}
              type="button"
            >
              {busy ? "Deleting..." : "Confirm deletion"}
            </button>
            <button className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300" onClick={() => setOpen(false)} type="button">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
