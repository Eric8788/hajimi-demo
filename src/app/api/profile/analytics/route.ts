import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getProfileAnalytics } from '@/lib/db';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const analytics = await getProfileAnalytics(Number(session.userId));
        return NextResponse.json(analytics, {
            headers: {
                'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
            },
        });
    } catch (error) {
        console.error('Profile analytics API error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
