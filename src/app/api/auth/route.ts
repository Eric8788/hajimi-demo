import { NextResponse } from 'next/server';
import { getUser, createUser } from '@/lib/db';
import { createSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password, isRegister } = body;

        if (!username || !password) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const user = await getUser(username);

        if (isRegister) {
            if (user) {
                return NextResponse.json({ error: 'User already exists' }, { status: 409 });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            const userId = await createUser(username, hashedPassword);
            // Automatically log in
            await createSession(Number(userId));
            return NextResponse.json({ success: true });
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
