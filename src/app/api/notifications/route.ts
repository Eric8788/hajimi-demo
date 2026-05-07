import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getNotifications, getUnreadNotificationCount, markNotificationsRead } from '@/lib/db';

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    try {
        const userId = Number(session.userId);
        const [notifications, unreadCount] = await Promise.all([
            getNotifications(userId),
            getUnreadNotificationCount(userId),
        ]);

        return NextResponse.json({ notifications, unreadCount }, {
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
