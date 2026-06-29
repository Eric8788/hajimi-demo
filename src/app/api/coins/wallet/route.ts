import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCoinWalletBalance, getCoinWalletOverview } from '@/lib/db';
import { getRequestLogContext, logApiError } from '@/lib/apiLog';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const balanceOnly = searchParams.get('mode') === 'balance';
        const overview = balanceOnly
            ? { wallet: await getCoinWalletBalance(Number(session.userId)) }
            : await getCoinWalletOverview(Number(session.userId));

        return NextResponse.json(overview, {
            headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
        });
    } catch (error) {
        logApiError('/api/coins/wallet', error, getRequestLogContext(request));
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
