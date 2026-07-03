import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createCoinRedemptionRequest, getUserById } from '@/lib/db';
import { isVerifiedAccount } from '@/lib/verification';
import { getInteractionBlockedMessage } from '@/lib/access';
import {
    COIN_REDEMPTION_BASE_MONTHLY_LIMIT,
    COIN_REDEMPTION_MAX_AMOUNT,
    COIN_REDEMPTION_MIN_AMOUNT,
    validateCoinRedemptionRequest,
} from '@/lib/coinRules';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userId = Number(session.userId);
        const user = await getUserById(userId);
        if (!isVerifiedAccount(user)) {
            return NextResponse.json({ error: getInteractionBlockedMessage(user, '申请兑换 token') }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const validation = validateCoinRedemptionRequest(body?.amount, body?.requestedNote);
        if (!validation.ok && validation.reason === 'invalid_amount') {
            return NextResponse.json({ error: `兑换申请最低 ${COIN_REDEMPTION_MIN_AMOUNT} H币，最高 ${COIN_REDEMPTION_MAX_AMOUNT} H币。` }, { status: 400 });
        }
        if (!validation.ok && validation.reason === 'missing_additional_note') {
            return NextResponse.json({ error: `超过每人每月基础 ${COIN_REDEMPTION_BASE_MONTHLY_LIMIT} H币的追加申请必须填写用途说明。` }, { status: 400 });
        }
        if (!validation.ok) return NextResponse.json({ error: 'Invalid redemption request' }, { status: 400 });

        const result = await createCoinRedemptionRequest(userId, validation.amount, validation.note);
        return NextResponse.json({ success: true, ...result }, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'Invalid redemption amount') {
            return NextResponse.json({ error: `兑换申请最低 ${COIN_REDEMPTION_MIN_AMOUNT} H币，最高 ${COIN_REDEMPTION_MAX_AMOUNT} H币。` }, { status: 400 });
        }
        if (message === 'Additional redemption note required') {
            return NextResponse.json({ error: `超过每人每月基础 ${COIN_REDEMPTION_BASE_MONTHLY_LIMIT} H币的追加申请必须填写用途说明。` }, { status: 400 });
        }
        if (message === 'Insufficient coins') {
            return NextResponse.json({ error: 'H币余额不足，无法冻结兑换额度。' }, { status: 409 });
        }
        console.error('POST /api/coins/redemptions error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
