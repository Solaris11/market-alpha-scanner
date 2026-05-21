#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const FRONTEND_DIR = resolve(new URL("..", import.meta.url).pathname);
const ARTIFACT_DIR = resolve(FRONTEND_DIR, "..", "docs", "ops", "artifacts", "mobile-emulation");
const ROUTES = [
  "/",
  "/terminal",
  "/dashboard",
  "/discover",
  "/opportunities",
  "/symbol/AMD",
  "/alerts",
  "/performance",
  "/history?symbol=AMD",
  "/paper",
  "/strategy-labs",
  "/mobile",
];
const IN_APP_BROWSER_ROUTES = ["/", "/terminal", "/discover", "/symbol/AMD", "/paper", "/mobile"];
const DEVICES = [
  {
    height: 844,
    label: "iphone",
    scale: 3,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    width: 390,
  },
  {
    height: 915,
    label: "android",
    scale: 3,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    width: 412,
  },
  {
    height: 844,
    label: "facebook-ios",
    routes: IN_APP_BROWSER_ROUTES,
    scale: 3,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/465.0.0.0.92;FBBV/0;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US]",
    width: 390,
  },
  {
    height: 844,
    label: "instagram-ios",
    routes: IN_APP_BROWSER_ROUTES,
    scale: 3,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 333.0.0.0.101",
    width: 390,
  },
];

const failures = [];
const notes = [];

async function main() {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const chromePath = await findChrome();
  if (!chromePath) {
    console.log("MOBILE_UX_SMOKE_SKIPPED: Chrome/Chromium executable was not found. Browser emulation is required for screenshots.");
    return;
  }
  const base = await resolveBaseUrl();
  const chrome = await startChrome(chromePath);
  try {
    for (const device of DEVICES) {
      for (const route of device.routes ?? ROUTES) {
        await inspectRoute(chrome.port, base.url, device, route);
      }
    }
  } finally {
    await chrome.stop();
    await base.stop();
  }

  if (failures.length) {
    console.error(`MOBILE_UX_SMOKE_FAILED (${failures.length})`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  for (const note of notes) console.log(`NOTE: ${note}`);
  const routeCount = DEVICES.reduce((total, device) => total + (device.routes ?? ROUTES).length, 0);
  console.log(`MOBILE_UX_SMOKE_PASSED routeChecks=${routeCount} devices=${DEVICES.length} screenshots=${ARTIFACT_DIR}`);
}

async function resolveBaseUrl() {
  const configured = process.env.TRADEVETO_MOBILE_UX_BASE_URL?.trim();
  if (configured) return { stop: async () => undefined, url: configured.replace(/\/$/, "") };

  const buildIdPath = join(FRONTEND_DIR, ".next", "BUILD_ID");
  if (!existsSync(buildIdPath)) {
    throw new Error("Missing .next/BUILD_ID. Run `npm run build` before `npm run test:mobile-ux`, or set TRADEVETO_MOBILE_UX_BASE_URL.");
  }

  const port = await pickPort();
  const child = spawn("npm", ["run", "start", "--", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: FRONTEND_DIR,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[next] ${chunk}`));
  const url = `http://127.0.0.1:${port}`;
  await waitForHttp(url, 60_000);
  return {
    stop: async () => {
      child.kill("SIGTERM");
      await sleep(400);
      if (!child.killed) child.kill("SIGKILL");
    },
    url,
  };
}

async function inspectRoute(port, baseUrl, device, route) {
  const page = await createPage(port);
  const cdp = new CdpClient(page.webSocketDebuggerUrl);
  await cdp.ready;
  const url = `${baseUrl}${route}`;
  const hydrationErrors = [];
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    cdp.on("Runtime.consoleAPICalled", (params) => {
      const message = consoleMessageText(params);
      if (isHydrationMessage(message)) hydrationErrors.push(message);
    });
    cdp.on("Runtime.exceptionThrown", (params) => {
      const message = String(params?.exceptionDetails?.text ?? params?.exceptionDetails?.exception?.description ?? "");
      if (isHydrationMessage(message)) hydrationErrors.push(message);
    });
    await cdp.send("Network.setUserAgentOverride", { userAgent: device.userAgent });
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        try {
          window.localStorage.setItem("ma_risk_acknowledged_v1", "true");
          window.localStorage.setItem("ma_onboarding_completed", "true");
          window.localStorage.setItem("tradeveto_first_run_starter_hidden_v1", "true");
          window.localStorage.setItem("tradeveto_first_opportunity_review_hidden_v1", "true");
          window.sessionStorage.removeItem("ma_onboarding_replay_pending");
        } catch {}
      })();`,
    });
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: device.scale,
      height: device.height,
      mobile: true,
      width: device.width,
    });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await navigate(cdp, url);
    await acknowledgeRisk(cdp);
    await waitForSettledPage(cdp);

    const metrics = await evaluate(cdp, mobileMetricsExpression());
    assertRouteMetrics(device.label, route, metrics);
    await exerciseMoreMenu(cdp, device.label, route);
    if (route === "/symbol/AMD") await exerciseChartDetail(cdp, device.label, route);
    await exerciseStableOverlay(cdp, device.label, route);
    if (hydrationErrors.length) {
      failures.push(`${device.label} ${route}: hydration/runtime mismatch detected: ${hydrationErrors[0].slice(0, 240)}`);
    }

    const screenshot = await cdp.send("Page.captureScreenshot", { captureBeyondViewport: false, format: "png" });
    await writeFile(join(ARTIFACT_DIR, `${device.label}-${slugForRoute(route)}.png`), Buffer.from(screenshot.data, "base64"));
  } catch (error) {
    failures.push(`${device.label} ${route}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    cdp.close();
  }
}

function consoleMessageText(params) {
  const args = Array.isArray(params?.args) ? params.args : [];
  return args
    .map((arg) => String(arg.value ?? arg.description ?? arg.preview?.description ?? ""))
    .filter(Boolean)
    .join(" ");
}

function isHydrationMessage(message) {
  return /hydration|hydrate|server rendered|client properties|text content does not match|minified react error #418/i.test(message);
}

function assertRouteMetrics(device, route, metrics) {
  if (!metrics || typeof metrics !== "object") {
    failures.push(`${device} ${route}: metrics unavailable`);
    return;
  }
  if (metrics.horizontalOverflow > 2) failures.push(`${device} ${route}: horizontal overflow ${metrics.horizontalOverflow}px`);
  if (route !== "/" && metrics.bottomNavCount !== 1) failures.push(`${device} ${route}: expected one primary mobile nav, saw ${metrics.bottomNavCount}`);
  if (route !== "/" && metrics.bottomNavVisible !== true) failures.push(`${device} ${route}: bottom nav is not visible`);
  if (metrics.smallTapTargets > 0) failures.push(`${device} ${route}: ${metrics.smallTapTargets} bottom-nav tap targets below 44px`);
  if (metrics.modalOffscreen === true) failures.push(`${device} ${route}: visible dialog/sheet is clipped offscreen`);
  if (metrics.tinyChartLabels > 0) notes.push(`${device} ${route}: ${metrics.tinyChartLabels} chart labels are under 9px; verify on physical devices.`);
  if (typeof metrics.routeLoadMs === "number" && metrics.routeLoadMs > 6_500) notes.push(`${device} ${route}: route load reported ${metrics.routeLoadMs}ms; inspect production performance trace.`);
}

async function exerciseMoreMenu(cdp, device, route) {
  const result = await evaluate(
    cdp,
    `(async () => {
      const button = Array.from(document.querySelectorAll("button")).find((node) => /Open full navigation menu|Open navigation menu/i.test(node.getAttribute("aria-label") || ""));
      if (!button) return { skipped: true };
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const drawer = document.querySelector("#tradeveto-mobile-drawer");
      const nav = drawer?.querySelector("nav[aria-label='Mobile drawer navigation']");
      const labels = Array.from(nav?.querySelectorAll("a") || []).map((node) => node.textContent?.trim() || "");
      const rect = drawer?.getBoundingClientRect();
      const close = drawer?.querySelector("button[aria-label*='Close']");
      close?.click();
      return { labels, visible: Boolean(rect && rect.left >= 0 && rect.right <= window.innerWidth + 1) };
    })()`,
  );
  if (result?.skipped) return;
  if (!result?.visible) failures.push(`${device} ${route}: More menu opens offscreen`);
  const labels = Array.isArray(result?.labels) ? result.labels.join(" ") : "";
  for (const primary of ["Terminal", "Opportunities", "Watchlist", "Alerts", "Dashboard"]) {
    if (labels.includes(primary)) failures.push(`${device} ${route}: More menu duplicates primary nav item ${primary}`);
  }
  for (const expected of ["Performance", "History", "Paper Trading", "Strategy Labs", "Intelligence", "Copilot", "Install App", "Support", "Account"]) {
    if (!labels.includes(expected)) failures.push(`${device} ${route}: More menu missing ${expected}`);
  }
}

async function exerciseChartDetail(cdp, device, route) {
  const result = await evaluate(
    cdp,
    `(async () => {
      const button = Array.from(document.querySelectorAll("button")).find((node) => /Expand .*chart|Open .*chart|Full chart/i.test(node.getAttribute("aria-label") || node.textContent || ""));
      if (!button) return { skipped: true };
      const beforeY = window.scrollY;
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 260));
      const visualScrollY = () => {
        const lockedTop = Number.parseFloat(document.body.style.top || "0");
        return document.body.style.position === "fixed" && Number.isFinite(lockedTop) ? Math.abs(lockedTop) : window.scrollY;
      };
      const dialog = document.querySelector("[role='dialog']");
      const surface = document.querySelector("[data-stable-overlay-content='true']") || dialog;
      const close = dialog?.querySelector("button[aria-label*='Close']");
      const rect = surface?.getBoundingClientRect();
      const clipped = rect ? rect.left < -2 || rect.right > window.innerWidth + 2 || rect.top < -2 || rect.bottom > window.innerHeight + 2 : true;
      const openScrollDelta = Math.abs(visualScrollY() - beforeY);
      close?.click();
      await new Promise((resolve) => setTimeout(resolve, 220));
      return { clipped, opened: Boolean(dialog), scrollDelta: openScrollDelta, stillOpen: Boolean(document.querySelector("[role='dialog']")) };
    })()`,
  );
  if (result?.skipped) {
    notes.push(`${device} ${route}: no expandable chart control found for automated click; manual chart QA still required.`);
    return;
  }
  if (!result?.opened) failures.push(`${device} ${route}: chart detail did not open`);
  if (result?.clipped) failures.push(`${device} ${route}: chart detail was clipped`);
  if (result?.stillOpen) failures.push(`${device} ${route}: chart detail did not close`);
  if ((result?.scrollDelta ?? 0) > 8) failures.push(`${device} ${route}: chart detail changed scroll by ${result.scrollDelta}px`);
}

async function exerciseStableOverlay(cdp, device, route) {
  const result = await evaluate(
    cdp,
    `(async () => {
      const triggers = Array.from(document.querySelectorAll("[data-stable-overlay-trigger='true']")).filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return rect.width > 20 && rect.height > 20 && style.visibility !== "hidden" && style.display !== "none";
      });
      const trigger = triggers[0];
      if (!trigger) return { skipped: true };
      trigger.scrollIntoView({ block: "center", inline: "nearest" });
      await new Promise((resolve) => setTimeout(resolve, 120));
      const beforeY = window.scrollY;
      trigger.click();
      await new Promise((resolve) => setTimeout(resolve, 260));
      const visualScrollY = () => {
        const lockedTop = Number.parseFloat(document.body.style.top || "0");
        return document.body.style.position === "fixed" && Number.isFinite(lockedTop) ? Math.abs(lockedTop) : window.scrollY;
      };
      const overlay = document.querySelector("[data-stable-overlay='true']");
      const surface = document.querySelector("[data-stable-overlay-content='true']");
      const close = overlay?.querySelector("button[aria-label*='Close']");
      const surfaceRect = surface?.getBoundingClientRect();
      const closeRect = close?.getBoundingClientRect();
      const clipped = surfaceRect ? surfaceRect.left < -2 || surfaceRect.right > window.innerWidth + 2 || surfaceRect.top < -2 || surfaceRect.bottom > window.innerHeight + 2 : true;
      const closeVisible = closeRect ? closeRect.left >= -2 && closeRect.right <= window.innerWidth + 2 && closeRect.top >= -2 && closeRect.bottom <= window.innerHeight + 2 : false;
      const opened = Boolean(overlay && surface);
      const openScrollDelta = Math.abs(visualScrollY() - beforeY);
      close?.click();
      await new Promise((resolve) => setTimeout(resolve, 220));
      return {
        closeVisible,
        clipped,
        opened,
        openScrollDelta,
        stillOpen: Boolean(document.querySelector("[data-stable-overlay='true']")),
        closeScrollDelta: Math.abs(window.scrollY - beforeY),
      };
    })()`,
  );
  if (result?.skipped) {
    notes.push(`${device} ${route}: no stable overlay trigger found for automated interaction QA.`);
    return;
  }
  if (!result?.opened) failures.push(`${device} ${route}: stable overlay trigger did not open detail`);
  if (result?.clipped) failures.push(`${device} ${route}: stable overlay content clipped offscreen`);
  if (!result?.closeVisible) failures.push(`${device} ${route}: stable overlay close button not visible`);
  if (result?.stillOpen) failures.push(`${device} ${route}: stable overlay did not close`);
  if ((result?.openScrollDelta ?? 0) > 8) failures.push(`${device} ${route}: overlay open changed scroll by ${result.openScrollDelta}px`);
  if ((result?.closeScrollDelta ?? 0) > 8) failures.push(`${device} ${route}: overlay close changed scroll by ${result.closeScrollDelta}px`);
}

async function acknowledgeRisk(cdp) {
  await evaluate(
    cdp,
    `(() => {
      try {
        window.localStorage.setItem("ma_risk_acknowledged_v1", "true");
        window.localStorage.setItem("ma_onboarding_completed", "true");
        window.localStorage.setItem("tradeveto_first_run_starter_hidden_v1", "true");
        window.localStorage.setItem("tradeveto_first_opportunity_review_hidden_v1", "true");
        window.sessionStorage.removeItem("ma_onboarding_replay_pending");
        const checkbox = document.querySelector("input[type='checkbox']");
        if (checkbox && !checkbox.checked) checkbox.click();
        const button = Array.from(document.querySelectorAll("button")).find((node) => node.textContent?.trim() === "Continue");
        if (button && !button.disabled) button.click();
      } catch {}
      return true;
    })()`,
  );
}

function mobileMetricsExpression() {
  return `(() => {
    const root = document.documentElement;
    const body = document.body;
    const navigation = performance.getEntriesByType("navigation")[0];
    const scrollWidth = Math.max(root.scrollWidth, body?.scrollWidth || 0);
    const bottomNav = document.querySelector("nav[aria-label='Primary mobile navigation']");
    const bottomNavRect = bottomNav?.getBoundingClientRect();
    const navTargets = Array.from(bottomNav?.querySelectorAll("a,button") || []);
    const smallTapTargets = navTargets.filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width < 44 || rect.height < 44;
    }).length;
    const dialog = document.querySelector("[role='dialog']");
    const dialogRect = dialog?.getBoundingClientRect();
    const modalOffscreen = dialogRect ? dialogRect.left < -2 || dialogRect.right > window.innerWidth + 2 || dialogRect.top < -2 || dialogRect.bottom > window.innerHeight + 2 : false;
    const tinyChartLabels = Array.from(document.querySelectorAll("svg text, canvas + *")).filter((node) => {
      const style = window.getComputedStyle(node);
      const px = Number.parseFloat(style.fontSize || "0");
      return px > 0 && px < 9;
    }).length;
    return {
      bottomNavCount: document.querySelectorAll("nav[aria-label='Primary mobile navigation']").length,
      bottomNavVisible: !bottomNavRect || (bottomNavRect.top < window.innerHeight - 8 && bottomNavRect.bottom > 8),
      horizontalOverflow: scrollWidth - window.innerWidth,
      modalOffscreen,
      routeLoadMs: navigation ? Math.round(navigation.duration) : null,
      smallTapTargets,
      tinyChartLabels,
    };
  })()`;
}

async function navigate(cdp, url) {
  const loadPromise = cdp.waitForEvent("Page.loadEventFired", 45_000).catch(() => null);
  await cdp.send("Page.navigate", { url });
  await loadPromise;
}

async function waitForSettledPage(cdp) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = await evaluate(cdp, "document.readyState === 'complete' || document.readyState === 'interactive'");
    if (ready) break;
    await sleep(250);
  }
  await sleep(900);
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", { awaitPromise: true, expression, returnByValue: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result?.value;
}

class CdpClient {
  constructor(url) {
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => this.handleMessage(event));
  }

  handleMessage(event) {
    const payload = JSON.parse(String(event.data));
    if (payload.id) {
      const pending = this.pending.get(payload.id);
      if (!pending) return;
      this.pending.delete(payload.id);
      if (payload.error) pending.reject(new Error(payload.error.message));
      else pending.resolve(payload.result ?? {});
      return;
    }
    const listeners = this.listeners.get(payload.method);
    if (!listeners?.length) return;
    for (const listener of listeners) listener(payload.params ?? {});
  }

  send(method, params = {}) {
    const id = ++this.id;
    const message = JSON.stringify({ id, method, params });
    const promise = new Promise((resolve, reject) => this.pending.set(id, { reject, resolve }));
    this.socket.send(message);
    return promise;
  }

  waitForEvent(method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const listeners = this.listeners.get(method) ?? [];
        this.listeners.set(method, listeners.filter((listener) => listener !== onEvent));
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      const onEvent = (params) => {
        clearTimeout(timer);
        resolve(params);
      };
      const listeners = this.listeners.get(method) ?? [];
      listeners.push(onEvent);
      this.listeners.set(method, listeners);
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
    return () => {
      const current = this.listeners.get(method) ?? [];
      this.listeners.set(method, current.filter((item) => item !== listener));
    };
  }

  close() {
    this.socket.close();
  }
}

async function createPage(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  if (!response.ok) throw new Error(`Unable to create Chrome target: ${response.status}`);
  return response.json();
}

async function startChrome(chromePath) {
  const port = await pickPort();
  const userDataDir = await mkdtemp(join(tmpdir(), "tradeveto-mobile-ux-"));
  const child = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  child.stderr.on("data", (chunk) => {
    const message = String(chunk);
    if (!message.includes("DevTools listening")) process.stderr.write(`[chrome] ${message}`);
  });
  await waitForHttp(`http://127.0.0.1:${port}/json/version`, 30_000);
  return {
    port,
    stop: async () => {
      child.kill("SIGTERM");
      await waitForProcessExit(child, 1_500);
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await waitForProcessExit(child, 1_000);
      }
      await rm(userDataDir, { force: true, maxRetries: 3, recursive: true, retryDelay: 150 });
    },
  };
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

async function pickPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to allocate a local port"));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHttp(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // Keep polling.
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function slugForRoute(route) {
  return route.replace(/^\//, "home").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "home";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForProcessExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
