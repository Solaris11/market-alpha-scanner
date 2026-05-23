#!/usr/bin/env node

import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox, webkit } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const FRONTEND_DIR = resolve(new URL("..", import.meta.url).pathname);
const ARTIFACT_DIR = resolve(FRONTEND_DIR, "..", "docs", "ops", "artifacts", "phase-22-9");
const BASE_URL = (process.env.TRADEVETO_UTILITY_A11Y_BASE_URL || "https://tradeveto.com").replace(/\/$/, "");
const COOKIE = process.env.TRADEVETO_UTILITY_A11Y_COOKIE || process.env.TRADEVETO_PHASE22_COOKIE || "";
const ROUTES = ["/account", "/settings", "/support", "/alerts", "/history?symbol=AMD", "/performance"];
const BROWSER_TYPES = {
  chromium,
  firefox,
  webkit,
};
const REQUESTED_BROWSERS = (process.env.TRADEVETO_UTILITY_A11Y_BROWSERS || "chromium,webkit,firefox")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const failures = [];
const results = [];

await main();

async function main() {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  for (const browserName of REQUESTED_BROWSERS) {
    const browserType = BROWSER_TYPES[browserName];
    if (!browserType) {
      failures.push(`${browserName}: unsupported browser`);
      continue;
    }
    await runBrowser(browserName, browserType);
  }

  const artifact = {
    baseUrl: BASE_URL,
    browsers: REQUESTED_BROWSERS,
    generatedAt: new Date().toISOString(),
    results,
    summary: {
      failures: failures.length,
      routes: ROUTES,
    },
  };
  await writeFile(resolve(ARTIFACT_DIR, "utility-accessibility-smoke.json"), `${JSON.stringify(artifact, null, 2)}\n`);

  if (failures.length) {
    console.error(`PHASE22_UTILITY_A11Y_FAILED failures=${failures.length}`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`PHASE22_UTILITY_A11Y_PASSED browsers=${REQUESTED_BROWSERS.length} routes=${ROUTES.length} axeCritical=0 artifacts=${ARTIFACT_DIR}`);
}

async function runBrowser(browserName, browserType) {
  let browser;
  try {
    browser = await browserType.launch({ headless: true });
  } catch (error) {
    failures.push(`${browserName}: launch failed: ${messageFor(error)}`);
    return;
  }

  try {
    const context = await browser.newContext({
      colorScheme: "dark",
      extraHTTPHeaders: COOKIE ? { Cookie: COOKIE } : undefined,
      ignoreHTTPSErrors: false,
      viewport: { height: 900, width: 1440 },
    });
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem("ma_risk_acknowledged_v1", "true");
        window.localStorage.setItem("ma_onboarding_completed", "true");
        window.localStorage.setItem("tradeveto_first_run_starter_hidden_v1", "true");
        window.localStorage.setItem("tradeveto_first_opportunity_review_hidden_v1", "true");
      } catch {
        // Storage can be disabled in hardened browser contexts.
      }
    });

    for (const route of ROUTES) {
      await inspectRoute(context, browserName, route);
    }
    await context.close();
  } finally {
    await browser.close();
  }
}

async function inspectRoute(context, browserName, route) {
  const page = await context.newPage();
  const url = `${BASE_URL}${route}`;
  const result = {
    axeCriticalViolations: 0,
    browser: browserName,
    horizontalOverflowPx: 0,
    keyboardFocusVisible: false,
    route,
    status: 0,
    unlabeledControls: 0,
  };
  try {
    const response = await page.goto(url, { timeout: 45_000, waitUntil: "domcontentloaded" });
    result.status = response?.status() ?? 0;
    await page.waitForTimeout(1_000);
    await dismissRiskModal(page);

    const axeResult = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const criticalViolations = axeResult.violations.filter((violation) => violation.impact === "critical");
    result.axeCriticalViolations = criticalViolations.length;
    if (criticalViolations.length) {
      failures.push(`${browserName} ${route}: Axe critical violation: ${criticalViolations[0].id}`);
    }

    const metrics = await page.evaluate(() => {
      const interactiveSelector = "a,button,input,select,textarea,[role='button'],[role='link'],[tabindex]:not([tabindex='-1'])";
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      };
      const accessibleName = (element) => {
        const labelledBy = element.getAttribute("aria-labelledby");
        if (labelledBy) {
          const text = labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() || "")
            .filter(Boolean)
            .join(" ");
          if (text) return text;
        }
        return [
          element.getAttribute("aria-label"),
          element.getAttribute("title"),
          element.textContent,
          element.getAttribute("value"),
          element.getAttribute("placeholder"),
        ].map((value) => String(value || "").trim()).find(Boolean) || "";
      };
      const controls = Array.from(document.querySelectorAll(interactiveSelector))
        .filter((element) => element instanceof HTMLElement)
        .filter((element) => !element.hasAttribute("disabled"))
        .filter(isVisible);
      const unlabeledControls = controls.filter((element) => !accessibleName(element)).length;
      const horizontalOverflowPx = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const mainCount = document.querySelectorAll("main").length;
      const headingCount = document.querySelectorAll("h1").length;
      return { headingCount, horizontalOverflowPx, mainCount, unlabeledControls };
    });
    result.horizontalOverflowPx = metrics.horizontalOverflowPx;
    result.unlabeledControls = metrics.unlabeledControls;
    if (metrics.mainCount !== 1) failures.push(`${browserName} ${route}: expected one main landmark, saw ${metrics.mainCount}`);
    if (metrics.headingCount < 1) failures.push(`${browserName} ${route}: missing h1 heading`);
    if (metrics.horizontalOverflowPx > 2) failures.push(`${browserName} ${route}: horizontal overflow ${metrics.horizontalOverflowPx}px`);
    if (metrics.unlabeledControls > 0) failures.push(`${browserName} ${route}: ${metrics.unlabeledControls} visible interactive controls lack accessible names`);

    result.keyboardFocusVisible = await keyboardFocusVisible(page, browserName);
    if (!result.keyboardFocusVisible) failures.push(`${browserName} ${route}: keyboard Tab did not expose a visible focus target`);

    await page.screenshot({ fullPage: false, path: resolve(ARTIFACT_DIR, `${browserName}-${slugForRoute(route)}.png`) });
  } catch (error) {
    failures.push(`${browserName} ${route}: ${messageFor(error)}`);
  } finally {
    results.push(result);
    await page.close();
  }
}

async function dismissRiskModal(page) {
  const checkbox = page.getByRole("checkbox", { name: /financial advice|risk|understand/i }).first();
  const continueButton = page.getByRole("button", { name: /continue|understand|accept/i }).first();
  try {
    if (await checkbox.isVisible({ timeout: 500 })) await checkbox.check({ timeout: 1_000 });
    if (await continueButton.isVisible({ timeout: 500 })) await continueButton.click({ timeout: 1_000 });
  } catch {
    // The modal is not always present for remembered sessions.
  }
}

async function keyboardFocusVisible(page, browserName) {
  const keys = browserName === "webkit" ? ["Alt+Tab", "Tab"] : ["Tab"];
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press(keys[index % keys.length]);
    const state = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body) return { focused: false, visible: false };
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        focused: true,
        visible: rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none",
      };
    });
    if (state.focused && state.visible) return true;
  }
  return false;
}

function slugForRoute(route) {
  return route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
}

function messageFor(error) {
  return error instanceof Error ? error.message : String(error);
}
