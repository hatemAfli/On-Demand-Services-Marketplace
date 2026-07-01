import AsyncStorage from "@react-native-async-storage/async-storage";

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const memory = new Map<string, CacheEntry<unknown>>();
const STORAGE_PREFIX = "serveme:cache:";

export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 5 * 60 * 1000,
  options?: { forceRefresh?: boolean; staleWhileRevalidate?: boolean },
): Promise<T> {
  const now = Date.now();
  const forceRefresh = options?.forceRefresh ?? false;
  const swr = options?.staleWhileRevalidate ?? true;

  if (!forceRefresh) {
    const mem = memory.get(key) as CacheEntry<T> | undefined;
    if (mem && mem.expiresAt > now) {
      return mem.data;
    }

    try {
      const stored = await AsyncStorage.getItem(STORAGE_PREFIX + key);
      if (stored) {
        const parsed = JSON.parse(stored) as CacheEntry<T>;
        if (parsed.expiresAt > now) {
          memory.set(key, parsed);
          if (swr && parsed.expiresAt - now < ttlMs * 0.3) {
            void refreshCachedData(key, fetcher, ttlMs);
          }
          return parsed.data;
        }
      }
    } catch {
      // ignore corrupt cache
    }
  }

  return refreshCachedData(key, fetcher, ttlMs);
}

async function refreshCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  const data = await fetcher();
  const entry: CacheEntry<T> = {
    data,
    expiresAt: Date.now() + ttlMs,
  };
  memory.set(key, entry);
  try {
    await AsyncStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // storage full or unavailable
  }
  return data;
}

export async function invalidateCache(keyOrPrefix: string): Promise<void> {
  for (const key of [...memory.keys()]) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
      memory.delete(key);
    }
  }
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const toRemove = allKeys.filter(
      (k) =>
        k.startsWith(STORAGE_PREFIX) &&
        (k === STORAGE_PREFIX + keyOrPrefix ||
          k.startsWith(STORAGE_PREFIX + keyOrPrefix)),
    );
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch {
    // ignore
  }
}

export function peekCachedData<T>(key: string): T | null {
  const mem = memory.get(key) as CacheEntry<T> | undefined;
  if (mem && mem.expiresAt > Date.now()) {
    return mem.data;
  }
  return null;
}
