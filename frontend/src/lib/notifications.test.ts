import assert from "node:assert/strict";
import test from "node:test";
import { isNotificationType, normalizeNotificationId, notificationDisplayMessage } from "./notifications";

test("notification type validation allows only supported account message types", () => {
  assert.equal(isNotificationType("system"), true);
  assert.equal(isNotificationType("subscription"), true);
  assert.equal(isNotificationType("signal"), true);
  assert.equal(isNotificationType("email_verification"), true);
  assert.equal(isNotificationType("admin"), false);
  assert.equal(isNotificationType(""), false);
});

test("notification id validation rejects non-uuid input", () => {
  const id = "018f4c6b-7725-4b6a-9123-a85751000abc";

  assert.equal(normalizeNotificationId(id), id);
  assert.equal(normalizeNotificationId("018f4c6b-7725-4b6a-9123-a85751000abc OR true"), null);
  assert.equal(normalizeNotificationId("not-a-uuid"), null);
});

test("email verification notification display includes spam folder hint", () => {
  assert.equal(
    notificationDisplayMessage({ message: "Verify your email address to unlock premium upgrade.", type: "email_verification" }),
    "Verify your email address. Check your inbox or spam/junk folder.",
  );
  assert.equal(notificationDisplayMessage({ message: "System message", type: "system" }), "System message");
});
