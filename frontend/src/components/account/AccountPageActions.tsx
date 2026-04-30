"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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
