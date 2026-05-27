import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const ARTIFACT_ROOT = resolve(process.cwd(), "../docs/ops/artifacts/phase-27-2-chart-workstation");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("ma_risk_acknowledged_v1", "true");
    window.localStorage.setItem("ma_onboarding_completed", "true");
    window.localStorage.setItem("tradeveto_first_run_starter_hidden_v1", "true");
    window.localStorage.setItem("tradeveto_first_opportunity_review_hidden_v1", "true");
  });
});

test("AMD fullscreen chart exposes the decision workstation with bounded source states", async ({ page }, testInfo) => {
  await mkdir(ARTIFACT_ROOT, { recursive: true });
  const timings: Record<string, number> = {};

  const restoreStart = await now(page);
  await page.goto("/symbol/AMD", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await dismissRiskAcknowledgement(page);
  const chartRoot = page.locator("[data-chart-symbol='AMD'][data-chart-workspace-loaded='true']").first();
  const hasChart = await chartRoot.waitFor({ state: "visible", timeout: 20_000 }).then(() => true).catch(() => false);
  test.skip(!hasChart, "Chart workstation browser proof requires production-backed symbol chart data.");
  timings.workspaceRestoreMs = await elapsed(page, restoreStart);

  const fullscreenStart = await now(page);
  await page.locator("[data-chart-expand-trigger='AMD']").first().click();
  const workstation = page.locator("[data-chart-workstation='true']");
  await expect(workstation).toBeVisible({ timeout: 60_000 });
  timings.fullscreenOpenMs = await elapsed(page, fullscreenStart);

  const layoutStart = await now(page);
  await workstation.getByRole("button", { name: /^grid$/i }).click();
  await expect(workstation).toHaveAttribute("data-chart-workstation-layout", "grid");
  timings.layoutSwitchMs = await elapsed(page, layoutStart);

  await expect(page.locator("[data-chart-workstation-overlay='aiDecisionLayer'][data-chart-workstation-overlay-status='available']")).toBeVisible();
  await expect(page.locator("[data-chart-workstation-overlay='volumeProfile'][data-chart-workstation-overlay-status='limited']")).toBeVisible();
  await expect(page.locator("[data-chart-workstation-overlay='sessionVolume'][data-chart-workstation-overlay-status='limited']")).toBeVisible();
  await expect(workstation).toContainText(/No financial advice|Research only/);
  await expect(workstation).not.toContainText(/guaranteed|must buy|must sell|risk-free/i);

  const replayPanel = page.locator("[data-chart-workstation-replay-panel='true']");
  await expect(replayPanel).toBeVisible();
  const replayStatus = await workstation.getAttribute("data-chart-workstation-replay");
  if (replayStatus === "available") {
    const replayStart = await now(page);
    await page.locator("[data-chart-workstation-replay-scrubber='true']").evaluate((element) => {
      if (!(element instanceof HTMLInputElement)) return;
      element.value = "0";
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    timings.replayScrubMs = await elapsed(page, replayStart);
  }

  const geometry = await readGeometry(page);
  expect(geometry.horizontalOverflow).toBeLessThanOrEqual(2);
  expect(geometry.workstationRight).toBeLessThanOrEqual(geometry.viewportWidth + 2);
  expect(geometry.workstationLeft).toBeGreaterThanOrEqual(-2);

  const screenshotPath = join(ARTIFACT_ROOT, `chart-workstation-${testInfo.project.name}.png`);
  await page.screenshot({ fullPage: true, path: screenshotPath });
  await writeFile(join(ARTIFACT_ROOT, `browser-timing-${testInfo.project.name}.json`), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    project: testInfo.project.name,
    route: "/symbol/AMD",
    timings,
    geometry,
    replayStatus,
  }, null, 2)}\n`, "utf8");
});

async function dismissRiskAcknowledgement(page: Page): Promise<void> {
  const continueButton = page.getByRole("button", { name: /continue/i }).first();
  if (!(await continueButton.isVisible().catch(() => false))) return;
  const checkbox = page.getByRole("checkbox").first();
  if (await checkbox.isVisible().catch(() => false)) await checkbox.check().catch(() => undefined);
  await continueButton.click().catch(() => undefined);
}

async function now(page: Page): Promise<number> {
  return page.evaluate(() => performance.now());
}

async function elapsed(page: Page, startedAt: number): Promise<number> {
  return page.evaluate((start) => new Promise<number>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resolve(Math.round((performance.now() - start) * 1000) / 1000);
      });
    });
  }), startedAt);
}

async function readGeometry(page: Page): Promise<{
  horizontalOverflow: number;
  viewportWidth: number;
  workstationLeft: number;
  workstationRight: number;
}> {
  return page.evaluate(() => {
    const workstation = document.querySelector<HTMLElement>("[data-chart-workstation='true']");
    const rect = workstation?.getBoundingClientRect();
    return {
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      viewportWidth: window.innerWidth,
      workstationLeft: rect?.left ?? 0,
      workstationRight: rect?.right ?? window.innerWidth,
    };
  });
}
