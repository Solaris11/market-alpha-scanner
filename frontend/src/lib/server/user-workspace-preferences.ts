import "server-only";

import type { QueryResultRow } from "pg";
import { dbQuery } from "./db";
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  normalizeWorkspacePreferences,
  type WorkspacePreferences,
} from "@/lib/trading/workspace-preferences";
import {
  mergeChartWorkflowWorkspaceMap,
  normalizeChartWorkflowSymbol,
  sanitizeChartWorkflowWorkspace,
  sanitizeChartWorkflowWorkspaceMap,
  type ChartWorkflowWorkspace,
} from "@/components/terminal/chart-workflow-storage";

type WorkspacePreferencesRow = QueryResultRow & {
  chart_workspaces: unknown | null;
  favorite_actions: string[] | null;
  favorite_modules: string[] | null;
  favorite_symbols: string[] | null;
  hidden_modules: string[] | null;
  macro_first_mode: boolean | null;
  mobile_last_viewed_symbol: string | null;
  mobile_preferred_overview: string | null;
  module_order: string[] | null;
  pinned_mobile_cards: string[] | null;
  preferences_updated_at: Date | string | null;
  preferred_risk_style: string | null;
  preferred_timeframes: string[] | null;
  watchlist_first_mode: boolean | null;
  workspace_mode: string | null;
};

type ChartWorkspacesRow = QueryResultRow & {
  chart_workspaces: unknown | null;
};

export async function readUserWorkspacePreferences(userId: string): Promise<WorkspacePreferences> {
  const result = await dbQuery<WorkspacePreferencesRow>(
    `
      SELECT
        favorite_symbols,
        chart_workspaces,
        favorite_modules,
        hidden_modules,
        module_order,
        pinned_mobile_cards,
        preferred_timeframes,
        preferred_risk_style,
        workspace_mode,
        watchlist_first_mode,
        macro_first_mode,
        mobile_preferred_overview,
        mobile_last_viewed_symbol,
        favorite_actions,
        preferences_updated_at
      FROM user_workspace_preferences
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );
  return preferencesFromRow(result.rows[0]);
}

export async function upsertUserWorkspacePreferences(userId: string, value: unknown): Promise<WorkspacePreferences> {
  const preferences = normalizeWorkspacePreferences(value);
  const result = await dbQuery<WorkspacePreferencesRow>(
    `
      INSERT INTO user_workspace_preferences (
        user_id,
        chart_workspaces,
        favorite_symbols,
        favorite_modules,
        hidden_modules,
        module_order,
        pinned_mobile_cards,
        preferred_timeframes,
        preferred_risk_style,
        workspace_mode,
        watchlist_first_mode,
        macro_first_mode,
        mobile_preferred_overview,
        mobile_last_viewed_symbol,
        favorite_actions,
        created_at,
        updated_at,
        preferences_updated_at
      )
      VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now(), now(), now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        chart_workspaces = EXCLUDED.chart_workspaces,
        favorite_symbols = EXCLUDED.favorite_symbols,
        favorite_modules = EXCLUDED.favorite_modules,
        hidden_modules = EXCLUDED.hidden_modules,
        module_order = EXCLUDED.module_order,
        pinned_mobile_cards = EXCLUDED.pinned_mobile_cards,
        preferred_timeframes = EXCLUDED.preferred_timeframes,
        preferred_risk_style = EXCLUDED.preferred_risk_style,
        workspace_mode = EXCLUDED.workspace_mode,
        watchlist_first_mode = EXCLUDED.watchlist_first_mode,
        macro_first_mode = EXCLUDED.macro_first_mode,
        mobile_preferred_overview = EXCLUDED.mobile_preferred_overview,
        mobile_last_viewed_symbol = EXCLUDED.mobile_last_viewed_symbol,
        favorite_actions = EXCLUDED.favorite_actions,
        updated_at = now(),
        preferences_updated_at = now()
      RETURNING
        chart_workspaces,
        favorite_symbols,
        favorite_modules,
        hidden_modules,
        module_order,
        pinned_mobile_cards,
        preferred_timeframes,
        preferred_risk_style,
        workspace_mode,
        watchlist_first_mode,
        macro_first_mode,
        mobile_preferred_overview,
        mobile_last_viewed_symbol,
        favorite_actions,
        preferences_updated_at
    `,
    [
      userId,
      JSON.stringify(preferences.chartWorkspaces),
      preferences.favoriteSymbols,
      preferences.favoriteModules,
      preferences.hiddenModules,
      preferences.moduleOrder,
      preferences.pinnedMobileCards,
      preferences.preferredTimeframes,
      preferences.preferredRiskStyle,
      preferences.workspaceMode,
      preferences.watchlistFirstMode,
      preferences.macroFirstMode,
      preferences.mobilePreferredOverview,
      preferences.mobileLastViewedSymbol,
      preferences.favoriteActions,
    ],
  );
  return preferencesFromRow(result.rows[0]);
}

export async function readUserChartWorkflowWorkspace(userId: string, symbol: string): Promise<ChartWorkflowWorkspace | null> {
  const normalizedSymbol = normalizeChartWorkflowSymbol(symbol);
  const result = await dbQuery<ChartWorkspacesRow>(
    `
      SELECT chart_workspaces
      FROM user_workspace_preferences
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );
  const workspaces = sanitizeChartWorkflowWorkspaceMap(result.rows[0]?.chart_workspaces);
  return workspaces[normalizedSymbol] ?? null;
}

export async function upsertUserChartWorkflowWorkspace(userId: string, symbol: string, value: unknown): Promise<ChartWorkflowWorkspace> {
  const normalizedSymbol = normalizeChartWorkflowSymbol(symbol);
  const workspace = sanitizeChartWorkflowWorkspace(value);
  const current = await dbQuery<ChartWorkspacesRow>(
    `
      SELECT chart_workspaces
      FROM user_workspace_preferences
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );
  const chartWorkspaces = mergeChartWorkflowWorkspaceMap(current.rows[0]?.chart_workspaces, normalizedSymbol, workspace);
  const result = await dbQuery<ChartWorkspacesRow>(
    `
      INSERT INTO user_workspace_preferences (
        user_id,
        chart_workspaces,
        created_at,
        updated_at,
        preferences_updated_at
      )
      VALUES ($1, $2::jsonb, now(), now(), now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        chart_workspaces = EXCLUDED.chart_workspaces,
        updated_at = now(),
        preferences_updated_at = now()
      RETURNING chart_workspaces
    `,
    [userId, JSON.stringify(chartWorkspaces)],
  );
  const saved = sanitizeChartWorkflowWorkspaceMap(result.rows[0]?.chart_workspaces);
  return saved[normalizedSymbol] ?? workspace;
}

function preferencesFromRow(row: WorkspacePreferencesRow | undefined): WorkspacePreferences {
  if (!row) return DEFAULT_WORKSPACE_PREFERENCES;
  return normalizeWorkspacePreferences({
    chartWorkspaces: row.chart_workspaces,
    favoriteActions: row.favorite_actions ?? [],
    favoriteModules: row.favorite_modules ?? [],
    favoriteSymbols: row.favorite_symbols ?? [],
    hiddenModules: row.hidden_modules ?? [],
    macroFirstMode: row.macro_first_mode ?? false,
    mobileLastViewedSymbol: row.mobile_last_viewed_symbol,
    mobilePreferredOverview: row.mobile_preferred_overview,
    moduleOrder: row.module_order ?? [],
    pinnedMobileCards: row.pinned_mobile_cards ?? [],
    preferredRiskStyle: row.preferred_risk_style,
    preferredTimeframes: row.preferred_timeframes ?? [],
    updatedAt: timestampValue(row.preferences_updated_at),
    watchlistFirstMode: row.watchlist_first_mode ?? false,
    workspaceMode: row.workspace_mode,
  });
}

function timestampValue(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}
