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
  if (shouldUseNonFixedScrollLock()) {
    const preventBackgroundTouchMove = (event: TouchEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-stable-overlay-content='true']")) return;
      event.preventDefault();
    };
    body.style.touchAction = "none";
    root.style.overflow = lockStyles.root.overflow;
    root.style.overscrollBehavior = lockStyles.root.overscrollBehavior;
    root.style.touchAction = "none";
    document.addEventListener("touchmove", preventBackgroundTouchMove, { passive: false });
    return () => {
      document.removeEventListener("touchmove", preventBackgroundTouchMove);
      restoreMobileBodyScroll(snapshot);
    };
  }

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
  const targetScrollY = Number.isFinite(snapshot.scrollY) ? Math.max(0, snapshot.scrollY) : 0;
  const previousRootScrollBehavior = root.style.scrollBehavior;
  const previousBodyScrollBehavior = body.style.scrollBehavior;

  root.style.scrollBehavior = "auto";
  body.style.scrollBehavior = "auto";
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
  forceScrollY(targetScrollY);
  window.requestAnimationFrame(() => forceScrollY(targetScrollY));
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => forceScrollY(targetScrollY));
  });
  window.setTimeout(() => forceScrollY(targetScrollY), 40);
  window.setTimeout(() => forceScrollY(targetScrollY), 120);
  window.setTimeout(() => {
    forceScrollY(targetScrollY);
    root.style.scrollBehavior = previousRootScrollBehavior;
    body.style.scrollBehavior = previousBodyScrollBehavior;
  }, 220);
}

function getCurrentScrollY(): number {
  if (typeof window === "undefined") return 0;
  return window.scrollY;
}

function shouldUseNonFixedScrollLock(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iP(?:ad|hone|od)/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function forceScrollY(scrollY: number): void {
  window.scrollTo({ behavior: "auto", left: 0, top: scrollY });
  document.documentElement.scrollTop = scrollY;
  document.body.scrollTop = scrollY;
}
