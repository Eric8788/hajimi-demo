import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById, submitUserVerification } from '@/lib/db';
import { buildVerificationDraft } from '@/lib/verification';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const user = await getUserById(Number(session.userId));
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (user.verification_status === 'pending') {
            return NextResponse.json({ error: '认证正在审核中，请等待管理员处理。' }, { status: 409 });
        }

        if (user.verification_status === 'verified') {
            return NextResponse.json({ error: '账号已经完成认证。' }, { status: 409 });
        }

        const body = await request.json();
        const fallbackType = (user.role || '').toLowerCase() === 'teacher' ? 'teacher' : 'student';
        const result = await buildVerificationDraft(body, fallbackType);

        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        await submitUserVerification(user.id, result.draft);
        return NextResponse.json({ success: true, status: 'pending' });
    } catch (error) {
        console.error('Verification Submit Error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
