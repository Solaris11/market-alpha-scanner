export type ProviderOperationalState = "active" | "delayed" | "limited" | "outage" | "partial-outage" | "stale";

export type TrustStateKey = "degraded_mode" | "delayed_data" | "limited_evidence" | "provider_outage" | "stale_intelligence";

export type TrustStateStatus = "active" | "clear" | "unknown";

export type VisibleTrustState = {
  detail: string;
  key: TrustStateKey;
  label: string;
  status: TrustStateStatus;
};

export type TrustStateInput = {
  backupStatus?: string | null;
  dbStatus?: string | null;
  incidentCount?: number;
  providerCount?: number;
  providerFallbackCount?: number;
  scannerAgeMinutes?: number | null;
  scannerStatus?: string | null;
};

export type CertificationGateStatus = "blocked" | "certified" | "partial" | "unknown";

export function classifyProviderOperationalState(input: {
  providerCount: number;
  providerFallbackCount: number;
  scannerAgeMinutes: number | null;
  scannerStatus: string | null;
}): ProviderOperationalState {
  const scannerStatus = normalizeStatus(input.scannerStatus);
  const providerCount = Math.max(0, Math.round(input.providerCount));
  const fallbackCount = Math.max(0, Math.round(input.providerFallbackCount));
  const ageMinutes = input.scannerAgeMinutes;

  if (scannerStatus === "missing" || scannerStatus === "schema_mismatch" || scannerStatus === "fail" || scannerStatus === "failed") return "outage";
  if (scannerStatus === "stale" || ageMinutes !== null && ageMinutes >= 120) return "stale";
  if (providerCount === 0) return "limited";
  if (fallbackCount > 0) return "partial-outage";
  if (scannerStatus === "slightly_stale" || ageMinutes !== null && ageMinutes >= 45) return "delayed";
  return "active";
}

export function buildVisibleTrustStates(input: TrustStateInput): VisibleTrustState[] {
  const scannerStatus = normalizeStatus(input.scannerStatus);
  const dbStatus = normalizeStatus(input.dbStatus);
  const backupStatus = normalizeStatus(input.backupStatus);
  const ageMinutes = input.scannerAgeMinutes ?? null;
  const providerFallbackCount = Math.max(0, Math.round(input.providerFallbackCount ?? 0));
  const providerCount = Math.max(0, Math.round(input.providerCount ?? 0));
  const incidentCount = Math.max(0, Math.round(input.incidentCount ?? 0));
  const providerState = classifyProviderOperationalState({
    providerCount,
    providerFallbackCount,
    scannerAgeMinutes: ageMinutes,
    scannerStatus,
  });

  return [
    {
      detail: scannerStatus === "stale" || ageMinutes !== null && ageMinutes >= 120
        ? `Latest scanner packet is stale${ageMinutes === null ? "." : ` at ${Math.round(ageMinutes)} minutes old.`}`
        : "Latest scanner packet is not currently classified as stale.",
      key: "stale_intelligence",
      label: "Stale intelligence",
      status: scannerStatus === "stale" || ageMinutes !== null && ageMinutes >= 120 ? "active" : scannerStatus === "unknown" ? "unknown" : "clear",
    },
    {
      detail: providerCount === 0
        ? "No provider attribution is visible in the latest scanner packet."
        : `${providerCount} provider attribution bucket(s) are visible in the latest scanner packet.`,
      key: "limited_evidence",
      label: "Limited evidence",
      status: providerCount === 0 || scannerStatus === "missing" || scannerStatus === "schema_mismatch" ? "active" : "clear",
    },
    {
      detail: providerState === "outage" || providerState === "partial-outage" || providerFallbackCount > 0
        ? `${providerFallbackCount} provider fallback row(s) are visible in the latest scanner packet.`
        : "No provider outage or fallback signal is active in the latest scanner packet.",
      key: "provider_outage",
      label: "Provider outage",
      status: providerState === "outage" || providerState === "partial-outage" || providerFallbackCount > 0 ? "active" : providerState === "limited" ? "unknown" : "clear",
    },
    {
      detail: ageMinutes !== null && ageMinutes >= 45
        ? `Latest data is aging at ${Math.round(ageMinutes)} minutes old.`
        : "No delayed-feed condition is active from the current scanner freshness evidence.",
      key: "delayed_data",
      label: "Delayed data",
      status: scannerStatus === "slightly_stale" || ageMinutes !== null && ageMinutes >= 45 ? "active" : ageMinutes === null ? "unknown" : "clear",
    },
    {
      detail: degradedDetail({ backupStatus, dbStatus, incidentCount, scannerStatus }),
      key: "degraded_mode",
      label: "Degraded mode",
      status: dbStatus === "fail" || scannerStatus === "fail" || backupStatus === "failed" || incidentCount > 0 ? "active" : "clear",
    },
  ];
}

export function certificationGateStatusFromEvent(input: { eventStatus?: string | null; hasEvidence: boolean }): CertificationGateStatus {
  const status = normalizeStatus(input.eventStatus);
  if (!input.hasEvidence) return "unknown";
  if (status === "ok" || status === "pass" || status === "passed" || status === "certified") return "certified";
  if (status === "partial" || status === "warn" || status === "warning") return "partial";
  return "blocked";
}

function degradedDetail(input: { backupStatus: string; dbStatus: string; incidentCount: number; scannerStatus: string }): string {
  const parts: string[] = [];
  if (input.dbStatus === "fail") parts.push("database health is failing");
  if (input.scannerStatus === "fail" || input.scannerStatus === "missing" || input.scannerStatus === "schema_mismatch") parts.push("scanner health is degraded");
  if (input.backupStatus === "failed") parts.push("backup health is failing");
  if (input.incidentCount > 0) parts.push(`${input.incidentCount} active warning/error incident(s) are visible`);
  return parts.length ? parts.join("; ") : "No degraded-mode condition is active from current operational evidence.";
}

function normalizeStatus(value: string | null | undefined): string {
  return String(value ?? "unknown").trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
}
