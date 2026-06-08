import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById, reviewCoinRedemptionRequest } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

function parsePositiveInteger(value: unknown) {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeAction(value: unknown) {
    if (value === 'approve' || value === 'reject' || value === 'complete') return value;
    return null;
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = await getUserById(Number(session.userId));
        if (!admin || !isAdminRole(admin.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const requestId = parsePositiveInteger(body?.requestId);
        const action = normalizeAction(body?.action);
        const reviewNote = String(body?.reviewNote || '').trim();

        if (!requestId) return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
        if (!action) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

        const redemption = await reviewCoinRedemptionRequest(Number(admin.id), requestId, action, reviewNote);
        return NextResponse.json({ success: true, redemption }, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'Redemption request not found') {
            return NextResponse.json({ error: '兑换申请不存在。' }, { status: 404 });
        }
        if (
            message === 'Redemption request is not pending'
            || message === 'Redemption request cannot be rejected'
            || message === 'Redemption request is not approved'
        ) {
            return NextResponse.json({ error: '当前兑换状态不能执行这个操作。' }, { status: 409 });
        }
        console.error('POST /api/admin/coins/redemptions error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
