"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, Gauge, ShieldAlert, Sparkles } from "lucide-react";
import { StableDetailOverlay } from "@/components/ui/StableDetailOverlay";
import type { MobileIntelligencePacket } from "@/lib/trading/mobile-push-intelligence";

type MobileIntelligenceDeckProps = {
  packets: MobileIntelligencePacket[];
};

const CATEGORY_LABELS: Record<MobileIntelligencePacket["category"], string> = {
  copilot: "Copilot",
  fragility: "Fragility",
  macro: "Macro",
  replay: "Replay",
  shock: "Shock",
  watchlist: "Watchlist",
  what_changed: "What Changed",
};

export function MobileIntelligenceDeck({ packets }: MobileIntelligenceDeckProps) {
  const [selectedPacket, setSelectedPacket] = useState<MobileIntelligencePacket | null>(null);

  return (
    <>
      <div
        className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-mobile-gesture-ignore="true"
      >
        {packets.map((packet) => (
          <button
            aria-label={`Open ${packet.title}`}
            className="tv-tap-motion min-w-[84vw] snap-center rounded-[1.15rem] border border-white/10 bg-white/[0.035] p-0 text-left shadow-lg shadow-black/15 transition hover:border-cyan-300/25 hover:bg-cyan-400/[0.055] sm:min-w-0"
            key={packet.id}
            onClick={() => setSelectedPacket(packet)}
            type="button"
          >
            <PacketCardContent packet={packet} />
          </button>
        ))}
      </div>

      <StableDetailOverlay
        analyticsSurface="mobile-intelligence-packet"
        description={selectedPacket ? selectedPacket.body : null}
        eyebrow={selectedPacket ? CATEGORY_LABELS[selectedPacket.category] : "Mobile Intelligence"}
        onClose={() => setSelectedPacket(null)}
        open={Boolean(selectedPacket)}
        size="xl"
        title={selectedPacket?.title ?? "Mobile intelligence"}
      >
        {selectedPacket ? <PacketDetail packet={selectedPacket} /> : null}
      </StableDetailOverlay>
    </>
  );
}

function PacketCardContent({ packet }: { packet: MobileIntelligencePacket }) {
  return (
    <div className={`relative min-h-[15rem] overflow-hidden rounded-[1.15rem] p-4 ${packetAtmosphere(packet.priority)}`}>
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.14)]">
          <PacketIcon category={packet.category} />
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-1.5">
          <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${priorityClass(packet.priority)}`}>{packet.urgencyLabel}</span>
          {packet.pushEligible ? <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">Push</span> : null}
        </div>
      </div>
      <div className="mt-4">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{CATEGORY_LABELS[packet.category]}</div>
        <h3 className="mt-2 text-lg font-semibold leading-tight text-slate-50">{packet.title}</h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{packet.body}</p>
      </div>
      <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <ScoreRing score={packet.score} />
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-slate-300">{packet.evidenceLabel}</div>
          <div className="mt-1 truncate text-[11px] text-slate-500">{packet.reasonCodes.slice(0, 2).join(" · ")}</div>
        </div>
        <ArrowRight className="h-4 w-4 text-cyan-200" />
      </div>
    </div>
  );
}

function PacketDetail({ packet }: { packet: MobileIntelligencePacket }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <section className={`rounded-[1.25rem] border border-white/10 p-4 ${packetAtmosphere(packet.priority)}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${priorityClass(packet.priority)}`}>{packet.urgencyLabel}</span>
          <span className="rounded-full border border-white/10 bg-slate-950/40 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{CATEGORY_LABELS[packet.category]}</span>
          {packet.symbol ? <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 font-mono text-[11px] font-black text-cyan-100">{packet.symbol}</span> : null}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <ScoreRing score={packet.score} large />
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">Native Mobile Drilldown</div>
            <h3 className="mt-2 text-2xl font-semibold text-slate-50">{packet.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{packet.body}</p>
          </div>
        </div>
        <Link className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 text-sm font-black text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15 sm:w-auto" href={packet.actionUrl}>
          {packet.actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">Evidence Packet</div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Evidence</div>
          <div className="mt-1 text-sm font-semibold text-slate-100">{packet.evidenceLabel}</div>
        </div>
        <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Reason Codes</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {packet.reasonCodes.map((reason) => (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-300" key={reason}>{reason}</span>
            ))}
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] p-3 text-sm leading-6 text-amber-50/80">
          Research only. Mobile packets summarize verified TradeVeto context and are not financial advice.
        </div>
      </section>
    </div>
  );
}

function PacketIcon({ category }: { category: MobileIntelligencePacket["category"] }) {
  if (category === "fragility" || category === "shock") return <ShieldAlert className="h-5 w-5" />;
  if (category === "watchlist") return <Bell className="h-5 w-5" />;
  if (category === "macro" || category === "replay") return <Gauge className="h-5 w-5" />;
  return <Sparkles className="h-5 w-5" />;
}

function ScoreRing({ large = false, score }: { large?: boolean; score: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const size = large ? 112 : 54;
  const stroke = large ? 9 : 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ height: size, width: size }}>
      <svg aria-hidden="true" className="-rotate-90" height={size} width={size}>
        <circle cx={size / 2} cy={size / 2} fill="none" r={radius} stroke="rgba(148,163,184,0.18)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={scoreColor(clamped)}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          strokeWidth={stroke}
        />
      </svg>
      <div className="absolute text-center">
        <div className={`${large ? "text-3xl" : "text-sm"} font-black text-slate-50`}>{clamped}</div>
        {large ? <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Score</div> : null}
      </div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 84) return "#fb7185";
  if (score >= 70) return "#fbbf24";
  if (score >= 55) return "#22d3ee";
  return "#94a3b8";
}

function packetAtmosphere(priority: MobileIntelligencePacket["priority"]): string {
  if (priority === "critical") return "bg-[radial-gradient(circle_at_12%_0%,rgba(244,63,94,0.18),transparent_17rem),linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.78))]";
  if (priority === "high") return "bg-[radial-gradient(circle_at_12%_0%,rgba(251,191,36,0.14),transparent_17rem),linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.78))]";
  if (priority === "medium") return "bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.12),transparent_17rem),linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.78))]";
  return "bg-[radial-gradient(circle_at_12%_0%,rgba(148,163,184,0.09),transparent_17rem),linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.78))]";
}

function priorityClass(priority: MobileIntelligencePacket["priority"]): string {
  if (priority === "critical") return "border-rose-300/25 bg-rose-400/10 text-rose-100";
  if (priority === "high") return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  if (priority === "medium") return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
  return "border-white/10 bg-white/[0.03] text-slate-300";
}
