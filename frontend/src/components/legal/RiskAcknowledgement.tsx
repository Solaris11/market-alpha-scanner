"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "ma_risk_acknowledged_v1";

export function RiskAcknowledgement() {
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(STORAGE_KEY) !== "true");
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm md:items-center">
      <div className="w-full max-w-xl rounded-2xl border border-amber-300/30 bg-slate-950 p-5 shadow-2xl shadow-black/60">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-200">Risk Acknowledgement</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Research software only</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Market Alpha Scanner does not provide financial advice, broker execution, or guaranteed outcomes. Use it for research and paper simulation, and make your own decisions.
        </p>
        <label className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm font-semibold text-slate-100">
          <input checked={checked} className="mt-1 accent-amber-300" onChange={(event) => setChecked(event.target.checked)} type="checkbox" />
          <span>I understand this is not financial advice</span>
        </label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <Link className="hover:text-cyan-200" href="/terms">Terms</Link>
            <Link className="hover:text-cyan-200" href="/privacy">Privacy</Link>
            <Link className="hover:text-cyan-200" href="/risk-disclosure">Risk Disclosure</Link>
          </div>
          <button
            className="rounded-full bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!checked}
            onClick={() => {
              window.localStorage.setItem(STORAGE_KEY, "true");
              setVisible(false);
            }}
            type="button"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
