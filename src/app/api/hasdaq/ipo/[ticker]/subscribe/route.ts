import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getHasdaqCompanyDetail, subscribeHasdaqIpo } from '@/lib/hasdaq';
import { getUserById } from '@/lib/db';
import { canUseMemberInteractions, getInteractionBlockedMessage } from '@/lib/access';

export const dynamic = 'force-dynamic';

type RouteContext = {
    params: Promise<{ ticker: string }>;
};

function parsePositiveInteger(value: unknown) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : '';
}

export async function POST(request: Request, context: RouteContext) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const user = await getUserById(Number(session.userId));
        if (!user || !canUseMemberInteractions(user)) {
            return NextResponse.json({ error: getInteractionBlockedMessage(user, 'subscribe to Hasdaq IPO shares') }, { status: 403 });
        }

        const { ticker } = await context.params;
        const body = await request.json().catch(() => ({}));
        const detail = await getHasdaqCompanyDetail(ticker, user.id);
        const companyId = detail?.company?.id ? Number(detail.company.id) : null;
        const shares = parsePositiveInteger(body.shares);
        if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        if (!shares) return NextResponse.json({ error: 'Invalid shares' }, { status: 400 });

        const result = await subscribeHasdaqIpo(user.id, companyId, shares);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        const message = getErrorMessage(error);
        if (message === 'Invalid IPO shares') return NextResponse.json({ error: 'IPO subscriptions are limited to 1-20 shares per order.' }, { status: 400 });
        if (message === 'Company not found') return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        if (message === 'Company is not in IPO') return NextResponse.json({ error: 'This company is not in IPO subscription.' }, { status: 409 });
        if (message === 'Not enough public shares') return NextResponse.json({ error: 'Not enough IPO shares remain.' }, { status: 409 });
        if (message === 'Position limit reached') return NextResponse.json({ error: '单只股票最多持有 60 股。' }, { status: 409 });
        if (message === 'Insufficient coins') return NextResponse.json({ error: 'Insufficient H coins.' }, { status: 409 });

        console.error('POST /api/hasdaq/ipo/[ticker]/subscribe error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
