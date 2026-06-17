import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById, toggleProjectBookmark } from '@/lib/db';
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
        if (!projectId) {
            return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
        }

        const userId = Number(session.userId);
        const user = await getUserById(userId);
        if (!isVerifiedAccount(user)) {
            return NextResponse.json({ error: getInteractionBlockedMessage(user, '收藏项目') }, { status: 403 });
        }

        const bookmarked = await toggleProjectBookmark(userId, projectId);
        return NextResponse.json({ success: true, bookmarked }, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'Project not found') {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        if (message === 'Project is not live') {
            return NextResponse.json({ error: '项目上线后才可以收藏。' }, { status: 400 });
        }
        console.error('Project Bookmark Error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
