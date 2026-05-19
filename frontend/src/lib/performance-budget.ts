export type PerformanceBudgetSurface =
  | "api"
  | "dashboard"
  | "developer"
  | "intelligence"
  | "paper"
  | "replay"
  | "symbol";

export type PerformanceBudgetRoute = {
  budgetMs: number;
  method: "GET" | "POST";
  path: string;
  surface: PerformanceBudgetSurface;
};

export type PerformanceBudgetResult = {
  budgetMs: number;
  latencyMs: number;
  overBudgetMs: number;
  route: string;
  status: "ok" | "over_budget";
};

export const PERFORMANCE_ROUTE_BUDGETS: PerformanceBudgetRoute[] = [
  { budgetMs: 750, method: "GET", path: "/api/health", surface: "api" },
  { budgetMs: 1_500, method: "GET", path: "/api/health/deep", surface: "api" },
  { budgetMs: 3_500, method: "GET", path: "/terminal", surface: "dashboard" },
  { budgetMs: 3_500, method: "GET", path: "/dashboard", surface: "dashboard" },
  { budgetMs: 3_500, method: "GET", path: "/discover", surface: "dashboard" },
  { budgetMs: 3_500, method: "GET", path: "/opportunities", surface: "dashboard" },
  { budgetMs: 4_000, method: "GET", path: "/symbol/AMD", surface: "symbol" },
  { budgetMs: 3_500, method: "GET", path: "/paper", surface: "paper" },
  { budgetMs: 3_500, method: "GET", path: "/strategy-labs", surface: "intelligence" },
  { budgetMs: 3_000, method: "GET", path: "/community", surface: "intelligence" },
  { budgetMs: 3_000, method: "GET", path: "/developers", surface: "developer" },
  { budgetMs: 3_000, method: "GET", path: "/history", surface: "replay" },
  { budgetMs: 2_000, method: "GET", path: "/api/history/replay?symbol=AMD", surface: "replay" },
  { budgetMs: 1_500, method: "GET", path: "/api/v1/opportunities", surface: "api" },
  { budgetMs: 1_500, method: "GET", path: "/api/discovery", surface: "api" },
  { budgetMs: 1_500, method: "GET", path: "/api/v1/macro", surface: "api" },
  { budgetMs: 1_500, method: "GET", path: "/api/v1/shocks", surface: "api" },
  { budgetMs: 1_500, method: "GET", path: "/api/v1/replay?symbol=AMD", surface: "api" },
  { budgetMs: 2_000, method: "POST", path: "/api/v1/portfolio/scenario", surface: "api" },
];

export function evaluatePerformanceBudget(route: string, latencyMs: number, budgetMs: number): PerformanceBudgetResult {
  const overBudgetMs = Math.max(0, Math.round(latencyMs - budgetMs));
  return {
    budgetMs,
    latencyMs: Math.max(0, Math.round(latencyMs)),
    overBudgetMs,
    route,
    status: overBudgetMs > 0 ? "over_budget" : "ok",
  };
}

export function routesBySurface(routes: readonly PerformanceBudgetRoute[] = PERFORMANCE_ROUTE_BUDGETS): Record<PerformanceBudgetSurface, PerformanceBudgetRoute[]> {
  return routes.reduce<Record<PerformanceBudgetSurface, PerformanceBudgetRoute[]>>((acc, route) => {
    acc[route.surface].push(route);
    return acc;
  }, {
    api: [],
    dashboard: [],
    developer: [],
    intelligence: [],
    paper: [],
    replay: [],
    symbol: [],
  });
}
