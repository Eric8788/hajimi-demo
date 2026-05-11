import { NextResponse } from 'next/server';
import { getSession, logout } from '@/lib/auth';
import { deleteUser } from '@/lib/db';

export async function POST() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userId = Number(session.userId);
        await deleteUser(userId);
        await logout(); // Clears session cookie

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Account Deletion Error", err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
