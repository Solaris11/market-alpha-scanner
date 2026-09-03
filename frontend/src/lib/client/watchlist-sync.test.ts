import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";

import { requestWatchlistSync, resetWatchlistSyncState, watchlistSyncAlreadyDone } from "./watchlist-sync";

/**
 * /terminal issued two POST /api/user/watchlist per load, and the in-flight
 * guard that was already there did not stop them. These tests pin why: the two
 * mounts do not overlap, and after the first response storage holds a different
 * list, so the second mount builds a different body and misses the key.
 */

type Call = { body: string; url: string };

function fetcherFor(calls: Call[], symbols: string[] = ["AMD"], ok = true) {
  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ body: String(init.body ?? ""), url: String(input) });
    return {
      json: async () => (ok ? { symbols } : { error: "nope" }),
      ok,
    } as unknown as Response;
  };
}

describe("watchlist mount sync", () => {
  beforeEach(() => resetWatchlistSyncState());

  test("concurrent mounts carrying the same local list share one request", async () => {
    const calls: Call[] = [];
    const fetcher = fetcherFor(calls);
    const [a, b] = await Promise.all([
      requestWatchlistSync("user-1", ["AMD"], fetcher),
      requestWatchlistSync("user-1", ["AMD"], fetcher),
    ]);
    assert.equal(calls.length, 1);
    assert.deepEqual(a, b);
  });

  // The half that was still leaking. The first sync writes the merged list back
  // to storage, so the later mount reads ["AMD","NVDA"] rather than ["AMD"].
  test("a later mount reading the merged list does not post again", async () => {
    const calls: Call[] = [];
    const fetcher = fetcherFor(calls, ["AMD", "NVDA"]);
    await requestWatchlistSync("user-1", ["AMD"], fetcher);
    assert.equal(calls.length, 1);
    await requestWatchlistSync("user-1", ["AMD", "NVDA"], fetcher);
    assert.equal(calls.length, 1, "the second mount must not issue a second POST");
  });

  // The short circuit returns null rather than an empty payload: the hook writes
  // storage from the payload, and an empty one would clear the watchlist.
  test("the short circuit returns null, never an empty symbol list", async () => {
    const calls: Call[] = [];
    const fetcher = fetcherFor(calls);
    await requestWatchlistSync("user-1", ["AMD"], fetcher);
    const second = await requestWatchlistSync("user-1", ["AMD", "NVDA"], fetcher);
    assert.equal(second, null);
  });

  test("switching accounts syncs again", async () => {
    const calls: Call[] = [];
    const fetcher = fetcherFor(calls);
    await requestWatchlistSync("user-1", ["AMD"], fetcher);
    await requestWatchlistSync("user-2", ["AMD"], fetcher);
    assert.equal(calls.length, 2);
    assert.equal(watchlistSyncAlreadyDone("user-2"), true);
  });

  test("a failed sync is not remembered, so the next mount retries", async () => {
    const calls: Call[] = [];
    const failing = fetcherFor(calls, [], false);
    await assert.rejects(() => requestWatchlistSync("user-1", ["AMD"], failing));
    assert.equal(watchlistSyncAlreadyDone("user-1"), false);
    const ok: Call[] = [];
    await requestWatchlistSync("user-1", ["AMD"], fetcherFor(ok));
    assert.equal(ok.length, 1, "a transient failure must not silence the sync for the page");
  });
});
