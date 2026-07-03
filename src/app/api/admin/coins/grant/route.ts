import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById, grantCoinsByAdmin, grantCoinsToUsersByAdmin } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

const ALLOWED_SOURCES = new Set([
    'manual',
    'verification_airdrop',
    'project_publish_reward',
    'version_publish_reward',
    'monthly_award',
    'teacher_bounty',
    'content_award',
]);

function parsePositiveInteger(value: unknown) {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseTargetUserIds(value: unknown) {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(
        value
            .map(parsePositiveInteger)
            .filter((id): id is number => Boolean(id)),
    ));
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
        const targetUserId = parsePositiveInteger(body?.targetUserId);
        const targetUserIds = parseTargetUserIds(body?.targetUserIds);
        const amount = parsePositiveInteger(body?.amount);
        const note = String(body?.note || '').trim();
        const sourceType = ALLOWED_SOURCES.has(String(body?.sourceType || ''))
            ? String(body?.sourceType)
            : 'manual';

        if (!targetUserId && targetUserIds.length === 0) return NextResponse.json({ error: '请选择要发放 H币的成员。' }, { status: 400 });
        if (targetUserIds.length > 120) return NextResponse.json({ error: '单次批量发放最多选择 120 位成员。' }, { status: 400 });
        if (!amount || amount > 10000) return NextResponse.json({ error: '发放数量需要是 1-10000 的整数。' }, { status: 400 });
        if (note.length < 2) return NextResponse.json({ error: '管理员发币必须填写备注。' }, { status: 400 });

        if (targetUserIds.length > 0) {
            const result = await grantCoinsToUsersByAdmin({
                adminId: Number(admin.id),
                targetUserIds,
                amount,
                sourceType,
                note,
            });

            return NextResponse.json({ success: true, batch: true, ...result }, {
                headers: { 'Cache-Control': 'no-store' },
            });
        }

        if (!targetUserId) return NextResponse.json({ error: '请选择要发放 H币的成员。' }, { status: 400 });

        const result = await grantCoinsByAdmin({
            adminId: Number(admin.id),
            targetUserId,
            amount,
            sourceType,
            note,
        });

        return NextResponse.json({ success: true, ...result }, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'Target user not found') {
            return NextResponse.json({ error: '成员不存在。' }, { status: 404 });
        }
        if (message === 'Target user is not coin grant eligible') {
            return NextResponse.json({ error: '不能向已停用或系统演示账号发放 H币。' }, { status: 400 });
        }
        if (message === 'No target users selected') {
            return NextResponse.json({ error: '请选择要发放 H币的成员。' }, { status: 400 });
        }
        if (message === 'Too many target users') {
            return NextResponse.json({ error: '单次批量发放最多选择 120 位成员。' }, { status: 400 });
        }
        if (message === 'Invalid coin amount') {
            return NextResponse.json({ error: '发放数量需要是 1-10000 的整数。' }, { status: 400 });
        }
        if (message === 'Invalid verification airdrop amount') {
            return NextResponse.json({ error: '认证空投固定为 20 H币；如需其他金额，请选择其他发放来源。' }, { status: 400 });
        }
        if (message === 'Coin grant note required') {
            return NextResponse.json({ error: '管理员发币必须填写备注。' }, { status: 400 });
        }
        if (message === 'Verification airdrop already granted') {
            return NextResponse.json({ error: '认证空投已经发放过；为避免重复空投，请改用其他来源或先核对流水。' }, { status: 409 });
        }
        console.error('POST /api/admin/coins/grant error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
