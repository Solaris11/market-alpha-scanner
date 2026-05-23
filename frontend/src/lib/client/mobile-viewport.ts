"use client";

export type MobileViewportInput = {
  innerHeight: number;
  innerWidth: number;
  viewportHeight?: number | null;
  viewportOffsetTop?: number | null;
  viewportWidth?: number | null;
};

export type MobileViewportMetrics = {
  height: number;
  keyboardOffset: number;
  width: number;
};

export function deriveMobileViewportMetrics(input: MobileViewportInput): MobileViewportMetrics {
  const innerHeight = sanitizePositiveNumber(input.innerHeight);
  const innerWidth = sanitizePositiveNumber(input.innerWidth);
  const rawViewportHeight = sanitizePositiveNumber(input.viewportHeight) ?? innerHeight ?? 0;
  const rawViewportWidth = sanitizePositiveNumber(input.viewportWidth) ?? innerWidth ?? 0;
  const viewportHeight = innerHeight === null ? rawViewportHeight : Math.min(rawViewportHeight, innerHeight);
  const viewportWidth = innerWidth === null ? rawViewportWidth : Math.min(rawViewportWidth, innerWidth);
  const layoutHeight = innerHeight ?? viewportHeight;
  const viewportOffsetTop = Math.max(0, sanitizePositiveNumber(input.viewportOffsetTop) ?? 0);
  const keyboardOffset = Math.max(0, layoutHeight - viewportHeight - viewportOffsetTop);

  return {
    height: viewportHeight,
    keyboardOffset,
    width: viewportWidth,
  };
}

export function mobileViewportCssVars(metrics: MobileViewportMetrics): Record<string, string> {
  return {
    "--tv-keyboard-offset": `${Math.round(metrics.keyboardOffset)}px`,
    "--tv-visual-viewport-height": `${Math.round(metrics.height)}px`,
    "--tv-visual-viewport-width": `${Math.round(metrics.width)}px`,
  };
}

export function installMobileViewportCssVars(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => undefined;

  const root = document.documentElement;
  const previousHeight = root.style.getPropertyValue("--tv-visual-viewport-height");
  const previousKeyboardOffset = root.style.getPropertyValue("--tv-keyboard-offset");
  const previousWidth = root.style.getPropertyValue("--tv-visual-viewport-width");
  let frame: number | null = null;

  const update = (): void => {
    frame = null;
    const visualViewport = window.visualViewport;
    const vars = mobileViewportCssVars(deriveMobileViewportMetrics({
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      viewportHeight: visualViewport?.height,
      viewportOffsetTop: visualViewport?.offsetTop,
      viewportWidth: visualViewport?.width,
    }));
    root.style.setProperty("--tv-visual-viewport-height", vars["--tv-visual-viewport-height"]);
    root.style.setProperty("--tv-visual-viewport-width", vars["--tv-visual-viewport-width"]);
    root.style.setProperty("--tv-keyboard-offset", vars["--tv-keyboard-offset"]);
  };

  const scheduleUpdate = (): void => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(update);
  };

  update();
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  window.addEventListener("orientationchange", scheduleUpdate, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleUpdate, { passive: true });
  window.visualViewport?.addEventListener("scroll", scheduleUpdate, { passive: true });

  return () => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    window.removeEventListener("resize", scheduleUpdate);
    window.removeEventListener("orientationchange", scheduleUpdate);
    window.visualViewport?.removeEventListener("resize", scheduleUpdate);
    window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
    restoreCssVar(root, "--tv-visual-viewport-height", previousHeight);
    restoreCssVar(root, "--tv-visual-viewport-width", previousWidth);
    restoreCssVar(root, "--tv-keyboard-offset", previousKeyboardOffset);
  };
}

function restoreCssVar(root: HTMLElement, name: string, previous: string): void {
  if (previous) {
    root.style.setProperty(name, previous);
  } else {
    root.style.removeProperty(name);
  }
}

function sanitizePositiveNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}
