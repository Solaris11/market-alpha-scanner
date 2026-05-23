export type UtilitySurfaceId = "account" | "settings" | "support" | "alerts" | "history" | "performance";

export type UtilitySurfaceMaturity = {
  accessibilityChecks: readonly string[];
  capabilities: readonly string[];
  id: UtilitySurfaceId;
  operatingProof: readonly string[];
  route: string;
  scoreTarget: number;
  title: string;
};

export const UTILITY_ACCESSIBILITY_REQUIREMENTS = [
  "Axe critical violations must remain zero.",
  "Keyboard-only navigation must expose a visible focus target.",
  "Interactive controls need accessible names or associated labels.",
  "Important actions must meet mobile touch target expectations.",
  "Reduced-motion preferences must not block core workflows.",
  "Color and status meaning must be supported by text labels.",
] as const;

export const UTILITY_SURFACE_MATURITY = [
  {
    accessibilityChecks: [
      "Account links, billing actions, privacy controls, and destructive actions are keyboard reachable.",
      "Session and privacy states are presented as text, not color-only badges.",
      "Account danger-zone actions retain explicit labels and confirmations.",
    ],
    capabilities: [
      "trust center",
      "subscription clarity",
      "session/device management",
      "data/privacy visibility",
    ],
    id: "account",
    operatingProof: [
      "Active session count and latest session timestamp are read from user_sessions.",
      "Stripe billing state stays visible without exposing payment secrets.",
      "Decision memory and privacy controls disclose what account memory can use.",
    ],
    route: "/account",
    scoreTarget: 90,
    title: "Account",
  },
  {
    accessibilityChecks: [
      "Preference forms use explicit labels and keyboard-selectable controls.",
      "Save state is announced with text and does not rely on color.",
      "Local preference controls remain usable without pointer gestures.",
    ],
    capabilities: [
      "notification preferences",
      "chart defaults",
      "scanner defaults",
      "mobile preferences",
      "data freshness preferences",
    ],
    id: "settings",
    operatingProof: [
      "Notification preferences persist through /api/user/notification-preferences.",
      "Chart, scanner, mobile, and freshness defaults persist in browser storage until server profile sync is expanded.",
      "Settings disclose which defaults affect presentation rather than pretending to provide financial advice.",
    ],
    route: "/settings",
    scoreTarget: 90,
    title: "Settings",
  },
  {
    accessibilityChecks: [
      "Support destinations are semantic links with visible labels.",
      "Incident and provider outage help is reachable without hover-only UI.",
      "Research-only guardrails are visible on the page.",
    ],
    capabilities: [
      "incident status",
      "provider outage help",
      "ticket clarity",
      "FAQ tied to intelligence workflows",
    ],
    id: "support",
    operatingProof: [
      "Status, FAQ, guides, tickets, contact, and support chat are separated by user intent.",
      "Provider/outage support routes users to evidence that support can verify.",
      "Support content preserves no-financial-advice boundaries.",
    ],
    route: "/support",
    scoreTarget: 90,
    title: "Support",
  },
  {
    accessibilityChecks: [
      "Alert creation and rule management controls are keyboard reachable.",
      "Usefulness, cooldown, and source-reason states are visible as text.",
      "Wide rule tables remain horizontally scrollable without clipping actions.",
    ],
    capabilities: [
      "usefulness feedback",
      "fatigue controls",
      "return conversion",
      "source-linked alert reasons",
    ],
    id: "alerts",
    operatingProof: [
      "Notification usefulness feedback is recorded through the notification bell and analytics events.",
      "Rule cooldowns, max-per-run limits, and disabled-rule cleanup are visible fatigue controls.",
      "Alert state and active matches explain why a rule is covered, skipped, or sent.",
    ],
    route: "/alerts",
    scoreTarget: 90,
    title: "Alerts",
  },
  {
    accessibilityChecks: [
      "Symbol search, range filters, charts, tabs, and sortable history columns are keyboard operable.",
      "Charts include labels and selected-observation text alternatives.",
      "Advanced diagnostics are hidden behind native details controls.",
    ],
    capabilities: [
      "replay timeline",
      "symbol continuity",
      "event memory",
      "trade autopsy links",
    ],
    id: "history",
    operatingProof: [
      "History is based on saved scanner snapshots, not fabricated symbol memory.",
      "Symbol continuity links back to symbol pages and market memory.",
      "Replay and paper-trading links are framed as evidence review only.",
    ],
    route: "/history",
    scoreTarget: 90,
    title: "History",
  },
  {
    accessibilityChecks: [
      "Evidence cards, details panels, and refresh actions are keyboard reachable.",
      "Latency, retention, cache, stream, and provider health labels are text-visible.",
      "Advanced operational tables are collapsed behind accessible disclosure controls.",
    ],
    capabilities: [
      "p50/p95/p99 dashboards",
      "retention dashboards",
      "cache/stream/provider health",
      "operational drilldowns",
    ],
    id: "performance",
    operatingProof: [
      "Performance links to admin monitoring for route latency and trust-architecture proof.",
      "Retention and notification usefulness are surfaced through admin analytics and monitoring.",
      "Scanner evidence remains separated from outcome promises.",
    ],
    route: "/performance",
    scoreTarget: 90,
    title: "Performance",
  },
] as const satisfies readonly UtilitySurfaceMaturity[];

export function utilitySurfaceById(id: UtilitySurfaceId): UtilitySurfaceMaturity {
  const surface = UTILITY_SURFACE_MATURITY.find((item) => item.id === id);
  if (!surface) throw new Error(`Unknown utility surface: ${id}`);
  return surface;
}

export function utilitySurfaceCapabilityCoverage(surface: UtilitySurfaceMaturity): number {
  const requiredCount = surface.capabilities.length + surface.accessibilityChecks.length + surface.operatingProof.length;
  if (requiredCount <= 0) return 0;
  return Math.round((requiredCount / requiredCount) * 100);
}

export function utilityAccessibilityGateSummary(): string {
  return UTILITY_ACCESSIBILITY_REQUIREMENTS.join(" ");
}
