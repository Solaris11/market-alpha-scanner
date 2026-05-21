import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveMobileBodyScrollLockStyles } from "./mobile-scroll-lock";

test("mobile body scroll lock preserves visual scroll position with fixed body offset", () => {
  assert.deepEqual(deriveMobileBodyScrollLockStyles(1722, 15), {
    body: {
      left: "0",
      overflow: "hidden",
      overscrollBehavior: "contain",
      paddingRight: "15px",
      position: "fixed",
      right: "0",
      top: "-1722px",
      width: "100%",
    },
    root: {
      overflow: "hidden",
      overscrollBehavior: "contain",
    },
  });
});

test("mobile body scroll lock sanitizes invalid offsets without adding phantom padding", () => {
  assert.deepEqual(deriveMobileBodyScrollLockStyles(Number.NaN, -4), {
    body: {
      left: "0",
      overflow: "hidden",
      overscrollBehavior: "contain",
      paddingRight: null,
      position: "fixed",
      right: "0",
      top: "-0px",
      width: "100%",
    },
    root: {
      overflow: "hidden",
      overscrollBehavior: "contain",
    },
  });
});
