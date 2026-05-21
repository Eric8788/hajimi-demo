import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const requestedLimit = Number(searchParams.get('limit') || 10);
        const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50) : 10;
        const windowParam = searchParams.get('window');
        const categoryParam = searchParams.get('category');
        const window = windowParam === 'week' || windowParam === 'month' ? windowParam : 'all';
        const category = categoryParam === 'community' || categoryParam === 'project' ? categoryParam : 'all';
        const leaderboard = await getLeaderboard(limit, window, category);
        return NextResponse.json(leaderboard);
    } catch (error) {
        console.error('Leaderboard API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}
