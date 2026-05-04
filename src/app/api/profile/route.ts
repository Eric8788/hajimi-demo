import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateUserProfile } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const userId = Number(session.userId);

        await updateUserProfile(userId, body);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Profile Update Error", err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
