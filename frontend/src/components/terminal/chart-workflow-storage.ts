import {
  CHART_INDICATORS,
  CHART_OVERLAY_FAMILIES,
  DEFAULT_CHART_INDICATORS,
  DEFAULT_CHART_OVERLAY_FAMILIES,
  type ChartIndicatorId,
  type ChartOverlayFamily,
} from "./chart-intelligence-overlays";
import { INTERACTIVE_CHART_PERIODS, type InteractiveChartPeriod } from "@/lib/interactive-chart-data";

export type StoredChartDrawingTool =
  | "annotation"
  | "entryZone"
  | "edit"
  | "horizontal"
  | "inspect"
  | "marker"
  | "range"
  | "resistanceZone"
  | "riskBox"
  | "ruler"
  | "stopZone"
  | "supportZone"
  | "targetZone"
  | "trendline";

export type StoredChartDrawingPoint = {
  x: number;
  y: number;
};

export type StoredChartDrawingColor = "amber" | "cyan" | "emerald" | "rose" | "slate" | "violet";
export type StoredChartDrawingStyle = "dashed" | "dotted" | "solid";
export type StoredChartDrawingWidth = 1 | 2 | 3 | 4;

export type StoredChartDrawing = {
  color?: StoredChartDrawingColor;
  createdAt?: string;
  end: StoredChartDrawingPoint;
  folder?: string;
  id: string;
  label?: string;
  lineWidth?: StoredChartDrawingWidth;
  locked?: boolean;
  start: StoredChartDrawingPoint;
  style?: StoredChartDrawingStyle;
  tool: Exclude<StoredChartDrawingTool, "edit" | "inspect">;
  updatedAt?: string;
  visible?: boolean;
};

export type ChartIndicatorTemplate = {
  createdAt?: string;
  id: string;
  indicators: ChartIndicatorId[];
  name: string;
  overlayFamilies: ChartOverlayFamily[];
  source: "default" | "user";
  updatedAt?: string;
};

export type ChartDetailMode = "compare" | "overlays" | "timeline";
export type ChartLayoutMode = "focus" | "grid" | "split" | "stack";
export type StoredChartAlertRuleType = "price_above" | "price_below" | "score_above" | "score_below";

export type StoredChartAlertHistoryEntry = {
  cooldownMinutes: number;
  createdAt: string;
  id: string;
  label: string;
  sourceReason?: string;
  threshold: number;
  type: StoredChartAlertRuleType;
};

export type ChartWorkspaceTab = {
  detailMode: ChartDetailMode;
  id: string;
  indicators: ChartIndicatorId[];
  label: string;
  layoutMode: ChartLayoutMode;
  overlayFamilies: ChartOverlayFamily[];
  period: InteractiveChartPeriod;
  symbol?: string;
  updatedAt?: string;
};

export type ChartWorkflowWorkspace = {
  activeIndicatorTemplateId: string | null;
  alertHistory: StoredChartAlertHistoryEntry[];
  chartTabs: ChartWorkspaceTab[];
  compactMode: boolean;
  detailMode: ChartDetailMode;
  drawingTool: StoredChartDrawingTool;
  drawings: StoredChartDrawing[];
  fullscreenOpen: boolean;
  indicators: ChartIndicatorId[];
  indicatorTemplates: ChartIndicatorTemplate[];
  layoutMode: ChartLayoutMode;
  magnetMode: boolean;
  overlayFamilies: ChartOverlayFamily[];
  period: InteractiveChartPeriod;
  toolbarCollapsed: boolean;
  updatedAt: string | null;
  version: 1;
};

export type ChartWorkflowWorkspacePatch = Partial<Omit<ChartWorkflowWorkspace, "version">>;
export type ChartWorkflowWorkspaceMap = Record<string, ChartWorkflowWorkspace>;

const STORAGE_PREFIX = "tradeveto.chart-workflow";
export const CHART_WORKFLOW_STORAGE_EVENT = "tradeveto-chart-workflow-change";
const MAX_STORED_DRAWINGS = 24;
const MAX_STORED_INDICATOR_TEMPLATES = 12;
const MAX_STORED_ALERT_HISTORY = 20;
const MAX_STORED_CHART_TABS = 8;
const MAX_STORED_CHART_WORKSPACES = 24;
const VALID_PERIODS = new Set<InteractiveChartPeriod>(INTERACTIVE_CHART_PERIODS);
const VALID_OVERLAY_FAMILIES = new Set<ChartOverlayFamily>(CHART_OVERLAY_FAMILIES.map((item) => item.family));
const VALID_INDICATORS = new Set<ChartIndicatorId>(CHART_INDICATORS.map((item) => item.id));
const VALID_DRAWING_TOOLS = new Set<StoredChartDrawingTool>([
  "annotation",
  "entryZone",
  "edit",
  "horizontal",
  "inspect",
  "marker",
  "range",
  "resistanceZone",
  "riskBox",
  "ruler",
  "stopZone",
  "supportZone",
  "targetZone",
  "trendline",
]);
const VALID_DETAIL_MODES = new Set<ChartDetailMode>(["compare", "overlays", "timeline"]);
const VALID_LAYOUT_MODES = new Set<ChartLayoutMode>(["focus", "grid", "split", "stack"]);
const VALID_ALERT_RULE_TYPES = new Set<StoredChartAlertRuleType>(["price_above", "price_below", "score_above", "score_below"]);
const VALID_DRAWING_COLORS = new Set<StoredChartDrawingColor>(["amber", "cyan", "emerald", "rose", "slate", "violet"]);
const VALID_DRAWING_STYLES = new Set<StoredChartDrawingStyle>(["dashed", "dotted", "solid"]);
const VALID_DRAWING_WIDTHS = new Set<StoredChartDrawingWidth>([1, 2, 3, 4]);

export const DEFAULT_CHART_INDICATOR_TEMPLATES: ChartIndicatorTemplate[] = [
  {
    id: "default-trend-risk",
    indicators: ["ema20", "ema50", "rsi14"],
    name: "Trend + Risk",
    overlayFamilies: [...DEFAULT_CHART_OVERLAY_FAMILIES],
    source: "default",
  },
  {
    id: "default-momentum",
    indicators: ["ema20", "sma20", "macd", "rsi14"],
    name: "Momentum",
    overlayFamilies: ["confidence", "events", "levels", "replay"],
    source: "default",
  },
  {
    id: "default-volatility",
    indicators: ["atr14", "rangePressure", "supertrend", "volatility20"],
    name: "Volatility",
    overlayFamilies: ["macro", "risk", "events", "levels"],
    source: "default",
  },
  {
    id: "default-replay-memory",
    indicators: ["ema20", "anchoredVwap", "rangePressure"],
    name: "Replay Memory",
    overlayFamilies: ["memory", "replay", "confidence", "levels"],
    source: "default",
  },
];

export function defaultChartWorkflowWorkspace(): ChartWorkflowWorkspace {
  return {
    activeIndicatorTemplateId: "default-trend-risk",
    alertHistory: [],
    chartTabs: [],
    compactMode: false,
    detailMode: "overlays",
    drawingTool: "inspect",
    drawings: [],
    fullscreenOpen: false,
    indicators: [...DEFAULT_CHART_INDICATORS],
    indicatorTemplates: [...DEFAULT_CHART_INDICATOR_TEMPLATES],
    layoutMode: "focus",
    magnetMode: false,
    overlayFamilies: [...DEFAULT_CHART_OVERLAY_FAMILIES],
    period: "6mo",
    toolbarCollapsed: false,
    updatedAt: null,
    version: 1,
  };
}

export function normalizeChartWorkflowSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24) || "UNKNOWN";
}

export function chartWorkflowStorageKey(symbol: string): string {
  return `${STORAGE_PREFIX}.${normalizeChartWorkflowSymbol(symbol)}`;
}

export function sanitizeChartWorkflowWorkspace(input: unknown, fallback: ChartWorkflowWorkspace = defaultChartWorkflowWorkspace()): ChartWorkflowWorkspace {
  const record = isRecord(input) ? input : {};
  const indicatorTemplates = sanitizeIndicatorTemplates(record.indicatorTemplates, fallback.indicatorTemplates);
  const activeIndicatorTemplateId = compactText(record.activeIndicatorTemplateId, 96) ?? fallback.activeIndicatorTemplateId;
  const activeTemplateExists = activeIndicatorTemplateId ? indicatorTemplates.some((template) => template.id === activeIndicatorTemplateId) : false;
  return {
    activeIndicatorTemplateId: activeTemplateExists ? activeIndicatorTemplateId : null,
    alertHistory: sanitizeAlertHistory(record.alertHistory),
    chartTabs: sanitizeChartTabs(record.chartTabs),
    compactMode: booleanValue(record.compactMode, fallback.compactMode),
    detailMode: stringFromSet(record.detailMode, VALID_DETAIL_MODES, fallback.detailMode),
    drawingTool: stringFromSet(record.drawingTool, VALID_DRAWING_TOOLS, fallback.drawingTool),
    drawings: sanitizeDrawings(record.drawings),
    fullscreenOpen: booleanValue(record.fullscreenOpen, fallback.fullscreenOpen),
    indicators: stringsFromSet(record.indicators, VALID_INDICATORS, fallback.indicators),
    indicatorTemplates,
    layoutMode: stringFromSet(record.layoutMode, VALID_LAYOUT_MODES, fallback.layoutMode),
    magnetMode: booleanValue(record.magnetMode, fallback.magnetMode),
    overlayFamilies: stringsFromSet(record.overlayFamilies, VALID_OVERLAY_FAMILIES, fallback.overlayFamilies),
    period: stringFromSet(record.period, VALID_PERIODS, fallback.period),
    toolbarCollapsed: booleanValue(record.toolbarCollapsed, fallback.toolbarCollapsed),
    updatedAt: typeof record.updatedAt === "string" && record.updatedAt.trim() ? record.updatedAt : fallback.updatedAt,
    version: 1,
  };
}

export function sanitizeChartWorkflowWorkspaceMap(input: unknown): ChartWorkflowWorkspaceMap {
  if (!isRecord(input)) return {};
  const workspaces: Array<[string, ChartWorkflowWorkspace]> = [];
  for (const [rawSymbol, rawWorkspace] of Object.entries(input)) {
    const symbol = normalizeChartWorkflowSymbol(rawSymbol);
    if (!symbol || symbol === "UNKNOWN") continue;
    workspaces.push([symbol, sanitizeChartWorkflowWorkspace(rawWorkspace)]);
  }
  return Object.fromEntries(sortAndLimitWorkspaceEntries(workspaces));
}

export function mergeChartWorkflowWorkspaceMap(current: unknown, symbol: string, workspace: unknown): ChartWorkflowWorkspaceMap {
  const base = sanitizeChartWorkflowWorkspaceMap(current);
  const normalizedSymbol = normalizeChartWorkflowSymbol(symbol);
  const nextWorkspace = sanitizeChartWorkflowWorkspace(workspace);
  return Object.fromEntries(sortAndLimitWorkspaceEntries([
    ...Object.entries(base),
    [normalizedSymbol, nextWorkspace],
  ]));
}

export function latestChartWorkflowWorkspace(left: ChartWorkflowWorkspace | null, right: ChartWorkflowWorkspace | null): ChartWorkflowWorkspace | null {
  if (!left) return right;
  if (!right) return left;
  const leftTime = timestampMs(left.updatedAt);
  const rightTime = timestampMs(right.updatedAt);
  return rightTime > leftTime ? right : left;
}

export function mergeChartWorkflowWorkspace(current: unknown, patch: ChartWorkflowWorkspacePatch): ChartWorkflowWorkspace {
  const base = sanitizeChartWorkflowWorkspace(current);
  return sanitizeChartWorkflowWorkspace({
    ...base,
    ...patch,
    updatedAt: new Date().toISOString(),
    version: 1,
  }, base);
}

export function readChartWorkflowWorkspace(symbol: string): ChartWorkflowWorkspace | null {
  const storage = browserStorage();
  if (!storage) return null;
  const raw = storage.getItem(chartWorkflowStorageKey(symbol));
  if (!raw) return null;
  try {
    return sanitizeChartWorkflowWorkspace(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeChartWorkflowWorkspace(symbol: string, patch: ChartWorkflowWorkspacePatch): ChartWorkflowWorkspace | null {
  const storage = browserStorage();
  if (!storage) return null;
  const existing = readChartWorkflowWorkspace(symbol) ?? defaultChartWorkflowWorkspace();
  const next = mergeChartWorkflowWorkspace(existing, patch);
  storage.setItem(chartWorkflowStorageKey(symbol), JSON.stringify(next));
  dispatchChartWorkflowStorageEvent(symbol, next);
  return next;
}

export function replaceChartWorkflowWorkspace(symbol: string, workspace: unknown): ChartWorkflowWorkspace | null {
  const storage = browserStorage();
  if (!storage) return null;
  const next = sanitizeChartWorkflowWorkspace(workspace);
  storage.setItem(chartWorkflowStorageKey(symbol), JSON.stringify(next));
  dispatchChartWorkflowStorageEvent(symbol, next);
  return next;
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function stringsFromSet<T extends string>(value: unknown, valid: Set<T>, fallback: T[]): T[] {
  if (!Array.isArray(value)) return [...fallback];
  const normalized: T[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    if (!valid.has(item as T) || normalized.includes(item as T)) continue;
    normalized.push(item as T);
  }
  return normalized.length ? normalized : [...fallback];
}

function stringFromSet<T extends string>(value: unknown, valid: Set<T>, fallback: T): T;
function stringFromSet<T extends string>(value: unknown, valid: Set<T>, fallback: null): T | null;
function stringFromSet<T extends string>(value: unknown, valid: Set<T>, fallback: T | null): T | null {
  return typeof value === "string" && valid.has(value as T) ? value as T : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeDrawings(value: unknown): StoredChartDrawing[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeDrawing(item))
    .filter((item): item is StoredChartDrawing => item !== null)
    .slice(-MAX_STORED_DRAWINGS);
}

function sanitizeDrawing(value: unknown): StoredChartDrawing | null {
  if (!isRecord(value)) return null;
  const tool = stringFromSet(value.tool, new Set<StoredChartDrawing["tool"]>([
    "annotation",
    "entryZone",
    "horizontal",
    "marker",
    "range",
    "resistanceZone",
    "riskBox",
    "ruler",
    "stopZone",
    "supportZone",
    "targetZone",
    "trendline",
  ]), "trendline");
  const start = sanitizePoint(value.start);
  const end = sanitizePoint(value.end);
  if (!start || !end) return null;
  const rawId = typeof value.id === "string" && value.id.trim() ? value.id.trim().slice(0, 96) : `${tool}-${start.x}-${start.y}`;
  const drawing: StoredChartDrawing = {
    end,
    id: rawId,
    start,
    tool,
  };
  const label = compactText(value.label, 48);
  if (label) drawing.label = label;
  const folder = compactText(value.folder, 32);
  if (folder) drawing.folder = folder;
  const color = stringFromSet(value.color, VALID_DRAWING_COLORS, null);
  if (color) drawing.color = color;
  const style = stringFromSet(value.style, VALID_DRAWING_STYLES, null);
  if (style) drawing.style = style;
  const lineWidth = finiteIntegerFromSet(value.lineWidth, VALID_DRAWING_WIDTHS);
  if (lineWidth) drawing.lineWidth = lineWidth;
  if (typeof value.locked === "boolean") drawing.locked = value.locked;
  if (typeof value.visible === "boolean") drawing.visible = value.visible;
  if (typeof value.createdAt === "string" && value.createdAt.trim()) drawing.createdAt = value.createdAt;
  if (typeof value.updatedAt === "string" && value.updatedAt.trim()) drawing.updatedAt = value.updatedAt;
  return drawing;
}

function sanitizeAlertHistory(value: unknown): StoredChartAlertHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeAlertHistoryEntry(item))
    .filter((item): item is StoredChartAlertHistoryEntry => item !== null)
    .slice(-MAX_STORED_ALERT_HISTORY);
}

function sanitizeAlertHistoryEntry(value: unknown): StoredChartAlertHistoryEntry | null {
  if (!isRecord(value)) return null;
  const type = stringFromSet(value.type, VALID_ALERT_RULE_TYPES, null);
  const threshold = finiteNumber(value.threshold);
  const createdAt = compactText(value.createdAt, 48);
  const id = normalizeId(value.id, "");
  const label = compactText(value.label, 80);
  if (!type || threshold === null || !createdAt || !id || !label) return null;
  const cooldown = finiteNumber(value.cooldownMinutes);
  const entry: StoredChartAlertHistoryEntry = {
    cooldownMinutes: cooldown === null ? 240 : Math.max(0, Math.min(10_080, Math.round(cooldown))),
    createdAt,
    id,
    label,
    threshold,
    type,
  };
  const sourceReason = compactText(value.sourceReason, 180);
  if (sourceReason) entry.sourceReason = sourceReason;
  return entry;
}

function sanitizeChartTabs(value: unknown): ChartWorkspaceTab[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => sanitizeChartTab(item, index))
    .filter((item): item is ChartWorkspaceTab => item !== null)
    .slice(-MAX_STORED_CHART_TABS);
}

function sanitizeChartTab(value: unknown, index: number): ChartWorkspaceTab | null {
  if (!isRecord(value)) return null;
  const label = compactText(value.label, 36);
  if (!label) return null;
  const tab: ChartWorkspaceTab = {
    detailMode: stringFromSet(value.detailMode, VALID_DETAIL_MODES, "overlays"),
    id: normalizeId(value.id, `tab-${index + 1}`),
    indicators: stringsFromSet(value.indicators, VALID_INDICATORS, DEFAULT_CHART_INDICATORS),
    label,
    layoutMode: stringFromSet(value.layoutMode, VALID_LAYOUT_MODES, "focus"),
    overlayFamilies: stringsFromSet(value.overlayFamilies, VALID_OVERLAY_FAMILIES, DEFAULT_CHART_OVERLAY_FAMILIES),
    period: stringFromSet(value.period, VALID_PERIODS, "6mo"),
  };
  const symbol = compactText(value.symbol, 24);
  if (symbol) tab.symbol = normalizeChartWorkflowSymbol(symbol);
  if (typeof value.updatedAt === "string" && value.updatedAt.trim()) tab.updatedAt = value.updatedAt;
  return tab;
}

function sanitizeIndicatorTemplates(value: unknown, fallback: ChartIndicatorTemplate[]): ChartIndicatorTemplate[] {
  const defaults = DEFAULT_CHART_INDICATOR_TEMPLATES.map((template) => sanitizeIndicatorTemplate(template)).filter((template): template is ChartIndicatorTemplate => template !== null);
  const candidates = Array.isArray(value) ? value : fallback;
  const templates = candidates
    .map((item) => sanitizeIndicatorTemplate(item))
    .filter((item): item is ChartIndicatorTemplate => item !== null);
  const merged = new Map<string, ChartIndicatorTemplate>();
  for (const template of [...defaults, ...templates]) {
    merged.set(template.id, template.source === "default" ? { ...template, source: "default" } : template);
  }
  const defaultTemplates = [...merged.values()].filter((template) => template.source === "default");
  const userTemplates = [...merged.values()].filter((template) => template.source === "user").slice(-(MAX_STORED_INDICATOR_TEMPLATES - defaultTemplates.length));
  return [...defaultTemplates, ...userTemplates];
}

function sanitizeIndicatorTemplate(value: unknown): ChartIndicatorTemplate | null {
  if (!isRecord(value)) return null;
  const id = normalizeId(value.id, "");
  const name = compactText(value.name, 36);
  if (!id || !name) return null;
  const indicators = stringsFromSet(value.indicators, VALID_INDICATORS, DEFAULT_CHART_INDICATORS);
  const overlayFamilies = stringsFromSet(value.overlayFamilies, VALID_OVERLAY_FAMILIES, DEFAULT_CHART_OVERLAY_FAMILIES);
  const source = value.source === "user" ? "user" : "default";
  const template: ChartIndicatorTemplate = {
    id,
    indicators,
    name,
    overlayFamilies,
    source,
  };
  if (typeof value.createdAt === "string" && value.createdAt.trim()) template.createdAt = value.createdAt;
  if (typeof value.updatedAt === "string" && value.updatedAt.trim()) template.updatedAt = value.updatedAt;
  return template;
}

function sanitizePoint(value: unknown): StoredChartDrawingPoint | null {
  if (!isRecord(value)) return null;
  const x = finiteNumber(value.x);
  const y = finiteNumber(value.y);
  if (x === null || y === null) return null;
  return {
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
  };
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function finiteIntegerFromSet<T extends number>(value: unknown, valid: Set<T>): T | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return valid.has(rounded as T) ? rounded as T : null;
}

function compactText(value: unknown, maxLength: number): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  return text || null;
}

function normalizeId(value: unknown, fallback: string): string {
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return text || fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sortAndLimitWorkspaceEntries(entries: Array<[string, ChartWorkflowWorkspace]>): Array<[string, ChartWorkflowWorkspace]> {
  const deduped = new Map<string, ChartWorkflowWorkspace>();
  for (const [symbol, workspace] of entries) {
    deduped.set(symbol, workspace);
  }
  return [...deduped.entries()]
    .sort((left, right) => timestampMs(right[1].updatedAt) - timestampMs(left[1].updatedAt))
    .slice(0, MAX_STORED_CHART_WORKSPACES);
}

function timestampMs(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dispatchChartWorkflowStorageEvent(symbol: string, workspace: ChartWorkflowWorkspace): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHART_WORKFLOW_STORAGE_EVENT, {
    detail: {
      symbol: normalizeChartWorkflowSymbol(symbol),
      workspace,
    },
  }));
}
