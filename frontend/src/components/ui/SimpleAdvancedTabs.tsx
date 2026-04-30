"use client";

import { useState, type ReactNode } from "react";

type Mode = "simple" | "advanced";

export function SimpleAdvancedTabs({
  advanced,
  advancedLabel = "Advanced",
  simple,
  simpleLabel = "Simple",
}: {
  advanced: ReactNode;
  advancedLabel?: string;
  simple: ReactNode;
  simpleLabel?: string;
}) {
  const [mode, setMode] = useState<Mode>("simple");

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-full border border-white/10 bg-slate-950/60 p-1 text-xs font-semibold shadow-xl shadow-black/20">
        <TabButton active={mode === "simple"} label={simpleLabel} onClick={() => setMode("simple")} />
        <TabButton active={mode === "advanced"} label={advancedLabel} onClick={() => setMode("advanced")} />
      </div>
      {mode === "simple" ? simple : advanced}
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`rounded-full px-4 py-1.5 transition ${
        active ? "bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.22)]" : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
