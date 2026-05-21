import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { trackProjectOpen } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null);
        const projectId = Number(body?.projectId);

        if (!Number.isInteger(projectId) || projectId <= 0) {
            return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
        }

        const session = await getSession();
        const recorded = await trackProjectOpen(projectId, session ? Number(session.userId) : null);

        if (!recorded) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Project Open Error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
