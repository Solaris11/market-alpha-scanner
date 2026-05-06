import type { EChartsOption } from "echarts";

export type PremiumChartPoint = {
  bucket: string;
  value: number | null;
};

export type PremiumChartSeries = {
  color: string;
  label: string;
  valueFormatter?: (value: number | null) => string;
  values: PremiumChartPoint[];
};

export type DistributionRow = {
  color?: string;
  label: string;
  value: number;
};

const CHART_TEXT = "#cbd5e1";
const CHART_MUTED = "#94a3b8";
const GRID_LINE = "rgba(148, 163, 184, 0.14)";
const PANEL_BG = "rgba(2, 6, 23, 0.96)";
const PANEL_BORDER = "rgba(148, 163, 184, 0.28)";

export function hasPremiumChartData(series: PremiumChartSeries[]): boolean {
  return series.some((item) => item.values.some((point) => point.value !== null && Number.isFinite(point.value)));
}

export function hasDistributionData(rows: DistributionRow[]): boolean {
  return rows.some((row) => row.value > 0 && Number.isFinite(row.value));
}

export function buildPremiumTimeSeriesOption({
  maxY,
  series,
  title,
}: {
  maxY?: number;
  series: PremiumChartSeries[];
  title?: string;
}): EChartsOption {
  const buckets = Array.from(new Set(series.flatMap((item) => item.values.map((point) => point.bucket)))).sort();
  const valuesBySeries = series.map((item) => ({
    ...item,
    alignedValues: buckets.map((bucket) => {
      const value = item.values.find((point) => point.bucket === bucket)?.value ?? null;
      return value !== null && Number.isFinite(value) ? value : null;
    }),
  }));

  return {
    animationDuration: 450,
    backgroundColor: "transparent",
    color: series.map((item) => item.color),
    grid: { bottom: 34, containLabel: true, left: 42, right: 18, top: title ? 48 : 38 },
    legend: {
      data: series.map((item) => item.label),
      icon: "roundRect",
      itemHeight: 8,
      itemWidth: 18,
      textStyle: { color: CHART_TEXT, fontSize: 11 },
      top: 2,
      type: "scroll",
    },
    series: valuesBySeries.map((item, index) => ({
      areaStyle: index === 0 ? { color: buildAreaGradient(item.color), opacity: 0.28 } : undefined,
      data: item.alignedValues,
      emphasis: { focus: "series" },
      lineStyle: {
        color: item.color,
        shadowBlur: 8,
        shadowColor: `${item.color}66`,
        width: 2.2,
      },
      name: item.label,
      showSymbol: false,
      smooth: true,
      symbol: "circle",
      symbolSize: 7,
      type: "line",
    })),
    title: title
      ? {
          left: 0,
          text: title,
          textStyle: { color: CHART_TEXT, fontSize: 12, fontWeight: 700 },
        }
      : undefined,
    tooltip: {
      axisPointer: {
        label: { backgroundColor: "#0f172a", color: CHART_TEXT },
        lineStyle: { color: "rgba(103, 232, 249, 0.55)", type: "dashed", width: 1 },
        type: "cross",
      },
      backgroundColor: PANEL_BG,
      borderColor: PANEL_BORDER,
      borderWidth: 1,
      confine: true,
      formatter: (params: unknown) => formatTimeSeriesTooltip(params, valuesBySeries),
      textStyle: { color: CHART_TEXT, fontSize: 12 },
      trigger: "axis",
    },
    xAxis: {
      axisLabel: { color: CHART_MUTED, formatter: (value: string) => formatBucketLabel(value), hideOverlap: true },
      axisLine: { lineStyle: { color: "rgba(148, 163, 184, 0.24)" } },
      axisTick: { show: false },
      boundaryGap: false,
      data: buckets,
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.08)" }, show: true },
      type: "category",
    },
    yAxis: {
      axisLabel: { color: CHART_MUTED },
      max: maxY,
      min: 0,
      splitLine: { lineStyle: { color: GRID_LINE } },
      type: "value",
    },
  };
}

export function buildDistributionBarOption({
  rows,
  title,
  vertical = false,
}: {
  rows: DistributionRow[];
  title?: string;
  vertical?: boolean;
}): EChartsOption {
  const labels = rows.map((row) => row.label);
  const values = rows.map((row) => Math.max(0, row.value));
  const colors = rows.map((row) => row.color ?? "#67e8f9");
  const categoryAxis = {
    axisLabel: { color: CHART_MUTED, interval: 0 },
    axisLine: { lineStyle: { color: "rgba(148, 163, 184, 0.22)" } },
    axisTick: { show: false },
    data: labels,
    type: "category" as const,
  };
  const valueAxis = {
    axisLabel: { color: CHART_MUTED },
    splitLine: { lineStyle: { color: GRID_LINE } },
    type: "value" as const,
  };

  return {
    animationDuration: 450,
    backgroundColor: "transparent",
    color: colors,
    grid: { bottom: vertical ? 34 : 18, containLabel: true, left: vertical ? 42 : 82, right: 18, top: title ? 38 : 14 },
    series: [
      {
        barMaxWidth: 22,
        data: values.map((value, index) => ({ itemStyle: { color: colors[index] }, value })),
        emphasis: { focus: "series" },
        name: title ?? "Distribution",
        type: "bar",
      },
    ],
    title: title
      ? {
          left: 0,
          text: title,
          textStyle: { color: CHART_TEXT, fontSize: 12, fontWeight: 700 },
        }
      : undefined,
    tooltip: {
      backgroundColor: PANEL_BG,
      borderColor: PANEL_BORDER,
      borderWidth: 1,
      confine: true,
      textStyle: { color: CHART_TEXT, fontSize: 12 },
      trigger: "axis",
    },
    xAxis: vertical ? categoryAxis : valueAxis,
    yAxis: vertical ? valueAxis : categoryAxis,
  };
}

export function buildDonutOption({
  centerLabel,
  rows,
  title,
}: {
  centerLabel?: string;
  rows: DistributionRow[];
  title?: string;
}): EChartsOption {
  return {
    animationDuration: 500,
    backgroundColor: "transparent",
    color: rows.map((row) => row.color ?? "#67e8f9"),
    legend: {
      bottom: 0,
      data: rows.map((row) => row.label),
      icon: "circle",
      itemHeight: 8,
      itemWidth: 8,
      textStyle: { color: CHART_TEXT, fontSize: 11 },
      type: "scroll",
    },
    series: [
      {
        avoidLabelOverlap: true,
        data: rows.map((row) => ({ itemStyle: { color: row.color }, name: row.label, value: Math.max(0, row.value) })),
        emphasis: { label: { show: true } },
        label: { color: CHART_TEXT, formatter: "{b}: {c}", fontSize: 11 },
        labelLine: { lineStyle: { color: "rgba(148, 163, 184, 0.35)" } },
        name: title ?? "Distribution",
        radius: ["52%", "72%"],
        top: title ? 22 : 0,
        type: "pie",
      },
    ],
    title: title || centerLabel
      ? {
          left: 0,
          subtext: title ? centerLabel : undefined,
          subtextStyle: { color: CHART_MUTED, fontSize: 11 },
          text: title ?? centerLabel,
          textStyle: { color: CHART_TEXT, fontSize: 12, fontWeight: 700 },
        }
      : undefined,
    tooltip: {
      backgroundColor: PANEL_BG,
      borderColor: PANEL_BORDER,
      borderWidth: 1,
      confine: true,
      textStyle: { color: CHART_TEXT, fontSize: 12 },
      trigger: "item",
    },
  };
}

function buildAreaGradient(color: string): {
  colorStops: Array<{ color: string; offset: number }>;
  type: "linear";
  x: number;
  x2: number;
  y: number;
  y2: number;
} {
  return {
    colorStops: [
      { color: `${color}44`, offset: 0 },
      { color: `${color}05`, offset: 1 },
    ],
    type: "linear",
    x: 0,
    x2: 0,
    y: 0,
    y2: 1,
  };
}

function formatTimeSeriesTooltip(
  params: unknown,
  series: Array<PremiumChartSeries & { alignedValues: Array<number | null> }>,
): string {
  const items = Array.isArray(params) ? params : [params];
  const rows = items.flatMap((item) => {
    const payload = tooltipPayload(item);
    if (!payload) return [];
    const seriesName = stringFromUnknown(payload.seriesName);
    const formatter = series.find((entry) => entry.label === seriesName)?.valueFormatter;
    const value = numericTooltipValue(payload.value);
    const formatted = formatter ? formatter(value) : defaultTooltipValue(value);
    return [`${stringFromUnknown(payload.marker) ?? ""}${escapeHtml(seriesName ?? "Value")}: ${escapeHtml(formatted)}`];
  });
  const firstPayload = tooltipPayload(items[0]);
  const title = stringFromUnknown(firstPayload?.axisValueLabel ?? firstPayload?.name) ?? "Point";
  return [`<strong>${escapeHtml(title)}</strong>`, ...rows].join("<br/>");
}

function tooltipPayload(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

function numericTooltipValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    const numeric = value.find((item): item is number => typeof item === "number" && Number.isFinite(item));
    return numeric ?? null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function defaultTooltipValue(value: number | null): string {
  if (value === null) return "n/a";
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function stringFromUnknown(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function formatBucketLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = date.toLocaleString("en-US", { day: "numeric", timeZone: "UTC" });
  const hour = date.toLocaleString("en-US", { hour: "2-digit", hour12: false, minute: "2-digit", timeZone: "UTC" });
  return `${month} ${day} ${hour}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
