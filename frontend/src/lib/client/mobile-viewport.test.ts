import assert from "node:assert/strict";
import test from "node:test";

import { deriveMobileViewportMetrics, mobileViewportCssVars } from "./mobile-viewport";

test("deriveMobileViewportMetrics prefers visual viewport dimensions", () => {
  const metrics = deriveMobileViewportMetrics({
    innerHeight: 844,
    innerWidth: 390,
    viewportHeight: 701.4,
    viewportOffsetTop: 0,
    viewportWidth: 390,
  });

  assert.deepEqual(metrics, {
    height: 701.4,
    keyboardOffset: 142.60000000000002,
    width: 390,
  });
});

test("deriveMobileViewportMetrics accounts for Safari visual viewport offset", () => {
  const metrics = deriveMobileViewportMetrics({
    innerHeight: 852,
    innerWidth: 393,
    viewportHeight: 640,
    viewportOffsetTop: 42,
    viewportWidth: 393,
  });

  assert.deepEqual(metrics, {
    height: 640,
    keyboardOffset: 170,
    width: 393,
  });
});

test("deriveMobileViewportMetrics clamps oversized iOS visual viewport reports", () => {
  const metrics = deriveMobileViewportMetrics({
    innerHeight: 751,
    innerWidth: 390,
    viewportHeight: 844,
    viewportOffsetTop: 0,
    viewportWidth: 430,
  });

  assert.deepEqual(metrics, {
    height: 751,
    keyboardOffset: 0,
    width: 390,
  });
});

test("mobileViewportCssVars returns stable pixel strings", () => {
  assert.deepEqual(mobileViewportCssVars({ height: 701.4, keyboardOffset: 142.6, width: 389.8 }), {
    "--tv-keyboard-offset": "143px",
    "--tv-visual-viewport-height": "701px",
    "--tv-visual-viewport-width": "390px",
  });
});
