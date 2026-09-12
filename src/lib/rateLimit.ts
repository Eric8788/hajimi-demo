type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Small per-instance guard for burst control. It is intentionally best-effort:
 * Vercel instances do not share memory, so a shared limiter can be added later
 * if traffic requires it.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
        const next = { count: 1, resetAt: now + windowMs };
        buckets.set(key, next);
        return { allowed: true, remaining: limit - 1, retryAfter: Math.ceil(windowMs / 1000) };
    }

    current.count += 1;
    const allowed = current.count <= limit;
    return {
        allowed,
        remaining: Math.max(0, limit - current.count),
        retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
}

export function getClientKey(request: Request, suffix: string) {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ip = forwarded || request.headers.get('x-real-ip') || 'unknown';
    return `${suffix}:${ip}`;
}
