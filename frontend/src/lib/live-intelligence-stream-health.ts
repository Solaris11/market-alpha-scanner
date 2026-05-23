export type LiveIntelligenceStreamEventType = "close" | "error" | "event" | "open";

export type LiveIntelligenceStreamHealthSnapshot = {
  activeStreams: number;
  averageEventBuildMs: number | null;
  closedStreamsLastHour: number;
  errorRatePct: number;
  errorsLastHour: number;
  eventsLastHour: number;
  lastErrorAt: string | null;
  lastEventAt: string | null;
  openedStreamsLastHour: number;
  reconnectPressure: "elevated" | "normal" | "unknown";
  windowSize: number;
};

type StreamEvent = {
  atMs: number;
  buildMs: number | null;
  type: LiveIntelligenceStreamEventType;
};

type StreamHealthState = {
  activeStreams: Map<string, number>;
  events: StreamEvent[];
  sequence: number;
};

const WINDOW_MS = 60 * 60 * 1000;
const MAX_EVENTS = 2_000;

const stateRoot = globalThis as typeof globalThis & {
  __tradeVetoLiveStreamHealth?: StreamHealthState;
};

const streamHealthState: StreamHealthState = stateRoot.__tradeVetoLiveStreamHealth ?? {
  activeStreams: new Map<string, number>(),
  events: [],
  sequence: 0,
};

stateRoot.__tradeVetoLiveStreamHealth = streamHealthState;

export function recordLiveIntelligenceStreamOpen(refreshIntervalMs: number): string {
  streamHealthState.sequence += 1;
  const streamId = `stream-${Date.now()}-${streamHealthState.sequence}-${Math.max(0, Math.round(refreshIntervalMs))}`;
  streamHealthState.activeStreams.set(streamId, Date.now());
  pushEvent({ atMs: Date.now(), buildMs: null, type: "open" });
  return streamId;
}

export function recordLiveIntelligenceStreamEvent(buildMs: number): void {
  pushEvent({ atMs: Date.now(), buildMs: safeDuration(buildMs), type: "event" });
}

export function recordLiveIntelligenceStreamError(buildMs: number | null = null): void {
  pushEvent({ atMs: Date.now(), buildMs: buildMs === null ? null : safeDuration(buildMs), type: "error" });
}

export function recordLiveIntelligenceStreamClose(streamId: string): void {
  if (streamHealthState.activeStreams.delete(streamId)) {
    pushEvent({ atMs: Date.now(), buildMs: null, type: "close" });
  }
}

export function getLiveIntelligenceStreamHealthSnapshot(nowMs = Date.now()): LiveIntelligenceStreamHealthSnapshot {
  trimEvents(nowMs);
  const events = streamHealthState.events.filter((event) => event.atMs >= nowMs - WINDOW_MS);
  const opened = events.filter((event) => event.type === "open").length;
  const closed = events.filter((event) => event.type === "close").length;
  const delivered = events.filter((event) => event.type === "event");
  const errors = events.filter((event) => event.type === "error");
  const eventBuildTimes = delivered.map((event) => event.buildMs).filter((value): value is number => value !== null);
  const errorRatePct = delivered.length + errors.length
    ? Math.round((errors.length / (delivered.length + errors.length)) * 100)
    : 0;
  return {
    activeStreams: streamHealthState.activeStreams.size,
    averageEventBuildMs: eventBuildTimes.length ? Math.round(eventBuildTimes.reduce((sum, value) => sum + value, 0) / eventBuildTimes.length) : null,
    closedStreamsLastHour: closed,
    errorRatePct,
    errorsLastHour: errors.length,
    eventsLastHour: delivered.length,
    lastErrorAt: isoFromMs(errors.at(-1)?.atMs ?? null),
    lastEventAt: isoFromMs(delivered.at(-1)?.atMs ?? null),
    openedStreamsLastHour: opened,
    reconnectPressure: reconnectPressure({ activeStreams: streamHealthState.activeStreams.size, closed, errors: errors.length, opened }),
    windowSize: events.length,
  };
}

export function resetLiveIntelligenceStreamHealthForTests(): void {
  streamHealthState.activeStreams.clear();
  streamHealthState.events = [];
  streamHealthState.sequence = 0;
}

function pushEvent(event: StreamEvent): void {
  streamHealthState.events.push(event);
  trimEvents(event.atMs);
}

function trimEvents(nowMs: number): void {
  const cutoff = nowMs - WINDOW_MS;
  while (streamHealthState.events.length > MAX_EVENTS || streamHealthState.events[0]?.atMs < cutoff) {
    streamHealthState.events.shift();
  }
}

function reconnectPressure(input: { activeStreams: number; closed: number; errors: number; opened: number }): LiveIntelligenceStreamHealthSnapshot["reconnectPressure"] {
  if (input.opened === 0 && input.closed === 0 && input.errors === 0) return "unknown";
  if (input.errors >= 5) return "elevated";
  if (input.opened >= 20 && input.closed >= input.opened * 0.8 && input.activeStreams < Math.max(2, input.opened * 0.2)) return "elevated";
  return "normal";
}

function safeDuration(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(600_000, Math.round(value))) : 0;
}

function isoFromMs(value: number | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}
