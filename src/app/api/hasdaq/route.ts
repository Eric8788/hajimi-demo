import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createOrUpdateHasdaqCompanyDraft, getHasdaqOverview } from '@/lib/hasdaq';
import { getUserById } from '@/lib/db';
import { canUseMemberInteractions, getInteractionBlockedMessage } from '@/lib/access';

export const dynamic = 'force-dynamic';

async function requireHasdaqMember() {
    const session = await getSession();
    if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

    const user = await getUserById(Number(session.userId));
    if (!user || !canUseMemberInteractions(user)) {
        return { error: NextResponse.json({ error: getInteractionBlockedMessage(user, 'use Hasdaq') }, { status: 403 }) };
    }

    return { user };
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : '';
}

export async function GET() {
    try {
        const session = await getSession();
        const overview = await getHasdaqOverview(session?.userId ? Number(session.userId) : null);
        return NextResponse.json(overview, {
            headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
        });
    } catch (error) {
        console.error('GET /api/hasdaq error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const member = await requireHasdaqMember();
        if (member.error) return member.error;

        const body = await request.json().catch(() => ({}));
        const company = await createOrUpdateHasdaqCompanyDraft(member.user.id, body);
        return NextResponse.json({ success: true, company });
    } catch (error) {
        const message = getErrorMessage(error);
        if (message === 'Invalid company name') return NextResponse.json({ error: 'Company name is too short.' }, { status: 400 });
        if (message === 'Invalid ticker') return NextResponse.json({ error: 'Ticker must be 3-8 uppercase letters or numbers.' }, { status: 400 });
        if (message === 'Invalid company summary') return NextResponse.json({ error: 'Company summary is too short.' }, { status: 400 });
        if (message === 'Ticker already exists') return NextResponse.json({ error: 'Ticker is already taken.' }, { status: 409 });
        if (message === 'Founder company limit reached') return NextResponse.json({ error: 'Each verified member can found only one active Hasdaq company.' }, { status: 409 });
        if (message === 'Company forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (message === 'Company is not editable') return NextResponse.json({ error: 'This company can no longer be edited as a draft.' }, { status: 409 });

        console.error('POST /api/hasdaq error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    return POST(request);
}
