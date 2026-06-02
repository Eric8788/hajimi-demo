type ServerCacheEntry<T> = {
    value: T;
    expiresAt: number;
};

const serverCache = new Map<string, ServerCacheEntry<unknown>>();
const pendingLoads = new Map<string, Promise<unknown>>();
const cacheVersions = new Map<string, number>();

export async function cachedServerValue<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = serverCache.get(key);
    if (cached && cached.expiresAt > now) {
        return cached.value as T;
    }

    const pending = pendingLoads.get(key);
    if (pending) {
        return pending as Promise<T>;
    }

    const loadVersion = cacheVersions.get(key) ?? 0;
    const load = loader()
        .then(value => {
            if ((cacheVersions.get(key) ?? 0) === loadVersion) {
                serverCache.set(key, {
                    value,
                    expiresAt: Date.now() + ttlMs,
                });
            }
            return value;
        })
        .finally(() => {
            pendingLoads.delete(key);
        });

    pendingLoads.set(key, load);
    const value = await load;
    return value;
}

export function clearServerCache(prefix: string) {
    const invalidateKey = (key: string) => {
        cacheVersions.set(key, (cacheVersions.get(key) ?? 0) + 1);
    };

    for (const key of serverCache.keys()) {
        if (key.startsWith(prefix)) {
            invalidateKey(key);
            serverCache.delete(key);
        }
    }
    for (const key of pendingLoads.keys()) {
        if (key.startsWith(prefix)) {
            invalidateKey(key);
            pendingLoads.delete(key);
        }
    }
}
