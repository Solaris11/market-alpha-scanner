"use client";

import { useState } from "react";
import { csrfFetch } from "@/lib/client/csrf-fetch";

export function AdminRoleButton({ currentRole, targetUserId }: { currentRole: string; targetUserId: string }) {
  const [busy, setBusy] = useState(false);
  const makeAdmin = currentRole !== "admin";
  const nextRole = makeAdmin ? "admin" : "user";
  const label = makeAdmin ? "Promote admin" : "Demote admin";
  const confirmText = makeAdmin ? "PROMOTE ADMIN" : "DEMOTE ADMIN";

  async function submit() {
    const confirmed = window.prompt(`Type ${confirmText} to continue.`);
    if (confirmed !== confirmText) return;
    setBusy(true);
    try {
      const response = await csrfFetch(`/api/admin/users/${targetUserId}/role`, {
        body: JSON.stringify({ confirm: confirmText, role: nextRole }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Unable to update role.");
      }
      window.location.reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to update role.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={busy}
      onClick={submit}
      type="button"
    >
      {busy ? "Updating..." : label}
    </button>
  );
}

export function DisableAlertRuleButton({ ruleId }: { ruleId: string }) {
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!window.confirm("Disable this alert rule?")) return;
    setBusy(true);
    try {
      const response = await csrfFetch(`/api/admin/alerts/rules/${ruleId}/disable`, { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Unable to disable alert rule.");
      }
      window.location.reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to disable alert rule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:border-amber-200/60 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={busy}
      onClick={submit}
      type="button"
    >
      {busy ? "Disabling..." : "Disable"}
    </button>
  );
}
