import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adminAccessState, isAdminRole, sanitizeAdminAuditMetadata, validAdminRoleMutation } from "./admin-policy";

describe("admin policy", () => {
  it("denies anonymous and non-admin users", () => {
    assert.equal(adminAccessState(null), "unauthenticated");
    assert.equal(adminAccessState({ role: "user" }), "authenticated_non_admin");
    assert.equal(adminAccessState({ role: "premium" }), "authenticated_non_admin");
  });

  it("allows only DB admin role", () => {
    assert.equal(isAdminRole("admin"), true);
    assert.equal(isAdminRole("user"), false);
    assert.equal(isAdminRole(undefined), false);
  });

  it("requires strong confirmation for role mutations", () => {
    assert.deepEqual(validAdminRoleMutation({ actorUserId: "a", confirm: "PROMOTE ADMIN", role: "admin", targetUserId: "b" }), { ok: true, role: "admin" });
    assert.deepEqual(validAdminRoleMutation({ actorUserId: "a", confirm: "DEMOTE ADMIN", role: "user", targetUserId: "b" }), { ok: true, role: "user" });
    assert.equal(validAdminRoleMutation({ actorUserId: "a", confirm: "admin", role: "admin", targetUserId: "b" }).ok, false);
    assert.equal(validAdminRoleMutation({ actorUserId: "a", confirm: "DEMOTE ADMIN", role: "owner", targetUserId: "b" }).ok, false);
  });

  it("prevents an admin from demoting their own account", () => {
    const result = validAdminRoleMutation({ actorUserId: "same", confirm: "DEMOTE ADMIN", role: "user", targetUserId: "same" });
    assert.deepEqual(result, { ok: false, reason: "cannot_demote_self" });
  });

  it("sanitizes audit metadata before storage", () => {
    const metadata = sanitizeAdminAuditMetadata({
      action: "test",
      nested: { ok: true, stripe_secret: "sk_test_secret" },
      password: "secret",
      sessionToken: "raw-token",
      targetId: "user-1",
    });
    assert.equal(metadata.action, "test");
    assert.equal(metadata.targetId, "user-1");
    assert.equal(Object.hasOwn(metadata, "password"), false);
    assert.equal(Object.hasOwn(metadata, "sessionToken"), false);
    assert.deepEqual(metadata.nested, { ok: true });
  });
});
