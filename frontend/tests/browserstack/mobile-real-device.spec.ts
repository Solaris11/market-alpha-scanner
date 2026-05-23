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

const NOTIFICATION_DRAWER_ROUTES = ["/terminal", "/alerts", "/symbol/AMD"] as const;

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
const ARTIFACT_ROOT = resolve(process.cwd(), process.env.TRADEVETO_BROWSERSTACK_ARTIFACT_ROOT ?? "../docs/ops/artifacts/phase-22-1");
const ARTIFACT_DIR = resolve(ARTIFACT_ROOT, "browserstack-screenshots");
const BASE_URL = (process.env.TRADEVETO_MOBILE_UX_BASE_URL ?? "https://tradeveto.com").replace(/\/$/, "");

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
  diagnostics: {
    bodyPosition: string;
    bodyTop: string;
    closeRect: RectSnapshot | null;
    rootRect: RectSnapshot | null;
    surfaceRect: RectSnapshot | null;
    visualViewportHeight: number | null;
    visualViewportWidth: number | null;
    viewportHeight: number;
    viewportWidth: number;
    visualViewportCssHeight: string;
    visualViewportCssWidth: string;
  };
  openScrollDelta: number;
  opened: boolean;
  skipped: boolean;
  stillOpen: boolean;
};

type RectSnapshot = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
});

test("risk acknowledgement overlay mobile safe area", async ({ page }, testInfo) => {
  const hydrationMessages = bindHydrationCapture(page);
  await installRiskAcknowledgementTestState(page);

  await navigateAndSettle(page, "/scanner");

  const dialog = page.locator("[role='dialog'][aria-label='Risk acknowledgement']").first();
  await expect(dialog, "risk acknowledgement dialog is visible").toBeVisible();
  await assertRiskAcknowledgementOverlaySafe(page);
  await captureNamedScreenshot(page, "risk-acknowledgement-open", testInfo);

  const checkbox = dialog.locator("input[type='checkbox']").first();
  await checkbox.check({ force: true });
  const continueButton = dialog.getByRole("button", { name: /^Continue$/ });
  await expect(continueButton, "risk acknowledgement continue enabled").toBeEnabled();
  await continueButton.tap().catch(async () => {
    await continueButton.click({ force: true });
  });
  await expect(dialog, "risk acknowledgement dismisses").toBeHidden({ timeout: 10_000 });
  await assertMobileMetrics(page, "/scanner");
  expect(hydrationMessages, "risk acknowledgement hydration/runtime mismatch").toEqual([]);
});

test("notification overlay mobile safe area", async ({ page }, testInfo) => {
  const hydrationMessages = bindHydrationCapture(page);
  await installStableClientState(page);
  await installAuthenticatedNotificationMocks(page);

  await navigateAndSettle(page, "/terminal");
  await openNotifications(page);

  const menu = page.locator(".tv-notification-menu").first();
  await expect(menu, "notification menu is visible").toBeVisible();
  await assertNotificationOverlaySafe(page, "notification overlay top");
  await captureNamedScreenshot(page, "notifications-open", testInfo);

  await page.evaluate(() => {
    const scroll = document.querySelector<HTMLElement>(".tv-notification-scroll");
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
  });
  await page.waitForTimeout(150);
  await assertNotificationOverlaySafe(page, "notification overlay bottom");
  await captureNamedScreenshot(page, "notifications-scrolled-bottom", testInfo);

  await page.evaluate(() => {
    document.querySelector<HTMLElement>("button[aria-label='Close notifications']")?.click();
  });
  await page.keyboard.press("Escape").catch(() => undefined);
  await expect(menu, "notification menu closes").toBeHidden({ timeout: 10_000 });
  expect(hydrationMessages, "notification overlay hydration/runtime mismatch").toEqual([]);
});

test("notification drawer toggle and close behavior preserves route and scroll", async ({ page }) => {
  const hydrationMessages = bindHydrationCapture(page);
  await installStableClientState(page);
  await installAuthenticatedNotificationMocks(page);

  for (const route of NOTIFICATION_DRAWER_ROUTES) {
    await test.step(`notification drawer controls on ${route}`, async () => {
      await navigateAndSettle(page, route);
      await acknowledgeRisk(page);
      await page.evaluate(() => {
        window.scrollTo({ behavior: "auto", top: 0 });
      });
      await page.waitForTimeout(200);

      const before = await currentRouteState(page);
      await clickVisibleNotificationBell(page);
      const menu = page.locator(".tv-notification-menu").first();
      await expect(menu, `${route} notification drawer opens from bell`).toBeVisible();
      await expect(menu, `${route} notification drawer uses dialog semantics`).toHaveAttribute("role", "dialog");
      await expect(page.getByRole("button", { name: "Close notifications" }), `${route} close button visible`).toBeVisible();
      await assertNotificationOverlaySafe(page, `${route} notification drawer`);
      await expectRouteStateStable(page, route, before, `${route} after open`);

      await clickVisibleNotificationBell(page);
      await expect(menu, `${route} notification drawer closes from bell toggle`).toBeHidden({ timeout: 10_000 });
      await expectRouteStateStable(page, route, before, `${route} after bell close`);

      await clickVisibleNotificationBell(page);
      await expect(menu, `${route} notification drawer reopens`).toBeVisible();
      await page.getByRole("button", { name: "Close notifications" }).click();
      await expect(menu, `${route} notification drawer closes from close button`).toBeHidden({ timeout: 10_000 });
      await expectRouteStateStable(page, route, before, `${route} after close button`);
      const focusRestored = await page.evaluate(() => document.activeElement?.getAttribute("data-notification-bell") === "true");
      expect(focusRestored, `${route} focus returns to notification bell`).toBe(true);

      await clickVisibleNotificationBell(page);
      await expect(menu, `${route} notification drawer opens for inside click test`).toBeVisible();
      const box = await menu.boundingBox();
      expect(box, `${route} notification drawer has geometry`).not.toBeNull();
      if (box) await page.mouse.click(box.x + 20, box.y + 20);
      await expect(menu, `${route} clicking inside drawer does not close it`).toBeVisible();
      await page.mouse.click(2, 2);
      await expect(menu, `${route} outside click closes drawer`).toBeHidden({ timeout: 10_000 });
      await expectRouteStateStable(page, route, before, `${route} after outside click`);

      await clickVisibleNotificationBell(page);
      await expect(menu, `${route} notification drawer opens for Escape test`).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu, `${route} Escape closes drawer`).toBeHidden({ timeout: 10_000 });
      await expectRouteStateStable(page, route, before, `${route} after Escape`);
    });
  }

  expect(hydrationMessages, "notification drawer toggle hydration/runtime mismatch").toEqual([]);
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

async function installRiskAcknowledgementTestState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.removeItem("ma_risk_acknowledged_v1");
    window.localStorage.setItem("ma_onboarding_completed", "true");
    window.localStorage.setItem("tradeveto_first_run_starter_hidden_v1", "true");
    window.localStorage.setItem("tradeveto_first_opportunity_review_hidden_v1", "true");
    window.sessionStorage.removeItem("ma_onboarding_replay_pending");
  });
}

async function installAuthenticatedNotificationMocks(page: Page): Promise<void> {
  const now = new Date().toISOString();
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        authenticated: true,
        entitlement: {
          authenticated: true,
          betaAccess: true,
          betaAccessLabel: "Phase 22 QA",
          isAdmin: false,
          isPremium: true,
          legalStatus: {
            allAccepted: true,
            privacyAccepted: true,
            riskAccepted: true,
            termsAccepted: true,
          },
          plan: "premium",
        },
        user: {
          createdAt: now,
          displayName: "Phase 22 Mobile QA",
          email: "phase22-mobile@example.test",
          emailVerified: true,
          id: "phase22-mobile-qa",
          lastLoginAt: now,
          onboardingCompleted: true,
          profileImageUrl: null,
          riskExperienceLevel: "advanced",
          role: "user",
          state: "active",
          timezone: "America/New_York",
        },
      }),
      contentType: "application/json",
      status: 200,
    });
  });
  await page.route("**/api/legal/status", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ allAccepted: true, authenticated: true, ok: true, privacyAccepted: true, riskAccepted: true, termsAccepted: true }),
      contentType: "application/json",
      status: 200,
    });
  });
  await page.route("**/api/notifications**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/notifications") {
      await route.fulfill({
        body: JSON.stringify({
          notifications: [
            {
              actionUrl: "/alerts",
              createdAt: now,
              id: "11111111-1111-4111-8111-111111111111",
              message: "AMD moved into a watchlist risk state with a long source-linked explanation that must wrap cleanly without vertical clipping on real mobile devices.",
              read: false,
              title: "Watchlist risk changed",
              type: "signal",
            },
            {
              actionUrl: "/feed",
              createdAt: now,
              id: "22222222-2222-4222-8222-222222222222",
              message: "A macro pressure update is available. This notification intentionally uses enough text to exercise card height, internal scroll behavior, and safe-area spacing.",
              read: false,
              title: "Macro pressure update",
              type: "system",
            },
            {
              actionUrl: "/account",
              createdAt: now,
              id: "33333333-3333-4333-8333-333333333333",
              message: "Your premium access is active. Review account details if you want to confirm entitlement state.",
              read: true,
              title: "Premium active",
              type: "subscription",
            },
            {
              actionUrl: "/market-memory",
              createdAt: now,
              id: "44444444-4444-4444-8444-444444444444",
              message: "Market memory found a similar replay context. The card should remain readable and scrollable at the bottom of the overlay.",
              read: false,
              title: "Replay context available",
              type: "signal",
            },
          ],
          ok: true,
          unreadCount: 3,
        }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }
    if (url.pathname.startsWith("/api/notifications/read")) {
      await route.fulfill({ body: JSON.stringify({ ok: true }), contentType: "application/json", status: 200 });
      return;
    }
    await route.continue();
  });
}

async function navigateAndSettle(page: Page, route: string): Promise<void> {
  const response = await gotoRouteWithRetry(page, route);
  expect(response?.status() ?? 0, `${route} should not return a server error`).toBeLessThan(500);
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(350);
  const path = await page.evaluate(() => window.location.pathname);
  expect(path, `${route} should resolve to requested route`).toBe(route);
}

async function gotoRouteWithRetry(page: Page, route: string): Promise<Response | null> {
  const url = `${BASE_URL}${route}`;
  try {
    return await page.goto(url, { timeout: 60_000, waitUntil: "domcontentloaded" });
  } catch (firstError) {
    await page.waitForTimeout(1_000);
    try {
      return await page.goto(url, { timeout: 60_000, waitUntil: "commit" });
    } catch {
      await page.evaluate((nextUrl: string) => {
        window.location.assign(nextUrl);
      }, url);
      await page.waitForFunction((expectedPath: string) => window.location.pathname === expectedPath, route, { timeout: 45_000 });
      return null;
    }
  }
}

async function openNotifications(page: Page): Promise<void> {
  await clickVisibleNotificationBell(page);
  await page.waitForTimeout(450);
  if (await page.locator(".tv-notification-menu").first().isVisible().catch(() => false)) return;
  throw new Error("No visible notification button opened the notification overlay.");
}

async function clickVisibleNotificationBell(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll<HTMLElement>("button[data-notification-bell='true']")).some((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width >= 20 && rect.height >= 20 && rect.bottom > 0 && rect.top < window.innerHeight;
    });
  }, null, { timeout: 15_000 });
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll<HTMLElement>("button[data-notification-bell='true']")).reverse();
    const button = buttons.find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return rect.width >= 20 && rect.height >= 20 && rect.bottom > 0 && rect.top < window.innerHeight;
    });
    button?.click();
    return Boolean(button);
  });
  if (clicked) return;

  const buttons = page.locator("button[data-notification-bell='true']");
  const count = await buttons.count();
  for (let index = count - 1; index >= 0; index -= 1) {
    const button = buttons.nth(index);
    if (!(await button.isVisible().catch(() => false))) continue;
    const box = await button.boundingBox();
    if (!box || box.width < 20 || box.height < 20) continue;
    await button.tap({ timeout: 3_000 }).catch(async () => {
      await button.click({ force: true, timeout: 3_000 });
    });
    return;
  }
  throw new Error("No visible notification bell was available.");
}

type RouteState = {
  historyLength: number;
  path: string;
  scrollY: number;
};

async function currentRouteState(page: Page): Promise<RouteState> {
  return page.evaluate(() => ({
    historyLength: window.history.length,
    path: window.location.pathname,
    scrollY: window.scrollY,
  }));
}

async function expectRouteStateStable(page: Page, route: string, before: RouteState, label: string): Promise<void> {
  await page.waitForTimeout(100);
  const state = await currentRouteState(page);
  expect(state.path, `${label} path`).toBe(route);
  expect(state.historyLength, `${label} history length`).toBe(before.historyLength);
  expect(Math.abs(state.scrollY - before.scrollY), `${label} scroll preservation`).toBeLessThanOrEqual(8);
}

async function assertRiskAcknowledgementOverlaySafe(page: Page): Promise<void> {
  const geometry = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>("[role='dialog'][aria-label='Risk acknowledgement']");
    const panel = dialog?.querySelector<HTMLElement>(".tv-critical-overlay-panel") ?? null;
    const footer = dialog?.querySelector<HTMLElement>(".tv-critical-overlay-footer") ?? null;
    const checkbox = dialog?.querySelector<HTMLInputElement>("input[type='checkbox']") ?? null;
    const continueButton = Array.from(dialog?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent?.trim() === "Continue") ?? null;
    const nav = document.querySelector<HTMLElement>("nav[aria-label='Primary mobile navigation']");
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const rect = (element: Element | null) => {
      const box = element?.getBoundingClientRect();
      return box ? { bottom: box.bottom, height: box.height, left: box.left, right: box.right, top: box.top, width: box.width } : null;
    };
    const buttonRect = rect(continueButton);
    const checkboxRect = rect(checkbox);
    const footerRect = rect(footer);
    const navRect = rect(nav);
    const navVisible = navRect ? navRect.bottom > 0 && navRect.top < viewportHeight : false;
    const horizontalOverflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth;
    return {
      buttonClearanceFromNav: buttonRect && navRect && navVisible ? navRect.top - buttonRect.bottom : null,
      buttonRect,
      checkboxRect,
      footerRect,
      horizontalOverflow,
      panelRect: rect(panel),
      viewportHeight,
      viewportWidth,
    };
  });

  expect(geometry.panelRect, "risk acknowledgement panel exists").not.toBeNull();
  expect(geometry.buttonRect, "risk acknowledgement continue exists").not.toBeNull();
  expect(geometry.checkboxRect, "risk acknowledgement checkbox exists").not.toBeNull();
  expect(geometry.footerRect, "risk acknowledgement footer exists").not.toBeNull();
  expect(geometry.horizontalOverflow, "risk acknowledgement horizontal overflow").toBeLessThanOrEqual(2);
  expect(geometry.panelRect?.left ?? -1, "risk acknowledgement panel left").toBeGreaterThanOrEqual(-2);
  expect(geometry.panelRect?.right ?? Number.POSITIVE_INFINITY, "risk acknowledgement panel right").toBeLessThanOrEqual(geometry.viewportWidth + 2);
  expect(geometry.panelRect?.bottom ?? Number.POSITIVE_INFINITY, "risk acknowledgement panel bottom").toBeLessThanOrEqual(geometry.viewportHeight + 2);
  expect(geometry.buttonRect?.bottom ?? Number.POSITIVE_INFINITY, "risk acknowledgement continue bottom").toBeLessThanOrEqual(geometry.viewportHeight + 2);
  expect(geometry.checkboxRect?.bottom ?? Number.POSITIVE_INFINITY, "risk acknowledgement checkbox bottom").toBeLessThanOrEqual(geometry.viewportHeight + 2);
  if (geometry.buttonClearanceFromNav !== null) {
    expect(geometry.buttonClearanceFromNav, "risk acknowledgement continue clearance above bottom nav").toBeGreaterThanOrEqual(0);
  }
}

async function assertNotificationOverlaySafe(page: Page, label: string): Promise<void> {
  const geometry = await page.evaluate(() => {
    const menu = document.querySelector<HTMLElement>(".tv-notification-menu");
    const scroll = document.querySelector<HTMLElement>(".tv-notification-scroll");
    const nav = document.querySelector<HTMLElement>("nav[aria-label='Primary mobile navigation']");
    const cards = Array.from(scroll?.children ?? []).filter((node): node is HTMLElement => node instanceof HTMLElement && Boolean(node.querySelector("button")));
    const lastCard = cards[cards.length - 1] ?? null;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const rect = (element: Element | null) => {
      const box = element?.getBoundingClientRect();
      return box ? { bottom: box.bottom, height: box.height, left: box.left, right: box.right, top: box.top, width: box.width } : null;
    };
    const menuRect = rect(menu);
    const scrollRect = rect(scroll);
    const navRect = rect(nav);
    const lastCardRect = rect(lastCard);
    const navVisible = navRect ? navRect.bottom > 0 && navRect.top < viewportHeight : false;
    const horizontalOverflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth;
    return {
      cardCount: cards.length,
      horizontalOverflow,
      lastCardBottomClearance: lastCardRect && scrollRect ? scrollRect.bottom - lastCardRect.bottom : null,
      lastCardRect,
      menuBottomClearanceFromNav: menuRect && navRect && navVisible ? navRect.top - menuRect.bottom : null,
      menuRect,
      scrollClientHeight: scroll?.clientHeight ?? 0,
      scrollHeight: scroll?.scrollHeight ?? 0,
      scrollTop: scroll?.scrollTop ?? 0,
      scrollRect,
      viewportHeight,
      viewportWidth,
    };
  });

  expect(geometry.menuRect, `${label} menu exists`).not.toBeNull();
  expect(geometry.scrollRect, `${label} scroll exists`).not.toBeNull();
  expect(geometry.cardCount, `${label} notification cards rendered`).toBeGreaterThanOrEqual(4);
  expect(geometry.horizontalOverflow, `${label} horizontal overflow`).toBeLessThanOrEqual(2);
  expect(geometry.menuRect?.left ?? -1, `${label} menu left`).toBeGreaterThanOrEqual(-2);
  expect(geometry.menuRect?.right ?? Number.POSITIVE_INFINITY, `${label} menu right`).toBeLessThanOrEqual(geometry.viewportWidth + 2);
  expect(geometry.menuRect?.top ?? -1, `${label} menu top`).toBeGreaterThanOrEqual(-2);
  expect(geometry.menuRect?.bottom ?? Number.POSITIVE_INFINITY, `${label} menu bottom`).toBeLessThanOrEqual(geometry.viewportHeight + 2);
  expect(geometry.scrollClientHeight, `${label} scroll client height`).toBeGreaterThan(120);
  expect(geometry.scrollHeight, `${label} scroll height`).toBeGreaterThanOrEqual(geometry.scrollClientHeight);
  if (geometry.menuBottomClearanceFromNav !== null) {
    expect(geometry.menuBottomClearanceFromNav, `${label} menu clearance above bottom nav`).toBeGreaterThanOrEqual(0);
  }
  const scrolledToBottom = geometry.scrollTop + geometry.scrollClientHeight >= geometry.scrollHeight - 2;
  if (scrolledToBottom && geometry.lastCardBottomClearance !== null) {
    expect(geometry.lastCardBottomClearance, `${label} last visible card is not vertically clipped`).toBeGreaterThanOrEqual(-2);
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
  const x = box.x + Math.min(box.width / 2, 24);
  const y = box.y + Math.min(box.height / 2, 24);
  await button.tap({ timeout: 5_000 }).catch(async () => {
    await page.touchscreen.tap(x, y).catch(async () => {
      await button.click({ timeout: 5_000 });
    });
  });
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
  const toolbar = page.locator("[data-chart-fullscreen-toolbar='true']").first();
  if (await toolbar.isVisible().catch(() => false)) {
    const toolbarBox = await toolbar.boundingBox();
    const viewport = page.viewportSize();
    expect(toolbarBox?.width ?? 0, "chart fullscreen toolbar should stay inside viewport").toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
    expect(toolbarBox?.x ?? 0, "chart fullscreen toolbar should not overflow left").toBeGreaterThanOrEqual(-1);
  }
  await assertOverlayGeometry(page, "chart detail");
  await closeOverlay(page);
}

async function exerciseStableOverlay(page: Page, route: string, required: boolean): Promise<void> {
  const result: OverlayResult = await page.evaluate(async () => {
    const rectSnapshot = (rect: DOMRect | undefined): RectSnapshot | null => {
      if (!rect) return null;
      return {
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
      };
    };
    const overlayDiagnostics = (overlay: Element | null, surface: Element | null, close: HTMLElement | null): OverlayResult["diagnostics"] => {
      const root = document.documentElement;
      return {
        bodyPosition: document.body.style.position,
        bodyTop: document.body.style.top,
        closeRect: rectSnapshot(close?.getBoundingClientRect()),
        rootRect: rectSnapshot(overlay?.getBoundingClientRect()),
        surfaceRect: rectSnapshot(surface?.getBoundingClientRect()),
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        visualViewportCssHeight: root.style.getPropertyValue("--tv-visual-viewport-height"),
        visualViewportCssWidth: root.style.getPropertyValue("--tv-visual-viewport-width"),
        visualViewportHeight: window.visualViewport?.height ?? null,
        visualViewportWidth: window.visualViewport?.width ?? null,
      };
    };
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
      return {
        closeScrollDelta: 0,
        closeVisible: false,
        clipped: false,
        diagnostics: overlayDiagnostics(null, null, null),
        openScrollDelta: 0,
        opened: false,
        skipped: true,
        stillOpen: false,
      };
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
    const diagnostics = overlayDiagnostics(overlay, surface, close ?? null);
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
      diagnostics,
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
  expect(result.clipped, `${route} stable overlay clipped ${formatOverlayDiagnostics(result)}`).toBe(false);
  expect(result.closeVisible, `${route} stable overlay close visible ${formatOverlayDiagnostics(result)}`).toBe(true);
  expect(result.stillOpen, `${route} stable overlay closed`).toBe(false);
  expect(result.openScrollDelta, `${route} overlay open scroll delta`).toBeLessThanOrEqual(8);
  expect(result.closeScrollDelta, `${route} overlay close scroll restoration`).toBeLessThanOrEqual(8);
}

function formatOverlayDiagnostics(result: OverlayResult): string {
  return JSON.stringify({
    bodyPosition: result.diagnostics.bodyPosition,
    bodyTop: result.diagnostics.bodyTop,
    closeRect: result.diagnostics.closeRect,
    rootRect: result.diagnostics.rootRect,
    surfaceRect: result.diagnostics.surfaceRect,
    viewport: {
      height: result.diagnostics.viewportHeight,
      width: result.diagnostics.viewportWidth,
    },
    visualViewport: {
      cssHeight: result.diagnostics.visualViewportCssHeight,
      cssWidth: result.diagnostics.visualViewportCssWidth,
      height: result.diagnostics.visualViewportHeight,
      width: result.diagnostics.visualViewportWidth,
    },
  });
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

async function captureNamedScreenshot(page: Page, name: string, testInfo: TestInfo): Promise<void> {
  const projectSlug = slug(testInfo.project.name || "browserstack-device");
  await page.screenshot({
    fullPage: false,
    path: resolve(ARTIFACT_DIR, `${projectSlug}-${slug(name)}.png`),
  });
}

function slug(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "route";
}
