import { isUserSessionActive } from './db';

const SESSION_ACTIVE_STATUS_TTL_MS = 45_000;
const MAX_SESSION_ACTIVE_STATUS_CACHE_SIZE = 1_000;

type SessionActiveCacheEntry = {
    active: boolean;
    expiresAt: number;
};

const activeStatusCache = new Map<number, SessionActiveCacheEntry>();
const pendingActiveStatusChecks = new Map<number, Promise<boolean>>();

function pruneSessionActiveStatusCache(now = Date.now()) {
    for (const [userId, entry] of activeStatusCache) {
        if (entry.expiresAt <= now) {
            activeStatusCache.delete(userId);
        }
    }

    while (activeStatusCache.size > MAX_SESSION_ACTIVE_STATUS_CACHE_SIZE) {
        const oldestUserId = activeStatusCache.keys().next().value;
        if (typeof oldestUserId !== 'number') {
            return;
        }
        activeStatusCache.delete(oldestUserId);
    }
}

export async function getCachedSessionActiveStatus(userId: number): Promise<boolean> {
    const now = Date.now();
    const cached = activeStatusCache.get(userId);
    if (cached && cached.expiresAt > now) {
        return cached.active;
    }

    const pending = pendingActiveStatusChecks.get(userId);
    if (pending) {
        return pending;
    }

    const check = isUserSessionActive(userId)
        .then(active => {
            pruneSessionActiveStatusCache();
            activeStatusCache.set(userId, {
                active,
                expiresAt: Date.now() + SESSION_ACTIVE_STATUS_TTL_MS,
            });
            pruneSessionActiveStatusCache();
            return active;
        })
        .finally(() => {
            pendingActiveStatusChecks.delete(userId);
        });

    pendingActiveStatusChecks.set(userId, check);
    return check;
}

export function clearSessionActiveStatusCache(userId: number) {
    activeStatusCache.delete(userId);
    pendingActiveStatusChecks.delete(userId);
}
