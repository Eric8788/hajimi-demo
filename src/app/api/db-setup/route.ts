import { NextResponse } from 'next/server';
import { initDB } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';

export async function GET(request: Request) {
    const setupToken = process.env.HAJIMI_DB_SETUP_TOKEN?.trim();
    const providedToken = request.headers.get('x-hajimi-db-setup-token')?.trim();
    const session = await getSession();
    const user = session ? await getUserById(Number(session.userId)) : null;
    if (!((setupToken && providedToken && setupToken === providedToken) || isAdminRole(user?.role))) {
        return NextResponse.json({ error: 'Database setup requires administrator access.' }, { status: 403 });
    }

    console.log('Checking POSTGRES_URL...', !!process.env.POSTGRES_URL);
    try {
        await initDB();
        return NextResponse.json({ success: true, message: 'Database initialized successfully' });
    } catch (err) {
        console.error('Database initialization failed:', err);
        return NextResponse.json({ error: 'Database initialization failed', details: String(err) }, { status: 500 });
    }
}
