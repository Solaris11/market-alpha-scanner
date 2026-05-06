import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  MOBILE_BOTTOM_NAV_ITEMS,
  MOBILE_MORE_NAV_LABEL,
  PRIMARY_NAV_ITEMS,
  activeSectionTitle,
  allNavigationItems,
  drawerNavSections,
  isActivePath,
  visibleUtilityNavItems,
} from "./navigation";

describe("application navigation hierarchy", () => {
  test("keeps the desktop primary nav focused on core workflows", () => {
    assert.deepEqual(
      PRIMARY_NAV_ITEMS.map((item) => item.label),
      ["Terminal", "Opportunities", "Performance", "History", "Alerts"],
    );
  });

  test("keeps low-frequency admin and utility routes out of the primary nav", () => {
    assert.deepEqual(
      visibleUtilityNavItems(false).map((item) => item.label),
      ["Support", "Advanced"],
    );
    assert.deepEqual(
      visibleUtilityNavItems(true).map((item) => item.label),
      ["Support", "Advanced", "Admin"],
    );
  });

  test("groups mobile drawer items by workflow", () => {
    const sections = drawerNavSections(true);
    assert.deepEqual(
      sections.map((section) => section.label),
      ["Trading", "Execution", "System"],
    );
    assert.deepEqual(
      sections[0]?.items.map((item) => item.label),
      ["Terminal", "Opportunities", "Performance", "History"],
    );
    assert.deepEqual(
      sections[1]?.items.map((item) => item.label),
      ["Alerts", "Paper"],
    );
    assert.deepEqual(
      sections[2]?.items.map((item) => item.label),
      ["Support", "Advanced", "Admin"],
    );
  });

  test("keeps mobile bottom navigation thumb-friendly and limited", () => {
    assert.deepEqual(
      MOBILE_BOTTOM_NAV_ITEMS.map((item) => item.label),
      ["Terminal", "Opportunities", "Alerts", "Account"],
    );
    assert.equal(MOBILE_MORE_NAV_LABEL, "More");
  });

  test("keeps all major product sections reachable through the mobile drawer", () => {
    const sections = drawerNavSections(false);
    const labels = sections.flatMap((section) => section.items.map((item) => item.label));
    assert.deepEqual(labels, ["Terminal", "Opportunities", "Performance", "History", "Alerts", "Paper", "Support", "Advanced"]);
    assert.equal(labels.includes("Admin"), false);
  });

  test("shows admin in the mobile drawer only for admin users", () => {
    const nonAdminLabels = drawerNavSections(false).flatMap((section) => section.items.map((item) => item.label));
    const adminLabels = drawerNavSections(true).flatMap((section) => section.items.map((item) => item.label));
    assert.equal(nonAdminLabels.includes("Admin"), false);
    assert.equal(adminLabels.includes("Admin"), true);
  });

  test("resolves active titles and nested paths consistently", () => {
    assert.equal(activeSectionTitle("/admin/monitoring", true), "Admin");
    assert.equal(activeSectionTitle("/paper", false), "Paper");
    assert.equal(activeSectionTitle("/history/symbol/NVDA", false), "History");
    assert.equal(isActivePath("/history/symbol/NVDA", "/history"), true);
    assert.equal(isActivePath("/opportunities", "/terminal"), false);
  });

  test("deduplicates repeated routes across drawer and primary nav sources", () => {
    const hrefs = allNavigationItems(true).map((item) => item.href);
    assert.equal(new Set(hrefs).size, hrefs.length);
  });
});
