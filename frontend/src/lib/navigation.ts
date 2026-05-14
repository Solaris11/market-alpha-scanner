export type AppNavItem = {
  group: "account" | "execution" | "system" | "trading" | "utility";
  href: string;
  key: string;
  label: string;
};

export type AppNavSection = {
  items: AppNavItem[];
  label: string;
};

export type MobileRouteMode = {
  href: string;
  key: string;
  label: string;
  summary: string;
};

export const PRIMARY_NAV_ITEMS: AppNavItem[] = [
  { group: "trading", href: "/terminal", key: "terminal", label: "Terminal" },
  { group: "trading", href: "/opportunities", key: "opportunities", label: "Opportunities" },
  { group: "trading", href: "/terminal#mobile-watchlist", key: "watchlist", label: "Watchlist" },
  { group: "execution", href: "/alerts", key: "alerts", label: "Alerts" },
  { group: "system", href: "/dashboard", key: "dashboard", label: "Dashboard" },
];

export const EXECUTION_NAV_ITEMS: AppNavItem[] = [
  { group: "trading", href: "/performance", key: "performance", label: "Performance" },
  { group: "trading", href: "/history", key: "history", label: "History" },
  { group: "execution", href: "/paper", key: "paper", label: "Paper Trading" },
  { group: "system", href: "/strategy-labs", key: "strategy-labs", label: "Strategy Labs" },
];

export const UTILITY_NAV_ITEMS: AppNavItem[] = [
  { group: "system", href: "/intelligence", key: "intelligence", label: "Intelligence" },
  { group: "system", href: "/mobile", key: "mobile", label: "Mobile App Setup" },
  { group: "system", href: "/support", key: "support", label: "Support" },
];

export const ADMIN_UTILITY_NAV_ITEMS: AppNavItem[] = [
  { group: "system", href: "/team", key: "team", label: "Team" },
  { group: "system", href: "/community", key: "community", label: "Community" },
  { group: "system", href: "/developers", key: "developers", label: "Developers" },
  { group: "system", href: "/advanced", key: "advanced", label: "Advanced" },
];

export const ACCOUNT_NAV_ITEM: AppNavItem = { group: "account", href: "/account", key: "account", label: "Account" };
export const ADMIN_NAV_ITEM: AppNavItem = { group: "system", href: "/admin", key: "admin", label: "Admin" };

export const MOBILE_BOTTOM_NAV_ITEMS: AppNavItem[] = [
  { group: "trading", href: "/terminal", key: "terminal", label: "Terminal" },
  { group: "trading", href: "/opportunities", key: "opportunities", label: "Opportunities" },
  { group: "trading", href: "/terminal#mobile-watchlist", key: "watchlist", label: "Watchlist" },
  { group: "execution", href: "/alerts", key: "alerts", label: "Alerts" },
  { group: "system", href: "/dashboard", key: "dashboard", label: "Dashboard" },
];

export const MOBILE_MORE_NAV_ITEMS: AppNavItem[] = [
  { group: "trading", href: "/performance", key: "performance", label: "Performance" },
  { group: "trading", href: "/history", key: "history", label: "History" },
  { group: "execution", href: "/paper", key: "paper", label: "Paper Trading" },
  { group: "system", href: "/strategy-labs", key: "strategy-labs", label: "Strategy Labs" },
  { group: "system", href: "/intelligence", key: "intelligence", label: "Intelligence" },
  { group: "system", href: "/terminal#copilot", key: "copilot", label: "Copilot" },
  { group: "system", href: "/mobile", key: "mobile", label: "Install App" },
  { group: "system", href: "/support", key: "support", label: "Support" },
  ACCOUNT_NAV_ITEM,
];

export const MOBILE_MORE_NAV_LABEL = "More";

export function visibleUtilityNavItems(isAdmin: boolean): AppNavItem[] {
  return isAdmin ? [...UTILITY_NAV_ITEMS, ...ADMIN_UTILITY_NAV_ITEMS, ADMIN_NAV_ITEM] : UTILITY_NAV_ITEMS;
}

export function mobileMoreNavSections(isAdmin: boolean): AppNavSection[] {
  const sections: AppNavSection[] = [
    { label: "More Tools", items: MOBILE_MORE_NAV_ITEMS },
  ];
  if (isAdmin) sections.push({ label: "Admin", items: [...ADMIN_UTILITY_NAV_ITEMS, ADMIN_NAV_ITEM] });
  return sections;
}

export function drawerNavSections(isAdmin: boolean): AppNavSection[] {
  return [
    { label: "Primary", items: PRIMARY_NAV_ITEMS },
    { label: "Research", items: EXECUTION_NAV_ITEMS },
    { label: "More", items: visibleUtilityNavItems(isAdmin) },
  ];
}

export function allNavigationItems(isAdmin: boolean): AppNavItem[] {
  const items = [...PRIMARY_NAV_ITEMS, ...EXECUTION_NAV_ITEMS, ...UTILITY_NAV_ITEMS, ...ADMIN_UTILITY_NAV_ITEMS, ACCOUNT_NAV_ITEM];
  if (isAdmin) items.push(ADMIN_NAV_ITEM);
  return dedupeNavItems(items);
}

export function activeNavItem(pathname: string, isAdmin: boolean): AppNavItem {
  const items = allNavigationItems(isAdmin);
  const match = items
    .filter((item) => isActivePath(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match ?? PRIMARY_NAV_ITEMS[0];
}

export function activeSectionTitle(pathname: string, isAdmin: boolean): string {
  return activeNavItem(pathname, isAdmin).label;
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href.includes("#")) return false;
  const normalizedHref = href.split("#", 1)[0] || "/";
  if (href === "/") return pathname === "/";
  return pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);
}

export function mobileRouteModesForPath(pathname: string): MobileRouteMode[] {
  if (pathname.startsWith("/symbol/")) {
    return [
      { href: "#overview", key: "overview", label: "Overview", summary: "Identity and current state." },
      { href: "#chart", key: "chart", label: "Chart", summary: "Price context and overlays." },
      { href: "#intelligence", key: "intelligence", label: "Intel", summary: "Why the setup matters." },
      { href: "#risk", key: "risk", label: "Risk", summary: "Invalidation and pressure." },
    ];
  }
  const routeModes: Record<string, MobileRouteMode[]> = {
    "/alerts": [
      { href: "#alert-radar", key: "radar", label: "Radar", summary: "Active alert pressure." },
      { href: "#alert-rules", key: "rules", label: "Rules", summary: "Saved monitoring rules." },
      { href: "#alert-history", key: "history", label: "History", summary: "Recent triggers." },
    ],
    "/dashboard": [
      { href: "#overview", key: "overview", label: "Overview", summary: "Workspace status." },
      { href: "#activity", key: "activity", label: "Activity", summary: "Recent actions." },
      { href: "#workspace", key: "workspace", label: "Workspace", summary: "Personalized modules." },
    ],
    "/history": [
      { href: "#timeline", key: "timeline", label: "Timeline", summary: "What changed over time." },
      { href: "#chart", key: "chart", label: "Chart", summary: "Score movement." },
      { href: "#table", key: "table", label: "Table", summary: "Detailed saved scans." },
    ],
    "/mobile": [
      { href: "#install", key: "install", label: "Install", summary: "Add TradeVeto to phone." },
      { href: "#alerts", key: "alerts", label: "Alerts", summary: "Mobile notification setup." },
      { href: "#setup", key: "setup", label: "Setup", summary: "iPhone and Android steps." },
    ],
    "/opportunities": [
      { href: "#cards", key: "cards", label: "Cards", summary: "Scan current setups." },
      { href: "#map", key: "map", label: "Map", summary: "Visual opportunity view." },
      { href: "#watchlist", key: "watchlist", label: "Watch", summary: "Tracked candidates." },
      { href: "#details", key: "details", label: "Details", summary: "Deeper breakdowns." },
    ],
    "/paper": [
      { href: "#guide", key: "guide", label: "Guide", summary: "How paper mode works." },
      { href: "#positions", key: "positions", label: "Positions", summary: "Open and closed tests." },
      { href: "#simulator", key: "simulator", label: "Simulator", summary: "Practice setup planning." },
    ],
    "/performance": [
      { href: "#summary", key: "summary", label: "Summary", summary: "Recent signal behavior." },
      { href: "#evidence", key: "evidence", label: "Evidence", summary: "Reliability and coverage." },
      { href: "#history", key: "history", label: "History", summary: "Past scanner outcomes." },
    ],
    "/strategy-labs": [
      { href: "#guide", key: "guide", label: "Guide", summary: "Simulation basics." },
      { href: "#strategies", key: "strategies", label: "Strategies", summary: "Research families." },
      { href: "#results", key: "results", label: "Results", summary: "Replay-backed outcomes." },
    ],
  };
  return routeModes[pathname] ?? [];
}

function dedupeNavItems(items: AppNavItem[]): AppNavItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}
