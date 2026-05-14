export const PRESENTATION_MODE_QUERY_KEYS = ["presentation", "demo", "present"] as const;

const ENABLED_QUERY_VALUES = new Set(["1", "true", "yes", "on"]);

export type SemanticTone = "constructive" | "caution" | "elevated" | "dangerous" | "intelligence" | "neutral";

export type SemanticToneDefinition = {
  readonly accent: string;
  readonly className: string;
  readonly label: string;
};

export const SEMANTIC_TONES: Record<SemanticTone, SemanticToneDefinition> = {
  caution: {
    accent: "yellow",
    className: "tv-status-caution",
    label: "Caution",
  },
  constructive: {
    accent: "green",
    className: "tv-status-constructive",
    label: "Constructive",
  },
  dangerous: {
    accent: "red",
    className: "tv-status-dangerous",
    label: "Dangerous",
  },
  elevated: {
    accent: "orange",
    className: "tv-status-elevated",
    label: "Elevated risk",
  },
  intelligence: {
    accent: "purple/cyan",
    className: "tv-status-intelligence",
    label: "Intelligence context",
  },
  neutral: {
    accent: "blue",
    className: "tv-status-neutral",
    label: "Neutral system context",
  },
};

export function shouldEnablePresentationMode(search: string): boolean {
  const normalizedSearch = search.startsWith("?") ? search : `?${search}`;
  const params = new URLSearchParams(normalizedSearch);
  return PRESENTATION_MODE_QUERY_KEYS.some((key) => ENABLED_QUERY_VALUES.has((params.get(key) ?? "").toLowerCase()));
}

export function semanticToneForStatus(input: string | null | undefined): SemanticTone {
  const value = (input ?? "").toLowerCase();
  if (/\b(danger|dangerous|critical|avoid|panic|breakdown|failed|failure|blocked)\b/.test(value)) return "dangerous";
  if (/\b(elevated|high risk|risk review|pressure|fragile|unstable|warning)\b/.test(value)) return "elevated";
  if (/\b(wait|watch|caution|limited|maturing|stale|mixed|unclear)\b/.test(value)) return "caution";
  if (/\b(constructive|favorable|improving|supportive|strong|healthy|ready)\b/.test(value)) return "constructive";
  if (/\b(replay|memory|copilot|strategy|intelligence|macro|shock)\b/.test(value)) return "intelligence";
  return "neutral";
}

export function semanticToneClass(input: string | null | undefined): string {
  return SEMANTIC_TONES[semanticToneForStatus(input)].className;
}

