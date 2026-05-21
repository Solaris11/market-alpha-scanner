import assert from "node:assert/strict";
import { test } from "node:test";
import { PERFORMANCE_ROUTE_BUDGETS, evaluatePerformanceBudget, routesBySurface } from "./performance-budget";

test("performance budget catalog covers core launch surfaces", () => {
  const paths = new Set(PERFORMANCE_ROUTE_BUDGETS.map((route) => route.path));
  for (const expected of ["/terminal", "/dashboard", "/discover", "/opportunities", "/feed", "/macro", "/market-memory", "/symbol/AMD", "/paper", "/strategy-labs", "/community", "/developers", "/api/history/replay?symbol=AMD", "/api/discovery", "/api/v1/portfolio/scenario"]) {
    assert.equal(paths.has(expected), true, `${expected} should have a route budget`);
  }
  assert.equal(PERFORMANCE_ROUTE_BUDGETS.every((route) => route.budgetMs > 0), true);
});

test("performance budget evaluation reports over-budget routes deterministically", () => {
  assert.deepEqual(evaluatePerformanceBudget("/terminal", 2200.4, 3500), {
    budgetMs: 3500,
    latencyMs: 2200,
    overBudgetMs: 0,
    route: "/terminal",
    status: "ok",
  });
  assert.deepEqual(evaluatePerformanceBudget("/terminal", 4100.8, 3500), {
    budgetMs: 3500,
    latencyMs: 4101,
    overBudgetMs: 601,
    route: "/terminal",
    status: "over_budget",
  });
});

test("performance budget routes group by surface for operator reporting", () => {
  const grouped = routesBySurface();
  assert.ok(grouped.dashboard.some((route) => route.path === "/terminal"));
  assert.ok(grouped.api.some((route) => route.path === "/api/health"));
  assert.ok(grouped.developer.some((route) => route.path === "/developers"));
});
