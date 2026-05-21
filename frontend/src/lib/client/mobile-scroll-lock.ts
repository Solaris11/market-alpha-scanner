"use client";

type BodyScrollLockSnapshot = {
  bodyLeft: string;
  bodyOverflow: string;
  bodyOverscroll: string;
  bodyPaddingRight: string;
  bodyPosition: string;
  bodyRight: string;
  bodyTop: string;
  bodyTouchAction: string;
  bodyWidth: string;
  htmlOverflow: string;
  htmlOverscroll: string;
  htmlTouchAction: string;
  scrollY: number;
};

export type MobileBodyScrollLockStyles = {
  body: {
    left: string;
    overflow: string;
    overscrollBehavior: string;
    paddingRight: string | null;
    position: string;
    right: string;
    top: string;
    width: string;
  };
  root: {
    overflow: string;
    overscrollBehavior: string;
  };
};

export function lockMobileBodyScroll(scrollY = getCurrentScrollY()): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => undefined;

  const body = document.body;
  const root = document.documentElement;
  const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth);
  const lockStyles = deriveMobileBodyScrollLockStyles(scrollY, scrollbarWidth);
  const snapshot: BodyScrollLockSnapshot = {
    bodyLeft: body.style.left,
    bodyOverflow: body.style.overflow,
    bodyOverscroll: body.style.overscrollBehavior,
    bodyPaddingRight: body.style.paddingRight,
    bodyPosition: body.style.position,
    bodyRight: body.style.right,
    bodyTop: body.style.top,
    bodyTouchAction: body.style.touchAction,
    bodyWidth: body.style.width,
    htmlOverflow: root.style.overflow,
    htmlOverscroll: root.style.overscrollBehavior,
    htmlTouchAction: root.style.touchAction,
    scrollY,
  };

  body.style.overflow = lockStyles.body.overflow;
  body.style.overscrollBehavior = lockStyles.body.overscrollBehavior;
  body.style.position = lockStyles.body.position;
  body.style.top = lockStyles.body.top;
  body.style.left = lockStyles.body.left;
  body.style.right = lockStyles.body.right;
  body.style.width = lockStyles.body.width;
  if (lockStyles.body.paddingRight !== null) body.style.paddingRight = lockStyles.body.paddingRight;
  root.style.overflow = lockStyles.root.overflow;
  root.style.overscrollBehavior = lockStyles.root.overscrollBehavior;

  return () => restoreMobileBodyScroll(snapshot);
}

export function deriveMobileBodyScrollLockStyles(scrollY: number, scrollbarWidth: number): MobileBodyScrollLockStyles {
  const safeScrollY = Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0;
  const safeScrollbarWidth = Number.isFinite(scrollbarWidth) ? Math.max(0, scrollbarWidth) : 0;
  return {
    body: {
      left: "0",
      overflow: "hidden",
      overscrollBehavior: "contain",
      paddingRight: safeScrollbarWidth > 0 ? `${safeScrollbarWidth}px` : null,
      position: "fixed",
      right: "0",
      top: `-${safeScrollY}px`,
      width: "100%",
    },
    root: {
      overflow: "hidden",
      overscrollBehavior: "contain",
    },
  };
}

function restoreMobileBodyScroll(snapshot: BodyScrollLockSnapshot): void {
  const body = document.body;
  const root = document.documentElement;
  body.style.position = snapshot.bodyPosition;
  body.style.top = snapshot.bodyTop;
  body.style.left = snapshot.bodyLeft;
  body.style.right = snapshot.bodyRight;
  body.style.width = snapshot.bodyWidth;
  body.style.overflow = snapshot.bodyOverflow;
  body.style.overscrollBehavior = snapshot.bodyOverscroll;
  body.style.touchAction = snapshot.bodyTouchAction;
  body.style.paddingRight = snapshot.bodyPaddingRight;
  root.style.overflow = snapshot.htmlOverflow;
  root.style.overscrollBehavior = snapshot.htmlOverscroll;
  root.style.touchAction = snapshot.htmlTouchAction;
  window.scrollTo(0, snapshot.scrollY);
  window.requestAnimationFrame(() => window.scrollTo(0, snapshot.scrollY));
  window.setTimeout(() => window.scrollTo(0, snapshot.scrollY), 80);
}

function getCurrentScrollY(): number {
  if (typeof window === "undefined") return 0;
  return window.scrollY;
}
