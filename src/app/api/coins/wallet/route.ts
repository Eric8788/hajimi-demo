import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCoinWalletOverview } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const overview = await getCoinWalletOverview(Number(session.userId));
        return NextResponse.json(overview, {
            headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
        });
    } catch (error) {
        console.error('GET /api/coins/wallet error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
