// Minimal stale-while-revalidate cache. Module-level Map survives
// component unmount/remount during a single SPA session — so navigating
// back to a previously-visited page renders instantly from cache while
// a fresh fetch runs in the background.
//
// Cleared on full page reload (intentional — auth state may have changed).
// No dependency on TanStack/SWR packages; ~30 lines.

interface Entry {
  data: unknown;
  ts: number;
}

const store = new Map<string, Entry>();

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

export function readCache<T>(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > maxAgeMs) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function writeCache<T>(key: string, data: T): void {
  store.set(key, { data, ts: Date.now() });
}

export function invalidateCache(key: string): void {
  store.delete(key);
}

// Bust all entries whose key starts with prefix — useful after a mutation
// invalidates a family of cached views (e.g. "history:" after a new tx).
export function invalidateCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
