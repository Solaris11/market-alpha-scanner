"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { analyticsIdentityPayload, trackAnalyticsEvent } from "@/lib/client/analytics";

const PRODUCT_PATH_PREFIXES = ["/terminal", "/opportunities", "/performance", "/history", "/alerts", "/paper", "/support", "/account", "/admin", "/symbol", "/advanced"];
const FEEDBACK_TYPES = [
  { label: "Helpful", rating: "positive", value: "helpful" },
  { label: "Confusing Signal", rating: "negative", value: "confusing_signal" },
  { label: "Issue", rating: "negative", value: "issue" },
  { label: "Feature Request", rating: "neutral", value: "feature_request" },
] as const;

export function BetaFeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<(typeof FEEDBACK_TYPES)[number]["value"]>("helpful");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  if (!pathname || !PRODUCT_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;

  async function submit() {
    setStatus("Sending...");
    const identity = analyticsIdentityPayload();
    const type = FEEDBACK_TYPES.find((item) => item.value === feedbackType) ?? FEEDBACK_TYPES[0];
    try {
      const response = await fetch("/api/analytics/feedback", {
        body: JSON.stringify({
          ...identity,
          feedbackType,
          message,
          metadata: { deviceType: identity.deviceType },
          rating: type.rating,
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("Feedback could not be saved.");
      trackAnalyticsEvent("beta_feedback_submit", { feedbackType, rating: type.rating }, { source: "feedback_widget" });
      setMessage("");
      setStatus("Feedback received.");
      window.setTimeout(() => {
        setOpen(false);
        setStatus(null);
      }, 900);
    } catch {
      setStatus("Feedback could not be saved.");
    }
  }

  return (
    <div className="fixed bottom-20 right-3 z-[8200] sm:bottom-5">
      {open ? (
        <section className="w-[min(92vw,360px)] rounded-2xl border border-cyan-300/20 bg-slate-950/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Beta Feedback</div>
              <h2 className="mt-1 text-base font-semibold text-slate-50">Help sharpen TradeVeto</h2>
            </div>
            <button className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400 hover:text-slate-100" onClick={() => setOpen(false)} type="button">Close</button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {FEEDBACK_TYPES.map((item) => (
              <button
                className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${feedbackType === item.value ? "border-cyan-300/45 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/25"}`}
                key={item.value}
                onClick={() => setFeedbackType(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <textarea
            className="mt-3 min-h-24 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/45"
            maxLength={900}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Optional note. Do not include passwords, tokens, or private financial account details."
            value={message}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[11px] leading-5 text-slate-500">Privacy-conscious beta learning only.</p>
            <button className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-200" onClick={() => void submit()} type="button">Send</button>
          </div>
          {status ? <div className="mt-2 text-xs text-slate-400">{status}</div> : null}
        </section>
      ) : (
        <button
          className="rounded-full border border-cyan-300/25 bg-slate-950/90 px-4 py-2 text-xs font-bold text-cyan-100 shadow-xl shadow-black/35 backdrop-blur-xl transition hover:border-cyan-200/60 hover:bg-cyan-400/10"
          onClick={() => setOpen(true)}
          type="button"
        >
          Beta Feedback
        </button>
      )}
    </div>
  );
}
