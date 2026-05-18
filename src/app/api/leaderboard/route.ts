import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const requestedLimit = Number(searchParams.get('limit') || 10);
        const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50) : 10;
        const leaderboard = await getLeaderboard(limit);
        return NextResponse.json(leaderboard);
    } catch (error) {
        console.error('Leaderboard API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}
