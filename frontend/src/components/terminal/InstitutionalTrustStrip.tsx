"use client";

import Link from "next/link";
import { AlertTriangle, Clock3, Database, Eye, Route, ShieldCheck } from "lucide-react";
import type { InstitutionalTrustModel, TrustTone } from "@/lib/trading/institutional-trust";
import {
  buildTrustArchitectureFromInstitutionalModel,
  certifyTrustArchitecture,
  type TrustArchitectureCertification,
  type TrustArchitecturePacket,
} from "@/lib/trading/trust-architecture";

export function InstitutionalTrustStrip({
  className = "",
  compact = false,
  model,
}: {
  className?: string;
  compact?: boolean;
  model: InstitutionalTrustModel;
}) {
  const visibleProvenance = compact ? model.provenance.slice(0, 4) : model.provenance;
  const visibleWorkflow = compact ? model.workflow.slice(0, 3) : model.workflow;
  const trustArchitecture = buildTrustArchitectureFromInstitutionalModel(model);
  const certification = certifyTrustArchitecture(trustArchitecture);
  return (
    <section className={`rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.035] p-3 ${className}`} aria-label="Trust and evidence">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
            <ShieldCheck className="h-4 w-4" />
            Trust & Evidence
          </div>
          <div className="mt-1 text-sm font-black text-slate-50">{model.headline}</div>
          {!compact ? <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">{model.summary}</p> : null}
        </div>
        <div className={`rounded-full border px-3 py-1 font-mono text-xs font-black ${trustScoreClass(model.score)}`}>
          {model.score}/100 trust
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {visibleProvenance.map((item) => (
          <div className={`rounded-xl border p-2.5 ${toneClass(item.tone)}`} key={`${item.label}-${item.value}`}>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.13em] opacity-85">
              {provenanceIcon(item.label)}
              {item.label}
            </div>
            <div className="mt-1 truncate text-sm font-black text-slate-50">{item.value}</div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-300/85">{item.detail}</p>
          </div>
        ))}
      </div>

      <details className="mt-3 rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2" onClick={(event) => event.stopPropagation()}>
        <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em] text-slate-300">
          <span className="inline-flex items-center gap-2">
            <Eye className="h-4 w-4 text-cyan-200" />
            Why shown / workflow
          </span>
          <span className="text-[10px] text-slate-500">Open</span>
        </summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <TrustList title="Why you see it" tone="intelligence" items={model.personalization} />
          <TrustList title="Limitations" tone={model.limitations[0]?.includes("No major limitation") ? "constructive" : "caution"} items={model.limitations} />
          <TrustList title="Traceability" tone="neutral" items={model.traceability.slice(0, compact ? 3 : 5)} />
        </div>
        <TrustArchitectureView certification={certification} compact={compact} packet={trustArchitecture} />
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleWorkflow.map((item) => (
            <Link
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.055] px-3 text-[11px] font-black uppercase tracking-[0.08em] text-cyan-100 transition hover:border-cyan-200/45 hover:bg-cyan-300/10"
              href={item.href}
              key={`${item.label}-${item.href}`}
              title={item.reason}
            >
              <Route className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          ))}
        </div>
      </details>
    </section>
  );
}

function TrustArchitectureView({
  certification,
  compact,
  packet,
}: {
  certification: TrustArchitectureCertification;
  compact: boolean;
  packet: TrustArchitecturePacket;
}) {
  const visibleLineage = packet.evidenceLineage.slice(0, compact ? 4 : 6);
  return (
    <div className="mt-3 rounded-xl border border-cyan-300/15 bg-slate-950/45 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Evidence lineage</div>
          <p className="mt-1 text-xs leading-5 text-slate-400">Trace the signals, freshness, sources, and audit path behind this intelligence surface.</p>
        </div>
        <div className={`rounded-full border px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.1em] ${certification.passed ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-rose-300/25 bg-rose-300/10 text-rose-100"}`}>
          {packet.status} · {packet.confidence.governedConfidence}/100
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {visibleLineage.map((node) => (
          <div className={`rounded-xl border p-2.5 ${toneClass(node.tone)}`} key={node.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-black uppercase tracking-[0.13em] opacity-85">{node.category}</span>
              <span className="font-mono text-[10px] font-black">{node.strength}/100</span>
            </div>
            <div className="mt-1 text-xs font-black text-slate-50">{node.label}: {node.value}</div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-300/85">{node.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-3">
        <TrustList title="Confidence governance" tone={packet.confidence.state === "blocked" ? "risk" : packet.confidence.state === "stale" ? "caution" : "intelligence"} items={packet.confidence.downgradeReasons} />
        <TrustList title="Reproducibility" tone="neutral" items={packet.reproducibility.slice(0, 4)} />
        <TrustList title="Safety rules" tone="constructive" items={packet.safetyRules.slice(0, 4)} />
      </div>
      {certification.blockers.length ? <TrustList title="Trust blockers" tone="risk" items={certification.blockers} /> : null}
    </div>
  );
}

function TrustList({ items, title, tone }: { items: string[]; title: string; tone: TrustTone }) {
  return (
    <div className={`rounded-xl border p-3 ${toneClass(tone)}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.14em] opacity-80">{title}</div>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
        {items.slice(0, 5).map((item) => (
          <li className="flex gap-2" key={item}>
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function provenanceIcon(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("fresh") || normalized.includes("timestamp")) return <Clock3 className="h-3.5 w-3.5" />;
  if (normalized.includes("risk") || normalized.includes("uncertainty")) return <AlertTriangle className="h-3.5 w-3.5" />;
  return <Database className="h-3.5 w-3.5" />;
}

function toneClass(tone: TrustTone): string {
  if (tone === "constructive") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (tone === "risk") return "border-rose-300/20 bg-rose-300/10 text-rose-100";
  if (tone === "caution") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  if (tone === "intelligence") return "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";
  return "border-white/10 bg-white/[0.04] text-slate-300";
}

function trustScoreClass(score: number): string {
  if (score >= 82) return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  if (score >= 62) return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
  if (score >= 42) return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  return "border-rose-300/25 bg-rose-300/10 text-rose-100";
}
