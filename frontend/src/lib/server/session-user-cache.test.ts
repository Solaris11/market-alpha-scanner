import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { SessionUserCache } from "./session-user-cache";

type TestUser = { id: string; onboardingCompleted: boolean };

function cache(now = { value: 1_000 }) {
  return {
    clock: now,
    instance: new SessionUserCache<TestUser>({
      maxEntries: 4,
      negativeTtlMs: 5_000,
      now: () => now.value,
      positiveTtlMs: 120_000,
    }),
  };
}

const before: TestUser = { id: "u1", onboardingCompleted: false };
const after: TestUser = { id: "u1", onboardingCompleted: true };

describe("session user cache", () => {
  test("distinguishes a miss from a cached absence", () => {
    const { instance } = cache();
    assert.equal(instance.read("t1"), undefined, "nothing cached yet");
    instance.write("t1", null);
    assert.equal(instance.read("t1"), null, "cached as no such user");
  });

  test("entries expire on their own TTL", () => {
    const { clock, instance } = cache();
    instance.write("t1", before);
    clock.value += 119_000;
    assert.deepEqual(instance.read("t1"), before);
    clock.value += 2_000;
    assert.equal(instance.read("t1"), undefined, "expired entries are misses");
  });

  test("a negative entry expires sooner than a positive one", () => {
    const { clock, instance } = cache();
    instance.write("absent", null);
    instance.write("present", before);
    clock.value += 6_000;
    assert.equal(instance.read("absent"), undefined);
    assert.deepEqual(instance.read("present"), before);
  });

  // The onboarding-loop regression.
  test("invalidating a user drops every session that account holds", () => {
    const { instance } = cache();
    instance.write("phone", before);
    instance.write("laptop", before);
    instance.write("someone-else", { id: "u2", onboardingCompleted: true });

    const dropped = instance.invalidateUser("u1");

    assert.equal(dropped, 2, "both of u1's sessions");
    assert.equal(instance.read("phone"), undefined);
    assert.equal(instance.read("laptop"), undefined);
    assert.deepEqual(instance.read("someone-else"), { id: "u2", onboardingCompleted: true }, "other accounts untouched");
  });

  test("a load that started before an invalidation may not write its stale result", () => {
    const { instance } = cache();
    instance.write("t1", before);

    // A request reads through, misses, and starts loading.
    const epochAtLoadStart = instance.epoch;
    // Meanwhile the profile is saved and the cache invalidated.
    instance.invalidateUser("u1");
    // The in-flight load now returns the row as it was before the save.
    const wrote = instance.write("t1", before, epochAtLoadStart);

    assert.equal(wrote, false, "the stale write is refused");
    assert.equal(instance.read("t1"), undefined, "so the next read goes to the database");
  });

  test("a load that started after the invalidation still caches normally", () => {
    const { instance } = cache();
    instance.invalidateUser("u1");
    const epochAtLoadStart = instance.epoch;
    assert.equal(instance.write("t1", after, epochAtLoadStart), true);
    assert.deepEqual(instance.read("t1"), after);
  });

  test("invalidating an unknown or empty user is a no-op", () => {
    const { instance } = cache();
    instance.write("t1", before);
    assert.equal(instance.invalidateUser(""), 0);
    assert.equal(instance.invalidateUser(null), 0);
    assert.deepEqual(instance.read("t1"), before, "epoch is not bumped for an empty id");
    assert.equal(instance.invalidateUser("nobody"), 0);
  });

  test("the cache stays bounded", () => {
    const { instance } = cache();
    for (let index = 0; index < 12; index += 1) {
      instance.write(`t${index}`, { id: `u${index}`, onboardingCompleted: true });
    }
    assert.ok(instance.size <= 4, `expected at most 4 entries, got ${instance.size}`);
    assert.deepEqual(instance.read("t11"), { id: "u11", onboardingCompleted: true }, "the newest entry survives");
  });

  test("deleting one token leaves the rest alone", () => {
    const { instance } = cache();
    instance.write("t1", before);
    instance.write("t2", before);
    instance.delete("t1");
    assert.equal(instance.read("t1"), undefined);
    assert.deepEqual(instance.read("t2"), before);
  });
});
