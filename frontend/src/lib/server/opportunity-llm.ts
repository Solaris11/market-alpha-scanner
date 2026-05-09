import "server-only";

import { evaluateLlmGrounding, groundingPacketFromStructuredData } from "@/lib/trading/llm-grounding";
import type { RiskTolerantOpportunityPacket } from "@/lib/trading/risk-tolerant-opportunities";
import { deterministicOpportunityExplanation } from "@/lib/trading/risk-tolerant-opportunities";

export type RiskTolerantLlmAnalysis = {
  available: boolean;
  chaseRiskAssessment: string;
  conciseExplanation: string;
  dataFreshnessNote: string;
  evidenceSupportingRanking: string[];
  monitorNext: string[];
  profileFitReason: string;
  safetyLanguage: string;
  source: "deterministic" | "llm";
  uncertaintyNote: string;
  whyItMayFail: string;
  whyItMayWork: string;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const FORBIDDEN_LANGUAGE = /\b(buy now|sell now|guaranteed|sure profit|can't lose|cannot lose|will definitely|must buy|must sell)\b/i;

export async function analyzeRiskTolerantOpportunity(packet: RiskTolerantOpportunityPacket): Promise<RiskTolerantLlmAnalysis> {
  if (!llmEnabled()) return deterministicAnalysis(packet, false);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = (process.env.TRADEVETO_OPPORTUNITY_LLM_MODEL || process.env.TRADEVETO_EVENT_LLM_MODEL || "").trim();
  if (!apiKey || !model) return deterministicAnalysis(packet, false);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      body: JSON.stringify(requestPayload(model, packet)),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "TradeVetoRiskTolerantOpportunity/1.0 (+https://tradeveto.com)",
      },
      method: "POST",
      signal: controller.signal,
    });
    if (!response.ok) return deterministicAnalysis(packet, false);
    const payload = await response.json() as unknown;
    const text = extractOutputText(payload);
    if (!text) return deterministicAnalysis(packet, false);
    const parsed = parseAnalysisJson(text);
    const validated = validateAnalysis(parsed, packet);
    return validated ?? deterministicAnalysis(packet, false);
  } catch {
    return deterministicAnalysis(packet, false);
  } finally {
    clearTimeout(timeout);
  }
}

export function deterministicAnalysis(packet: RiskTolerantOpportunityPacket, llmWasAvailable = false): RiskTolerantLlmAnalysis {
  const explanation = deterministicOpportunityExplanation(packet);
  return {
    available: llmWasAvailable,
    chaseRiskAssessment: packet.candidate.chaseRiskScore >= 70
      ? "Chase risk is elevated; the setup should be treated as pullback or confirmation dependent."
      : "Chase risk is not the dominant blocker, but entry quality still matters.",
    conciseExplanation: explanation,
    dataFreshnessNote: packet.dataFreshness.status === "fresh" || packet.dataFreshness.status === "slightly_stale"
      ? packet.dataFreshness.message
      : `${packet.dataFreshness.message}. Treat the analysis as limited until fresh data updates.`,
    evidenceSupportingRanking: packet.deterministicReasons.keyReasons.slice(0, 3),
    monitorNext: [
      "Whether macro/event pressure improves or deteriorates.",
      "Whether price returns toward the research entry zone instead of extending into the do-not-chase area.",
      "Whether core decision quality improves from WAIT/AVOID toward cleaner confirmation.",
    ],
    profileFitReason: packet.candidate.riskTolerantRank
      ? `${packet.candidate.symbol} is ranked within the selected ${packet.preference.label} profile by deterministic TradeVeto scores.`
      : `${packet.candidate.symbol} did not fully fit the selected ${packet.preference.label} profile.`,
    safetyLanguage: "Risk-tolerant opportunity mode is speculative research context only. It is not financial advice or a core buy signal.",
    source: "deterministic",
    uncertaintyNote: packet.marketMemory?.available
      ? `${packet.marketMemory.evidenceLabel}. Historical analogs are context, not prediction.`
      : "Historical analog evidence is limited for this specific setup.",
    whyItMayFail: packet.deterministicReasons.keyRisks[0] ?? "The setup may fail if downside risk, chase risk, or macro pressure increases.",
    whyItMayWork: packet.deterministicReasons.keyReasons[0] ?? "The setup may work if current scanner evidence continues to improve.",
  };
}

function requestPayload(model: string, packet: RiskTolerantOpportunityPacket): Record<string, unknown> {
  return {
    model,
    input: [
      {
        role: "system",
        content: [
          "You explain a risk-tolerant opportunity ranking for TradeVeto.",
          "Use only the supplied structured packet.",
          "If personalization is present, explain how the candidate fits or conflicts with that user's selected style and behavioral summary.",
          "Do not invent prices, news, probabilities, targets, scores, or events.",
          "The deterministic engine owns all numeric claims and ranking decisions.",
          "Do not manipulate the user or encourage reckless exposure.",
          "Do not use the words buy or sell. Use entry, exit, act, or avoid action instead.",
          "Do not say guaranteed, sure profit, or direct financial advice.",
          "Mention stale or limited data if the packet says data freshness or evidence is limited.",
          "Return strict ASCII JSON only. Do not use curly quotes. Do not put quotation marks inside string values.",
          "The safetyLanguage field must include the exact phrase: not financial advice.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify(packet),
      },
    ],
    store: false,
    text: {
      format: {
        type: "json_schema",
        name: "risk_tolerant_opportunity_explanation",
        strict: true,
        schema: analysisSchema(),
      },
    },
  };
}

function analysisSchema(): Record<string, unknown> {
  const stringSchema = { type: "string", minLength: 1, maxLength: 420 };
  return {
    additionalProperties: false,
    properties: {
      chaseRiskAssessment: stringSchema,
      conciseExplanation: stringSchema,
      dataFreshnessNote: stringSchema,
      evidenceSupportingRanking: { items: stringSchema, maxItems: 4, minItems: 1, type: "array" },
      monitorNext: { items: stringSchema, maxItems: 4, minItems: 1, type: "array" },
      profileFitReason: stringSchema,
      safetyLanguage: stringSchema,
      uncertaintyNote: stringSchema,
      unsupportedClaimsDetected: { type: "boolean" },
      whyItMayFail: stringSchema,
      whyItMayWork: stringSchema,
    },
    required: [
      "chaseRiskAssessment",
      "conciseExplanation",
      "dataFreshnessNote",
      "evidenceSupportingRanking",
      "monitorNext",
      "profileFitReason",
      "safetyLanguage",
      "uncertaintyNote",
      "unsupportedClaimsDetected",
      "whyItMayFail",
      "whyItMayWork",
    ],
    type: "object",
  };
}

function parseAnalysisJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return parseLooseAnalysisJson(text);
  }
}

function parseLooseAnalysisJson(text: string): Record<string, unknown> | null {
  const unsupportedClaimsDetected = booleanField(text, "unsupportedClaimsDetected");
  if (unsupportedClaimsDetected === null) return null;
  return {
    chaseRiskAssessment: looseStringField(text, "chaseRiskAssessment"),
    conciseExplanation: looseStringField(text, "conciseExplanation"),
    dataFreshnessNote: looseStringField(text, "dataFreshnessNote"),
    evidenceSupportingRanking: looseStringArrayField(text, "evidenceSupportingRanking"),
    monitorNext: looseStringArrayField(text, "monitorNext"),
    profileFitReason: looseStringField(text, "profileFitReason"),
    safetyLanguage: looseStringField(text, "safetyLanguage"),
    uncertaintyNote: looseStringField(text, "uncertaintyNote"),
    unsupportedClaimsDetected,
    whyItMayFail: looseStringField(text, "whyItMayFail"),
    whyItMayWork: looseStringField(text, "whyItMayWork"),
  };
}

function looseStringField(text: string, field: string): string {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`"${escaped}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,|})`).exec(text);
  return normalizeJsonishText(match?.[1] ?? "");
}

function looseStringArrayField(text: string, field: string): string[] {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`"${escaped}"\\s*:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|})`).exec(text);
  const body = match?.[1] ?? "";
  const items: string[] = [];
  const itemPattern = /"([^"]*)"/g;
  let item: RegExpExecArray | null;
  while ((item = itemPattern.exec(body)) !== null) {
    const normalized = normalizeJsonishText(item[1]);
    if (normalized) items.push(normalized);
  }
  return items;
}

function booleanField(text: string, field: string): boolean | null {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`"${escaped}"\\s*:\\s*(true|false)`).exec(text);
  if (!match) return null;
  return match[1] === "true";
}

function normalizeJsonishText(text: string): string {
  return text
    .replace(/[“”]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/\\n/g, " ")
    .replace(/\\"/g, "\"")
    .replace(/\s+/g, " ")
    .replace(/,+$/g, "")
    .trim();
}

function validateAnalysis(value: unknown, packet: RiskTolerantOpportunityPacket): RiskTolerantLlmAnalysis | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.unsupportedClaimsDetected !== false) return null;
  const fields = {
    chaseRiskAssessment: safeText(record.chaseRiskAssessment),
    conciseExplanation: safeText(record.conciseExplanation),
    dataFreshnessNote: safeText(record.dataFreshnessNote),
    profileFitReason: safeText(record.profileFitReason),
    safetyLanguage: safeText(record.safetyLanguage),
    uncertaintyNote: safeText(record.uncertaintyNote),
    whyItMayFail: safeText(record.whyItMayFail),
    whyItMayWork: safeText(record.whyItMayWork),
  };
  if (Object.values(fields).some((text) => !text || FORBIDDEN_LANGUAGE.test(text))) return null;
  const evidenceSupportingRanking = stringArray(record.evidenceSupportingRanking, 4);
  const monitorNext = stringArray(record.monitorNext, 4);
  if (!evidenceSupportingRanking.length || !monitorNext.length) return null;
  if (packet.dataFreshness.status === "stale" && !fields.dataFreshnessNote.toLowerCase().includes("stale")) return null;
  if (!fields.safetyLanguage.toLowerCase().includes("not financial advice") && !fields.safetyLanguage.toLowerCase().includes("research")) return null;
  const grounding = evaluateLlmGrounding({
    output: {
      ...fields,
      evidenceSupportingRanking,
      monitorNext,
      unsupportedClaimsDetected: record.unsupportedClaimsDetected,
    },
    packet: groundingPacketFromStructuredData(packet),
    requiredFields: [
      "chaseRiskAssessment",
      "conciseExplanation",
      "dataFreshnessNote",
      "evidenceSupportingRanking",
      "monitorNext",
      "profileFitReason",
      "safetyLanguage",
      "uncertaintyNote",
      "whyItMayFail",
      "whyItMayWork",
    ],
  });
  if (!grounding.safeForUse) return null;
  return {
    available: true,
    source: "llm",
    ...fields,
    evidenceSupportingRanking,
    monitorNext,
  };
}

function stringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeText(item)).filter((item) => item && !FORBIDDEN_LANGUAGE.test(item)).slice(0, limit);
}

function safeText(value: unknown): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 420 ? text.slice(0, 420) : text;
}

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return "";
  const chunks: string[] = [];
  for (const item of record.output) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const chunk of content) {
      if (!chunk || typeof chunk !== "object" || Array.isArray(chunk)) continue;
      const text = (chunk as Record<string, unknown>).text;
      if (typeof text === "string") chunks.push(text);
    }
  }
  return chunks.join("").trim();
}

function llmEnabled(): boolean {
  const value = (process.env.TRADEVETO_OPPORTUNITY_LLM_ENABLED || process.env.TRADEVETO_EVENT_LLM_ENABLED || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(value);
}

function timeoutMs(): number {
  const raw = Number(process.env.TRADEVETO_OPPORTUNITY_LLM_TIMEOUT_SECONDS || process.env.TRADEVETO_EVENT_LLM_TIMEOUT_SECONDS || 8);
  const seconds = Number.isFinite(raw) ? Math.max(2, Math.min(20, raw)) : 8;
  return seconds * 1000;
}
