/**
 * Server-side render timing for a single route render.
 *
 * Measured on production with a logged-in premium session, /terminal sends its
 * first byte in 186ms and then emits nothing for about twelve seconds before
 * flushing the whole 13.7 MB document in under a second. Parsing accounts for
 * 81ms of it. So the wait is not bandwidth and not payload size: it is work
 * this component does before it can resolve.
 *
 * This records where that time goes. It emits step names, durations and item
 * counts only -- never a symbol list, a user id, a row, or anything read from
 * the environment.
 */

export type RenderTimelineEntry = {
  concurrent: boolean;
  detail: string | null;
  ms: number;
  step: string;
};

export type RenderTimeline = {
  /** Measure one promise. Safe to use inside Promise.all; marks the entry concurrent. */
  track: <T>(step: string, work: Promise<T>, detail?: string | (() => string)) => Promise<T>;
  /** Measure one synchronous call. */
  sync: <T>(step: string, work: () => T, detail?: string | ((value: T) => string)) => T;
  /** Measure a wall-clock span that contains concurrent work. */
  phase: (step: string) => () => void;
  /** Emit one line and return the entries. */
  finish: (detail?: string) => RenderTimelineEntry[];
};

const ENABLED = process.env.TRADEVETO_RENDER_TIMING !== "false";

export function createRenderTimeline(route: string): RenderTimeline {
  const startedAt = Date.now();
  const entries: RenderTimelineEntry[] = [];

  const record = (step: string, ms: number, detail: string | null, concurrent: boolean) => {
    entries.push({ concurrent, detail: detail ? safeDetail(detail) : null, ms: Math.round(ms), step });
  };

  return {
    async track(step, work, detail) {
      if (!ENABLED) return work;
      const began = Date.now();
      try {
        const value = await work;
        record(step, Date.now() - began, resolveDetail(detail), true);
        return value;
      } catch (error) {
        record(step, Date.now() - began, "threw", true);
        throw error;
      }
    },
    sync(step, work, detail) {
      if (!ENABLED) return work();
      const began = Date.now();
      const value = work();
      record(step, Date.now() - began, resolveDetail(detail, value), false);
      return value;
    },
    phase(step) {
      const began = Date.now();
      return () => {
        if (ENABLED) record(step, Date.now() - began, "wall clock", false);
      };
    },
    finish(detail) {
      const total = Date.now() - startedAt;
      if (!ENABLED) return entries;
      const slowest = [...entries].sort((left, right) => right.ms - left.ms).slice(0, 12);
      const rendered = slowest
        .map((entry) => `${entry.step}=${entry.ms}ms${entry.concurrent ? "*" : ""}${entry.detail ? `(${entry.detail})` : ""}`)
        .join(" ");
      console.info(`[render-timing] route=${route} total=${total}ms steps=${entries.length}${detail ? ` ${safeDetail(detail)}` : ""} | ${rendered}`);
      return entries;
    },
  };
}

function resolveDetail<T>(detail: string | ((value: T) => string) | undefined, value?: T): string | null {
  if (detail === undefined) return null;
  try {
    return typeof detail === "function" ? (detail as (value: T) => string)(value as T) : detail;
  } catch {
    return null;
  }
}

/** Counts and short labels only; anything longer is truncated rather than logged whole. */
function safeDetail(detail: string): string {
  return detail.replace(/[\r\n]+/g, " ").slice(0, 60);
}
