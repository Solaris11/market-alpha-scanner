"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { csrfFetch } from "@/lib/client/csrf-fetch";

const STORAGE_KEY = "ma_risk_acknowledged_v1";

type LegalStatus = {
  allAccepted: boolean;
  privacyAccepted: boolean;
  riskAccepted: boolean;
  termsAccepted: boolean;
};

type LegalStatusResponse = LegalStatus & {
  authenticated?: boolean;
  ok?: boolean;
};

const EMPTY_STATUS: LegalStatus = {
  allAccepted: false,
  privacyAccepted: false,
  riskAccepted: false,
  termsAccepted: false,
};

export function RiskAcknowledgement() {
  const router = useRouter();
  const { authenticated, loading, refresh, user } = useCurrentUser();
  const [visible, setVisible] = useState(false);
  const [anonymousChecked, setAnonymousChecked] = useState(false);
  const [checks, setChecks] = useState({ privacy: false, risk: false, terms: false });
  const [legalStatus, setLegalStatus] = useState<LegalStatus>(EMPTY_STATUS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading || authenticated) return;
    setVisible(window.localStorage.getItem(STORAGE_KEY) !== "true");
  }, [authenticated, loading]);

  useEffect(() => {
    if (loading || !authenticated || !user) return;
    let cancelled = false;
    async function loadLegalStatus() {
      setError("");
      const response = await fetch("/api/legal/status", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as LegalStatusResponse | null;
      if (cancelled) return;
      const nextStatus = payload?.ok ? payload : EMPTY_STATUS;
      setLegalStatus(nextStatus);
      setChecks({
        privacy: Boolean(nextStatus.privacyAccepted),
        risk: Boolean(nextStatus.riskAccepted),
        terms: Boolean(nextStatus.termsAccepted),
      });
      setVisible(!nextStatus.allAccepted);
    }
    void loadLegalStatus().catch(() => {
      if (!cancelled) {
        setLegalStatus(EMPTY_STATUS);
        setVisible(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authenticated, loading, user]);

  useEffect(() => {
    function openLegalAcknowledgement() {
      setVisible(true);
    }
    window.addEventListener("ma:open-legal-acknowledgement", openLegalAcknowledgement);
    return () => window.removeEventListener("ma:open-legal-acknowledgement", openLegalAcknowledgement);
  }, []);

  if (!visible) return null;
  const accountMode = authenticated && Boolean(user);
  const canContinue = accountMode ? checks.terms && checks.privacy && checks.risk : anonymousChecked;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm md:items-center">
      <div className="w-full max-w-xl rounded-2xl border border-amber-300/30 bg-slate-950 p-5 shadow-2xl shadow-black/60">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-200">Risk Acknowledgement</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Research software only</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Market Alpha Scanner does not provide financial advice, broker execution, or guaranteed outcomes. You can lose money. Use it for research and paper simulation, and make your own decisions.
        </p>
        {accountMode ? (
          <div className="mt-4 space-y-2">
            <LegalCheckbox checked={checks.terms} label="I accept the Terms of Service" onChange={(value) => setChecks((current) => ({ ...current, terms: value }))} />
            <LegalCheckbox checked={checks.privacy} label="I accept the Privacy Policy" onChange={(value) => setChecks((current) => ({ ...current, privacy: value }))} />
            <LegalCheckbox checked={checks.risk} label="I understand this is not financial advice and I can lose money" onChange={(value) => setChecks((current) => ({ ...current, risk: value }))} />
          </div>
        ) : (
          <LegalCheckbox checked={anonymousChecked} label="I understand this is not financial advice" onChange={setAnonymousChecked} />
        )}
        {error ? <div className="mt-3 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">{error}</div> : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <Link className="hover:text-cyan-200" href="/terms">Terms</Link>
            <Link className="hover:text-cyan-200" href="/privacy">Privacy</Link>
            <Link className="hover:text-cyan-200" href="/risk-disclosure">Risk Disclosure</Link>
          </div>
          <button
            className="rounded-full bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canContinue || busy}
            onClick={async () => {
              if (!accountMode) {
                window.localStorage.setItem(STORAGE_KEY, "true");
                setVisible(false);
                return;
              }
              setBusy(true);
              setError("");
              try {
                await Promise.all((["terms", "privacy", "risk"] as const).map((type) => (documentAccepted(legalStatus, type) ? Promise.resolve() : acceptDocument(type))));
                await refresh();
                router.refresh();
                setVisible(false);
              } catch {
                setError("Unable to save legal acceptance. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
            type="button"
          >
            {busy ? "Saving..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

async function acceptDocument(type: "terms" | "privacy" | "risk"): Promise<void> {
  const response = await csrfFetch("/api/legal/accept", {
    body: JSON.stringify({ type }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("Legal acceptance failed.");
}

function documentAccepted(status: LegalStatus, type: "terms" | "privacy" | "risk"): boolean {
  if (type === "terms") return status.termsAccepted;
  if (type === "privacy") return status.privacyAccepted;
  return status.riskAccepted;
}

function LegalCheckbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm font-semibold text-slate-100">
      <input checked={checked} className="mt-1 accent-amber-300" onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}
