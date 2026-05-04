export function formatAdminDate(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let next = Math.max(0, value);
  let unitIndex = 0;
  while (next >= 1024 && unitIndex < units.length - 1) {
    next /= 1024;
    unitIndex += 1;
  }
  return `${next.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function statusTone(status: string | null | undefined): "default" | "good" | "warn" | "bad" {
  const normalized = String(status ?? "").toLowerCase();
  if (["ok", "success", "active", "trialing", "healthy"].includes(normalized)) return "good";
  if (["warn", "warning", "pending", "past_due", "stale"].includes(normalized)) return "warn";
  if (["error", "fail", "failed", "missing", "canceled", "unpaid", "inactive"].includes(normalized)) return "bad";
  return "default";
}
