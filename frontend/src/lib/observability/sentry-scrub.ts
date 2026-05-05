import type { ErrorEvent, Event, EventHint } from "@sentry/nextjs";

const SENSITIVE_KEY_PATTERN = /authorization|cookie|csrf|dsn|password|secret|session|set-cookie|stripe-signature|token|api[_-]?key/i;
const SENSITIVE_VALUE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /sk_(?:live|test)_[A-Za-z0-9_]+/gi,
  /pk_(?:live|test)_[A-Za-z0-9_]+/gi,
  /whsec_[A-Za-z0-9_]+/gi,
  /sess_[A-Za-z0-9_-]+/gi,
  /csrf[A-Za-z0-9_-]*/gi,
];

type Jsonish = null | boolean | number | string | Jsonish[] | { [key: string]: Jsonish };

export function sentryBeforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent {
  return scrubSentryEvent(event) as ErrorEvent;
}

export function scrubSentryEvent(event: Event): Event {
  const scrubbed = scrubUnknown(event, 0);
  return scrubbed && typeof scrubbed === "object" && !Array.isArray(scrubbed) ? (scrubbed as Event) : event;
}

function scrubUnknown(value: unknown, depth: number): Jsonish {
  if (depth > 6) return "[redacted]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return scrubText(value);
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => scrubUnknown(item, depth + 1));
  if (typeof value !== "object") return String(value);

  const output: Record<string, Jsonish> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = "[redacted]";
      continue;
    }
    output[key] = scrubUnknown(nestedValue, depth + 1);
  }
  return output;
}

function scrubText(value: string): string {
  return SENSITIVE_VALUE_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[redacted]"), value).slice(0, 2000);
}
