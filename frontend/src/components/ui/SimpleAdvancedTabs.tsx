"use client";

import { useId, useState, type ReactNode } from "react";

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
  const id = useId();
  const [mode, setMode] = useState<Mode>("simple");
  const simplePanelId = `${id}-simple-panel`;
  const advancedPanelId = `${id}-advanced-panel`;

  return (
    <div className="space-y-3">
      <div className="inline-flex border-b border-white/10 text-xs font-semibold" role="tablist">
        <TabButton active={mode === "simple"} label={simpleLabel} onClick={() => setMode("simple")} panelId={simplePanelId} tabId={`${id}-simple-tab`} />
        <TabButton active={mode === "advanced"} label={advancedLabel} onClick={() => setMode("advanced")} panelId={advancedPanelId} tabId={`${id}-advanced-tab`} />
      </div>
      <div aria-labelledby={mode === "simple" ? `${id}-simple-tab` : `${id}-advanced-tab`} id={mode === "simple" ? simplePanelId : advancedPanelId} role="tabpanel">
        {mode === "simple" ? simple : advanced}
      </div>
    </div>
  );
}

function TabButton({ active, label, onClick, panelId, tabId }: { active: boolean; label: string; onClick: () => void; panelId: string; tabId: string }) {
  return (
    <button
      aria-controls={panelId}
      aria-selected={active}
      className={`inline-flex min-h-9 items-center border-b-2 px-3 py-2 transition-colors ${active ? "border-cyan-300 text-cyan-100" : "border-transparent text-slate-400 hover:border-white/25 hover:text-slate-100"}`}
      id={tabId}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {label}
    </button>
  );
}
