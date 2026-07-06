import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/db';
import { cachedServerValue } from '@/lib/serverCache';

export const dynamic = 'force-dynamic';

function parseLocalDate(value: string | null) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year
        || date.getUTCMonth() !== month - 1
        || date.getUTCDate() !== day
    ) {
        return null;
    }

    return value;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const requestedLimit = Number(searchParams.get('limit') || 10);
        const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50) : 10;
        const windowParam = searchParams.get('window');
        const categoryParam = searchParams.get('category');
        const startDate = parseLocalDate(searchParams.get('start'));
        const endDate = parseLocalDate(searchParams.get('end'));
        const range = startDate !== null && endDate !== null && startDate <= endDate
            ? { startDate, endDate }
            : undefined;
        const window = windowParam === 'custom' && range
            ? 'custom'
            : windowParam === 'day' || windowParam === 'week' || windowParam === 'month'
                ? windowParam
                : 'all';
        const category = categoryParam === 'community' || categoryParam === 'project' ? categoryParam : 'all';
        const leaderboard = await cachedServerValue(
            range && window === 'custom'
                ? `leaderboard:${limit}:${window}:${category}:${range.startDate}:${range.endDate}`
                : `leaderboard:${limit}:${window}:${category}`,
            45_000,
            () => getLeaderboard(limit, window, category, range),
        );
        return NextResponse.json(leaderboard, {
            headers: {
                'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120',
            },
        });
    } catch (error) {
        console.error('Leaderboard API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}
