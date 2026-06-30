import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createHasdaqAnnouncement, getHasdaqCompanyDetail } from '@/lib/hasdaq';
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
            return NextResponse.json({ error: getInteractionBlockedMessage(user, 'publish Hasdaq announcements') }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        let companyId = parsePositiveInteger(body.companyId);
        if (!companyId && body.ticker) {
            const detail = await getHasdaqCompanyDetail(String(body.ticker), user.id);
            companyId = detail?.company?.id ? Number(detail.company.id) : null;
        }
        if (!companyId) return NextResponse.json({ error: 'Invalid companyId' }, { status: 400 });

        const announcement = await createHasdaqAnnouncement(user.id, companyId, body);
        return NextResponse.json({ success: true, announcement });
    } catch (error) {
        const message = getErrorMessage(error);
        if (message === 'Company forbidden') return NextResponse.json({ error: 'Only accepted company members can publish announcements.' }, { status: 403 });
        if (message === 'Invalid announcement title') return NextResponse.json({ error: 'Announcement title is too short.' }, { status: 400 });
        if (message === 'Invalid announcement body') return NextResponse.json({ error: 'Announcement body is too short.' }, { status: 400 });

        console.error('POST /api/hasdaq/announcements error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
