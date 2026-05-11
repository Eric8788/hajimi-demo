import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { doCheckIn, hasCheckedInToday } from '@/lib/db';

export async function POST() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = Number(session.userId);

        if (await hasCheckedInToday(userId)) {
            return NextResponse.json({ error: 'Already checked in today' }, { status: 400 });
        }

        const result = await doCheckIn(userId);
        if (result.success) {
            return NextResponse.json({ 
                success: true, 
                pointsAdded: result.pointsAdded,
                streak: result.streak 
            });
        } else {
            return NextResponse.json({ error: 'Failed to check in' }, { status: 500 });
        }
    } catch {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const checkedIn = await hasCheckedInToday(Number(session.userId));
        return NextResponse.json({ checkedIn });
    } catch {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
