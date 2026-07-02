import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPresenceSummary, touchUserPresence } from '@/lib/db';
import { cachedServerValue } from '@/lib/serverCache';
import { getRequestLogContext, logApiError } from '@/lib/apiLog';

export const dynamic = 'force-dynamic';

const PRESENCE_SUMMARY_TTL_MS = 20_000;

function getLimit(request: Request, isAuthenticated: boolean) {
    if (!isAuthenticated) return 0;

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || 8);
    return Math.max(0, Math.min(8, Math.floor(Number.isFinite(limit) ? limit : 8)));
}

function publicSummary(limit: number) {
    return cachedServerValue(
        `presence:summary:${limit}`,
        PRESENCE_SUMMARY_TTL_MS,
        () => getPresenceSummary(limit),
    );
}

export async function GET(request: Request) {
    try {
        const session = await getSession();
        const limit = getLimit(request, Boolean(session));
        const summary = await publicSummary(limit);

        return NextResponse.json(summary, {
            headers: {
                'Cache-Control': 'no-store, max-age=0, must-revalidate',
            },
        });
    } catch (error) {
        logApiError('/api/presence', error, getRequestLogContext(request));
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const limit = getLimit(request, true);
        await touchUserPresence(Number(session.userId));
        const summary = await getPresenceSummary(limit);

        return NextResponse.json(summary, {
            headers: {
                'Cache-Control': 'no-store, max-age=0, must-revalidate',
            },
        });
    } catch (error) {
        logApiError('/api/presence', error, getRequestLogContext(request));
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
