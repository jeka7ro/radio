const CACHE_PREFIX = 'aether_cache_v12_';
export const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  timestamp: number;
  ttl: number;
  data: T;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

export function getCachedData<T>(key: string): T | null {
  const fullKey = `${CACHE_PREFIX}${key}`;
  const now = Date.now();

  const memEntry = memoryCache.get(fullKey) as CacheEntry<T> | undefined;
  if (memEntry) {
    if (now - memEntry.timestamp < memEntry.ttl) {
      return memEntry.data;
    }
    memoryCache.delete(fullKey);
  }

  try {
    const raw = localStorage.getItem(fullKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.timestamp !== 'number') {
      localStorage.removeItem(fullKey);
      return null;
    }
    if (now - parsed.timestamp < (parsed.ttl || DEFAULT_TTL_MS)) {
      memoryCache.set(fullKey, parsed);
      return parsed.data;
    }
    localStorage.removeItem(fullKey);
  } catch {
    // Ignore storage read errors
  }

  return null;
}

export function setCachedData<T>(key: string, data: T, ttl: number = DEFAULT_TTL_MS): void {
  const fullKey = `${CACHE_PREFIX}${key}`;
  const entry: CacheEntry<T> = {
    timestamp: Date.now(),
    ttl,
    data,
  };

  memoryCache.set(fullKey, entry);

  try {
    localStorage.setItem(fullKey, JSON.stringify(entry));
  } catch {
    // If localStorage quota is exceeded, prune old cache entries and retry once
    pruneExpiredOrOldestCache();
    try {
      localStorage.setItem(fullKey, JSON.stringify(entry));
    } catch {
      // Keep in memoryCache even if localStorage is full
    }
  }
}

function pruneExpiredOrOldestCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore
  }
}

export function clearAllApiCache(): void {
  memoryCache.clear();
  pruneExpiredOrOldestCache();
}

