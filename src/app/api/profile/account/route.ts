import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { updateUserAuth } from '@/lib/db';
import { isStrongPassword, PASSWORD_REQUIREMENT_MESSAGE } from '@/lib/passwordPolicy';
import { normalizeUsernameInput, validateUsername, USERNAME_REQUIREMENT_MESSAGE } from '@/lib/accountValidation';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { username, password, confirmPassword } = await request.json();
        const userId = Number(session.userId);
        const updates: { username?: string; passwordHash?: string } = {};
        const normalizedUsername = username ? normalizeUsernameInput(username) : '';

        if (normalizedUsername) {
            if (!validateUsername(normalizedUsername)) {
                return NextResponse.json({ error: USERNAME_REQUIREMENT_MESSAGE }, { status: 400 });
            }
            updates.username = normalizedUsername;
        }

        if (password) {
            if (confirmPassword !== password) {
                return NextResponse.json({ error: '两次输入的密码不一致。' }, { status: 400 });
            }
            if (!isStrongPassword(password)) {
                return NextResponse.json({ error: PASSWORD_REQUIREMENT_MESSAGE }, { status: 400 });
            }
            updates.passwordHash = await bcrypt.hash(password, 10);
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
        }

        await updateUserAuth(userId, updates);
        return NextResponse.json({ success: true });
    } catch (err: any) {
        if (err.message === 'Username already taken') {
            return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
        }
        console.error("Account Update Error", err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
