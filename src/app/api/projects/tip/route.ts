import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById, tipProject } from '@/lib/db';
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
            return NextResponse.json({ error: '完成 Hajimi 认证后可以打赏项目。' }, { status: 403 });
        }

        const result = await tipProject(userId, projectId, amount);
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
        if (message === 'Insufficient points') {
            return NextResponse.json({ error: '积分余额不足，先去签到、评论或发布内容赚 XP。' }, { status: 409 });
        }
        console.error('Project Tip Error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
