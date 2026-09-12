import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyDeepHealthSeverity } from "./deep-health-severity";

const ok = { db: { status: "ok" }, scanner: { status: "ok" }, backup: { status: "ok" } };

test("all ok -> ok", () => {
  assert.equal(classifyDeepHealthSeverity(ok).status, "ok");
});

test("db not ok -> fail", () => {
  assert.equal(classifyDeepHealthSeverity({ ...ok, db: { status: "degraded" } }).status, "fail");
});

test("scanner fail -> fail", () => {
  assert.equal(classifyDeepHealthSeverity({ ...ok, scanner: { status: "fail" } }).status, "fail");
});

test("a genuinely FAILED backup is critical (regression guard for the old \"fail\" typo)", () => {
  const r = classifyDeepHealthSeverity({ ...ok, backup: { status: "failed" } });
  assert.equal(r.status, "fail");
  assert.match(r.message, /backup/i);
});

test("offsite-only backup warn stays a warning, not a page", () => {
  assert.equal(classifyDeepHealthSeverity({ ...ok, backup: { status: "warn" } }).status, "warn");
});
