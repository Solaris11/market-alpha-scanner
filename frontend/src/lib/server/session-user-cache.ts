/**
 * In-process cache of the user row behind a session token.
 *
 * Extracted from auth.ts so the invalidation contract can be tested without a
 * database. The contract exists because of a real defect: PUT /api/user/profile
 * wrote the users row and returned the fresh values, but nothing dropped the
 * cached copy, so /api/auth/me kept answering with the pre-update user for the
 * whole TTL (default 120s). The onboarding gate reads that endpoint, so saving
 * onboarding reopened the same modal until the entry expired.
 *
 * Two rules make that impossible to reintroduce:
 *   - invalidateUser drops every entry for an account.
 *   - a load that started before an invalidation may not write its result, or
 *     it would reinstate exactly the value the invalidation removed.
 */

export type SessionUserCacheEntry<TUser> = {
  expiresAtMs: number;
  user: TUser | null;
};

export type SessionUserCacheOptions = {
  maxEntries: number;
  negativeTtlMs: number;
  now?: () => number;
  positiveTtlMs: number;
};

export class SessionUserCache<TUser extends { id: string }> {
  private readonly entries = new Map<string, SessionUserCacheEntry<TUser>>();
  private readonly now: () => number;
  private epochValue = 0;

  public constructor(private readonly options: SessionUserCacheOptions) {
    this.now = options.now ?? Date.now;
  }

  /** Current invalidation generation; pass it to `write` after an async load. */
  public get epoch(): number {
    return this.epochValue;
  }

  public get size(): number {
    return this.entries.size;
  }

  /** `undefined` means "not cached"; `null` means "cached as no such user". */
  public read(tokenHash: string): TUser | null | undefined {
    const cached = this.entries.get(tokenHash);
    if (!cached) return undefined;
    if (cached.expiresAtMs <= this.now()) {
      this.entries.delete(tokenHash);
      return undefined;
    }
    return cached.user;
  }

  /**
   * Store a freshly loaded row. When `epochAtLoadStart` is given and no longer
   * matches, the row is dropped instead of cached: it was superseded while the
   * query was in flight.
   */
  public write(tokenHash: string, user: TUser | null, epochAtLoadStart?: number): boolean {
    if (epochAtLoadStart !== undefined && epochAtLoadStart !== this.epochValue) return false;
    this.trim();
    this.entries.set(tokenHash, {
      expiresAtMs: this.now() + (user ? this.options.positiveTtlMs : this.options.negativeTtlMs),
      user,
    });
    return true;
  }

  public delete(tokenHash: string): void {
    this.entries.delete(tokenHash);
  }

  /** Drop every entry for one account and invalidate in-flight loads. */
  public invalidateUser(userId: string | null | undefined): number {
    const id = String(userId ?? "").trim();
    if (!id) return 0;
    this.epochValue += 1;
    let dropped = 0;
    for (const [tokenHash, entry] of this.entries) {
      if (entry.user?.id === id) {
        this.entries.delete(tokenHash);
        dropped += 1;
      }
    }
    return dropped;
  }

  public clear(): void {
    this.entries.clear();
    this.epochValue += 1;
  }

  private trim(): void {
    if (this.entries.size < this.options.maxEntries) return;
    const now = this.now();
    for (const [key, value] of this.entries) {
      if (value.expiresAtMs <= now) this.entries.delete(key);
    }
    while (this.entries.size >= this.options.maxEntries) {
      const firstKey = this.entries.keys().next().value;
      if (typeof firstKey !== "string") return;
      this.entries.delete(firstKey);
    }
  }
}
