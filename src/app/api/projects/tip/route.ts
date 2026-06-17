import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById, transferProjectCoinTip } from '@/lib/db';
import { isVerifiedAccount } from '@/lib/verification';
import { getInteractionBlockedMessage } from '@/lib/access';

export const dynamic = 'force-dynamic';

function parsePositiveInteger(value: unknown) {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json().catch(() => null);
        const projectId = parsePositiveInteger(body?.projectId);
        const amount = parsePositiveInteger(body?.amount);
        if (!projectId) {
            return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
        }
        if (!amount || amount > 100) {
            return NextResponse.json({ error: '打赏金额需要是 1-100 的整数。' }, { status: 400 });
        }

        const userId = Number(session.userId);
        const user = await getUserById(userId);
        if (!isVerifiedAccount(user)) {
            return NextResponse.json({ error: getInteractionBlockedMessage(user, '打赏项目') }, { status: 403 });
        }

        const result = await transferProjectCoinTip(userId, projectId, amount);
        return NextResponse.json({ success: true, ...result }, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'Invalid tip amount') {
            return NextResponse.json({ error: '打赏金额需要是 1-100 的整数。' }, { status: 400 });
        }
        if (message === 'Project not found') {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        if (message === 'Project is not live') {
            return NextResponse.json({ error: '项目上线后才可以打赏。' }, { status: 400 });
        }
        if (message === 'Cannot tip your own project') {
            return NextResponse.json({ error: '不能给自己的项目打赏。' }, { status: 400 });
        }
        if (message === 'Insufficient coins') {
            return NextResponse.json({ error: 'H币余额不足。可以通过项目发布、精品内容、老师悬赏或管理员发放获得 H币。' }, { status: 409 });
        }
        console.error('Project Tip Error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
