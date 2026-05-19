import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

const SECRET_KEY = new TextEncoder().encode(
    'h4jimi-sup3r-s3cr3t-k3y-d0nt-sh4r3' // In prod, use environment variable
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
