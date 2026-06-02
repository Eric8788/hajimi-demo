import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/db';
import { cachedServerValue } from '@/lib/serverCache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const requestedLimit = Number(searchParams.get('limit') || 10);
        const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50) : 10;
        const windowParam = searchParams.get('window');
        const categoryParam = searchParams.get('category');
        const window = windowParam === 'day' || windowParam === 'week' || windowParam === 'month' ? windowParam : 'all';
        const category = categoryParam === 'community' || categoryParam === 'project' ? categoryParam : 'all';
        const leaderboard = await cachedServerValue(
            `leaderboard:${limit}:${window}:${category}`,
            45_000,
            () => getLeaderboard(limit, window, category),
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
