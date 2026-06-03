import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getProjectBookmarkIds, getUserById } from '@/lib/db';
import { isVerifiedAccount } from '@/lib/verification';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ projectIds: [] }, {
                headers: { 'Cache-Control': 'no-store' },
            });
        }

        const userId = Number(session.userId);
        const user = await getUserById(userId);
        if (!isVerifiedAccount(user)) {
            return NextResponse.json({ projectIds: [] }, {
                headers: { 'Cache-Control': 'no-store' },
            });
        }

        const projectIds = await getProjectBookmarkIds(userId);
        return NextResponse.json({ projectIds }, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        console.error('Project Bookmarks Error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
