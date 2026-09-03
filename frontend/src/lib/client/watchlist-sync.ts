"use client";

import { csrfFetch } from "@/lib/client/csrf-fetch";

export type WatchlistSyncResponse = {
  authenticated?: boolean;
  error?: string;
  symbols?: unknown;
};

/**
 * The mount-time watchlist reconcile, deduplicated across components.
 *
 * useLocalWatchlist is a hook, so every component that calls it runs its own
 * mount effect. On /terminal that is several at once -- the activation nudge
 * from the root layout, the first-run card, the watchlist widget and its
 * buttons -- and each one used to POST the local list for merging.
 *
 * Two guards, because the mounts fail to overlap in two different ways:
 *
 *  - Concurrent mounts carrying the same body share one request. This is the
 *    guard that took /terminal from four POSTs to two.
 *
 *  - Mounts that do NOT overlap still posted twice, and this is the half that
 *    was left. The first sync writes the merged list back to storage, so a
 *    component mounting after that response reads a different local list,
 *    builds a different body, misses the in-flight key entirely, and posts
 *    again. The merge is idempotent and its result is what storage already
 *    holds, so the later mount has nothing to contribute: once a user has been
 *    reconciled in this page session, later mounts read storage instead.
 *
 * The session memo is keyed by user id, so switching accounts syncs again, and
 * only a successful sync records, so a transient failure is retried by the next
 * mount rather than being silently swallowed for the life of the page.
 */
let inFlight: { key: string; promise: Promise<WatchlistSyncResponse | null> } | null = null;
let syncedUserId: string | null = null;

/** Test seam. Module-level memos would otherwise leak between cases. */
export function resetWatchlistSyncState(): void {
  inFlight = null;
  syncedUserId = null;
}

export function watchlistSyncAlreadyDone(userId: string): boolean {
  return syncedUserId === userId;
}

export function requestWatchlistSync(
  userId: string,
  symbols: string[],
  fetcher: typeof csrfFetch = csrfFetch,
): Promise<WatchlistSyncResponse | null> {
  const body = JSON.stringify({ symbols });
  const key = `${userId}:${body}`;
  if (inFlight && inFlight.key === key) return inFlight.promise;
  if (syncedUserId === userId) return Promise.resolve(null);

  const promise = (async () => {
    const response = await fetcher("/api/user/watchlist", {
      body,
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as WatchlistSyncResponse | null;
    if (!response.ok) throw new Error(payload?.error ?? "Failed to sync watchlist.");
    syncedUserId = userId;
    return payload;
  })();

  const entry = { key, promise };
  inFlight = entry;
  void promise.catch(() => undefined).finally(() => {
    if (inFlight === entry) inFlight = null;
  });
  return promise;
}
