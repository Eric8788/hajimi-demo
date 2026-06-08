import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createCoinRedemptionRequest, getUserById } from '@/lib/db';
import { isVerifiedAccount } from '@/lib/verification';

export const dynamic = 'force-dynamic';

function parsePositiveInteger(value: unknown) {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userId = Number(session.userId);
        const user = await getUserById(userId);
        if (!isVerifiedAccount(user)) {
            return NextResponse.json({ error: '完成 Hajimi 认证后可以申请兑换 token。' }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const amount = parsePositiveInteger(body?.amount);
        const note = String(body?.requestedNote || '').trim();
        if (!amount || amount < 50 || amount > 10000) {
            return NextResponse.json({ error: '兑换申请最低 50 H币，最高 10000 H币。' }, { status: 400 });
        }

        const result = await createCoinRedemptionRequest(userId, amount, note);
        return NextResponse.json({ success: true, ...result }, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'Invalid redemption amount') {
            return NextResponse.json({ error: '兑换申请最低 50 H币。' }, { status: 400 });
        }
        if (message === 'Insufficient coins') {
            return NextResponse.json({ error: 'H币余额不足，无法冻结兑换额度。' }, { status: 409 });
        }
        console.error('POST /api/coins/redemptions error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
