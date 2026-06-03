import dns from 'node:dns/promises';
import net from 'node:net';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';

function isPrivateIpv4(address: string) {
    const parts = address.split('.').map(part => Number(part));
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true;
    const [a, b] = parts;
    return (
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a === 0
    );
}

function isPrivateIpv6(address: string) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

function isPrivateAddress(address: string) {
    const family = net.isIP(address);
    if (family === 4) return isPrivateIpv4(address);
    if (family === 6) return isPrivateIpv6(address);
    return true;
}

async function validateRemoteUrl(rawUrl: string) {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Unsupported image protocol');
    }
    if (parsed.username || parsed.password) {
        throw new Error('Image URL credentials are not allowed');
    }
    if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local')) {
        throw new Error('Private image hosts are not allowed');
    }
    if (parsed.pathname.startsWith('/api/image-proxy')) {
        throw new Error('Recursive image proxy URL');
    }

    if (!parsed.hostname.endsWith(BLOB_HOST_SUFFIX)) {
        const addresses = await dns.lookup(parsed.hostname, { all: true });
        if (addresses.length === 0 || addresses.some(entry => isPrivateAddress(entry.address))) {
            throw new Error('Private image address is not allowed');
        }
    }

    return parsed;
}

async function fetchImage(url: URL, redirectCount = 0): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    try {
        const response = await fetch(url, {
            redirect: 'manual',
            signal: controller.signal,
            headers: {
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'User-Agent': 'HajimiImageProxy/1.0',
            },
        });

        if (response.status >= 300 && response.status < 400) {
            if (redirectCount >= MAX_REDIRECTS) {
                throw new Error('Too many image redirects');
            }
            const location = response.headers.get('location');
            if (!location) throw new Error('Image redirect missing location');
            const nextUrl = await validateRemoteUrl(new URL(location, url).href);
            return fetchImage(nextUrl, redirectCount + 1);
        }

        return response;
    } finally {
        clearTimeout(timeout);
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const rawUrl = searchParams.get('url');
        if (!rawUrl) {
            return NextResponse.json({ error: 'Missing image URL' }, { status: 400 });
        }

        const imageUrl = await validateRemoteUrl(rawUrl);
        const imageResponse = await fetchImage(imageUrl);
        if (!imageResponse.ok) {
            return NextResponse.json({ error: 'Image unavailable' }, { status: imageResponse.status });
        }

        const contentType = imageResponse.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('image/')) {
            return NextResponse.json({ error: 'Remote URL is not an image' }, { status: 415 });
        }

        const contentLength = Number(imageResponse.headers.get('content-length') || 0);
        if (contentLength > MAX_IMAGE_BYTES) {
            return NextResponse.json({ error: 'Image too large' }, { status: 413 });
        }

        const body = Buffer.from(await imageResponse.arrayBuffer());
        if (body.byteLength > MAX_IMAGE_BYTES) {
            return NextResponse.json({ error: 'Image too large' }, { status: 413 });
        }

        return new Response(body, {
            headers: {
                'Content-Type': contentType,
                'Content-Length': String(body.byteLength),
                'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error) {
        console.warn('Image proxy failed:', error);
        return NextResponse.json({ error: 'Image proxy failed' }, { status: 502 });
    }
}
