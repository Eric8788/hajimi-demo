import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { getCachedSessionActiveStatus } from './serverSessionCache';

const configuredSecret = process.env.HAJIMI_SESSION_SECRET?.trim();
const SECRET_KEY = new TextEncoder().encode(
    configuredSecret || (process.env.NODE_ENV === 'production' ? '' : 'local-development-only-session-secret')
);

export type SessionPayload = JWTPayload & {
    userId: number;
};

export async function createSession(userId: number) {
    const token = await new SignJWT({ userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('1d')
        .sign(SECRET_KEY);

    const cookieStore = await cookies();
    cookieStore.set('session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24, // 1 day
        path: '/',
    });
}

export async function getSession(): Promise<SessionPayload | null> {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return null;

    try {
        const { payload } = await jwtVerify(session, SECRET_KEY);
        if (typeof payload.userId !== 'number') {
            return null;
        }
        if (!(await getCachedSessionActiveStatus(payload.userId))) {
            return null;
        }
        return {
            ...payload,
            userId: payload.userId,
        };
    } catch {
        return null;
    }
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.delete('session');
}
