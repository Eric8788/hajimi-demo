import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createOrUpdateHasdaqCompanyDraft, getHasdaqCompanyDetail } from '@/lib/hasdaq';
import { getUserById } from '@/lib/db';
import { canUseMemberInteractions, getInteractionBlockedMessage } from '@/lib/access';

export const dynamic = 'force-dynamic';

type RouteContext = {
    params: Promise<{ ticker: string }>;
};

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : '';
}

export async function GET(_request: Request, context: RouteContext) {
    try {
        const session = await getSession();
        const { ticker } = await context.params;
        const detail = await getHasdaqCompanyDetail(ticker, session?.userId ? Number(session.userId) : null);
        if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(detail, {
            headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
        });
    } catch (error) {
        console.error('GET /api/hasdaq/[ticker] error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const user = await getUserById(Number(session.userId));
        if (!user || !canUseMemberInteractions(user)) {
            return NextResponse.json({ error: getInteractionBlockedMessage(user, 'edit Hasdaq companies') }, { status: 403 });
        }

        const { ticker } = await context.params;
        const existing = await getHasdaqCompanyDetail(ticker, user.id);
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const body = await request.json().catch(() => ({}));
        const company = await createOrUpdateHasdaqCompanyDraft(user.id, {
            ...body,
            companyId: existing.company.id,
            ticker: body.ticker || ticker,
        });
        return NextResponse.json({ success: true, company });
    } catch (error) {
        const message = getErrorMessage(error);
        if (message === 'Company forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (message === 'Company is not editable') return NextResponse.json({ error: 'This company can no longer be edited as a draft.' }, { status: 409 });
        if (message === 'Ticker already exists') return NextResponse.json({ error: 'Ticker is already taken.' }, { status: 409 });

        console.error('PATCH /api/hasdaq/[ticker] error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
