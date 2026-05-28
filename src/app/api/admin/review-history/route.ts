import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAdminAuditHistory, getUserById } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';

function normalizeType(value: string | null) {
    if (value === 'verification' || value === 'project' || value === 'user') return value;
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
        const type = normalizeType(searchParams.get('type'));
        const limit = Number(searchParams.get('limit') || 40);
        const events = await getAdminAuditHistory(type, limit);

        return NextResponse.json({ events }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0, must-revalidate',
            },
        });
    } catch (error) {
        console.error('GET /api/admin/review-history error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
