"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  LiveDashboardUpdate,
  LiveIntelligenceAlert,
  LiveIntelligenceSeverity,
  LiveIntelligenceSystem,
  LiveOpportunityEscalation,
} from "@/lib/trading/live-intelligence";
import { ResilienceStatusBanner } from "@/components/resilience/ResilienceStatusBanner";
import { formatNumber } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

type StreamState = "connected" | "connecting" | "reconnecting" | "unavailable";

export function LiveIntelligencePanel({
  compact = false,
  initialSystem,
}: {
  compact?: boolean;
  initialSystem: LiveIntelligenceSystem;
}) {
  const [system, setSystem] = useState(initialSystem);
  const [streamState, setStreamState] = useState<StreamState>("connecting");
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) {
      setStreamState("unavailable");
      return;
    }

    const interval = Math.max(10_000, Math.min(120_000, initialSystem.refreshIntervalMs));
    const source = new EventSource(`/api/live-intelligence/stream?intervalMs=${interval}`);
    let closed = false;

    source.addEventListener("open", () => {
      if (closed) return;
      setStreamState("connected");
      setLastError(null);
    });
    source.addEventListener("live-intelligence", (event) => {
      if (closed) return;
      try {
        const nextSystem = JSON.parse(event.data) as LiveIntelligenceSystem;
        setSystem(nextSystem);
        setStreamState(nextSystem.status === "paused" ? "unavailable" : nextSystem.status === "degraded" ? "reconnecting" : "connected");
        setLastError(null);
      } catch {
        setStreamState("reconnecting");
        setLastError("Latest live packet could not be read.");
      }
    });
    source.addEventListener("live-error", () => {
      if (closed) return;
      setStreamState("reconnecting");
      setLastError("Live stream is temporarily unavailable.");
    });
    source.addEventListener("error", () => {
      if (closed) return;
      setStreamState("reconnecting");
      setLastError("Reconnecting to live intelligence.");
    });

    return () => {
      closed = true;
      source.close();
    };
  }, [initialSystem.refreshIntervalMs]);

  const metrics = useMemo(() => [
    { inverse: false, label: "Breadth", value: system.breadthScore },
    { inverse: true, label: "Volatility", value: system.volatilityPressure },
    { inverse: true, label: "Unusual Vol", value: system.unusualVolumeScore },
    { inverse: true, label: "Regime Shift", value: system.regimeShiftScore },
    { inverse: true, label: "Shock", value: system.shockEscalationScore },
    { inverse: true, label: "Event", value: system.eventReactionScore },
  ], [system]);

  return (
    <GlassPanel className={`${compact ? "p-4" : "p-5"} border-cyan-300/15 bg-cyan-400/[0.045]`}>
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SectionTitle eyebrow="Real-Time Intelligence" title={system.marketState} meta={system.latencyLabel} />
            <StatusPill state={streamState} systemStatus={system.status} />
          </div>
          <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-300">{system.liveSummary}</p>
          <p className="mt-1 max-w-5xl text-xs leading-5 text-slate-500">
            Near-real-time scanner awareness. Research only, not execution. Last packet {formatPacketTime(system.generatedAt)}.
          </p>
          {lastError ? <p className="mt-2 text-xs font-semibold text-amber-200">{lastError}</p> : null}
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 2xl:min-w-[460px]">
          {metrics.map((metric) => <ScoreTile inverse={metric.inverse} key={metric.label} label={metric.label} value={metric.value} />)}
        </div>
      </div>

      {streamState !== "connected" || system.status === "degraded" ? (
        <ResilienceStatusBanner
          className="mt-4"
          compact
          errorMessage={streamState === "unavailable" ? (lastError ?? "Live intelligence stream is unavailable.") : null}
          partialData={system.status === "degraded"}
          websocketState={streamState === "connected" ? null : streamState}
          surface="live"
        />
      ) : null}

      <div className={`mt-4 grid gap-3 ${compact ? "xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)_340px]" : "xl:grid-cols-3"}`}>
        <LiveAlertStack alerts={system.alerts} />
        <ShockEscalationStack items={system.shockEscalations.slice(0, compact ? 4 : 6)} />
        <DashboardUpdateStack updates={system.dashboardUpdates.slice(0, compact ? 4 : 5)} />
      </div>
    </GlassPanel>
  );
}

function StatusPill({ state, systemStatus }: { state: StreamState; systemStatus: LiveIntelligenceSystem["status"] }) {
  const label = state === "connected"
    ? systemStatus === "degraded" ? "Live, limited" : "Live"
    : state === "connecting"
      ? "Connecting"
      : state === "reconnecting"
        ? "Reconnecting"
        : "Snapshot";
  const color = state === "connected" && systemStatus === "connected"
    ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
    : state === "unavailable"
      ? "border-white/10 bg-white/[0.04] text-slate-300"
      : "border-amber-300/25 bg-amber-400/10 text-amber-100";
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${color}`}>{label}</span>;
}

function LiveAlertStack({ alerts }: { alerts: LiveIntelligenceAlert[] }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Intraday Alerts</div>
      <div className="mt-3 space-y-2">
        {alerts.length ? alerts.slice(0, 5).map((alert) => (
          <div className={`rounded-xl border p-3 ${severityClass(alert.severity)}`} key={`${alert.title}-${alert.reasonCodes.join("-")}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-sm font-bold text-slate-100">{alert.title}</div>
              <div className="font-mono text-xs font-black text-slate-300">{formatNumber(alert.score, 0)}</div>
            </div>
            <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-400">{alert.detail}</p>
            <CodeList codes={alert.reasonCodes} />
          </div>
        )) : <p className="text-sm leading-6 text-slate-400">No live alert is confirmed in the latest bounded packet.</p>}
      </div>
    </div>
  );
}

function ShockEscalationStack({ items }: { items: LiveOpportunityEscalation[] }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Live Shock Detection</div>
      <div className="mt-3 grid gap-2">
        {items.length ? items.map((item) => (
          <Link className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-cyan-300/35" href={`/symbol/${item.symbol}`} key={`${item.symbol}-${item.state}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-sm font-black text-slate-50">{item.symbol}</div>
                <div className="mt-1 text-xs font-semibold text-cyan-100">{item.state}</div>
              </div>
              <div className="font-mono text-sm font-black text-cyan-100">{formatNumber(item.score, 0)}</div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px] text-slate-500">
              <MiniMetric label="Move" value={item.priceMovePct === null ? "N/A" : `${item.priceMovePct > 0 ? "+" : ""}${item.priceMovePct.toFixed(1)}%`} />
              <MiniMetric label="Vol" value={formatNumber(item.unusualVolumeScore, 0)} />
              <MiniMetric label="Event" value={formatNumber(item.eventPressureScore, 0)} />
            </div>
          </Link>
        )) : <p className="text-sm leading-6 text-slate-400">No symbol has confirmed live shock escalation yet.</p>}
      </div>
    </div>
  );
}

function DashboardUpdateStack({ updates }: { updates: LiveDashboardUpdate[] }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Live Dashboard Updates</div>
      <div className="mt-3 space-y-2">
        {updates.map((update) => (
          <div className={`rounded-xl border p-3 ${severityClass(update.severity)}`} key={update.label}>
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-bold text-slate-100">{update.label}</div>
              <div className="font-mono text-xs font-black text-slate-300">{formatNumber(update.score, 0)}</div>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-400">{update.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-slate-950/35 px-2 py-1">
      <div className="truncate text-[9px] font-black uppercase tracking-normal text-slate-500">{label}</div>
      <div className="truncate font-mono text-[11px] font-bold text-slate-200">{value}</div>
    </div>
  );
}

function ScoreTile({ inverse = false, label, value }: { inverse?: boolean; label: string; value: number }) {
  const good = inverse ? value <= 45 : value >= 65;
  const risk = inverse ? value >= 70 : value < 45;
  const color = good ? "text-emerald-200" : risk ? "text-rose-200" : "text-amber-200";
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="min-w-0 truncate text-[9px] font-black uppercase leading-3 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className={`mt-1 font-mono text-lg font-black ${color}`}>{formatNumber(value, 0)}</div>
    </div>
  );
}

function CodeList({ codes }: { codes: string[] }) {
  if (!codes.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {codes.slice(0, 4).map((code) => <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold text-slate-400" key={code}>{code}</span>)}
    </div>
  );
}

function severityClass(severity: LiveIntelligenceSeverity): string {
  if (severity === "critical") return "border-rose-300/25 bg-rose-400/[0.08]";
  if (severity === "warning") return "border-amber-300/20 bg-amber-400/[0.07]";
  return "border-cyan-300/15 bg-cyan-400/[0.045]";
}

function formatPacketTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "time unavailable";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}
