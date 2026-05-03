import assert from "node:assert/strict";
import test from "node:test";
import { containsUnsafePaperErrorText, paperAccessScope, safePaperErrorCode } from "./paper-safety";

test("logged-out paper access cannot read server paper data", () => {
  assert.deepEqual(paperAccessScope(null), { canReadServerData: false, userId: null });
  assert.deepEqual(paperAccessScope(""), { canReadServerData: false, userId: null });
});

test("authenticated paper access is scoped to the current user id", () => {
  assert.deepEqual(paperAccessScope("user-123"), { canReadServerData: true, userId: "user-123" });
});

test("paper DB errors map to stable generic client codes", () => {
  assert.equal(safePaperErrorCode("account"), "paper_account_unavailable");
  assert.equal(safePaperErrorCode("analytics"), "paper_analytics_unavailable");
  assert.equal(safePaperErrorCode("trade"), "paper_trade_unavailable");
});

test("unsafe DB internals are detected in potential client responses", () => {
  assert.equal(containsUnsafePaperErrorText({ error: "column created_at does not exist", stack: "trace" }), true);
  assert.equal(containsUnsafePaperErrorText({ ok: false, error: "paper_account_unavailable" }), false);
});
