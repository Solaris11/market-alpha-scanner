export type SortDirection = "asc" | "desc";
export type SortValueType = "date" | "number" | "percent" | "string";

export type SortConfig = {
  priority?: Record<string, number>;
  type?: SortValueType;
};

export function cleanSortText(value: unknown) {
  const raw = String(value ?? "").trim();
  return raw && !["nan", "none", "null"].includes(raw.toLowerCase()) ? raw : "";
}

export function normalizeSortText(value: unknown) {
  return cleanSortText(value).toUpperCase().replace(/\s+/g, " ");
}

export function parseSortNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(cleanSortText(value).replace(/[$,%]/g, "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseSortDate(value: unknown) {
  const raw = cleanSortText(value);
  if (!raw) return null;
  const timestamp = Date.parse(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function compareMissing(leftMissing: boolean, rightMissing: boolean) {
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  return null;
}

export function compareSortValues(left: unknown, right: unknown, direction: SortDirection, config: SortConfig = {}) {
  if (config.priority) {
    const leftRank = config.priority[normalizeSortText(left)] ?? null;
    const rightRank = config.priority[normalizeSortText(right)] ?? null;
    const missing = compareMissing(leftRank === null, rightRank === null);
    if (missing !== null) return missing;
    return direction === "desc" ? leftRank! - rightRank! : rightRank! - leftRank!;
  }

  if (config.type === "number" || config.type === "percent") {
    const leftNumber = parseSortNumber(left);
    const rightNumber = parseSortNumber(right);
    const missing = compareMissing(leftNumber === null, rightNumber === null);
    if (missing !== null) return missing;
    return direction === "desc" ? rightNumber! - leftNumber! : leftNumber! - rightNumber!;
  }

  if (config.type === "date") {
    const leftDate = parseSortDate(left);
    const rightDate = parseSortDate(right);
    const missing = compareMissing(leftDate === null, rightDate === null);
    if (missing !== null) return missing;
    return direction === "desc" ? rightDate! - leftDate! : leftDate! - rightDate!;
  }

  const leftText = cleanSortText(left).toLocaleLowerCase();
  const rightText = cleanSortText(right).toLocaleLowerCase();
  const missing = compareMissing(!leftText, !rightText);
  if (missing !== null) return missing;
  return direction === "desc" ? rightText.localeCompare(leftText) : leftText.localeCompare(rightText);
}

export function defaultSortDirection(config: SortConfig = {}): SortDirection {
  if (config.type === "string" && !config.priority) return "asc";
  return "desc";
}

export function nextSortDirection<K extends string>(
  currentKey: K | null,
  nextKey: K,
  currentDirection: SortDirection,
  config: SortConfig = {},
): SortDirection {
  if (currentKey === nextKey) return currentDirection === "asc" ? "desc" : "asc";
  return defaultSortDirection(config);
}

export function stableSortRows<T, K extends string>(
  rows: T[],
  key: K | null,
  direction: SortDirection,
  valueForKey: (row: T, key: K) => unknown,
  configForKey?: (key: K) => SortConfig | undefined,
) {
  if (!key) return rows;
  return rows
    .map((row, index) => ({ index, row }))
    .sort((left, right) => {
      const result = compareSortValues(valueForKey(left.row, key), valueForKey(right.row, key), direction, configForKey?.(key));
      return result || left.index - right.index;
    })
    .map((item) => item.row);
}
