import { NextResponse } from 'next/server';
import { getUser, createUser } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { isStrongPassword, PASSWORD_REQUIREMENT_MESSAGE } from '@/lib/passwordPolicy';
import { normalizeUsernameInput, validateUsername, USERNAME_REQUIREMENT_MESSAGE } from '@/lib/accountValidation';
import { buildVerificationDraft } from '@/lib/verification';
import { normalizeAvatarEmoji, normalizeAvatarThemeId } from '@/lib/avatarThemes';
import { normalizeUserRole } from '@/lib/access';
import bcrypt from 'bcryptjs';

type RegistrationRole = 'student' | 'teacher' | 'parent' | 'visitor';

function normalizeRegistrationRole(value: unknown): RegistrationRole {
    const role = normalizeUserRole(String(value || 'student'));
    if (role === 'teacher' || role === 'parent' || role === 'visitor') return role;
    return 'student';
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const username = normalizeUsernameInput(body.username);
        const { password, isRegister } = body;

        if (!username || !password) {
            return NextResponse.json({ error: '请填写用户名和密码。' }, { status: 400 });
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
                return NextResponse.json({ error: '这个用户名已经被使用。' }, { status: 409 });
            }

            const registrationRole = normalizeRegistrationRole(body.role);
            const requiresVerification = registrationRole === 'student' || registrationRole === 'teacher';
            const storedRole = registrationRole === 'parent' || registrationRole === 'visitor' ? registrationRole : 'student';
            const verificationResult = requiresVerification
                ? await buildVerificationDraft(
                    {
                        ...body.verification,
                        type: registrationRole === 'teacher' ? 'teacher' : 'student',
                    },
                    registrationRole === 'teacher' ? 'teacher' : 'student',
                )
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
                storedRole,
                verificationResult?.ok ? verificationResult.draft : null,
                avatarSelection,
                { bio: body.bio },
            );
            // Automatically log in
            await createSession(Number(userId));
            return NextResponse.json({ success: true, role: registrationRole });
        } else {
            // Login
            if (!user || !user.password_hash) {
                return NextResponse.json({ error: '没有找到这个账号。' }, { status: 404 });
            }
            if (user.account_status === 'disabled') {
                return NextResponse.json({ error: '该账号已被管理员停用，请联系 AI Club 管理员。' }, { status: 403 });
            }
            const isValid = await bcrypt.compare(password, user.password_hash);
            if (!isValid) {
                return NextResponse.json({ error: '密码不正确。' }, { status: 401 });
            }
            await createSession(user.id);
            return NextResponse.json({ success: true, role: user.role });
        }
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: '服务器暂时无法处理，请稍后再试。' }, { status: 500 });
    }
}
