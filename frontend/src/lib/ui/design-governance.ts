export type GovernanceTone = "neutral" | "constructive" | "caution" | "dangerous" | "intelligence";

export type GovernanceMotionToken = {
  cssVar: string;
  description: string;
  ms: number;
};

export type GovernanceZIndexToken = {
  description: string;
  value: number;
};

export type GovernanceComponentContract = {
  className: string;
  purpose: string;
  requirements: string[];
};

export const DESIGN_GOVERNANCE_TOKENS = {
  borderOpacity: {
    default: "rgba(255,255,255,0.10)",
    emphasis: "rgba(103,232,249,0.22)",
    strong: "rgba(103,232,249,0.32)",
  },
  radius: {
    chip: "999px",
    control: "0.9rem",
    panel: "1.25rem",
    shell: "1.75rem",
  },
  spacing: {
    controlX: "0.875rem",
    controlY: "0.625rem",
    pageXMobile: "0.75rem",
    pageXTablet: "1rem",
    panel: "1rem",
    section: "1.25rem",
  },
  typography: {
    microTracking: "0.18em",
    tacticalTracking: "0.24em",
  },
} as const;

export const MOTION_GOVERNANCE: Record<"instant" | "fast" | "standard" | "slow", GovernanceMotionToken> = {
  fast: {
    cssVar: "--tv-motion-fast",
    description: "Tap, hover, and focus response timing.",
    ms: 150,
  },
  instant: {
    cssVar: "--tv-motion-instant",
    description: "Micro feedback for keyboard focus and selected states.",
    ms: 90,
  },
  slow: {
    cssVar: "--tv-motion-slow",
    description: "Page-level cinematic reveal timing.",
    ms: 520,
  },
  standard: {
    cssVar: "--tv-motion-medium",
    description: "Overlay, drawer, panel, and chart transition timing.",
    ms: 260,
  },
};

export const Z_INDEX_GOVERNANCE: Record<"navigation" | "feedback" | "overlay" | "criticalOverlay", GovernanceZIndexToken> = {
  criticalOverlay: {
    description: "Reserved for onboarding, critical system overlays, and emergency blockers.",
    value: 11_000,
  },
  feedback: {
    description: "Beta feedback widget and passive diagnostics.",
    value: 8_200,
  },
  navigation: {
    description: "Sticky product navigation and bottom navigation.",
    value: 7_000,
  },
  overlay: {
    description: "Unified detail overlays, drawers, fullscreen command surfaces, and bottom sheets.",
    value: 10_500,
  },
};

export const COMPONENT_GOVERNANCE: Record<"panel" | "chart" | "overlay" | "button" | "scannerRow" | "bottomSheet", GovernanceComponentContract> = {
  bottomSheet: {
    className: "tv-governed-bottom-sheet",
    purpose: "Mobile detail surfaces with safe-area, scroll-lock, and drag affordance consistency.",
    requirements: ["uses stable scroll lock", "shows fixed close affordance", "preserves scroll position", "respects visual viewport"],
  },
  button: {
    className: "tv-governed-action",
    purpose: "Canonical hover, tap, focus, disabled, and keyboard behavior for controls.",
    requirements: ["has focus-visible styling", "uses 44px minimum touch target", "does not rely on color alone"],
  },
  chart: {
    className: "tv-governed-chart",
    purpose: "Consistent chart containers, loading states, and bounded rendering surfaces.",
    requirements: ["has aria label", "has stable height", "uses governed border/radius/background", "avoids layout shifts while loading"],
  },
  overlay: {
    className: "tv-governed-overlay-surface",
    purpose: "Canonical desktop modal, side detail, fullscreen, and mobile sheet surface styling.",
    requirements: ["uses governed z-index", "supports escape close", "preserves scroll position", "uses reduced-motion fallback"],
  },
  panel: {
    className: "tv-governed-panel",
    purpose: "Base cinematic intelligence panel with consistent radius, border, depth, and motion.",
    requirements: ["uses governed radius", "uses governed border opacity", "uses standard hover lift only on fine pointers"],
  },
  scannerRow: {
    className: "tv-governed-scanner-row",
    purpose: "Dense scanner/discovery rows with consistent selected, hover, keyboard, and touch behavior.",
    requirements: ["supports keyboard selection", "keeps minimum touch target", "does not shift layout on hover"],
  },
};

export function governanceClassFor(component: keyof typeof COMPONENT_GOVERNANCE): string {
  return COMPONENT_GOVERNANCE[component].className;
}

export function governedToneClass(tone: GovernanceTone): string {
  if (tone === "constructive") return "tv-governance-tone-constructive";
  if (tone === "caution") return "tv-governance-tone-caution";
  if (tone === "dangerous") return "tv-governance-tone-dangerous";
  if (tone === "intelligence") return "tv-governance-tone-intelligence";
  return "tv-governance-tone-neutral";
}

export function designGovernanceChecklist(): string[] {
  return [
    "Use root design tokens for radius, spacing, border opacity, shadow depth, z-index, and motion.",
    "Use StableDetailOverlay or tv-governed-overlay-surface for all detail layers.",
    "Use tv-governed-chart for chart containers with stable dimensions and aria labels.",
    "Use tv-governed-action or tv-governed-icon-button for clickable controls.",
    "Use tv-governed-scanner-row for dense discovery lists.",
    "Respect prefers-reduced-motion and avoid always-on motion for non-material changes.",
    "Preserve scroll position and focus context when opening or closing overlays.",
  ];
}
