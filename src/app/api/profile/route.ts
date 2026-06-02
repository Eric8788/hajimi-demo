import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateUserProfile } from '@/lib/db';
import { normalizeBadgePreferences } from '@/lib/badges';
import { clearServerCache } from '@/lib/serverCache';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const userId = Number(session.userId);
        const profileUpdates = {
            ...body,
            ...(Object.prototype.hasOwnProperty.call(body, 'badge_preferences')
                ? { badge_preferences: normalizeBadgePreferences(body.badge_preferences) }
                : {}),
        };

        await updateUserProfile(userId, profileUpdates);
        clearServerCache('avatars:');

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Profile Update Error", err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
