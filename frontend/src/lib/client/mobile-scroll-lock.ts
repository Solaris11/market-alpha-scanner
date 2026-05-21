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

export function lockMobileBodyScroll(scrollY = getCurrentScrollY()): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => undefined;

  const body = document.body;
  const root = document.documentElement;
  const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth);
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

  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "contain";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
  root.style.overflow = "hidden";
  root.style.overscrollBehavior = "contain";

  return () => restoreMobileBodyScroll(snapshot);
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
}

function getCurrentScrollY(): number {
  if (typeof window === "undefined") return 0;
  return window.scrollY;
}
