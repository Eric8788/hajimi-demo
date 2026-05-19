import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPendingVerificationRequests, getUserById, reviewUserVerification } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const reviewer = await getUserById(Number(session.userId));
        if (!reviewer || !isAdminRole(reviewer.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const requests = await getPendingVerificationRequests();
        return NextResponse.json(requests);
    } catch (error) {
        console.error('Admin Verifications GET Error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const reviewer = await getUserById(Number(session.userId));
        if (!reviewer || !isAdminRole(reviewer.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const targetUserId = Number(body.userId);
        const action = String(body.action || '');
        const note = String(body.note || '').slice(0, 240);

        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            return NextResponse.json({ error: 'Invalid user' }, { status: 400 });
        }

        if (action !== 'approve' && action !== 'reject') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        await reviewUserVerification(targetUserId, reviewer.id, action === 'approve' ? 'verified' : 'rejected', note);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error?.message === 'Student ID already verified') {
            return NextResponse.json({ error: '该学号已有认证主号，请先确认主号后再处理。' }, { status: 409 });
        }
        console.error('Admin Verifications POST Error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
