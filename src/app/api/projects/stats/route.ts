import { NextResponse } from 'next/server';
import { getProjectOpenStats } from '@/lib/db';
import { cachedServerValue } from '@/lib/serverCache';

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
        const startDate = parseLocalDate(searchParams.get('start'));
        const endDate = parseLocalDate(searchParams.get('end'));
        const range = startDate !== null && endDate !== null && startDate <= endDate
            ? { startDate, endDate }
            : undefined;
        const cacheKey = range
            ? `projects:stats:${range.startDate}:${range.endDate}`
            : 'projects:stats';
        const stats = await cachedServerValue(
            cacheKey,
            60_000,
            () => getProjectOpenStats(range),
        );
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
