import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { executeHasdaqTrade, getHasdaqCompanyDetail } from '@/lib/hasdaq';
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

const tradeErrorMessages: Record<string, string> = {
    'Not enough public shares': '交易池股份不足。',
    'Company pool has insufficient liquidity': '交易池 H币不足，暂时无法卖出。',
    'Position limit reached': '已达到单只股票持仓上限。',
    'Invalid buy shares': '买入股数不合法。',
    'Invalid sell shares': '卖出股数不合法。',
    'Daily trade limit reached': '今日交易次数已达上限。',
    'Daily price limit reached': '今日涨跌幅已达限制。',
    'Trading is paused': '该股票已暂停交易。',
};

function localizeTradeError(message: string) {
    return tradeErrorMessages[message] || message;
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const user = await getUserById(Number(session.userId));
        if (!user || !canUseMemberInteractions(user)) {
            return NextResponse.json({ error: getInteractionBlockedMessage(user, 'trade Hasdaq shares') }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        let companyId = parsePositiveInteger(body.companyId);
        if (!companyId && body.ticker) {
            const detail = await getHasdaqCompanyDetail(String(body.ticker), user.id);
            companyId = detail?.company?.id ? Number(detail.company.id) : null;
        }
        const side = body.side === 'sell' || body.type === 'sell' ? 'sell' : body.side === 'buy' || body.type === 'buy' ? 'buy' : null;
        const value = parsePositiveInteger(body.shares ?? body.amount ?? body.value);
        if (!companyId) return NextResponse.json({ error: 'Invalid companyId' }, { status: 400 });
        if (!side) return NextResponse.json({ error: 'Invalid trade side' }, { status: 400 });
        if (!value) return NextResponse.json({ error: 'Invalid trade value' }, { status: 400 });

        const result = await executeHasdaqTrade(user.id, companyId, side, value);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        const message = getErrorMessage(error);
        const status409 = new Set([
            'Company is not listed',
            'Trading is paused',
            'Not enough public shares',
            'Position limit reached',
            'Daily trade limit reached',
            'Daily price limit reached',
            'Not enough shares',
            'Founder shares are locked',
            'Company pool has insufficient liquidity',
            'Insufficient coins',
            'Founder sell limit reached',
        ]);
        const status400 = new Set(['Invalid buy shares', 'Invalid buy amount', 'Buy amount too small', 'Invalid sell shares', 'Sell proceeds too small']);

        if (message === 'Company not found') return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        if (status400.has(message)) return NextResponse.json({ error: localizeTradeError(message) }, { status: 400 });
        if (status409.has(message)) return NextResponse.json({ error: localizeTradeError(message) }, { status: 409 });

        console.error('POST /api/hasdaq/trade error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
