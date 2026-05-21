export type FailureSurface =
  | "chart"
  | "scanner"
  | "discovery"
  | "feed"
  | "overlay"
  | "replay"
  | "macro"
  | "mobile"
  | "live"
  | "strategy"
  | "portfolio"
  | "unknown";

export type FailureModeStatus = "operational" | "constrained" | "degraded" | "stale" | "offline" | "failed";
export type FailureModeSeverity = "info" | "warning" | "critical";
export type WebsocketFailureState = "connected" | "connecting" | "reconnecting" | "closed" | "unavailable";

export type NetworkConnectionLike = {
  downlink?: number;
  effectiveType?: string;
  saveData?: boolean;
};

export type LowBandwidthMode = {
  animationMode: "full" | "reduced";
  chartMode: "full" | "lightweight";
  enabled: boolean;
  reason: string | null;
  scannerMode: "full" | "compact";
};

export type RetryGovernance = {
  canRetry: boolean;
  maxAttempts: number;
  nextDelayMs: number | null;
  reason: string;
};

export type FailureModeInput = {
  attempt?: number;
  errorMessage?: string | null;
  freshnessStatus?: string | null;
  isOffline?: boolean;
  loadingMs?: number | null;
  lowBandwidth?: boolean;
  partialData?: boolean;
  staleAgeMinutes?: number | null;
  surface: FailureSurface;
  websocketState?: WebsocketFailureState | null;
};

export type FailureModeDecision = {
  confidenceMultiplier: number;
  fallbackAction: string;
  lowBandwidth: LowBandwidthMode;
  message: string;
  preserveContext: boolean;
  retry: RetryGovernance;
  severity: FailureModeSeverity;
  status: FailureModeStatus;
  surface: FailureSurface;
  telemetryKey: string;
  title: string;
};

const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_STALE_AFTER_MINUTES = 60;
const SLOW_RESPONSE_MS = 10_000;

const SURFACE_LABELS: Record<FailureSurface, string> = {
  chart: "Chart intelligence",
  discovery: "Discovery scanner",
  feed: "Intelligence feed",
  live: "Live intelligence",
  macro: "Macro intelligence",
  mobile: "Mobile workflow",
  overlay: "Detail overlay",
  portfolio: "Portfolio intelligence",
  replay: "Replay intelligence",
  scanner: "Scanner",
  strategy: "Strategy intelligence",
  unknown: "TradeVeto intelligence",
};

export function classifyFailureMode(input: FailureModeInput): FailureModeDecision {
  const lowBandwidth = input.lowBandwidth
    ? constrainedLowBandwidthMode("Browser is using a constrained network profile.")
    : defaultLowBandwidthMode();
  const retry = retryGovernanceFor(input);
  const surfaceLabel = SURFACE_LABELS[input.surface];

  if (input.isOffline) {
    return decision(input.surface, {
      confidenceMultiplier: 0.42,
      fallbackAction: "Use the last validated snapshot until the network returns.",
      lowBandwidth,
      message: `${surfaceLabel} is in offline snapshot mode. Current intelligence is preserved, but it is not being refreshed.`,
      retry,
      severity: "critical",
      status: "offline",
      title: "Offline snapshot mode",
    });
  }

  const freshnessStatus = normalized(input.freshnessStatus);
  const staleByStatus = freshnessStatus === "stale" || freshnessStatus === "missing" || freshnessStatus === "schema_mismatch";
  const staleByAge = typeof input.staleAgeMinutes === "number" && input.staleAgeMinutes >= DEFAULT_STALE_AFTER_MINUTES;
  if (staleByStatus || staleByAge) {
    return decision(input.surface, {
      confidenceMultiplier: 0.55,
      fallbackAction: "Treat the visible packet as historical context until a fresh scan confirms it.",
      lowBandwidth,
      message: `${surfaceLabel} is showing aging evidence. Confidence is automatically downgraded so stale data is not presented as live.`,
      retry,
      severity: "warning",
      status: "stale",
      title: "Freshness limited",
    });
  }

  if (input.errorMessage) {
    return decision(input.surface, {
      confidenceMultiplier: 0.35,
      fallbackAction: "Keep the current page state, show the bounded fallback, and retry only under the governed policy.",
      lowBandwidth,
      message: `${surfaceLabel} could not refresh cleanly. ${cleanError(input.errorMessage)}`,
      retry,
      severity: "critical",
      status: "failed",
      title: "Recovery mode active",
    });
  }

  if (input.websocketState === "connecting" || input.websocketState === "reconnecting" || input.websocketState === "closed" || input.websocketState === "unavailable") {
    return decision(input.surface, {
      confidenceMultiplier: 0.72,
      fallbackAction: "Continue showing the last validated packet while the stream reconnects.",
      lowBandwidth,
      message: `${surfaceLabel} is using the last validated packet while live transport ${input.websocketState === "connecting" ? "initializes" : "recovers"}.`,
      retry,
      severity: "warning",
      status: "degraded",
      title: input.websocketState === "connecting" ? "Live transport initializing" : "Live transport degraded",
    });
  }

  if (input.partialData) {
    return decision(input.surface, {
      confidenceMultiplier: 0.74,
      fallbackAction: "Keep core situational awareness visible and mark unavailable modules as limited evidence.",
      lowBandwidth,
      message: `${surfaceLabel} has partial evidence. Unavailable modules are withheld instead of filled with unsupported intelligence.`,
      retry,
      severity: "warning",
      status: "degraded",
      title: "Partial data mode",
    });
  }

  if (typeof input.loadingMs === "number" && input.loadingMs >= SLOW_RESPONSE_MS) {
    return decision(input.surface, {
      confidenceMultiplier: 0.78,
      fallbackAction: "Protect the user from infinite loading by switching to a bounded degraded state.",
      lowBandwidth,
      message: `${surfaceLabel} is responding slowly. TradeVeto is preserving the current workflow while recovery continues.`,
      retry,
      severity: "warning",
      status: "degraded",
      title: "Slow response protection",
    });
  }

  if (lowBandwidth.enabled) {
    return decision(input.surface, {
      confidenceMultiplier: 0.94,
      fallbackAction: "Prefer compact scanner density, lightweight charts, and reduced animation.",
      lowBandwidth,
      message: lowBandwidth.reason ?? `${surfaceLabel} is running in constrained mode.`,
      retry,
      severity: "info",
      status: "constrained",
      title: "Low-bandwidth mode",
    });
  }

  return decision(input.surface, {
    confidenceMultiplier: 1,
    fallbackAction: "No resilience fallback is active.",
    lowBandwidth,
    message: `${surfaceLabel} is operational.`,
    retry,
    severity: "info",
    status: "operational",
    title: "Operational",
  });
}

export function failureModeRetryDelayMs(attempt: number, baseDelayMs = 750, maxDelayMs = 30_000): number {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  const safeBase = Number.isFinite(baseDelayMs) ? Math.max(100, Math.floor(baseDelayMs)) : 750;
  const safeMax = Number.isFinite(maxDelayMs) ? Math.max(safeBase, Math.floor(maxDelayMs)) : 30_000;
  return Math.min(safeMax, safeBase * 2 ** safeAttempt);
}

export function shouldRetryFailure(input: FailureModeInput, maxAttempts = DEFAULT_MAX_ATTEMPTS): boolean {
  const attempt = Number.isFinite(input.attempt) ? Math.max(0, Math.floor(input.attempt ?? 0)) : 0;
  if (attempt >= maxAttempts) return false;
  if (input.isOffline) return true;
  if (input.errorMessage) return !isPermanentFailure(input.errorMessage);
  if (input.websocketState === "connecting" || input.websocketState === "reconnecting" || input.websocketState === "closed" || input.websocketState === "unavailable") return true;
  if (typeof input.loadingMs === "number" && input.loadingMs >= SLOW_RESPONSE_MS) return true;
  return false;
}

export function lowBandwidthModeFromConnection(connection: NetworkConnectionLike | null | undefined): LowBandwidthMode {
  if (!connection) return defaultLowBandwidthMode();
  if (connection.saveData) return constrainedLowBandwidthMode("Data saver is enabled. TradeVeto is reducing chart and animation weight.");
  const effectiveType = normalized(connection.effectiveType);
  if (effectiveType === "slow-2g" || effectiveType === "2g") {
    return constrainedLowBandwidthMode("Network quality is constrained. TradeVeto is favoring compact intelligence surfaces.");
  }
  if (typeof connection.downlink === "number" && Number.isFinite(connection.downlink) && connection.downlink > 0 && connection.downlink < 1) {
    return constrainedLowBandwidthMode("Low network throughput detected. Charts and scanner views can use lightweight recovery mode.");
  }
  return defaultLowBandwidthMode();
}

export function sessionContinuityKey(surface: FailureSurface, userScope = "anonymous"): string {
  const safeScope = userScope.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "anonymous";
  return `tradeveto:${surface}:continuity:${safeScope}`;
}

export function resilienceChecklist(): string[] {
  return [
    "Never silently present stale intelligence as live.",
    "Use bounded retries with visible recovery state.",
    "Preserve scanner, chart, overlay, and compare context through transient failures.",
    "Prefer lightweight chart/scanner modes on constrained mobile networks.",
    "Replace infinite loaders with contextual degraded states.",
  ];
}

function retryGovernanceFor(input: FailureModeInput): RetryGovernance {
  const attempt = Number.isFinite(input.attempt) ? Math.max(0, Math.floor(input.attempt ?? 0)) : 0;
  const canRetry = shouldRetryFailure(input, DEFAULT_MAX_ATTEMPTS);
  return {
    canRetry,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    nextDelayMs: canRetry ? failureModeRetryDelayMs(attempt) : null,
    reason: canRetry ? "Transient failure; retry is bounded and context-preserving." : "No automatic retry allowed for this state.",
  };
}

function decision(surface: FailureSurface, input: Omit<FailureModeDecision, "preserveContext" | "surface" | "telemetryKey">): FailureModeDecision {
  return {
    ...input,
    preserveContext: true,
    surface,
    telemetryKey: `failure_mode_${surface}_${input.status}`,
  };
}

function defaultLowBandwidthMode(): LowBandwidthMode {
  return {
    animationMode: "full",
    chartMode: "full",
    enabled: false,
    reason: null,
    scannerMode: "full",
  };
}

function constrainedLowBandwidthMode(reason: string): LowBandwidthMode {
  return {
    animationMode: "reduced",
    chartMode: "lightweight",
    enabled: true,
    reason,
    scannerMode: "compact",
  };
}

function isPermanentFailure(message: string): boolean {
  return /\b(not configured|unsupported|unauthorized|forbidden|invalid api key|permission)\b/i.test(message);
}

function cleanError(message: string): string {
  const cleaned = message.replace(/\s+/g, " ").trim();
  if (!cleaned) return "The failure did not include a readable detail.";
  return cleaned.length > 180 ? `${cleaned.slice(0, 177)}...` : cleaned;
}

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}
