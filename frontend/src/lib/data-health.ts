export type DataFreshnessStatus = "fresh" | "slightly_stale" | "stale" | "missing" | "schema_mismatch";

export type DataFreshness = {
  status: DataFreshnessStatus;
  label: string;
  lastUpdated: string | null;
  ageMinutes: number | null;
  humanAge: string;
  message: string;
};

const FRESH_UNTIL_MS = 5 * 60 * 1000;
const STALE_AFTER_MS = 30 * 60 * 1000;

export function freshnessFromTimestamp(lastUpdated: string | null | undefined, nowMs = Date.now()): DataFreshness {
  const timestamp = normalizedTimestamp(lastUpdated);
  if (!timestamp) {
    return {
      status: "missing",
      label: "Data unavailable",
      lastUpdated: null,
      ageMinutes: null,
      humanAge: "No timestamp available",
      message: "No scanner timestamp is available for this data.",
    };
  }

  const updatedMs = Date.parse(timestamp);
  const ageMs = Math.max(0, nowMs - updatedMs);
  const ageMinutes = ageMs / 60000;
  const status = ageMs < FRESH_UNTIL_MS ? "fresh" : ageMs < STALE_AFTER_MS ? "slightly_stale" : "stale";
  const label = status === "fresh" ? "Fresh" : status === "slightly_stale" ? "Slightly stale" : "Stale";
  const humanAge = `Updated ${formatAge(ageMs)} ago`;

  return {
    status,
    label,
    lastUpdated: timestamp,
    ageMinutes,
    humanAge,
    message: `${label} - ${humanAge.toLowerCase()}`,
  };
}

export function unavailableFreshness(status: Extract<DataFreshnessStatus, "missing" | "schema_mismatch">, message: string): DataFreshness {
  return {
    status,
    label: status === "schema_mismatch" ? "Schema issue" : "Data unavailable",
    lastUpdated: null,
    ageMinutes: null,
    humanAge: "No timestamp available",
    message,
  };
}

export function normalizedTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || ["nan", "none", "null", "n/a", "undefined"].includes(text.toLowerCase())) return null;
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function formatAge(ageMs: number): string {
  if (ageMs < 45 * 1000) return "just now";
  const minutes = Math.round(ageMs / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}
