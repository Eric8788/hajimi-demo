import { NextResponse } from 'next/server';
import { getUser, createUser } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { isRegistrationConfigured, resolveInviteRole } from '@/lib/inviteCodes';
import { isStrongPassword, PASSWORD_REQUIREMENT_MESSAGE } from '@/lib/passwordPolicy';
import { normalizeUsernameInput, validateUsername, USERNAME_REQUIREMENT_MESSAGE } from '@/lib/accountValidation';
import { buildVerificationDraft } from '@/lib/verification';
import { normalizeAvatarEmoji, normalizeAvatarThemeId } from '@/lib/avatarThemes';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const username = normalizeUsernameInput(body.username);
        const { password, isRegister, inviteCode } = body;

        if (!username || !password) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        if (isRegister && !validateUsername(username)) {
            return NextResponse.json({ error: USERNAME_REQUIREMENT_MESSAGE }, { status: 400 });
        }

        if (isRegister && body.confirmPassword !== password) {
            return NextResponse.json({ error: '两次输入的密码不一致。' }, { status: 400 });
        }

        if (isRegister && !isStrongPassword(password)) {
            return NextResponse.json({ error: PASSWORD_REQUIREMENT_MESSAGE }, { status: 400 });
        }

        const user = await getUser(username);

        if (isRegister) {
            if (user) {
                return NextResponse.json({ error: 'User already exists' }, { status: 409 });
            }

            if (!isRegistrationConfigured()) {
                return NextResponse.json({ error: 'Registration is not open yet. Ask a teacher to configure invite codes.' }, { status: 503 });
            }

            const inviteRole = resolveInviteRole(inviteCode);
            if (!inviteRole) {
                return NextResponse.json({ error: 'Invalid invite code' }, { status: 403 });
            }

            const shouldSubmitVerification = Boolean(body.verification?.enabled);
            const verificationResult = shouldSubmitVerification
                ? await buildVerificationDraft(inviteRole, body.verification)
                : null;

            if (verificationResult && !verificationResult.ok) {
                return NextResponse.json({ error: verificationResult.error }, { status: 400 });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const avatarSelection = {
                emoji: normalizeAvatarEmoji(body.avatar?.emoji),
                theme: normalizeAvatarThemeId(body.avatar?.theme),
            };
            const userId = await createUser(
                username,
                hashedPassword,
                inviteRole,
                verificationResult?.ok ? verificationResult.draft : null,
                avatarSelection,
                { bio: body.bio },
            );
            // Automatically log in
            await createSession(Number(userId));
            return NextResponse.json({ success: true, role: inviteRole });
        } else {
            // Login
            if (!user || !user.password_hash) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }
            const isValid = await bcrypt.compare(password, user.password_hash);
            if (!isValid) {
                return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
            }
            await createSession(user.id);
            return NextResponse.json({ success: true });
        }
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
