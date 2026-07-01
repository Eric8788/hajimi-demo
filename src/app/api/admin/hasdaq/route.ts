import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
    bellHasdaqListing, getAdminHasdaqOverview, reviewHasdaqListingApplication, setHasdaqTradingStatus } from '@/lib/hasdaq';
import { getUserById } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
    const session = await getSession();
    if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

    const user = await getUserById(Number(session.userId));
    if (!user || !isAdminRole(user.role)) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { user };
}

function parsePositiveInteger(value: unknown) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : '';
}

export async function GET(request: Request) {
    try {
        const admin = await requireAdmin();
        if (admin.error) return admin.error;

        const { searchParams } = new URL(request.url);
        const statusParam = String(searchParams.get('status') || 'pending');
        const status = statusParam === 'approved' || statusParam === 'rejected' || statusParam === 'all'
            ? statusParam
            : 'pending';
        const overview = await getAdminHasdaqOverview(status);
        return NextResponse.json(overview, {
            headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
        });
    } catch (error) {
        console.error('GET /api/admin/hasdaq error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const admin = await requireAdmin();
        if (admin.error) return admin.error;

        const body = await request.json().catch(() => ({}));
        const action = String(body.action || '');
        const note = String(body.note || '').slice(0, 500);

        if (action === 'approve' || action === 'reject') {
            const applicationId = parsePositiveInteger(body.applicationId);
            if (!applicationId) return NextResponse.json({ error: 'Invalid applicationId' }, { status: 400 });
            await reviewHasdaqListingApplication(admin.user.id, applicationId, action, note);
            return NextResponse.json({ success: true });
        }

        if (action === 'bell') {
            const companyId = parsePositiveInteger(body.companyId);
            if (!companyId) return NextResponse.json({ error: 'Invalid companyId' }, { status: 400 });
            const company = await bellHasdaqListing(admin.user.id, companyId);
            return NextResponse.json({ success: true, company });
        }

        if (action === 'pause' || action === 'resume') {
            const companyId = parsePositiveInteger(body.companyId);
            if (!companyId) return NextResponse.json({ error: 'Invalid companyId' }, { status: 400 });
            const company = await setHasdaqTradingStatus(admin.user.id, companyId, action, note);
            return NextResponse.json({ success: true, company });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        const message = getErrorMessage(error);
        if (message === 'Listing application not found') return NextResponse.json({ error: 'Listing application not found or already reviewed.' }, { status: 404 });
        if (message === 'Company not found') return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        if (message === 'Company is not in IPO') return NextResponse.json({ error: 'Company must be in IPO before bell listing.' }, { status: 409 });
        if (message === 'Company has insufficient IPO subscribers') return NextResponse.json({ error: 'Company needs at least 5 IPO subscribers before bell listing.' }, { status: 409 });
        if (message === 'Company has insufficient IPO shares') return NextResponse.json({ error: 'Company needs at least 50 subscribed IPO shares before bell listing.' }, { status: 409 });
        if (message === 'Company status cannot be changed') return NextResponse.json({ error: 'Company status cannot be changed.' }, { status: 409 });
        if (message === 'Company has no founder') return NextResponse.json({ error: 'Company has no accepted founder.' }, { status: 409 });

        console.error('PATCH /api/admin/hasdaq error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
