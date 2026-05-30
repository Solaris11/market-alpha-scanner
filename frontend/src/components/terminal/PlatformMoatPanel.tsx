import type { PlatformMoatSystem } from "@/lib/trading/platform-moat";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function PlatformMoatPanel({ system }: { system: PlatformMoatSystem }) {
  return (
    <GlassPanel className="overflow-hidden p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle eyebrow="Platform Moat" meta={system.certification.overallStatus} title="Defensible Intelligence Graph" />
        <div className="rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-violet-100">
          {system.defensibility.moatScore}/100
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <MoatMetric label="Datasets" value={system.proprietaryDatasets.length} detail="proprietary layers" />
        <MoatMetric label="Signals" value={system.uniqueSignals.length} detail="unique signal engines" />
        <MoatMetric label="Memory Graph" value={system.marketMemoryGraph.edges.length} detail="relationships" />
        <MoatMetric label="User Graph" value={system.userIntelligenceGraph.edges.length} detail="authenticated links" />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Unique signal development</div>
          <div className="mt-3 grid gap-2">
            {system.uniqueSignals.slice(0, 4).map((signal) => (
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3" key={signal.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{signal.title}</div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{signal.workflowUse}</p>
                  </div>
                  <div className="font-mono text-sm font-black text-cyan-100">{signal.signalStrengthScore}</div>
                </div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{signal.replicationDifficulty.replace("_", " ")}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Defensibility</div>
          <div className="mt-3 space-y-2">
            <ScoreLine label="Data uniqueness" value={system.defensibility.dataUniquenessScore} />
            <ScoreLine label="Workflow uniqueness" value={system.defensibility.workflowUniquenessScore} />
            <ScoreLine label="AI uniqueness" value={system.defensibility.aiUniquenessScore} />
            <ScoreLine label="Difficulty to replicate" value={system.defensibility.difficultyToReplicateScore} />
          </div>
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
            {system.proofBoundary}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

function MoatMetric({ detail, label, value }: { detail: string; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-2xl font-black text-slate-50">{value}</div>
      <div className="text-xs text-slate-400">{detail}</div>
    </div>
  );
}

function ScoreLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono font-black text-slate-100">{value}/100</span>
    </div>
  );
}
