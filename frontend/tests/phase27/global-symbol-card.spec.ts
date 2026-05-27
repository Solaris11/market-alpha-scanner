import { expect, test, type Page } from "@playwright/test";

const ROUTES = ["/terminal", "/alerts", "/symbol/AMD"] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("ma_risk_acknowledged_v1", "true");
    window.localStorage.setItem("ma_onboarding_completed", "true");
    window.localStorage.setItem("tradeveto_first_run_starter_hidden_v1", "true");
    window.localStorage.setItem("tradeveto_first_opportunity_review_hidden_v1", "true");
  });
});

for (const route of ROUTES) {
  test(`global symbol card opens and closes without navigation on ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await installInjectedSymbolSurface(page, route);
    await page.evaluate(() => window.scrollTo({ behavior: "auto", top: 360 }));
    await page.waitForTimeout(100);
    const before = await routeState(page);

    await page.getByTestId("phase27-symbol-link").click();
    const card = page.locator("[data-symbol-intelligence-card='true']");
    const closeButton = page.getByRole("button", { exact: true, name: "Close symbol intelligence card" });
    await expect(card).toBeVisible();
    await expect(page.locator("[data-symbol-card-panel='true']")).toBeVisible();
    await expect(closeButton).toBeVisible();
    await expect(page.locator("#symbol-intelligence-card-title")).toContainText("AMD");
    await expectPathStable(page, before);
    await assertCardGeometry(page);

    await page.locator("[data-symbol-card-content='true']").click({ position: { x: 40, y: 40 } });
    await expect(card, "inside card click must not close").toBeVisible();

    await closeButton.click();
    await expect(card, "close button closes card").toBeHidden();
    await expectRouteStateStable(page, before);

    await page.getByTestId("phase27-symbol-link").click();
    await expect(card).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card, "Escape closes card").toBeHidden();
    await expectRouteStateStable(page, before);

    await page.getByTestId("phase27-symbol-link").click();
    await expect(card).toBeVisible();
    await page.mouse.click(8, 8);
    await expect(card, "backdrop click closes card").toBeHidden();
    await expectRouteStateStable(page, before);

    await page.getByTestId("phase27-symbol-link").click();
    await expect(card).toBeVisible();
    await page.evaluate(() => window.history.back());
    await expect(card, "browser back closes card first").toBeHidden();
    await expectRouteStateStable(page, before);
  });
}

test("Open full symbol page navigates intentionally from the card", async ({ page }) => {
  await page.goto("/terminal", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await installInjectedSymbolSurface(page, "/terminal");
  await page.getByTestId("phase27-symbol-link").click();
  await expect(page.locator("[data-symbol-intelligence-card='true']")).toBeVisible();
  await page.getByRole("link", { name: /open full symbol page/i }).click();
  await expect(page).toHaveURL(/\/symbol\/AMD$/);
});

test("mobile symbol card has visible close control and no bottom-nav obstruction", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "mobile geometry check runs in mobile project");
  await page.goto("/terminal", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await installInjectedSymbolSurface(page, "/terminal");
  await page.getByTestId("phase27-symbol-link").click();
  await expect(page.locator("[data-symbol-intelligence-card='true']")).toBeVisible();
  await assertCardGeometry(page);
});

async function installInjectedSymbolSurface(page: Page, route: string): Promise<void> {
  await page.evaluate((sourceRoute) => {
    const existing = document.querySelector("[data-testid='phase27-symbol-link']");
    if (existing) existing.remove();
    const host = document.createElement("div");
    host.style.left = "16px";
    host.style.padding = "12px";
    host.style.position = "fixed";
    host.style.top = "96px";
    host.style.zIndex = "50";
    host.innerHTML = `<a data-testid="phase27-symbol-link" data-symbol-source="${sourceRoute}" href="/symbol/AMD" style="display:inline-flex;min-height:44px;align-items:center;border:1px solid rgba(103,232,249,.35);border-radius:14px;padding:8px 12px;color:white;background:rgba(14,165,233,.18);font-family:monospace;font-weight:800">AMD</a>`;
    document.body.prepend(host);
  }, route);
}

async function routeState(page: Page): Promise<{ pathname: string; scrollY: number }> {
  return page.evaluate(() => ({ pathname: window.location.pathname, scrollY: Math.round(window.scrollY) }));
}

async function expectRouteStateStable(page: Page, before: { pathname: string; scrollY: number }): Promise<void> {
  await expectPathStable(page, before);
  await expect
    .poll(async () => Math.abs((await routeState(page)).scrollY - before.scrollY), { timeout: 3_000 })
    .toBeLessThanOrEqual(8);
}

async function expectPathStable(page: Page, before: { pathname: string }): Promise<void> {
  await expect.poll(async () => (await routeState(page)).pathname, { timeout: 3_000 }).toBe(before.pathname);
}

async function assertCardGeometry(page: Page): Promise<void> {
  const geometry = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-symbol-intelligence-card='true']");
    const panel = document.querySelector<HTMLElement>("[data-symbol-card-panel='true']");
    const close = document.querySelector<HTMLElement>("button[aria-label='Close symbol intelligence card']");
    const bottomNav = Array.from(document.querySelectorAll<HTMLElement>("nav, [data-mobile-bottom-nav='true'], [data-testid='mobile-bottom-nav']"))
      .map((element) => element.getBoundingClientRect())
      .find((rect) => rect.bottom > window.innerHeight - 120 && rect.height > 24);
    const panelRect = panel?.getBoundingClientRect() ?? null;
    const closeRect = close?.getBoundingClientRect() ?? null;
    return {
      closeBottom: closeRect?.bottom ?? null,
      closeTop: closeRect?.top ?? null,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      navTop: bottomNav?.top ?? null,
      panelBottom: panelRect?.bottom ?? null,
      panelLeft: panelRect?.left ?? null,
      panelRight: panelRect?.right ?? null,
      rootVisible: Boolean(root),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });

  expect(geometry.rootVisible).toBe(true);
  expect(geometry.horizontalOverflow).toBeLessThanOrEqual(2);
  expect(geometry.panelLeft ?? -1).toBeGreaterThanOrEqual(-2);
  expect(geometry.panelRight ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(geometry.viewportWidth + 2);
  expect(geometry.closeTop ?? -1).toBeGreaterThanOrEqual(-2);
  expect(geometry.closeBottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(geometry.viewportHeight + 2);
  expect(geometry.panelBottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(geometry.viewportHeight + 2);
}
