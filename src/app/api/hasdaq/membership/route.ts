import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { respondToHasdaqMembership } from '@/lib/hasdaq';
import { getUserById } from '@/lib/db';
import { canUseMemberInteractions, getInteractionBlockedMessage } from '@/lib/access';

export const dynamic = 'force-dynamic';

function parsePositiveInteger(value: unknown) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : '';
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const user = await getUserById(Number(session.userId));
        if (!user || !canUseMemberInteractions(user)) {
            return NextResponse.json({ error: getInteractionBlockedMessage(user, 'respond to Hasdaq membership invites') }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const companyId = parsePositiveInteger(body.companyId);
        const action = body.action === 'decline' ? 'decline' : body.action === 'accept' ? 'accept' : null;
        if (!companyId) return NextResponse.json({ error: 'Invalid companyId' }, { status: 400 });
        if (!action) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

        const membership = await respondToHasdaqMembership(user.id, companyId, action);
        return NextResponse.json({ success: true, membership });
    } catch (error) {
        const message = getErrorMessage(error);
        if (message === 'Membership invite not found') {
            return NextResponse.json({ error: 'Membership invite not found.' }, { status: 404 });
        }
        console.error('POST /api/hasdaq/membership error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
