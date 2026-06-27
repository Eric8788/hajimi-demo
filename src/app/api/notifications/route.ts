import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAdminAuditHistory, getAdminReviewSummary, getNotifications, getUnreadNotificationCount, getUserAccountRole, markNotificationsRead } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';

export async function GET(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const countOnly = searchParams.get('mode') === 'count';
        const userId = Number(session.userId);

        if (countOnly) {
            const unreadCount = await getUnreadNotificationCount(userId);
            return NextResponse.json({ unreadCount }, {
                headers: {
                    'Cache-Control': 'no-store, max-age=0, must-revalidate',
                },
            });
        }

        const [account, notifications, unreadCount] = await Promise.all([
            getUserAccountRole(userId),
            getNotifications(userId),
            getUnreadNotificationCount(userId),
        ]);
        const isAdmin = account && account.account_status !== 'disabled' && isAdminRole(account.role);
        const [reviewSummary, reviewHistory] = isAdmin
            ? await Promise.all([
                getAdminReviewSummary(),
                getAdminAuditHistory('all', 8),
            ])
            : [null, []];

        return NextResponse.json({ notifications, unreadCount, reviewSummary, reviewHistory }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0, must-revalidate',
            },
        });
    } catch (error) {
        console.error('GET /api/notifications error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function PATCH() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await markNotificationsRead(Number(session.userId));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PATCH /api/notifications error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
