import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { pruneCache, readCacheSizes, registerCacheSize, resetCacheRegistry } from "./cache-registry";

/**
 * The counters exist so that two consecutive /api/health polls can say whether
 * a growing rss is a cache filling up or something else. That only works if a
 * broken counter cannot take the health endpoint down with it.
 */
describe("cache size registry", () => {
  beforeEach(() => resetCacheRegistry());

  test("reports each registered cache by name", () => {
    const store = new Map<string, number>([["a", 1], ["b", 2]]);
    registerCacheSize("store", () => store.size);
    assert.deepEqual(readCacheSizes(), { store: 2 });
    store.delete("a");
    assert.deepEqual(readCacheSizes(), { store: 1 });
  });

  test("a throwing counter reports -1 rather than failing the health check", () => {
    registerCacheSize("healthy", () => 3);
    registerCacheSize("broken", () => {
      throw new Error("counter blew up");
    });
    assert.deepEqual(readCacheSizes(), { broken: -1, healthy: 3 });
  });

  test("re-registering a name replaces the reader", () => {
    registerCacheSize("store", () => 1);
    registerCacheSize("store", () => 9);
    assert.deepEqual(readCacheSizes(), { store: 9 });
  });

  test("an empty registry is an empty object, not a throw", () => {
    assert.deepEqual(readCacheSizes(), {});
  });
});

/**
 * The discovery system cache was the one cache in this codebase with no cap,
 * and its values are the largest in the process -- a resolved system object
 * graph plus its megabyte-scale serialization, one entry per account per
 * packet mode. expiresAt and staleUntil governed freshness, not residency, so
 * nothing ever left the map. That is the shape of the +491 MB the 24-hour
 * observation recorded, and these tests pin the policy that bounds it.
 */
type Entry = { refreshing?: boolean; staleUntil: number };

function seed(entries: Array<[string, Entry]>): Map<string, Entry> {
  return new Map(entries);
}

describe("cache eviction policy", () => {
  test("drops entries past their stale window", () => {
    const cache = seed([
      ["fresh", { staleUntil: 200 }],
      ["stale", { staleUntil: 50 }],
    ]);
    const evicted = pruneCache(cache, { maxEntries: 10, now: 100, staleUntil: (e) => e.staleUntil });
    assert.equal(evicted, 1);
    assert.deepEqual([...cache.keys()], ["fresh"]);
  });

  test("falls back to the oldest write once the stale sweep is not enough", () => {
    const cache = seed([
      ["a", { staleUntil: 900 }],
      ["b", { staleUntil: 900 }],
      ["c", { staleUntil: 900 }],
    ]);
    pruneCache(cache, { maxEntries: 2, now: 100, staleUntil: (e) => e.staleUntil });
    assert.deepEqual([...cache.keys()], ["b", "c"], "insertion order is least-recently-written first");
  });

  // Re-inserting on write is what makes insertion order mean "least recently
  // written". If a caller ever mutates in place instead, this is the test that
  // catches the eviction order silently becoming wrong.
  test("a rewritten key moves to the back of the queue", () => {
    const cache = seed([
      ["a", { staleUntil: 900 }],
      ["b", { staleUntil: 900 }],
    ]);
    cache.delete("a");
    cache.set("a", { staleUntil: 900 });
    pruneCache(cache, { maxEntries: 1, now: 100, staleUntil: (e) => e.staleUntil });
    assert.deepEqual([...cache.keys()], ["a"]);
  });

  test("a pinned entry survives the stale sweep", () => {
    const cache = seed([
      ["refreshing", { refreshing: true, staleUntil: 50 }],
      ["idle", { staleUntil: 50 }],
    ]);
    pruneCache(cache, {
      maxEntries: 10,
      now: 100,
      pinned: (e) => Boolean(e.refreshing),
      staleUntil: (e) => e.staleUntil,
    });
    assert.deepEqual([...cache.keys()], ["refreshing"], "an in-flight refresh still references the entry");
  });

  // The cap is a ceiling, not a hit-rate change: under the limit it must not
  // touch anything, or a bounded cache would start missing for no reason.
  test("does nothing while the cache is under its cap and fresh", () => {
    const cache = seed([["a", { staleUntil: 900 }], ["b", { staleUntil: 900 }]]);
    assert.equal(pruneCache(cache, { maxEntries: 10, now: 100, staleUntil: (e) => e.staleUntil }), 0);
    assert.equal(cache.size, 2);
  });

  test("pinned entries are still evictable by the cap, so the ceiling holds", () => {
    const cache = seed([
      ["a", { refreshing: true, staleUntil: 900 }],
      ["b", { refreshing: true, staleUntil: 900 }],
      ["c", { refreshing: true, staleUntil: 900 }],
    ]);
    pruneCache(cache, {
      maxEntries: 1,
      now: 100,
      pinned: (e) => Boolean(e.refreshing),
      staleUntil: (e) => e.staleUntil,
    });
    assert.equal(cache.size, 1, "pinning defers the stale sweep, it does not defeat the cap");
  });
});
