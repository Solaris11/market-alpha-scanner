import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chartWorkflowStorageKey,
  defaultChartWorkflowWorkspace,
  latestChartWorkflowWorkspace,
  mergeChartWorkflowWorkspace,
  mergeChartWorkflowWorkspaceMap,
  normalizeChartWorkflowSymbol,
  sanitizeChartWorkflowWorkspace,
  sanitizeChartWorkflowWorkspaceMap,
} from "@/components/terminal/chart-workflow-storage";

describe("chart workflow workspace persistence", () => {
  it("sanitizes persisted chart state and rejects unsupported values", () => {
    const workspace = sanitizeChartWorkflowWorkspace({
      detailMode: "bad",
      drawingTool: "ruler",
      drawings: [
        {
          end: { x: 103, y: -2 },
          id: "measure-1",
          start: { x: 10, y: 20 },
          tool: "ruler",
        },
        {
          end: { x: "bad", y: 50 },
          id: "invalid",
          start: { x: 10, y: 20 },
          tool: "trendline",
        },
      ],
      fullscreenOpen: true,
      indicators: ["ema20", "unsupported", "rangePressure", "rsi14", "ema20"],
      layoutMode: "grid",
      overlayFamilies: ["risk", "macro", "bad", "risk"],
      period: "1y",
      updatedAt: "2026-05-21T12:00:00Z",
    });

    assert.equal(workspace.detailMode, "overlays");
    assert.equal(workspace.drawingTool, "ruler");
    assert.equal(workspace.fullscreenOpen, true);
    assert.deepEqual(workspace.indicators, ["ema20", "rangePressure", "rsi14"]);
    assert.equal(workspace.layoutMode, "grid");
    assert.deepEqual(workspace.overlayFamilies, ["risk", "macro"]);
    assert.equal(workspace.period, "1y");
    assert.equal(workspace.drawings.length, 1);
    assert.deepEqual(workspace.drawings[0]?.end, { x: 100, y: 0 });
  });

  it("keeps only the latest stored research drawings", () => {
    const drawings = Array.from({ length: 30 }, (_item, index) => ({
      end: { x: index + 1, y: index + 2 },
      id: `drawing-${index}`,
      start: { x: index, y: index + 1 },
      tool: "trendline",
    }));

    const workspace = sanitizeChartWorkflowWorkspace({ drawings });

    assert.equal(workspace.drawings.length, 24);
    assert.equal(workspace.drawings[0]?.id, "drawing-6");
    assert.equal(workspace.drawings[23]?.id, "drawing-29");
  });

  it("preserves professional drawing tool types", () => {
    const workspace = sanitizeChartWorkflowWorkspace({
      drawingTool: "edit",
      drawings: [
        {
          end: { x: 82, y: 44 },
          id: "entry-zone-1",
          start: { x: 22, y: 38 },
          tool: "entryZone",
        },
        {
          end: { x: 100, y: 31 },
          id: "support-1",
          start: { x: 4, y: 35 },
          tool: "supportZone",
        },
        {
          end: { x: 72, y: 22 },
          id: "risk-box-1",
          start: { x: 52, y: 62 },
          tool: "riskBox",
        },
      ],
    });

    assert.equal(workspace.drawingTool, "edit");
    assert.deepEqual(workspace.drawings.map((drawing) => drawing.tool), ["entryZone", "supportZone", "riskBox"]);
  });

  it("merges a patch without dropping existing compare or layout state", () => {
    const current = {
      ...defaultChartWorkflowWorkspace(),
      detailMode: "compare",
      layoutMode: "stack",
      overlayFamilies: ["replay", "risk"],
    };
    const merged = mergeChartWorkflowWorkspace(current, { period: "5y" });

    assert.equal(merged.detailMode, "compare");
    assert.equal(merged.layoutMode, "stack");
    assert.equal(merged.period, "5y");
    assert.deepEqual(merged.overlayFamilies, ["replay", "risk"]);
    assert.ok(merged.updatedAt);
  });

  it("uses a stable sanitized per-symbol storage key", () => {
    assert.equal(chartWorkflowStorageKey(" amd "), "tradeveto.chart-workflow.AMD");
    assert.equal(chartWorkflowStorageKey("$bad symbol!"), "tradeveto.chart-workflow.BADSYMBOL");
    assert.equal(normalizeChartWorkflowSymbol(" brk.b "), "BRK.B");
  });

  it("bounds cross-device chart workspace maps by most recent updates", () => {
    const workspaces = Object.fromEntries(Array.from({ length: 30 }, (_item, index) => [
      `SYM${index}`,
      {
        ...defaultChartWorkflowWorkspace(),
        updatedAt: `2026-05-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
      },
    ]));
    const sanitized = sanitizeChartWorkflowWorkspaceMap(workspaces);

    assert.equal(Object.keys(sanitized).length, 24);
    assert.equal(Boolean(sanitized.SYM29), true);
    assert.equal(Boolean(sanitized.SYM0), false);
  });

  it("merges one authenticated chart workspace without dropping other symbols", () => {
    const current = {
      AMD: {
        ...defaultChartWorkflowWorkspace(),
        updatedAt: "2026-05-20T00:00:00Z",
      },
    };
    const merged = mergeChartWorkflowWorkspaceMap(current, "nvda", {
      ...defaultChartWorkflowWorkspace(),
      fullscreenOpen: true,
      period: "1y",
      updatedAt: "2026-05-21T00:00:00Z",
    });

    assert.equal(merged.NVDA?.period, "1y");
    assert.equal(merged.NVDA?.fullscreenOpen, true);
    assert.equal(Boolean(merged.AMD), true);
  });

  it("selects the newest workspace during local/account reconciliation", () => {
    const older = {
      ...defaultChartWorkflowWorkspace(),
      period: "1mo" as const,
      updatedAt: "2026-05-20T00:00:00Z",
    };
    const newer = {
      ...defaultChartWorkflowWorkspace(),
      period: "5y" as const,
      updatedAt: "2026-05-21T00:00:00Z",
    };

    assert.equal(latestChartWorkflowWorkspace(older, newer)?.period, "5y");
    assert.equal(latestChartWorkflowWorkspace(newer, older)?.period, "5y");
  });
});
