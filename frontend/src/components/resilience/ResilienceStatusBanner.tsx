"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, Gauge, RefreshCw, WifiOff } from "lucide-react";
import {
  classifyFailureMode,
  lowBandwidthModeFromConnection,
  type FailureModeInput,
  type FailureModeStatus,
  type FailureSurface,
  type NetworkConnectionLike,
  type WebsocketFailureState,
} from "@/lib/resilience/failure-mode";

type ResilienceStatusBannerProps = {
  className?: string;
  compact?: boolean;
  errorMessage?: string | null;
  freshnessStatus?: string | null;
  loadingMs?: number | null;
  lowBandwidth?: boolean;
  onRetry?: () => void;
  partialData?: boolean;
  retryAttempt?: number;
  showWhenOperational?: boolean;
  staleAgeMinutes?: number | null;
  surface: FailureSurface;
  websocketState?: WebsocketFailureState | null;
};

type BrowserNetworkState = {
  connection: NetworkConnectionLike | null;
  online: boolean;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkConnectionLike;
  mozConnection?: NetworkConnectionLike;
  webkitConnection?: NetworkConnectionLike;
};

export function ResilienceStatusBanner({
  className = "",
  compact = false,
  errorMessage,
  freshnessStatus,
  loadingMs,
  lowBandwidth,
  onRetry,
  partialData,
  retryAttempt = 0,
  showWhenOperational = false,
  staleAgeMinutes,
  surface,
  websocketState,
}: ResilienceStatusBannerProps) {
  const [network, setNetwork] = useState<BrowserNetworkState>({ connection: null, online: true });

  useEffect(() => {
    const updateNetwork = (): void => {
      setNetwork({
        connection: readNavigatorConnection(),
        online: typeof navigator === "undefined" ? true : navigator.onLine,
      });
    };
    updateNetwork();
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
    };
  }, []);

  const inferredLowBandwidth = useMemo(() => {
    if (typeof lowBandwidth === "boolean") return lowBandwidth;
    return lowBandwidthModeFromConnection(network.connection).enabled;
  }, [lowBandwidth, network.connection]);

  const input: FailureModeInput = {
    attempt: retryAttempt,
    errorMessage,
    freshnessStatus,
    isOffline: !network.online,
    loadingMs,
    lowBandwidth: inferredLowBandwidth,
    partialData,
    staleAgeMinutes,
    surface,
    websocketState,
  };
  const decision = classifyFailureMode(input);

  if (decision.status === "operational" && !showWhenOperational) return null;

  const Icon = iconForStatus(decision.status);
  const toneClass = toneForStatus(decision.status);
  const details = compact ? decision.message : `${decision.message} ${decision.fallbackAction}`;

  return (
    <div className={`rounded-2xl border p-3 ${toneClass} ${className}`} data-resilience-status={decision.status}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-current/20 bg-current/10">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">Failure-mode governance</div>
            <div className="mt-1 text-sm font-black text-slate-50">{decision.title}</div>
            <p className="mt-1 text-xs leading-5 text-slate-300">{details}</p>
            {!compact ? (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">Confidence x{decision.confidenceMultiplier.toFixed(2)}</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">Context preserved</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">{decision.lowBandwidth.chartMode} charts</span>
              </div>
            ) : null}
          </div>
        </div>
        {decision.retry.canRetry && onRetry ? (
          <button
            className="tv-governed-button inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-100 transition hover:border-cyan-300/35 hover:bg-cyan-300/10"
            onClick={onRetry}
            type="button"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}

function readNavigatorConnection(): NetworkConnectionLike | null {
  if (typeof navigator === "undefined") return null;
  const candidate = navigator as NavigatorWithConnection;
  return candidate.connection ?? candidate.mozConnection ?? candidate.webkitConnection ?? null;
}

function iconForStatus(status: FailureModeStatus) {
  if (status === "offline") return WifiOff;
  if (status === "stale") return Clock3;
  if (status === "constrained") return Gauge;
  return AlertTriangle;
}

function toneForStatus(status: FailureModeStatus): string {
  if (status === "offline" || status === "failed") return "border-rose-300/25 bg-rose-500/[0.08] text-rose-100 shadow-[0_0_36px_rgba(244,63,94,0.08)]";
  if (status === "stale" || status === "degraded") return "border-amber-300/25 bg-amber-400/[0.08] text-amber-100 shadow-[0_0_34px_rgba(245,158,11,0.08)]";
  if (status === "constrained") return "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-100";
  return "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100";
}
