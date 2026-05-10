import Link from "next/link";
import type {
  AutomatedResearchAgentsSystem,
  ResearchAgentAction,
  ResearchAgentFinding,
  ResearchAgentSeverity,
  ResearchAgentSummary,
} from "@/lib/trading/research-agents";
import { formatNumber } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function AutomatedResearchAgentsPanel({
  compact = false,
  system,
}: {
  compact?: boolean;
  system: AutomatedResearchAgentsSystem;
}) {
  const topAgents = system.agentSummaries
    .filter((agent) => agent.status !== "quiet")
    .slice(0, compact ? 4 : 7);
  return (
    <GlassPanel className={`${compact ? "p-4" : "p-5"} border-violet-300/15 bg-violet-400/[0.045]`}>
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SectionTitle eyebrow="Automated Research Agents" title="Continuous Intelligence Monitoring" meta={statusLabel(system.status)} />
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass(system.status)}`}>
              {statusLabel(system.status)}
            </span>
          </div>
          <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-300">{system.summary}</p>
          <p className="mt-1 max-w-5xl text-xs leading-5 text-slate-500">{system.safetyBoundary}</p>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 2xl:min-w-[520px]">
          <Metric label="Agents" value={system.agentSummaries.filter((agent) => agent.status === "active").length} />
          <Metric inverse label="Risk" value={system.riskEscalations.length} />
          <Metric label="Opps" value={system.opportunityCandidates.length} />
          <Metric label="Watch" value={system.watchlistUpdates.length} />
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_340px]" : "xl:grid-cols-3"}`}>
        <ActionStack
          empty="No urgent risk escalation is confirmed."
          items={system.riskEscalations.slice(0, compact ? 4 : 6)}
          title="Risk Escalations"
          tone="risk"
        />
        <ActionStack
          empty="No high-priority opportunity candidate is confirmed."
          items={system.opportunityCandidates.slice(0, compact ? 4 : 6)}
          title="Opportunity Queue"
          tone="opportunity"
        />
        <ActionStack
          empty="No new watchlist suggestion in this packet."
          items={system.watchlistUpdates.slice(0, compact ? 4 : 6)}
          title="Watchlist Suggestions"
          tone="watch"
        />
      </div>

      <div className={`mt-3 grid gap-3 ${compact ? "lg:grid-cols-2 2xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-4"}`}>
        {(topAgents.length ? topAgents : system.agentSummaries.slice(0, 4)).map((agent) => <AgentCard agent={agent} key={agent.agentId} />)}
      </div>

      {!compact ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <FindingStack findings={system.eventSummaries.slice(0, 5)} title="Event Monitoring" />
          <FindingStack findings={system.narrativeShifts.slice(0, 5)} title="Narrative and Sector Drift" />
        </div>
      ) : null}
    </GlassPanel>
  );
}

function AgentCard({ agent }: { agent: ResearchAgentSummary }) {
  const finding = agent.keyFindings[0];
  return (
    <div className={`min-w-0 rounded-xl border p-3 ${severityClass(agent.severity)}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500" title={agent.label}>{agent.label}</div>
          <div className="mt-1 text-sm font-bold text-slate-100">{agent.status === "active" ? "Active" : agent.status === "watching" ? "Watching" : "Quiet"}</div>
        </div>
        <div className="shrink-0 font-mono text-sm font-black text-slate-200">{formatNumber(agent.confidenceScore, 0)}</div>
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{finding?.detail ?? agent.summary}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {agent.sourceIds.slice(0, 3).map((source) => (
          <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold text-slate-500" key={source}>{source}</span>
        ))}
      </div>
    </div>
  );
}

function ActionStack({
  empty,
  items,
  title,
  tone,
}: {
  empty: string;
  items: ResearchAgentAction[];
  title: string;
  tone: "opportunity" | "risk" | "watch";
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
      <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${toneColor(tone)}`}>{title}</div>
      <div className="mt-3 grid gap-2">
        {items.length ? items.map((item) => <ActionCard item={item} key={`${item.actionType}-${item.symbol ?? item.label}-${item.priorityScore}`} tone={tone} />) : (
          <p className="text-sm leading-6 text-slate-400">{empty}</p>
        )}
      </div>
    </div>
  );
}

function ActionCard({ item, tone }: { item: ResearchAgentAction; tone: "opportunity" | "risk" | "watch" }) {
  const body = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-100" title={item.label}>{item.label}</div>
          {item.symbol ? <div className="mt-1 font-mono text-xs font-black text-cyan-100">{item.symbol}</div> : null}
        </div>
        <div className="shrink-0 font-mono text-xs font-black text-slate-300">{formatNumber(item.priorityScore, 0)}</div>
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{item.detail}</p>
      <CodeList codes={item.reasonCodes} />
    </>
  );
  const className = `min-w-0 rounded-xl border p-3 transition ${toneCardClass(tone)} ${item.symbol ? "hover:border-cyan-300/35" : ""}`;
  if (!item.symbol) return <div className={className}>{body}</div>;
  return (
    <Link className={className} href={`/symbol/${item.symbol}`}>
      {body}
    </Link>
  );
}

function FindingStack({ findings, title }: { findings: ResearchAgentFinding[]; title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">{title}</div>
      <div className="mt-3 space-y-2">
        {findings.length ? findings.map((finding) => (
          <div className={`rounded-xl border p-3 ${severityClass(finding.severity)}`} key={`${finding.title}-${finding.symbol ?? ""}`}>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-100" title={finding.title}>{finding.title}</div>
                {finding.symbol ? <div className="mt-1 font-mono text-xs text-cyan-100">{finding.symbol}</div> : null}
              </div>
              <div className="shrink-0 font-mono text-xs font-black text-slate-300">{formatNumber(finding.score, 0)}</div>
            </div>
            <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-400">{finding.detail}</p>
            <CodeList codes={finding.reasonCodes} />
          </div>
        )) : <p className="text-sm leading-6 text-slate-400">No confirmed change in this packet.</p>}
      </div>
    </div>
  );
}

function Metric({ inverse = false, label, value }: { inverse?: boolean; label: string; value: number }) {
  const good = inverse ? value === 0 : value > 0;
  const risk = inverse ? value >= 3 : false;
  const color = good ? "text-emerald-200" : risk ? "text-rose-200" : "text-slate-200";
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="truncate text-[9px] font-black uppercase leading-3 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className={`mt-1 font-mono text-lg font-black ${color}`}>{formatNumber(value, 0)}</div>
    </div>
  );
}

function CodeList({ codes }: { codes: string[] }) {
  if (!codes.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {codes.slice(0, 4).map((code) => <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold text-slate-500" key={code}>{code}</span>)}
    </div>
  );
}

function statusLabel(status: AutomatedResearchAgentsSystem["status"]): string {
  if (status === "active") return "Active";
  if (status === "limited") return "Limited";
  return "Quiet";
}

function statusClass(status: AutomatedResearchAgentsSystem["status"]): string {
  if (status === "active") return "border-emerald-300/30 bg-emerald-400/10 text-emerald-100";
  if (status === "limited") return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  return "border-white/10 bg-white/[0.04] text-slate-300";
}

function severityClass(severity: ResearchAgentSeverity): string {
  if (severity === "critical") return "border-rose-300/30 bg-rose-400/[0.10]";
  if (severity === "risk") return "border-amber-300/25 bg-amber-400/[0.08]";
  if (severity === "watch") return "border-cyan-300/20 bg-cyan-400/[0.06]";
  return "border-white/10 bg-white/[0.035]";
}

function toneColor(tone: "opportunity" | "risk" | "watch"): string {
  if (tone === "risk") return "text-amber-200";
  if (tone === "opportunity") return "text-emerald-200";
  return "text-cyan-200";
}

function toneCardClass(tone: "opportunity" | "risk" | "watch"): string {
  if (tone === "risk") return "border-amber-300/20 bg-amber-400/[0.07]";
  if (tone === "opportunity") return "border-emerald-300/20 bg-emerald-400/[0.06]";
  return "border-cyan-300/15 bg-cyan-400/[0.045]";
}
