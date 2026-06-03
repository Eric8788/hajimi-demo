const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';

export function getImageDisplayUrl(value?: string | null) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('/')) return raw;

    try {
        const parsed = new URL(raw);
        const shouldProxy = parsed.protocol === 'http:' || parsed.hostname.endsWith(BLOB_HOST_SUFFIX);
        return shouldProxy ? `/api/image-proxy?url=${encodeURIComponent(parsed.href)}` : parsed.href;
    } catch {
        return raw;
    }
}
