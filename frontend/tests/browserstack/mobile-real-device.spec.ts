import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page, type Response, type TestInfo } from "@playwright/test";

const ROUTES = [
  "/terminal",
  "/discover",
  "/scanner",
  "/paper",
  "/strategy-labs",
  "/market-memory",
  "/feed",
  "/macro",
  "/symbol/AMD",
  "/alerts",
  "/history",
  "/performance",
];

const PRODUCT_NAV_ROUTES = new Set([
  "/alerts",
  "/discover",
  "/history",
  "/paper",
  "/performance",
  "/scanner",
  "/strategy-labs",
  "/symbol/AMD",
  "/terminal",
]);

const HYDRATION_PATTERN = /hydration|hydrate|server rendered|client properties|text content does not match|minified react error #418/i;
const ARTIFACT_DIR = resolve(process.cwd(), "..", "docs", "ops", "artifacts", "phase-21-1", "browserstack-screenshots");

type MobileMetrics = {
  activeElementBottom: number | null;
  bottomNavCount: number;
  bottomNavVisible: boolean;
  clippedFixedOrSticky: number;
  clippedOverlay: boolean;
  horizontalOverflow: number;
  keyboardSafe: boolean;
  modalOffscreen: boolean;
  smallTapTargets: number;
  viewportHeight: number;
  viewportWidth: number;
};

type OverlayResult = {
  closeScrollDelta: number;
  closeVisible: boolean;
  clipped: boolean;
  openScrollDelta: number;
  opened: boolean;
  skipped: boolean;
  stillOpen: boolean;
};

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
});

test("real-device mobile QA required routes", async ({ page }, testInfo) => {
  const hydrationMessages = bindHydrationCapture(page);
  await installStableClientState(page);

  for (const route of ROUTES) {
    await test.step(`validate ${route}`, async () => {
      const hydrationStart = hydrationMessages.length;
      await navigateAndSettle(page, route);
      await acknowledgeRisk(page);

      await assertMobileMetrics(page, route);
      await assertTouchResponsiveness(page);
      await assertKeyboardSafety(page);
      await exerciseScannerUsability(page, route);
      await exerciseChartUsability(page, route);
      await exerciseStableOverlay(page, route, route === "/paper");
      if (route === "/paper") await exercisePaperDeepScrollOverlay(page);

      expect(hydrationMessages.slice(hydrationStart), `hydration/runtime mismatch on ${route}`).toEqual([]);
      await captureRouteScreenshot(page, route, testInfo);
    });
  }
});

function bindHydrationCapture(page: Page): string[] {
  const messages: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (HYDRATION_PATTERN.test(text)) messages.push(text.slice(0, 240));
  });
  page.on("pageerror", (error) => {
    const text = error.message;
    if (HYDRATION_PATTERN.test(text)) messages.push(text.slice(0, 240));
  });
  return messages;
}

async function installStableClientState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("ma_risk_acknowledged_v1", "true");
    window.localStorage.setItem("ma_onboarding_completed", "true");
    window.localStorage.setItem("tradeveto_first_run_starter_hidden_v1", "true");
    window.localStorage.setItem("tradeveto_first_opportunity_review_hidden_v1", "true");
    window.sessionStorage.removeItem("ma_onboarding_replay_pending");
  });
}

async function navigateAndSettle(page: Page, route: string): Promise<void> {
  const response = await gotoRouteWithRetry(page, route);
  expect(response?.status() ?? 0, `${route} should not return a server error`).toBeLessThan(500);
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => undefined);
  await page.waitForTimeout(900);
}

async function gotoRouteWithRetry(page: Page, route: string): Promise<Response | null> {
  try {
    return await page.goto(route, { timeout: 45_000, waitUntil: "commit" });
  } catch (firstError) {
    await page.waitForTimeout(1_000);
    try {
      return await page.goto(route, { timeout: 45_000, waitUntil: "commit" });
    } catch {
      throw firstError;
    }
  }
}

async function acknowledgeRisk(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.localStorage.setItem("ma_risk_acknowledged_v1", "true");
    window.localStorage.setItem("ma_onboarding_completed", "true");
    const checkbox = document.querySelector<HTMLInputElement>("input[type='checkbox']");
    if (checkbox && !checkbox.checked) checkbox.click();
    const button = Array.from(document.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Continue");
    if (button instanceof HTMLButtonElement && !button.disabled) button.click();
  });
  await page.waitForTimeout(250);
}

async function assertMobileMetrics(page: Page, route: string): Promise<void> {
  const before = await page.evaluate(() => ({ height: window.innerHeight, width: window.innerWidth }));
  await page.waitForTimeout(450);
  const metrics: MobileMetrics = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(root.scrollWidth, body?.scrollWidth ?? 0);
    const bottomNav = document.querySelector("nav[aria-label='Primary mobile navigation']");
    const bottomNavRect = bottomNav?.getBoundingClientRect();
    const navTargets = Array.from(bottomNav?.querySelectorAll("a,button") ?? []);
    const smallTapTargets = navTargets.filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width < 44 || rect.height < 44;
    }).length;
    const dialog = document.querySelector("[role='dialog']");
    const dialogRect = dialog?.getBoundingClientRect();
    const overlay = document.querySelector("[data-stable-overlay-content='true']");
    const overlayRect = overlay?.getBoundingClientRect();
    const fixedOrSticky = Array.from(document.querySelectorAll("body *")).filter((node) => {
      const style = window.getComputedStyle(node);
      if (style.position !== "fixed" && style.position !== "sticky") return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8 && (rect.left < -2 || rect.right > window.innerWidth + 2 || rect.top < -2 || rect.bottom > window.innerHeight + 2);
    }).length;
    const activeElement = document.activeElement;
    const keyboardTarget =
      activeElement instanceof HTMLElement && activeElement.matches("input:not([type='hidden']), textarea, select, [contenteditable='true']") ? activeElement : null;
    const activeRect = keyboardTarget ? keyboardTarget.getBoundingClientRect() : null;
    const visualHeight = window.visualViewport?.height ?? window.innerHeight;
    return {
      activeElementBottom: activeRect ? activeRect.bottom : null,
      bottomNavCount: document.querySelectorAll("nav[aria-label='Primary mobile navigation']").length,
      bottomNavVisible: !bottomNavRect || (bottomNavRect.top < window.innerHeight - 8 && bottomNavRect.bottom > 8),
      clippedFixedOrSticky: fixedOrSticky,
      clippedOverlay: overlayRect ? overlayRect.left < -2 || overlayRect.right > window.innerWidth + 2 || overlayRect.top < -2 || overlayRect.bottom > window.innerHeight + 2 : false,
      horizontalOverflow: scrollWidth - window.innerWidth,
      keyboardSafe: activeRect ? activeRect.bottom <= visualHeight + 8 : true,
      modalOffscreen: dialogRect ? dialogRect.left < -2 || dialogRect.right > window.innerWidth + 2 || dialogRect.top < -2 || dialogRect.bottom > window.innerHeight + 2 : false,
      smallTapTargets,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });

  expect(Math.abs(metrics.viewportWidth - before.width), `${route} viewport width shifted`).toBeLessThanOrEqual(2);
  expect(Math.abs(metrics.viewportHeight - before.height), `${route} viewport height shifted`).toBeLessThanOrEqual(80);
  expect(metrics.horizontalOverflow, `${route} horizontal overflow`).toBeLessThanOrEqual(2);
  if (PRODUCT_NAV_ROUTES.has(route)) {
    expect(metrics.bottomNavCount, `${route} should render one mobile bottom nav`).toBe(1);
    expect(metrics.bottomNavVisible, `${route} bottom nav visible`).toBe(true);
    expect(metrics.smallTapTargets, `${route} bottom-nav tap targets`).toBe(0);
  } else {
    expect(metrics.bottomNavCount, `${route} should not duplicate mobile bottom nav`).toBeLessThanOrEqual(1);
    if (metrics.bottomNavCount > 0) {
      expect(metrics.bottomNavVisible, `${route} bottom nav visible`).toBe(true);
      expect(metrics.smallTapTargets, `${route} bottom-nav tap targets`).toBe(0);
    }
  }
  expect(metrics.modalOffscreen, `${route} modal offscreen`).toBe(false);
  expect(metrics.clippedOverlay, `${route} overlay clipped`).toBe(false);
  expect(metrics.clippedFixedOrSticky, `${route} clipped sticky/fixed elements`).toBe(0);
  expect(metrics.keyboardSafe, `${route} active input should not sit under keyboard viewport`).toBe(true);
}

async function assertTouchResponsiveness(page: Page): Promise<void> {
  const button = page.locator("button:not([disabled])").first();
  if (!(await button.isVisible().catch(() => false))) return;
  const box = await button.boundingBox();
  if (!box || box.width < 20 || box.height < 20) return;
  await page.touchscreen.tap(box.x + Math.min(box.width / 2, 24), box.y + Math.min(box.height / 2, 24));
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(200);
}

async function assertKeyboardSafety(page: Page): Promise<void> {
  const input = page.locator("input:not([type='hidden']), textarea").first();
  if (!(await input.isVisible().catch(() => false))) return;
  await input.tap().catch(async () => {
    await input.click({ force: true });
  });
  await page.waitForTimeout(500);
  const safe = await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return true;
    const rect = active.getBoundingClientRect();
    const visualHeight = window.visualViewport?.height ?? window.innerHeight;
    return rect.bottom <= visualHeight + 8;
  });
  expect(safe, "focused input should remain above visual viewport").toBe(true);
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}

async function exerciseScannerUsability(page: Page, route: string): Promise<void> {
  if (route !== "/discover" && route !== "/scanner") return;
  const search = page.locator("input[type='search'], input[placeholder*='Search' i], input[aria-label*='Search' i]").first();
  if (await search.isVisible().catch(() => false)) {
    await search.fill("AMD");
    await page.waitForTimeout(300);
    await search.fill("");
  }
  const preset = page.locator("button").filter({ hasText: /Best|Breakout|Gainers|Risk|Macro|Replay/i }).first();
  if (await preset.isVisible().catch(() => false)) {
    await preset.tap();
    await page.waitForTimeout(250);
  }
}

async function exerciseChartUsability(page: Page, route: string): Promise<void> {
  if (route !== "/symbol/AMD") return;
  const control = page.locator("button[aria-label*='chart' i], button").filter({ hasText: /Expand|Full chart|Chart/i }).first();
  if (!(await control.isVisible().catch(() => false))) return;
  await control.tap();
  await page.waitForTimeout(350);
  const dialog = page.locator("[role='dialog']").first();
  await expect(dialog, "chart detail dialog opens").toBeVisible();
  await assertOverlayGeometry(page, "chart detail");
  await closeOverlay(page);
}

async function exerciseStableOverlay(page: Page, route: string, required: boolean): Promise<void> {
  const result: OverlayResult = await page.evaluate(async () => {
    const triggers = Array.from(document.querySelectorAll<HTMLElement>("[data-stable-overlay-trigger='true']")).filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 20 && rect.height > 20 && style.visibility !== "hidden" && style.display !== "none";
    });
    const visibleTriggers = triggers.filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    });
    const trigger = visibleTriggers[0] ?? triggers[0];
    if (!trigger) {
      return { closeScrollDelta: 0, closeVisible: false, clipped: false, openScrollDelta: 0, opened: false, skipped: true, stillOpen: false };
    }
    trigger.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const beforeY = window.scrollY;
    trigger.click();
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    const visualScrollY = () => {
      const lockedTop = Number.parseFloat(document.body.style.top || "0");
      return document.body.style.position === "fixed" && Number.isFinite(lockedTop) ? Math.abs(lockedTop) : window.scrollY;
    };
    const overlay = document.querySelector("[data-stable-overlay='true']");
    const surface = document.querySelector("[data-stable-overlay-content='true']");
    const close = overlay?.querySelector<HTMLElement>("button[aria-label*='Close']");
    const surfaceRect = surface?.getBoundingClientRect();
    const closeRect = close?.getBoundingClientRect();
    const clipped = surfaceRect ? surfaceRect.left < -2 || surfaceRect.right > window.innerWidth + 2 || surfaceRect.top < -2 || surfaceRect.bottom > window.innerHeight + 2 : true;
    const closeVisible = closeRect ? closeRect.left >= -2 && closeRect.right <= window.innerWidth + 2 && closeRect.top >= -2 && closeRect.bottom <= window.innerHeight + 2 : false;
    const opened = Boolean(overlay && surface);
    const openScrollDelta = Math.abs(visualScrollY() - beforeY);
    close?.click();
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    return {
      closeScrollDelta: Math.abs(window.scrollY - beforeY),
      closeVisible,
      clipped,
      openScrollDelta,
      opened,
      skipped: false,
      stillOpen: Boolean(document.querySelector("[data-stable-overlay='true']")),
    };
  });

  if (result.skipped) {
    expect(required, `${route} should expose a stable overlay trigger`).toBe(false);
    return;
  }
  expect(result.opened, `${route} stable overlay opened`).toBe(true);
  expect(result.clipped, `${route} stable overlay clipped`).toBe(false);
  expect(result.closeVisible, `${route} stable overlay close visible`).toBe(true);
  expect(result.stillOpen, `${route} stable overlay closed`).toBe(false);
  expect(result.openScrollDelta, `${route} overlay open scroll delta`).toBeLessThanOrEqual(8);
  expect(result.closeScrollDelta, `${route} overlay close scroll restoration`).toBeLessThanOrEqual(8);
}

async function exercisePaperDeepScrollOverlay(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo({ behavior: "auto", top: document.body.scrollHeight }));
  await page.waitForTimeout(400);
  await exerciseStableOverlay(page, "/paper deep-scroll", true);
  await page.evaluate(() => window.scrollTo({ behavior: "auto", top: Math.floor(document.body.scrollHeight * 0.55) }));
  await page.waitForTimeout(250);
  await exerciseStableOverlay(page, "/paper mid-scroll", true);
}

async function assertOverlayGeometry(page: Page, label: string): Promise<void> {
  const geometry = await page.evaluate(() => {
    const surface = document.querySelector("[data-stable-overlay-content='true']") ?? document.querySelector("[role='dialog']");
    const rect = surface?.getBoundingClientRect();
    return rect ? { clipped: rect.left < -2 || rect.right > window.innerWidth + 2 || rect.top < -2 || rect.bottom > window.innerHeight + 2 } : { clipped: true };
  });
  expect(geometry.clipped, `${label} clipped`).toBe(false);
}

async function closeOverlay(page: Page): Promise<void> {
  const close = page.locator("[role='dialog'] button[aria-label*='Close' i], [data-stable-overlay='true'] button[aria-label*='Close' i]").first();
  if (await close.isVisible().catch(() => false)) await close.tap();
  await page.waitForTimeout(250);
}

async function captureRouteScreenshot(page: Page, route: string, testInfo: TestInfo): Promise<void> {
  const projectSlug = slug(testInfo.project.name || "browserstack-device");
  await page.screenshot({
    fullPage: false,
    path: resolve(ARTIFACT_DIR, `${projectSlug}-${slug(route)}.png`),
  });
}

function slug(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "route";
}
