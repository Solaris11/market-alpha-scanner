const SHORT_DATE_UTC = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatDateUtc(value: string | number | Date | null | undefined) {
  const date = parseUtcDate(value);
  return date ? SHORT_DATE_UTC.format(date) : "N/A";
}

export function utcTimestampMs(value: string | number | Date | null | undefined) {
  return parseUtcDate(value)?.getTime() ?? 0;
}

function parseUtcDate(value: string | number | Date | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(normalizeUtcInput(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeUtcInput(value: string | number) {
  if (typeof value === "number") return value;
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00.000Z`;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text)) return `${text.replace(" ", "T")}Z`;
  return text;
}
