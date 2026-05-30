"use client";

import Link from "next/link";
import { useState } from "react";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import type { TeamOpportunityPriority, TeamWorkspaceMetric, TeamWorkspaceSystem } from "@/lib/trading/team-intelligence";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";

type TeamApiResponse = {
  message?: string;
  ok?: boolean;
  system?: TeamWorkspaceSystem;
};

export function TeamIntelligenceWorkspace({ initialSystem }: { initialSystem: TeamWorkspaceSystem }) {
  const [system, setSystem] = useState(initialSystem);
  const [symbolInput, setSymbolInput] = useState("");
  const [noteSymbol, setNoteSymbol] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const canEdit = system.roleCapabilities.canEditResearch;
  const canManageWatchlist = system.roleCapabilities.canManageWatchlist;

  async function applyMutation(endpoint: string, body: Record<string, unknown>, method = "POST") {
    setPending(true);
    setStatus(null);
    try {
      const response = await csrfFetch(endpoint, {
        body: method === "DELETE" ? undefined : JSON.stringify(body),
        headers: method === "DELETE" ? undefined : { "Content-Type": "application/json" },
        method,
      });
      const payload = (await response.json().catch(() => null)) as TeamApiResponse | null;
      if (!response.ok || !payload?.system) throw new Error(payload?.message ?? "Team workspace update failed.");
      setSystem(payload.system);
      setStatus(payload.message ?? "Team workspace updated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Team workspace update failed.");
    } finally {
      setPending(false);
    }
  }

  async function addSymbols() {
    if (!symbolInput.trim()) return;
    await applyMutation("/api/team/watchlist", { symbols: symbolInput.split(/[,\s]+/).filter(Boolean), workspaceId: system.workspace.id });
    setSymbolInput("");
  }

  async function removeSymbol(symbol: string) {
    await applyMutation(`/api/team/watchlist/${encodeURIComponent(symbol)}?workspaceId=${encodeURIComponent(system.workspace.id)}`, {}, "DELETE");
  }

  async function createNote() {
    if (!noteTitle.trim() || !noteBody.trim()) return;
    await applyMutation("/api/team/research-notes", {
      body: noteBody,
      symbol: noteSymbol,
      title: noteTitle,
      workspaceId: system.workspace.id,
    });
    setNoteTitle("");
    setNoteBody("");
    setNoteSymbol("");
  }

  return (
    <div className="space-y-5">
      <GlassPanel className="overflow-hidden border-cyan-300/15 bg-cyan-400/[0.02] p-5 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300">Enterprise Intelligence</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">{system.workspace.name}</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
              Shared watchlists, collaborative research notes, role-aware controls, and audit trails for team-level TradeVeto intelligence.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <HeaderMetric label="Role" value={system.roleCapabilities.label} />
            <HeaderMetric label="Workspace Score" value={String(system.workspaceHealthScore)} />
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {system.metrics.map((metric) => <MetricCard key={metric.key} metric={metric} />)}
        </div>
      </GlassPanel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Team Briefing" title="What the Desk Should Review" meta="shared context" />
          <div className="mt-4 grid gap-3">
            {system.teamBriefing.map((line) => (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300" key={line}>
                {line}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Team briefings are derived from shared symbols, latest scanner context, research notes, and audit activity. They do not create trade instructions.</p>
        </GlassPanel>

        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Roles" title="Workspace Permissions" meta={system.roleCapabilities.label} />
          <div className="mt-4 grid gap-2">
            {[
              { enabled: system.roleCapabilities.canView, label: "View shared intelligence" },
              { enabled: system.roleCapabilities.canManageWatchlist, label: "Manage shared watchlist" },
              { enabled: system.roleCapabilities.canEditResearch, label: "Add research notes" },
              { enabled: system.roleCapabilities.canInvite, label: "Invite and administer members" },
              { enabled: system.roleCapabilities.canAdmin, label: "Admin workspace" },
            ].map(({ enabled, label }) => (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm" key={label}>
                <span className="text-slate-300">{label}</span>
                <span className={`text-xs font-black uppercase tracking-[0.14em] ${enabled ? "text-emerald-300" : "text-slate-600"}`}>{enabled ? "Enabled" : "Restricted"}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Shared Watchlist" title="Desk Coverage" meta={`${system.sharedWatchlist.length} symbols`} />
          <div className="mt-4 flex flex-wrap gap-2">
            {system.sharedWatchlist.length ? system.sharedWatchlist.map((item) => (
              <div className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-slate-100" key={item.symbol}>
                <Link href={`/symbol/${encodeURIComponent(item.symbol)}`}>{item.symbol}</Link>
                {canManageWatchlist ? (
                  <button className="rounded-full px-1 text-slate-500 transition hover:text-rose-200" disabled={pending} onClick={() => void removeSymbol(item.symbol)} type="button">
                    x
                  </button>
                ) : null}
              </div>
            )) : (
              <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">No shared symbols yet. Add a symbol to make the team dashboard watchlist-specific.</p>
            )}
          </div>
          {canManageWatchlist ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                className="min-h-11 min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/65 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/45"
                disabled={pending}
                onChange={(event) => setSymbolInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void addSymbols();
                }}
                placeholder="AMD, MU, NVDA..."
                value={symbolInput}
              />
              <button className="min-h-11 rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-50" disabled={pending || !symbolInput.trim()} onClick={() => void addSymbols()} type="button">
                Add Symbols
              </button>
            </div>
          ) : null}
          {status ? <p className="mt-3 text-xs leading-5 text-slate-500">{status}</p> : null}
        </GlassPanel>

        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Team Opportunity Board" title="Highest Attention Symbols" meta={`${system.topSharedOpportunities.length} ranked`} />
          <div className="mt-4 grid gap-3">
            {system.topSharedOpportunities.length ? system.topSharedOpportunities.map((item) => <OpportunityCard item={item} key={item.symbol} />) : (
              <p className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-400">No team opportunities are visible yet. Add shared symbols or wait for the next scanner update.</p>
            )}
          </div>
        </GlassPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Collaborative Research" title="Team Notes" meta={`${system.researchNotes.length} recent`} />
          {canEdit ? (
            <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                <input className="min-h-11 rounded-xl border border-white/10 bg-slate-950/65 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/45" disabled={pending} onChange={(event) => setNoteSymbol(event.target.value)} placeholder="Symbol" value={noteSymbol} />
                <input className="min-h-11 rounded-xl border border-white/10 bg-slate-950/65 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/45" disabled={pending} onChange={(event) => setNoteTitle(event.target.value)} placeholder="Research title" value={noteTitle} />
              </div>
              <textarea className="min-h-28 rounded-xl border border-white/10 bg-slate-950/65 p-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/45" disabled={pending} onChange={(event) => setNoteBody(event.target.value)} placeholder="What should the team know? Keep it evidence-based." value={noteBody} />
              <div className="flex justify-end">
                <button className="min-h-11 rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-50" disabled={pending || !noteTitle.trim() || !noteBody.trim()} onClick={() => void createNote()} type="button">
                  Save Note
                </button>
              </div>
            </div>
          ) : null}
          <div className="mt-4 grid gap-3">
            {system.researchNotes.length ? system.researchNotes.map((note) => (
              <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4" key={note.id}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-black text-slate-50">{note.title}</h3>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{note.symbol ?? "General"} · {shortDate(note.createdAt)}</div>
                </div>
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-400">{note.body}</p>
              </article>
            )) : (
              <p className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-400">No team research notes yet.</p>
            )}
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <SectionTitle eyebrow="Audit Trail" title="Recent Workspace Activity" meta={`${system.auditTrail.length} events`} />
          <div className="mt-4 space-y-2">
            {system.auditTrail.length ? system.auditTrail.slice(0, 10).map((event) => (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={event.id}>
                <div className="text-sm font-bold text-slate-100">{event.action.replaceAll("_", " ")}</div>
                <div className="mt-1 text-xs text-slate-500">{event.targetType} · {event.targetId ?? "workspace"} · {shortDate(event.createdAt)}</div>
              </div>
            )) : (
              <p className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-400">No audit events recorded yet. Watchlist and research note changes will appear here.</p>
            )}
          </div>
        </GlassPanel>
      </div>

      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Trust Boundary" title="Team Intelligence Limits" meta="research only" />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {system.limitations.map((item) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs leading-5 text-slate-400" key={item}>{item}</div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="break-words text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500">{label}</div>
      <div className="mt-1 truncate font-mono text-lg font-black text-slate-50">{value}</div>
    </div>
  );
}

function MetricCard({ metric }: { metric: TeamWorkspaceMetric }) {
  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${metricToneClass(metric.tone)}`}>
      <div className="text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500">{metric.label}</div>
      <div className="mt-2 font-mono text-2xl font-black text-slate-50">{metric.value}</div>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{metric.detail}</p>
    </div>
  );
}

function OpportunityCard({ item }: { item: TeamOpportunityPriority }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link className="text-lg font-black text-slate-50 transition hover:text-cyan-200" href={`/symbol/${encodeURIComponent(item.symbol)}`}>{item.symbol}</Link>
            {item.companyName ? <span className="truncate text-sm text-slate-500">{item.companyName}</span> : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{item.keyReason}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{item.entryContext}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.tags.map((tag) => <span className="rounded-full border border-cyan-300/15 bg-cyan-400/[0.06] px-2.5 py-1 text-[11px] font-bold text-cyan-100" key={tag}>{tag}</span>)}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
          <MiniScore label="Attention" value={item.attentionScore} />
          <MiniScore label="Opportunity" value={item.opportunityScore} />
          <MiniScore inverse label="Risk" value={item.riskScore} />
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-400/[0.04] p-3 text-xs leading-5 text-amber-100/80">{item.keyRisk}</div>
    </article>
  );
}

function MiniScore({ inverse = false, label, value }: { inverse?: boolean; label: string; value: number }) {
  const constructive = inverse ? value <= 45 : value >= 62;
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/45 p-3">
      <div className="break-words text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-lg font-black ${constructive ? "text-emerald-200" : "text-slate-50"}`}>{value}</div>
    </div>
  );
}

function metricToneClass(tone: TeamWorkspaceMetric["tone"]): string {
  if (tone === "constructive") return "border-emerald-300/15 bg-emerald-400/[0.035]";
  if (tone === "risk") return "border-amber-300/15 bg-amber-400/[0.035]";
  return "border-white/10 bg-white/[0.035]";
}

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
