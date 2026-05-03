import assert from "node:assert/strict";
import test from "node:test";
import { isNotificationType, normalizeNotificationId } from "./notifications";

test("notification type validation allows only supported account message types", () => {
  assert.equal(isNotificationType("system"), true);
  assert.equal(isNotificationType("subscription"), true);
  assert.equal(isNotificationType("signal"), true);
  assert.equal(isNotificationType("admin"), false);
  assert.equal(isNotificationType(""), false);
});

test("notification id validation rejects non-uuid input", () => {
  const id = "018f4c6b-7725-4b6a-9123-a85751000abc";

  assert.equal(normalizeNotificationId(id), id);
  assert.equal(normalizeNotificationId("018f4c6b-7725-4b6a-9123-a85751000abc OR true"), null);
  assert.equal(normalizeNotificationId("not-a-uuid"), null);
});
