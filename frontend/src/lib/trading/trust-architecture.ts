import { isVerifiedNewsSource, type VerifiedNewsItem } from "@/lib/news-source-policy";
import { cleanText } from "@/lib/ui/formatters";
import { LLM_FORBIDDEN_LANGUAGE } from "./llm-grounding";
import type { InstitutionalTrustModel, TrustTone } from "./institutional-trust";

export type TrustArchitectureStatus = "verified" | "limited" | "stale" | "blocked";

export type TrustLineageCategory = "origin" | "macro" | "replay" | "indicator" | "confidence" | "freshness" | "source" | "audit";

export type EvidenceLineageNode = {
  category: TrustLineageCategory;
  detail: string;
  id: string;
  label: string;
  strength: number;
  timestamp: string | null;
  tone: TrustTone;
  value: string;
};

export type SourceTraceabilityRecord = {
  label: string;
  status: "verified" | "missing" | "rejected";
  timestamp: string | null;
  url: string | null;
};

export type ConfidenceGovernanceResult = {
  band: "high" | "medium" | "low" | "blocked";
  downgradeReasons: string[];
  governedConfidence: number;
  rawConfidence: number;
  state: "usable" | "limited" | "stale" | "blocked";
};

export type TrustArchitecturePacket = {
  auditTrail: string[];
  confidence: ConfidenceGovernanceResult;
  evidenceLineage: EvidenceLineageNode[];
  reproducibility: string[];
  safetyRules: string[];
  score: number;
  sourceTraceability: SourceTraceabilityRecord[];
  status: TrustArchitectureStatus;
  warnings: string[];
};

export type TrustArchitectureCertification = {
  passed: boolean;
  blockers: string[];
  warnings: string[];
};

export type ConfidenceGovernanceInput = {
  conflictCount?: number;
  evidenceScore?: number | null;
  freshnessStatus?: string | null;
  rawConfidence: number;
  sourceCount?: number;
  unsupportedClaimsDetected?: boolean;
};

const DIRECT_ADVICE_LANGUAGE = /\b(?:you should|should|recommend(?:ed)? to|must|need to)\s+(?:buy|sell|enter|exit|short|long)\b/i;

export function governConfidence(input: ConfidenceGovernanceInput): ConfidenceGovernanceResult {
  const rawConfidence = bounded(input.rawConfidence);
  const evidenceScore = input.evidenceScore === null || input.evidenceScore === undefined ? null : bounded(input.evidenceScore);
  const freshness = cleanText(input.freshnessStatus, "unknown").toLowerCase();
  const conflictCount = Math.max(0, Math.round(input.conflictCount ?? 0));
  const sourceCount = Math.max(0, Math.round(input.sourceCount ?? 0));
  const downgradeReasons: string[] = [];
  let governedConfidence = rawConfidence;
  let state: ConfidenceGovernanceResult["state"] = "usable";

  if (input.unsupportedClaimsDetected) {
    downgradeReasons.push("unsupported claims detected; AI output must be suppressed");
    governedConfidence = 0;
    state = "blocked";
  }
  if (/\b(stale|old|outdated)\b/.test(freshness)) {
    downgradeReasons.push("freshness is stale");
    governedConfidence -= 28;
    if (state !== "blocked") state = "stale";
  } else if (/\b(missing|unknown|unavailable|schema|limited)\b/.test(freshness)) {
    downgradeReasons.push("freshness is incomplete");
    governedConfidence -= 18;
    if (state === "usable") state = "limited";
  }
  if (evidenceScore !== null && evidenceScore < 45) {
    downgradeReasons.push("evidence quality is limited");
    governedConfidence -= 18;
    if (state === "usable") state = "limited";
  }
  if (conflictCount > 0) {
    downgradeReasons.push(`${conflictCount} conflicting signal${conflictCount === 1 ? "" : "s"} detected`);
    governedConfidence -= Math.min(22, 8 + conflictCount * 4);
    if (state === "usable") state = "limited";
  }
  if (sourceCount === 0) {
    downgradeReasons.push("no external source trace is attached");
    governedConfidence -= 8;
  }

  const finalConfidence = Math.round(bounded(governedConfidence));
  return {
    band: confidenceBand(finalConfidence, state),
    downgradeReasons: downgradeReasons.length ? uniqueStrings(downgradeReasons) : ["no confidence downgrade required from available trust checks"],
    governedConfidence: finalConfidence,
    rawConfidence: Math.round(rawConfidence),
    state,
  };
}

export function buildTrustArchitectureFromInstitutionalModel(model: InstitutionalTrustModel): TrustArchitecturePacket {
  const evidenceLineage = buildLineageNodes(model);
  const sourceTraceability = buildSourceTraceabilityFromModel(model);
  const warnings = uniqueStrings([
    ...model.limitations.filter((item) => !/no major limitation/i.test(item)),
    ...model.provenance.filter((item) => item.tone === "risk" || item.tone === "caution").map((item) => `${item.label}: ${item.value}`),
  ]);
  const confidence = governConfidence({
    conflictCount: model.limitations.filter((item) => /conflict|contradiction|mixed|risk|limited/i.test(item)).length,
    evidenceScore: evidenceScoreFromModel(model),
    freshnessStatus: model.freshness,
    rawConfidence: model.score,
    sourceCount: sourceTraceability.filter((item) => item.status === "verified").length,
    unsupportedClaimsDetected: containsUnsupportedClaim(model),
  });
  const status = architectureStatus(confidence, warnings, sourceTraceability);

  return {
    auditTrail: uniqueStrings([
      ...model.auditability,
      `Trust score after governance: ${confidence.governedConfidence}/100.`,
      `Trust state: ${status}.`,
    ]).slice(0, 7),
    confidence,
    evidenceLineage,
    reproducibility: uniqueStrings([
      model.summary,
      ...model.traceability,
      ...model.provenance.map((item) => `${item.label}: ${item.value} - ${item.detail}`),
    ]).slice(0, 8),
    safetyRules: [
      "Unsupported claims are suppressed and deterministic TradeVeto reasoning is shown instead.",
      "Stale, missing, or limited evidence downgrades confidence before display.",
      "News and event context require verified source, timestamp, headline, and URL.",
      "Research language remains non-advisory and cannot claim certainty.",
    ],
    score: confidence.governedConfidence,
    sourceTraceability,
    status,
    warnings: warnings.length ? warnings.slice(0, 8) : ["No major trust warning surfaced in the available packet."],
  };
}

export function sourceTraceabilityFromVerifiedNews(item: VerifiedNewsItem | null): SourceTraceabilityRecord {
  if (!item) {
    return {
      label: "No verified source attached",
      status: "missing",
      timestamp: null,
      url: null,
    };
  }
  return {
    label: item.source,
    status: isVerifiedNewsSource(item.source, item.url) ? "verified" : "rejected",
    timestamp: item.timestamp,
    url: item.url,
  };
}

export function certifyTrustArchitecture(packet: TrustArchitecturePacket): TrustArchitectureCertification {
  const combinedText = [
    ...packet.auditTrail,
    ...packet.reproducibility,
    ...packet.safetyRules,
    ...packet.warnings,
    ...packet.evidenceLineage.flatMap((item) => [item.label, item.value, item.detail]),
    ...packet.sourceTraceability.map((item) => item.label),
  ].join(" ");
  const blockers = uniqueStrings([
    packet.evidenceLineage.length < 3 ? "insufficient evidence lineage" : null,
    !packet.evidenceLineage.some((item) => item.category === "freshness") ? "missing freshness lineage" : null,
    packet.status === "blocked" ? "trust architecture is blocked" : null,
    packet.confidence.state === "blocked" ? "confidence governance blocked output" : null,
    LLM_FORBIDDEN_LANGUAGE.test(combinedText) ? "forbidden certainty language detected" : null,
    DIRECT_ADVICE_LANGUAGE.test(combinedText) ? "direct financial advice language detected" : null,
    packet.sourceTraceability.some((item) => item.status === "rejected") ? "rejected source attached" : null,
  ]);
  const warnings = uniqueStrings([
    packet.status === "stale" ? "stale intelligence requires visible warning" : null,
    packet.status === "limited" ? "limited evidence requires visible disclosure" : null,
    packet.sourceTraceability.every((item) => item.status !== "verified") ? "no verified external source attached" : null,
    ...packet.warnings.filter((item) => !/no major trust warning/i.test(item)).slice(0, 4),
  ]);

  return {
    blockers,
    passed: blockers.length === 0,
    warnings,
  };
}

function architectureStatus(confidence: ConfidenceGovernanceResult, warnings: string[], sources: SourceTraceabilityRecord[]): TrustArchitectureStatus {
  if (confidence.state === "blocked") return "blocked";
  if (confidence.state === "stale") return "stale";
  if (confidence.state === "limited" || confidence.governedConfidence < 20 || warnings.length || sources.every((item) => item.status !== "verified")) return "limited";
  return "verified";
}

function buildLineageNodes(model: InstitutionalTrustModel): EvidenceLineageNode[] {
  const nodes = model.provenance.map((item, index) => ({
    category: lineageCategory(item.label),
    detail: item.detail,
    id: stableId(`${item.label}-${item.value}-${index}`),
    label: item.label,
    strength: lineageStrength(item.tone, item.value),
    timestamp: timestampFromText(`${item.value} ${item.detail}`),
    tone: item.tone,
    value: item.value,
  }));
  const auditNode: EvidenceLineageNode = {
    category: "audit",
    detail: model.auditability[0] ?? "Audit trail is available when the backing workflow provides it.",
    id: "audit-trail",
    label: "Audit",
    strength: Math.min(100, Math.max(35, model.auditability.length * 18)),
    timestamp: timestampFromText(model.auditability.join(" ")),
    tone: "neutral",
    value: `${model.auditability.length} checks`,
  };
  return uniqueLineage([...nodes, auditNode]).slice(0, 8);
}

function buildSourceTraceabilityFromModel(model: InstitutionalTrustModel): SourceTraceabilityRecord[] {
  const linkedSources = model.workflow
    .filter((item) => /^https?:\/\//i.test(item.href))
    .map((item) => ({
      label: item.label,
      status: "verified" as const,
      timestamp: null,
      url: item.href,
    }));
  if (linkedSources.length) return linkedSources.slice(0, 5);
  return [{
    label: "Internal deterministic packet",
    status: "verified",
    timestamp: timestampFromText([...model.auditability, ...model.traceability].join(" ")),
    url: null,
  }];
}

function confidenceBand(value: number, state: ConfidenceGovernanceResult["state"]): ConfidenceGovernanceResult["band"] {
  if (state === "blocked") return "blocked";
  if (value >= 74) return "high";
  if (value >= 48) return "medium";
  return "low";
}

function evidenceScoreFromModel(model: InstitutionalTrustModel): number | null {
  const explicit = model.provenance.find((item) => item.label.toLowerCase().includes("evidence"));
  const text = explicit ? `${explicit.value} ${explicit.detail}` : model.evidenceQuality;
  const match = text.match(/\b(\d{1,3})(?:\s*\/\s*100)?\b/);
  if (!match) return /limited/i.test(text) ? 30 : null;
  return bounded(Number(match[1]));
}

function containsUnsupportedClaim(model: InstitutionalTrustModel): boolean {
  const text = [
    model.headline,
    model.summary,
    model.evidenceQuality,
    model.freshness,
    ...model.auditability,
    ...model.limitations,
    ...model.personalization,
    ...model.traceability,
    ...model.provenance.flatMap((item) => [item.label, item.value, item.detail]),
  ].join(" ");
  return LLM_FORBIDDEN_LANGUAGE.test(text) || DIRECT_ADVICE_LANGUAGE.test(text);
}

function lineageCategory(label: string): TrustLineageCategory {
  const normalized = label.toLowerCase();
  if (normalized.includes("fresh") || normalized.includes("timestamp")) return "freshness";
  if (normalized.includes("macro")) return "macro";
  if (normalized.includes("replay") || normalized.includes("memory")) return "replay";
  if (normalized.includes("confidence")) return "confidence";
  if (normalized.includes("source") || normalized.includes("news") || normalized.includes("event")) return "source";
  if (normalized.includes("risk") || normalized.includes("score") || normalized.includes("evidence")) return "indicator";
  return "origin";
}

function lineageStrength(tone: TrustTone, value: string): number {
  const numericMatch = value.match(/\b(\d{1,3})(?:\s*\/\s*100)?\b/);
  if (numericMatch) return bounded(Number(numericMatch[1]));
  if (tone === "constructive") return 82;
  if (tone === "intelligence") return 72;
  if (tone === "caution") return 48;
  if (tone === "risk") return 30;
  return 58;
}

function timestampFromText(value: string): string | null {
  const iso = value.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z\b/);
  if (iso) return iso[0];
  const date = value.match(/\b\d{4}-\d{2}-\d{2}\b/);
  return date ? date[0] : null;
}

function stableId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "lineage-node";
}

function bounded(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function uniqueLineage(nodes: EvidenceLineageNode[]): EvidenceLineageNode[] {
  const seen = new Set<string>();
  const output: EvidenceLineageNode[] = [];
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    output.push(node);
  }
  return output;
}

function uniqueStrings(values: Array<string | null | undefined | false>): string[] {
  const output: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const text = cleanText(value, "");
    if (text && !output.includes(text)) output.push(text);
  }
  return output;
}
