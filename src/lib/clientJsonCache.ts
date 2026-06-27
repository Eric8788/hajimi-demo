type CacheEntry<T> = {
    data: T;
    expiresAt: number;
};

const jsonCache = new Map<string, CacheEntry<unknown>>();

export async function cachedJson<T>(key: string, input: RequestInfo | URL, ttlMs: number, init?: RequestInit): Promise<T> {
    const now = Date.now();
    const cached = jsonCache.get(key);
    if (cached && cached.expiresAt > now) {
        return cached.data as T;
    }

    const res = await fetch(input, init);
    if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
    }

    const data = await res.json() as T;
    jsonCache.set(key, {
        data,
        expiresAt: Date.now() + ttlMs,
    });
    return data;
}

export function getCachedJson<T>(key: string): T | null {
    const cached = jsonCache.get(key);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
        jsonCache.delete(key);
        return null;
    }

    return cached.data as T;
}

export function setCachedJson<T>(key: string, data: T, ttlMs: number) {
    jsonCache.set(key, {
        data,
        expiresAt: Date.now() + ttlMs,
    });
}

export function clearCachedJson(prefix: string) {
    for (const key of jsonCache.keys()) {
        if (key.startsWith(prefix)) {
            jsonCache.delete(key);
        }
    }
}

export function clearCachedJsonKey(key: string) {
    jsonCache.delete(key);
}
