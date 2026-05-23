"use client";

import { useState, type FormEvent } from "react";
import { trackAnalyticsEvent } from "@/lib/client/analytics";

export function EarlyAccessWaitlistForm() {
  const [email, setEmail] = useState("");
  const [focus, setFocus] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setStatus("Email is required.");
      return;
    }
    setBusy(true);
    setStatus("Sending...");
    trackAnalyticsEvent("founding_member_interest", { sourceCta: "waitlist_submit_start" }, { source: "early_access_waitlist" });
    try {
      const response = await fetch("/api/support/contact", {
        body: JSON.stringify({
          category: "feedback",
          email: normalizedEmail,
          message: `Founding member early-access waitlist interest. Intended workflow: ${focus.trim() || "Not specified"}.`,
          subject: "Founding member waitlist",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("Unable to join waitlist.");
      trackAnalyticsEvent("founding_member_interest", { sourceCta: "waitlist_submit_complete" }, { source: "early_access_waitlist" });
      setEmail("");
      setFocus("");
      setStatus("Waitlist request received.");
    } catch {
      setStatus("Unable to join waitlist right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        Email
        <input
          autoComplete="email"
          className="h-12 rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm text-slate-100 outline-none ring-1 ring-white/5 transition placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-cyan-300/20"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-200">
        What workflow do you want to use first?
        <textarea
          className="min-h-28 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-white/5 transition placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-cyan-300/20"
          maxLength={700}
          onChange={(event) => setFocus(event.target.value)}
          placeholder="Scanner, alerts, watchlist, replay, paper trading, or another research workflow."
          value={focus}
        />
      </label>
      <button className="inline-flex min-h-12 w-fit items-center justify-center rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.18)] transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60" disabled={busy} type="submit">
        {busy ? "Sending..." : "Join waitlist"}
      </button>
      {status ? <p className="text-sm leading-6 text-slate-400">{status}</p> : null}
      <p className="text-xs leading-5 text-slate-500">Do not include passwords, brokerage data, payment information, or private financial account details.</p>
    </form>
  );
}
