import { NextResponse } from 'next/server';
import { getProjectOpenStats } from '@/lib/db';
import { cachedServerValue } from '@/lib/serverCache';

export async function GET() {
    try {
        const stats = await cachedServerValue('projects:stats', 60_000, getProjectOpenStats);
        return NextResponse.json(stats, {
            headers: {
                'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120',
            },
        });
    } catch (err) {
        console.error('Fetch Project Stats Error', err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
