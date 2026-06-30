import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { submitHasdaqListingApplication } from '@/lib/hasdaq';
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
            return NextResponse.json({ error: getInteractionBlockedMessage(user, 'submit Hasdaq listing applications') }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const companyId = parsePositiveInteger(body.companyId);
        if (!companyId) return NextResponse.json({ error: 'Invalid companyId' }, { status: 400 });

        const application = await submitHasdaqListingApplication(user.id, companyId, body);
        return NextResponse.json({ success: true, application });
    } catch (error) {
        const message = getErrorMessage(error);
        if (message === 'Company not found') return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        if (message === 'Company forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (message === 'Company is not editable') return NextResponse.json({ error: 'Only draft or rejected companies can submit listing applications.' }, { status: 409 });
        if (message === 'Listing requires a mature product') return NextResponse.json({ error: 'A company needs at least one mature product before IPO review.' }, { status: 400 });
        if (message === 'Members not accepted') return NextResponse.json({ error: 'All invited members need to accept before IPO review.' }, { status: 409 });
        if (message === 'Invalid listing reason') return NextResponse.json({ error: 'Listing reason is too short.' }, { status: 400 });
        if (message === 'Invalid risk statement') return NextResponse.json({ error: 'Risk statement is too short.' }, { status: 400 });

        console.error('POST /api/hasdaq/listing-applications error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
