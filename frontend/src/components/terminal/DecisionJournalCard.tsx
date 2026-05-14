"use client";

import { useMemo, useState } from "react";
import { trackAnalyticsEvent } from "@/lib/client/analytics";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import {
  buildDecisionMemorySummary,
  buildPersonalizedDecisionCoaching,
  DECISION_JOURNAL_ACTIONS,
  decisionJournalActionLabel,
  snapshotFromRow,
  type DecisionJournalAction,
  type DecisionJournalEntry,
  type DecisionMemorySummary,
  type PersonalizedDecisionCoaching,
} from "@/lib/trading/decision-journal";
import type { UserPersonalizationProfile } from "@/lib/trading/personalized-intelligence";
import type { RankingRow } from "@/lib/types";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

type JournalResponse = {
  entries?: DecisionJournalEntry[];
  entry?: DecisionJournalEntry;
  memory?: DecisionMemorySummary;
  message?: string;
  ok?: boolean;
};

const PRIMARY_JOURNAL_ACTIONS: DecisionJournalAction[] = [
  "watch",
  "wait",
  "enter",
  "exit",
  "avoid",
  "missed_opportunity",
  "shock_watch",
  "pullback_watch",
];

export function DecisionJournalCard({
  entries,
  memory,
  coaching,
  profile,
  row,
}: {
  coaching: PersonalizedDecisionCoaching;
  entries: DecisionJournalEntry[];
  memory: DecisionMemorySummary;
  profile: UserPersonalizationProfile | null;
  row: RankingRow;
}) {
  const [journalEntries, setJournalEntries] = useState(entries);
  const [decisionMemory, setDecisionMemory] = useState(memory);
  const [action, setAction] = useState<DecisionJournalAction>(() => defaultAction(row));
  const [reason, setReason] = useState("");
  const [thesis, setThesis] = useState("");
  const [concerns, setConcerns] = useState("");
  const [invalidationReasoning, setInvalidationReasoning] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const currentCoaching = useMemo(
    () => buildPersonalizedDecisionCoaching({ entries: journalEntries, memory: decisionMemory, profile, row }),
    [decisionMemory, journalEntries, profile, row],
  );
  const visibleCoaching = journalEntries === entries ? coaching : currentCoaching;
  const recentEntries = journalEntries.filter((entry) => entry.symbol === row.symbol.toUpperCase()).slice(0, 4);

  async function saveEntry(): Promise<void> {
    setSaving(true);
    setStatus(null);
    try {
      const response = await csrfFetch("/api/user/decision-journal", {
        body: JSON.stringify({
          concerns,
          convictionScore: row.conviction_score ?? row.final_score ?? null,
          deterministicSnapshot: snapshotFromRow(row, profile),
          finalDecision: row.final_decision ?? null,
          fragilityScore: row.fragility_score ?? row.risk_score ?? row.event_risk_score ?? null,
          invalidationReasoning,
          macroRegime: row.macro_context_label ?? row.market_regime ?? null,
          personalityProfile: profile?.personality ?? null,
          reason,
          riskRewardProfile: `${profile?.preferredRiskLevel ?? "default"} risk / ${profile?.preferredRewardLevel ?? "default"} reward`,
          setupType: row.setup_type ?? null,
          shockState: row["shock_opportunity_type"] ?? row["shock_state"] ?? null,
          symbol: row.symbol,
          thesis,
          userAction: action,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as JournalResponse | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.message ?? "Decision journal could not be saved.");
      const nextEntries = payload.entries ?? (payload.entry ? [payload.entry, ...journalEntries] : journalEntries);
      const nextMemory = payload.memory ?? buildDecisionMemorySummary(nextEntries, { symbol: row.symbol });
      setJournalEntries(nextEntries);
      setDecisionMemory(nextMemory);
      setReason("");
      setThesis("");
      setConcerns("");
      setInvalidationReasoning("");
      setStatus("Decision saved. Outcome tracking starts as pending evidence.");
      trackAnalyticsEvent("decision_journal_save", { action, symbol: row.symbol }, { source: "decision_journal", symbol: row.symbol });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Decision journal could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function clearMemory(): Promise<void> {
    if (typeof window !== "undefined" && !window.confirm("Clear all decision journal memory for this account?")) return;
    setClearing(true);
    setStatus(null);
    try {
      const response = await csrfFetch("/api/user/decision-journal", {
        body: JSON.stringify({ confirm: "CLEAR DECISION MEMORY" }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as JournalResponse | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.message ?? "Decision memory could not be cleared.");
      const emptyMemory = payload.memory ?? buildDecisionMemorySummary([]);
      setJournalEntries([]);
      setDecisionMemory(emptyMemory);
      setStatus("Decision memory cleared for your account.");
      trackAnalyticsEvent("decision_memory_clear", { symbol: row.symbol }, { source: "decision_journal", symbol: row.symbol });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Decision memory could not be cleared.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <GlassPanel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle eyebrow="Decision Journal" title="User Memory" meta={visibleCoaching.fitLabel} />
        <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">
          Private memory
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Metric label="Journal entries" value={decisionMemory.journalCount.toLocaleString()} />
        <Metric label={`${row.symbol.toUpperCase()} memory`} value={decisionMemory.symbolEntryCount.toLocaleString()} />
        <Metric label="Pending outcomes" value={decisionMemory.outcomePendingCount.toLocaleString()} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Personalized coaching</div>
          <p className="mt-2 text-xs leading-5 text-slate-300">{visibleCoaching.strengthReason}</p>
          <p className="mt-2 text-xs leading-5 text-amber-100">{visibleCoaching.warningReason}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Behavior memory</div>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
            {decisionMemory.behaviorFlags.slice(0, 3).map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <MemoryList title="Strength signals" items={decisionMemory.strengths} />
        <MemoryList title="Caution signals" items={decisionMemory.weaknesses} warning />
      </div>

      <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.055] p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Save this decision before the outcome is known</div>
        <JournalActionPicker action={action} onChange={setAction} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextInput label="Reason" onChange={setReason} placeholder="Why this decision makes sense now" value={reason} />
          <TextInput label="Thesis" onChange={setThesis} placeholder="What would need to go right" value={thesis} />
          <TextInput label="Concern" onChange={setConcerns} placeholder="What could weaken the setup" value={concerns} />
        </div>
        <label className="mt-3 block text-xs font-semibold text-slate-300">
          Invalidation reasoning
          <textarea
            className="mt-1 min-h-20 w-full resize-y rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
            onChange={(event) => setInvalidationReasoning(event.target.value)}
            placeholder="What would make this decision wrong or lower quality?"
            value={invalidationReasoning}
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving}
            onClick={() => void saveEntry()}
            type="button"
          >
            {saving ? "Saving..." : "Save decision"}
          </button>
          <p className="text-xs leading-5 text-slate-500">Research memory only. This does not place trades or override the core decision.</p>
        </div>
      </div>

      {recentEntries.length ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Recent {row.symbol.toUpperCase()} decisions</div>
          <div className="mt-2 space-y-2">
            {recentEntries.map((entry) => (
              <div className="rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2" key={entry.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-100">{decisionJournalActionLabel(entry.userAction)}</span>
                  <span className="text-[11px] text-slate-500">{formatDate(entry.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">{entry.reason ?? entry.thesis ?? "No note saved."}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
        <div className="max-w-2xl">
          <p className="text-xs leading-5 text-slate-500">{decisionMemory.privacyNote}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">Stored fields are limited to journal action, optional notes, setup context, risk scores, and a compact signal snapshot. Export and broader memory controls are available from Account settings.</p>
        </div>
        <button
          className="rounded-full border border-rose-300/30 bg-rose-400/10 px-4 py-2 text-xs font-semibold text-rose-100 transition hover:border-rose-200/70 hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={clearing || !journalEntries.length}
          onClick={() => void clearMemory()}
          type="button"
        >
          {clearing ? "Clearing..." : "Clear memory"}
        </button>
      </div>
      {status ? <p className="mt-3 text-xs leading-5 text-slate-400">{status}</p> : null}
    </GlassPanel>
  );
}

function JournalActionPicker({ action, onChange }: { action: DecisionJournalAction; onChange: (value: DecisionJournalAction) => void }) {
  return (
    <div className="mt-3">
      <div className="text-xs font-semibold text-slate-300">Decision action</div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PRIMARY_JOURNAL_ACTIONS.map((item) => {
          const active = item === action;
          return (
            <button
              className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-semibold transition ${active ? "border-cyan-200/70 bg-cyan-400/15 text-cyan-50" : "border-white/10 bg-slate-950/45 text-slate-300 hover:border-cyan-300/35 hover:bg-white/[0.05]"}`}
              key={item}
              onClick={() => onChange(item)}
              type="button"
            >
              {decisionJournalActionLabel(item)}
            </button>
          );
        })}
      </div>
      <label className="mt-3 block text-xs font-semibold text-slate-300">
        Advanced action
        <select
          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/50"
          onChange={(event) => onChange(event.target.value as DecisionJournalAction)}
          value={action}
        >
          {DECISION_JOURNAL_ACTIONS.map((item) => <option key={item} value={item}>{decisionJournalActionLabel(item)}</option>)}
        </select>
      </label>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="min-w-0 truncate text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-50">{value}</div>
    </div>
  );
}

function MemoryList({ items, title, warning = false }: { items: string[]; title: string; warning?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${warning ? "border-amber-300/20 bg-amber-400/[0.055]" : "border-white/10 bg-white/[0.035]"}`}>
      <div className={`min-w-0 truncate text-[10px] font-black uppercase leading-4 tracking-normal ${warning ? "text-amber-200" : "text-slate-500"}`} title={title}>{title}</div>
      <ul className={`mt-2 space-y-1 text-xs leading-5 ${warning ? "text-amber-100" : "text-slate-300"}`}>
        {items.slice(0, 3).map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}

function TextInput({ label, onChange, placeholder, value }: { label: string; onChange: (value: string) => void; placeholder: string; value: string }) {
  return (
    <label className="text-xs font-semibold text-slate-300">
      {label}
      <input
        className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function defaultAction(row: RankingRow): DecisionJournalAction {
  const decision = String(row.final_decision ?? "").toUpperCase();
  if (decision.includes("AVOID")) return "avoid";
  if (decision.includes("PULLBACK")) return "pullback_watch";
  if (decision.includes("WAIT")) return "wait";
  if (decision.includes("WATCH")) return "watch";
  if (decision.includes("ENTER")) return "enter";
  return "watch";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleString("en-US", { day: "numeric", hour: "numeric", minute: "2-digit", month: "short" });
}
