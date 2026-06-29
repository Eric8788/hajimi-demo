import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAdminCoinOverview, getUserById } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

function normalizeVerification(value: string | null) {
    if (value === 'pending' || value === 'verified' || value === 'rejected' || value === 'unverified') return value;
    return 'all';
}

function normalizeAccountStatus(value: string | null) {
    if (value === 'active' || value === 'disabled') return value;
    return 'all';
}

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const user = await getUserById(Number(session.userId));
        if (!user || !isAdminRole(user.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const overview = await getAdminCoinOverview({
            query: searchParams.get('query') || '',
            verification: normalizeVerification(searchParams.get('verification')),
            accountStatus: normalizeAccountStatus(searchParams.get('accountStatus')),
            limit: Number(searchParams.get('limit') || 80),
        });

        return NextResponse.json(overview, {
            headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
        });
    } catch (error) {
        console.error('GET /api/admin/coins error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
