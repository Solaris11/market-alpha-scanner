"use client";

import { csrfFetch } from "@/lib/client/csrf-fetch";
import {
  latestChartWorkflowWorkspace,
  normalizeChartWorkflowSymbol,
  sanitizeChartWorkflowWorkspace,
  type ChartWorkflowWorkspace,
} from "./chart-workflow-storage";

type ChartWorkspaceApiResponse = {
  authenticated?: boolean;
  error?: string;
  symbol?: string;
  workspace?: unknown;
};

export type AccountChartWorkspaceResult = {
  authenticated: boolean;
  workspace: ChartWorkflowWorkspace | null;
};

export async function fetchAccountChartWorkflowWorkspace(symbol: string): Promise<AccountChartWorkspaceResult> {
  const response = await fetch(chartWorkspaceEndpoint(symbol), { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as ChartWorkspaceApiResponse | null;
  if (!response.ok) throw new Error(payload?.error ?? "Failed to load chart workspace.");
  return {
    authenticated: Boolean(payload?.authenticated),
    workspace: payload?.workspace ? sanitizeChartWorkflowWorkspace(payload.workspace) : null,
  };
}

export async function saveAccountChartWorkflowWorkspace(symbol: string, workspace: ChartWorkflowWorkspace): Promise<AccountChartWorkspaceResult> {
  const response = await csrfFetch(chartWorkspaceEndpoint(symbol), {
    body: JSON.stringify({ workspace: sanitizeChartWorkflowWorkspace(workspace) }),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
  const payload = (await response.json().catch(() => null)) as ChartWorkspaceApiResponse | null;
  if (!response.ok) throw new Error(payload?.error ?? "Failed to save chart workspace.");
  return {
    authenticated: Boolean(payload?.authenticated),
    workspace: payload?.workspace ? sanitizeChartWorkflowWorkspace(payload.workspace) : null,
  };
}

export function mergeLocalAndAccountChartWorkspace(
  localWorkspace: ChartWorkflowWorkspace | null,
  accountWorkspace: ChartWorkflowWorkspace | null,
): ChartWorkflowWorkspace | null {
  return latestChartWorkflowWorkspace(localWorkspace, accountWorkspace);
}

function chartWorkspaceEndpoint(symbol: string): string {
  return `/api/user/chart-workspaces/${encodeURIComponent(normalizeChartWorkflowSymbol(symbol))}`;
}
