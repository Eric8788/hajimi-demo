import { NextResponse } from 'next/server';
import { getPublicAvatars } from '@/lib/db';
import { cachedServerValue } from '@/lib/serverCache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const ids = (searchParams.get('ids') || '')
            .split(',')
            .map(value => Number(value))
            .filter(value => Number.isFinite(value) && value > 0)
            .slice(0, 80);

        const uniqueIds = Array.from(new Set(ids)).sort((a, b) => a - b);
        if (uniqueIds.length === 0) {
            return NextResponse.json([]);
        }

        const avatars = await cachedServerValue(
            `avatars:${uniqueIds.join(',')}`,
            120_000,
            () => getPublicAvatars(uniqueIds),
        );

        return NextResponse.json(avatars, {
            headers: {
                'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
            },
        });
    } catch (error) {
        console.error('Avatars API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch avatars' }, { status: 500 });
    }
}
