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

export const PRIMARY_NAV_ITEMS: AppNavItem[] = [
  { group: "trading", href: "/terminal", key: "terminal", label: "Terminal" },
  { group: "trading", href: "/opportunities", key: "opportunities", label: "Opportunities" },
  { group: "trading", href: "/performance", key: "performance", label: "Performance" },
  { group: "trading", href: "/history", key: "history", label: "History" },
  { group: "execution", href: "/alerts", key: "alerts", label: "Alerts" },
];

export const EXECUTION_NAV_ITEMS: AppNavItem[] = [
  { group: "execution", href: "/alerts", key: "alerts", label: "Alerts" },
  { group: "execution", href: "/paper", key: "paper", label: "Paper" },
];

export const UTILITY_NAV_ITEMS: AppNavItem[] = [
  { group: "system", href: "/support", key: "support", label: "Support" },
  { group: "system", href: "/advanced", key: "advanced", label: "Advanced" },
];

export const ACCOUNT_NAV_ITEM: AppNavItem = { group: "account", href: "/account", key: "account", label: "Account" };
export const ADMIN_NAV_ITEM: AppNavItem = { group: "system", href: "/admin", key: "admin", label: "Admin" };

export const MOBILE_BOTTOM_NAV_ITEMS: AppNavItem[] = [
  { group: "trading", href: "/terminal", key: "terminal", label: "Terminal" },
  { group: "trading", href: "/opportunities", key: "opportunities", label: "Opportunities" },
  { group: "execution", href: "/alerts", key: "alerts", label: "Alerts" },
  ACCOUNT_NAV_ITEM,
];

export function visibleUtilityNavItems(isAdmin: boolean): AppNavItem[] {
  return isAdmin ? [...UTILITY_NAV_ITEMS, ADMIN_NAV_ITEM] : UTILITY_NAV_ITEMS;
}

export function drawerNavSections(isAdmin: boolean): AppNavSection[] {
  return [
    { label: "Trading", items: PRIMARY_NAV_ITEMS.filter((item) => item.key !== "alerts") },
    { label: "Execution", items: EXECUTION_NAV_ITEMS },
    { label: "System", items: visibleUtilityNavItems(isAdmin) },
  ];
}

export function allNavigationItems(isAdmin: boolean): AppNavItem[] {
  const items = [...PRIMARY_NAV_ITEMS, ...EXECUTION_NAV_ITEMS, ...UTILITY_NAV_ITEMS, ACCOUNT_NAV_ITEM];
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
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function dedupeNavItems(items: AppNavItem[]): AppNavItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}
