export type LlmGroundingMetrics = {
  deterministicOverrideDetected: boolean;
  directFinancialAdviceDetected: boolean;
  forbiddenLanguageDetected: boolean;
  groundednessScore: number;
  inventedNewsDetected: boolean;
  inventedPriceDetected: boolean;
  inventedProbabilityDetected: boolean;
  safeForUse: boolean;
  schemaValidity: boolean;
  staleDataDisclosure: boolean;
  unsupportedClaimsDetected: boolean;
  unsupportedMacroClaimsDetected: boolean;
  violations: string[];
};

export type LlmGroundingPacket = {
  allowedEventTitles?: string[];
  allowedEvidencePhrases?: string[];
  allowedNumbers?: number[];
  allowedSymbols?: string[];
  dataFreshnessStatus?: string | null;
  hasVerifiedEvents?: boolean;
  rawPacket?: unknown;
};

export type LlmGroundingInput = {
  output: unknown;
  packet?: LlmGroundingPacket;
  requiredFields?: string[];
  textBlocks?: string[];
};

export const LLM_FORBIDDEN_LANGUAGE = /\b(buy now|sell now|guaranteed|sure profit|can't lose|cannot lose|will definitely|must buy|must sell|risk-free|free money)\b/i;
const DIRECT_ADVICE_LANGUAGE = /\b(?:you should|should|recommend(?:ed)? to|must|need to)\s+(?:buy|sell|enter|exit|short|long)\b/i;
const UNSUPPORTED_MACRO_LANGUAGE = /\b(?:fed|rates?|inflation|cpi|oil|yields?|qqq|spy|market|war|peace talks?|regulators?)\s+(?:will|is going to|are going to|must|definitely)\b/i;
const DETERMINISTIC_OVERRIDE_LANGUAGE = /\b(?:ignore|override|disregard)\s+(?:the\s+)?(?:deterministic|scanner|tradeveto|core)\b|\b(?:deterministic|scanner|tradeveto|core)\s+(?:score|decision|ranking)\s+(?:is|are)\s+(?:wrong|irrelevant|invalid)\b/i;
const EVENT_NEWS_LANGUAGE = /\b(?:announced|reported|confirmed|news|earnings|guidance|cpi|fed|fomc|war|ceasefire|acquisition|merger|launch|regulatory|lawsuit)\b/i;
const PROBABILITY_LANGUAGE = /\b(?:probability|chance|odds|win rate|likelihood|will|guaranteed|certain)\b/i;
const PRICE_CONTEXT_LANGUAGE = /\b(?:price|target|entry|exit|stop|support|resistance|zone)\b/i;

export function evaluateLlmGrounding(input: LlmGroundingInput): LlmGroundingMetrics {
  const outputRecord = recordFrom(input.output);
  const packet = normalizePacket(input.packet, input.output);
  const text = normalizedText([
    ...flattenTextBlocks(input.output),
    ...(input.textBlocks ?? []),
  ]);
  const requiredFields = input.requiredFields ?? [];
  const schemaValidity = requiredFields.every((field) => hasNonEmptyField(outputRecord, field));
  const forbiddenLanguageDetected = LLM_FORBIDDEN_LANGUAGE.test(text);
  const directFinancialAdviceDetected = DIRECT_ADVICE_LANGUAGE.test(text);
  const inventedPriceDetected = inventedPriceClaimDetected(text, packet.allowedNumbers);
  const inventedProbabilityDetected = inventedProbabilityClaimDetected(text);
  const inventedNewsDetected = inventedNewsClaimDetected(text, packet);
  const unsupportedMacroClaimsDetected = UNSUPPORTED_MACRO_LANGUAGE.test(text);
  const deterministicOverrideDetected = DETERMINISTIC_OVERRIDE_LANGUAGE.test(text);
  const staleRequired = requiresStaleDisclosure(packet.dataFreshnessStatus);
  const staleDataDisclosure = !staleRequired || /\b(stale|limited|outdated|not fresh|data is limited|freshness is limited)\b/i.test(text);
  const unsupportedClaimsDetected = Boolean(outputRecord.unsupportedClaimsDetected)
    || inventedPriceDetected
    || inventedProbabilityDetected
    || inventedNewsDetected
    || unsupportedMacroClaimsDetected
    || deterministicOverrideDetected;
  const violations = [
    ...(!schemaValidity ? ["schema_invalid"] : []),
    ...(forbiddenLanguageDetected ? ["forbidden_language"] : []),
    ...(directFinancialAdviceDetected ? ["direct_financial_advice"] : []),
    ...(inventedPriceDetected ? ["invented_price"] : []),
    ...(inventedProbabilityDetected ? ["invented_probability"] : []),
    ...(inventedNewsDetected ? ["invented_news"] : []),
    ...(unsupportedMacroClaimsDetected ? ["unsupported_macro_claim"] : []),
    ...(deterministicOverrideDetected ? ["deterministic_override"] : []),
    ...(!staleDataDisclosure ? ["missing_stale_data_disclosure"] : []),
  ];
  const groundednessScore = Math.max(0, 100
    - (!schemaValidity ? 25 : 0)
    - (forbiddenLanguageDetected ? 28 : 0)
    - (directFinancialAdviceDetected ? 28 : 0)
    - (inventedPriceDetected ? 24 : 0)
    - (inventedProbabilityDetected ? 22 : 0)
    - (inventedNewsDetected ? 24 : 0)
    - (unsupportedMacroClaimsDetected ? 22 : 0)
    - (deterministicOverrideDetected ? 28 : 0)
    - (!staleDataDisclosure ? 15 : 0));

  return {
    deterministicOverrideDetected,
    directFinancialAdviceDetected,
    forbiddenLanguageDetected,
    groundednessScore,
    inventedNewsDetected,
    inventedPriceDetected,
    inventedProbabilityDetected,
    safeForUse: schemaValidity && staleDataDisclosure && !forbiddenLanguageDetected && !directFinancialAdviceDetected && !unsupportedClaimsDetected && groundednessScore >= 85,
    schemaValidity,
    staleDataDisclosure,
    unsupportedClaimsDetected,
    unsupportedMacroClaimsDetected,
    violations,
  };
}

export function safeLlmFallbackLanguage(scope: string): string {
  const label = scope.trim() || "LLM";
  return `${label} explanation was not used because validation failed. Deterministic TradeVeto reasoning is shown instead. Research only; not financial advice.`;
}

export function groundingPacketFromStructuredData(value: unknown): LlmGroundingPacket {
  const strings = collectStrings(value);
  return {
    allowedEventTitles: strings.filter((item) => EVENT_NEWS_LANGUAGE.test(item)).slice(0, 20),
    allowedEvidencePhrases: strings.slice(0, 80),
    allowedNumbers: collectNumbers(value),
    allowedSymbols: strings.filter((item) => /^[A-Z][A-Z0-9.-]{0,9}$/.test(item)).slice(0, 80),
    dataFreshnessStatus: freshnessStatusFrom(value),
    hasVerifiedEvents: strings.some((item) => /\b(EVENT_|verified event|earnings|fed|cpi|inflation|oil|war|regulatory)\b/i.test(item)),
    rawPacket: value,
  };
}

function normalizePacket(packet: LlmGroundingPacket | undefined, output: unknown): Required<LlmGroundingPacket> {
  const inferred = groundingPacketFromStructuredData(packet?.rawPacket ?? output);
  return {
    allowedEventTitles: packet?.allowedEventTitles ?? inferred.allowedEventTitles ?? [],
    allowedEvidencePhrases: packet?.allowedEvidencePhrases ?? inferred.allowedEvidencePhrases ?? [],
    allowedNumbers: packet?.allowedNumbers ?? inferred.allowedNumbers ?? [],
    allowedSymbols: packet?.allowedSymbols ?? inferred.allowedSymbols ?? [],
    dataFreshnessStatus: packet?.dataFreshnessStatus ?? inferred.dataFreshnessStatus ?? null,
    hasVerifiedEvents: packet?.hasVerifiedEvents ?? inferred.hasVerifiedEvents ?? false,
    rawPacket: packet?.rawPacket ?? inferred.rawPacket,
  };
}

function inventedPriceClaimDetected(text: string, allowedNumbers: number[]): boolean {
  const matches = [
    ...Array.from(text.matchAll(/\$\s*(-?\d+(?:\.\d+)?)/g)).map((match) => Number(match[1])),
    ...Array.from(text.matchAll(/\b(?:price|target|entry|exit|stop|support|resistance|zone)\D{0,18}(-?\d+(?:\.\d+)?)/gi)).map((match) => Number(match[1])),
  ].filter(Number.isFinite);
  return matches.some((value) => PRICE_CONTEXT_LANGUAGE.test(text) && !numberAllowed(value, allowedNumbers));
}

function inventedProbabilityClaimDetected(text: string): boolean {
  return Array.from(text.matchAll(/\b\d+(?:\.\d+)?\s*%/g)).some((match) => {
    const index = Math.max(0, match.index ?? 0);
    const context = text.slice(Math.max(0, index - 45), index + 80);
    return PROBABILITY_LANGUAGE.test(context);
  });
}

function inventedNewsClaimDetected(text: string, packet: Required<LlmGroundingPacket>): boolean {
  if (!EVENT_NEWS_LANGUAGE.test(text)) return false;
  if (!packet.hasVerifiedEvents) return true;
  const evidence = [...packet.allowedEventTitles, ...packet.allowedEvidencePhrases]
    .map((item) => item.toLowerCase())
    .filter((item) => item.length >= 8);
  if (!evidence.length) return true;
  const lowerText = text.toLowerCase();
  return !evidence.some((phrase) => lowerText.includes(phrase.slice(0, Math.min(phrase.length, 90))));
}

function requiresStaleDisclosure(status: string | null): boolean {
  if (!status) return false;
  return /\b(stale|limited|old|unknown|missing|unavailable)\b/i.test(status);
}

function hasNonEmptyField(record: Record<string, unknown>, field: string): boolean {
  const value = record[field];
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
}

function numberAllowed(value: number, allowed: number[]): boolean {
  return allowed.some((candidate) => Math.abs(candidate - value) <= Math.max(0.05, Math.abs(candidate) * 0.005));
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function flattenTextBlocks(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap((item) => flattenTextBlocks(item));
  if (typeof value === "object") return Object.values(value).flatMap((item) => flattenTextBlocks(item));
  return [];
}

function collectNumbers(value: unknown): number[] {
  if (typeof value === "number" && Number.isFinite(value)) return [value];
  if (typeof value === "string") {
    return Array.from(value.matchAll(/-?\d+(?:\.\d+)?/g)).map((match) => Number(match[0])).filter(Number.isFinite);
  }
  if (Array.isArray(value)) return uniqueNumbers(value.flatMap((item) => collectNumbers(item)));
  if (value && typeof value === "object") return uniqueNumbers(Object.values(value).flatMap((item) => collectNumbers(item)));
  return [];
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value.trim()].filter(Boolean);
  if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) return [];
  if (Array.isArray(value)) return uniqueStrings(value.flatMap((item) => collectStrings(item)));
  if (typeof value === "object") return uniqueStrings(Object.values(value).flatMap((item) => collectStrings(item)));
  return [];
}

function freshnessStatusFrom(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const status = freshnessStatusFrom(item);
      if (status) return status;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  const candidates = [record.status, record.dataFreshnessStatus, record.freshnessStatus, record.label, record.message];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && /\b(stale|fresh|limited|old|unknown|missing|unavailable)\b/i.test(candidate)) return candidate;
  }
  for (const item of Object.values(record)) {
    const nested = freshnessStatusFrom(item);
    if (nested) return nested;
  }
  return null;
}

function normalizedText(values: string[]): string {
  return values.join(" ").replace(/\s+/g, " ").trim();
}

function uniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values.map((value) => Number(value.toFixed(4))))).slice(0, 400);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 400);
}
