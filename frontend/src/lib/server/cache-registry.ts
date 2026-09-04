/**
 * Occupancy counters for the module-level caches.
 *
 * The 24-hour stability observation recorded the frontend container growing
 * +491 MB against a +50 MiB budget, and `/api/health` could not say where it
 * went: it reported rss and heapUsed, which tell you the process is bigger
 * without telling you what is holding the bytes.
 *
 * Almost every cache in this codebase caps its entries and evicts the oldest.
 * The ones that matter for memory are the ones whose values are large -- a
 * serialized discovery system is megabytes of string -- so the count of live
 * entries, sampled next to rss, is what separates "a cache is filling up" from
 * "something else is leaking". Two consecutive polls are enough to tell them
 * apart, which is exactly how the event-loop histogram next to it is read.
 *
 * A registered cache pays nothing until something asks. `size()` is called
 * only from `readCacheSizes`, which only `/api/health` calls.
 */
type CacheSizeReader = () => number;

const readers = new Map<string, CacheSizeReader>();

/**
 * Register a cache so its live entry count shows up in the health snapshot.
 * Registering the same name twice replaces the reader, which keeps hot module
 * replacement in development from accumulating stale closures.
 */
export function registerCacheSize(name: string, size: CacheSizeReader): void {
  readers.set(name, size);
}

export function readCacheSizes(): Record<string, number> {
  const sizes: Record<string, number> = {};
  for (const [name, size] of readers) {
    try {
      sizes[name] = size();
    } catch {
      // A counter must never be the reason a health check fails.
      sizes[name] = -1;
    }
  }
  return sizes;
}

/** Test seam: the registry is module state and would otherwise leak between cases. */
export function resetCacheRegistry(): void {
  readers.clear();
}

/**
 * The eviction policy the module-level caches share, in one testable place.
 *
 * Drop what is past its stale window first, then the oldest, until the map
 * fits. Map iteration order is insertion order and every write re-inserts, so
 * the first key is the least recently written. Sweeping the stale entries
 * before falling back to age means eviction almost never takes an entry
 * someone would have reused.
 *
 * `pinned` is how a caller protects an entry that has work in flight against
 * it: evicting one of those would not free the memory it is holding anyway,
 * because the in-flight promise still references it.
 */
export function pruneCache<K, V>(
  cache: Map<K, V>,
  options: {
    maxEntries: number;
    now?: number;
    pinned?: (entry: V) => boolean;
    staleUntil: (entry: V) => number;
  },
): number {
  const now = options.now ?? Date.now();
  const pinned = options.pinned ?? (() => false);
  let evicted = 0;

  for (const [key, entry] of cache) {
    if (options.staleUntil(entry) <= now && !pinned(entry)) {
      cache.delete(key);
      evicted += 1;
    }
  }

  while (cache.size > options.maxEntries) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
    evicted += 1;
  }

  return evicted;
}
