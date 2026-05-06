export type BackupStatus = "failed" | "ok" | "unknown" | "warn";
export type BackupOverallStatus = "failed" | "ok" | "partial" | "unknown";

export type BackupComponent = {
  ageMinutes?: number | null;
  lastUpdated?: string | null;
  message: string;
  status: BackupStatus;
};

export type BackupHealthDetails = BackupComponent & {
  latestEvent?: BackupEventSummary | null;
  local_backup: BackupStatus;
  localBackup: BackupComponent;
  offsite_backup: BackupStatus;
  offsiteBackup: BackupComponent;
  overall_backup: BackupOverallStatus;
  overallBackup: BackupOverallStatus;
};

export type BackupEventSummary = {
  createdAt: string | null;
  message: string;
  metadata?: Record<string, unknown> | null;
  severity: string;
  status: string;
};

const OFFSITE_WARN_MINUTES = 8 * 60;
const OFFSITE_FAIL_MINUTES = 30 * 60;

export function classifyBackupHealth(input: {
  events: BackupEventSummary[];
  localBackup: BackupComponent;
  nowMs?: number;
}): BackupHealthDetails {
  const nowMs = input.nowMs ?? Date.now();
  const events = input.events.slice().sort((a, b) => eventTimeMs(b) - eventTimeMs(a));
  const latestEvent = events[0] ?? null;
  const latestOffsiteOk = events.find(isOffsiteSuccessEvent) ?? null;
  const latestOffsiteFailure = events.find(isOffsiteFailureEvent) ?? null;
  const offsiteBackup = classifyOffsiteBackup({ latestOffsiteFailure, latestOffsiteOk, nowMs });
  const overallBackup = classifyOverallBackup(input.localBackup.status, offsiteBackup.status);
  const status = overallStatusToComponentStatus(overallBackup);
  const message = backupOverallMessage(overallBackup, input.localBackup, offsiteBackup);
  const lastUpdated = newestTimestamp(input.localBackup.lastUpdated, offsiteBackup.lastUpdated);
  const ageMinutes = lastUpdated ? Math.max(0, (nowMs - new Date(lastUpdated).getTime()) / 60000) : null;

  return {
    ageMinutes,
    latestEvent,
    lastUpdated,
    local_backup: input.localBackup.status,
    localBackup: input.localBackup,
    message,
    offsite_backup: offsiteBackup.status,
    offsiteBackup,
    overall_backup: overallBackup,
    overallBackup,
    status,
  };
}

function classifyOffsiteBackup(input: {
  latestOffsiteFailure: BackupEventSummary | null;
  latestOffsiteOk: BackupEventSummary | null;
  nowMs: number;
}): BackupComponent {
  const okMs = eventTimeMs(input.latestOffsiteOk);
  const failureMs = eventTimeMs(input.latestOffsiteFailure);
  if (input.latestOffsiteFailure && failureMs > okMs) {
    return {
      ageMinutes: null,
      lastUpdated: input.latestOffsiteFailure.createdAt,
      message: input.latestOffsiteFailure.message || "Offsite backup sync failed.",
      status: "failed",
    };
  }
  if (!input.latestOffsiteOk || !input.latestOffsiteOk.createdAt) {
    return { ageMinutes: null, lastUpdated: null, message: "No successful offsite backup event found.", status: "unknown" };
  }
  const ageMinutes = Math.max(0, (input.nowMs - okMs) / 60000);
  const base = {
    ageMinutes,
    lastUpdated: input.latestOffsiteOk.createdAt,
    message: `Latest offsite backup synced ${Math.round(ageMinutes)} minutes ago.`,
  };
  if (ageMinutes > OFFSITE_FAIL_MINUTES) return { ...base, status: "failed" };
  if (ageMinutes > OFFSITE_WARN_MINUTES) return { ...base, status: "warn" };
  return { ...base, status: "ok" };
}

function classifyOverallBackup(localStatus: BackupStatus, offsiteStatus: BackupStatus): BackupOverallStatus {
  if (localStatus === "failed") return "failed";
  if (localStatus === "unknown") return offsiteStatus === "ok" ? "partial" : "unknown";
  if (localStatus === "ok" && offsiteStatus === "ok") return "ok";
  return "partial";
}

function overallStatusToComponentStatus(status: BackupOverallStatus): BackupStatus {
  if (status === "failed") return "failed";
  if (status === "ok") return "ok";
  if (status === "partial") return "warn";
  return "unknown";
}

function backupOverallMessage(overall: BackupOverallStatus, local: BackupComponent, offsite: BackupComponent): string {
  if (overall === "ok") return "Local and offsite backups are healthy.";
  if (overall === "failed") return `Backup failed: ${local.message}`;
  if (overall === "partial") return `Backup partial: local=${local.status}, offsite=${offsite.status}. ${offsite.message}`;
  return "Backup state is unknown.";
}

function isOffsiteSuccessEvent(event: BackupEventSummary): boolean {
  const classification = metadataText(event.metadata, "classification");
  const offsiteStatus = metadataText(event.metadata, "offsite_status");
  return event.status === "offsite_sync_ok" || classification === "offsite_sync_ok" || offsiteStatus === "ok";
}

function isOffsiteFailureEvent(event: BackupEventSummary): boolean {
  const classification = metadataText(event.metadata, "classification");
  const offsiteStatus = metadataText(event.metadata, "offsite_status");
  return (
    event.status === "backup_partial" ||
    event.status === "offsite_sync_failed" ||
    event.status === "backup_failed" ||
    event.status === "error" ||
    classification === "backup_partial" ||
    classification === "offsite_sync_failed" ||
    offsiteStatus === "offsite_sync_failed"
  );
}

function metadataText(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function newestTimestamp(...timestamps: Array<string | null | undefined>): string | null {
  const dates = timestamps
    .map((value) => value ? new Date(value) : null)
    .filter((value): value is Date => value !== null && Number.isFinite(value.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  return dates[0]?.toISOString() ?? null;
}

function eventTimeMs(event: BackupEventSummary | null | undefined): number {
  if (!event?.createdAt) return 0;
  const ms = new Date(event.createdAt).getTime();
  return Number.isFinite(ms) ? ms : 0;
}
