import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  MOBILE_BOTTOM_NAV_ITEMS,
  MOBILE_MORE_NAV_LABEL,
  MOBILE_MORE_NAV_ITEMS,
  PRIMARY_NAV_ITEMS,
  activeSectionTitle,
  allNavigationItems,
  drawerNavSections,
  isActivePath,
  mobileMoreNavSections,
  mobileRouteModesForPath,
  visibleUtilityNavItems,
} from "./navigation";

describe("application navigation hierarchy", () => {
  test("keeps the desktop primary nav focused on core workflows", () => {
    assert.deepEqual(
      PRIMARY_NAV_ITEMS.map((item) => item.label),
      ["Terminal", "Discover", "Opportunities", "Watchlist", "Alerts", "Dashboard"],
    );
  });

  test("keeps low-frequency admin and utility routes out of the primary nav", () => {
    assert.deepEqual(
      visibleUtilityNavItems(false).map((item) => item.label),
      ["Intelligence", "Mobile App Setup", "Support"],
    );
    assert.deepEqual(
      visibleUtilityNavItems(true).map((item) => item.label),
      ["Intelligence", "Mobile App Setup", "Support", "Team", "Community", "Developers", "Advanced", "Admin"],
    );
  });

  test("groups mobile drawer items by workflow", () => {
    const sections = drawerNavSections(true);
    assert.deepEqual(
      sections.map((section) => section.label),
      ["Primary", "Research", "More"],
    );
    assert.deepEqual(
      sections[0]?.items.map((item) => item.label),
      ["Terminal", "Discover", "Opportunities", "Watchlist", "Alerts", "Dashboard"],
    );
    assert.deepEqual(
      sections[1]?.items.map((item) => item.label),
      ["Performance", "History", "Paper Trading", "Strategy Labs"],
    );
    assert.deepEqual(
      sections[2]?.items.map((item) => item.label),
      ["Intelligence", "Mobile App Setup", "Support", "Team", "Community", "Developers", "Advanced", "Admin"],
    );
  });

  test("keeps mobile bottom navigation thumb-friendly and limited", () => {
    assert.deepEqual(
      MOBILE_BOTTOM_NAV_ITEMS.map((item) => item.label),
      ["Terminal", "Discover", "Opportunities", "Watchlist", "Alerts", "Dashboard"],
    );
    assert.deepEqual(
      MOBILE_MORE_NAV_ITEMS.map((item) => item.label),
      ["Performance", "History", "Paper Trading", "Strategy Labs", "Intelligence", "Copilot", "Install App", "Support", "Account"],
    );
    assert.equal(MOBILE_MORE_NAV_LABEL, "More");
  });

  test("keeps all major product sections reachable through the mobile drawer", () => {
    const sections = mobileMoreNavSections(false);
    const labels = sections.flatMap((section) => section.items.map((item) => item.label));
    assert.deepEqual(labels, ["Performance", "History", "Paper Trading", "Strategy Labs", "Intelligence", "Copilot", "Install App", "Support", "Account"]);
    assert.equal(labels.includes("Admin"), false);
  });

  test("shows admin in the mobile drawer only for admin users", () => {
    const nonAdminLabels = mobileMoreNavSections(false).flatMap((section) => section.items.map((item) => item.label));
    const adminLabels = mobileMoreNavSections(true).flatMap((section) => section.items.map((item) => item.label));
    assert.equal(nonAdminLabels.includes("Admin"), false);
    assert.equal(adminLabels.includes("Admin"), true);
    assert.equal(nonAdminLabels.includes("Developers"), false);
    assert.equal(adminLabels.includes("Developers"), true);
  });

  test("resolves active titles and nested paths consistently", () => {
    assert.equal(activeSectionTitle("/admin/monitoring", true), "Admin");
    assert.equal(activeSectionTitle("/dashboard", false), "Dashboard");
    assert.equal(activeSectionTitle("/team", false), "Team");
    assert.equal(activeSectionTitle("/community", false), "Community");
    assert.equal(activeSectionTitle("/developers", false), "Developers");
    assert.equal(activeSectionTitle("/discover", false), "Discover");
    assert.equal(activeSectionTitle("/mobile", false), "Mobile App Setup");
    assert.equal(activeSectionTitle("/strategy-labs", false), "Strategy Labs");
    assert.equal(activeSectionTitle("/paper", false), "Paper Trading");
    assert.equal(activeSectionTitle("/history/symbol/NVDA", false), "History");
    assert.equal(isActivePath("/history/symbol/NVDA", "/history"), true);
    assert.equal(isActivePath("/terminal", "/terminal#mobile-watchlist"), false);
    assert.equal(isActivePath("/opportunities", "/terminal"), false);
  });

  test("defines mobile view modes for dense workflows without replacing primary nav", () => {
    assert.deepEqual(
      mobileRouteModesForPath("/symbol/AMD").map((mode) => mode.label),
      ["Overview", "Chart", "Intel", "Risk"],
    );
    assert.deepEqual(
      mobileRouteModesForPath("/performance").map((mode) => mode.label),
      ["Summary", "Evidence", "History"],
    );
    assert.deepEqual(
      mobileRouteModesForPath("/discover").map((mode) => mode.label),
      ["Search", "Filters", "Compare"],
    );
    assert.deepEqual(mobileRouteModesForPath("/terminal"), []);
  });

  test("deduplicates repeated routes across drawer and primary nav sources", () => {
    const hrefs = allNavigationItems(true).map((item) => item.href);
    assert.equal(new Set(hrefs).size, hrefs.length);
  });
});
