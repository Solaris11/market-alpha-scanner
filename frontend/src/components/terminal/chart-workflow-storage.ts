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

export type StoredChartDrawing = {
  createdAt?: string;
  end: StoredChartDrawingPoint;
  id: string;
  start: StoredChartDrawingPoint;
  tool: Exclude<StoredChartDrawingTool, "edit" | "inspect">;
};

export type ChartDetailMode = "compare" | "overlays" | "timeline";
export type ChartLayoutMode = "focus" | "grid" | "split" | "stack";

export type ChartWorkflowWorkspace = {
  detailMode: ChartDetailMode;
  drawingTool: StoredChartDrawingTool;
  drawings: StoredChartDrawing[];
  fullscreenOpen: boolean;
  indicators: ChartIndicatorId[];
  layoutMode: ChartLayoutMode;
  overlayFamilies: ChartOverlayFamily[];
  period: InteractiveChartPeriod;
  updatedAt: string | null;
  version: 1;
};

export type ChartWorkflowWorkspacePatch = Partial<Omit<ChartWorkflowWorkspace, "version">>;
export type ChartWorkflowWorkspaceMap = Record<string, ChartWorkflowWorkspace>;

const STORAGE_PREFIX = "tradeveto.chart-workflow";
export const CHART_WORKFLOW_STORAGE_EVENT = "tradeveto-chart-workflow-change";
const MAX_STORED_DRAWINGS = 24;
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

export function defaultChartWorkflowWorkspace(): ChartWorkflowWorkspace {
  return {
    detailMode: "overlays",
    drawingTool: "inspect",
    drawings: [],
    fullscreenOpen: false,
    indicators: [...DEFAULT_CHART_INDICATORS],
    layoutMode: "focus",
    overlayFamilies: [...DEFAULT_CHART_OVERLAY_FAMILIES],
    period: "6mo",
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
  return {
    detailMode: stringFromSet(record.detailMode, VALID_DETAIL_MODES, fallback.detailMode),
    drawingTool: stringFromSet(record.drawingTool, VALID_DRAWING_TOOLS, fallback.drawingTool),
    drawings: sanitizeDrawings(record.drawings),
    fullscreenOpen: booleanValue(record.fullscreenOpen, fallback.fullscreenOpen),
    indicators: stringsFromSet(record.indicators, VALID_INDICATORS, fallback.indicators),
    layoutMode: stringFromSet(record.layoutMode, VALID_LAYOUT_MODES, fallback.layoutMode),
    overlayFamilies: stringsFromSet(record.overlayFamilies, VALID_OVERLAY_FAMILIES, fallback.overlayFamilies),
    period: stringFromSet(record.period, VALID_PERIODS, fallback.period),
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

function stringFromSet<T extends string>(value: unknown, valid: Set<T>, fallback: T): T {
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
  if (typeof value.createdAt === "string" && value.createdAt.trim()) drawing.createdAt = value.createdAt;
  return drawing;
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
