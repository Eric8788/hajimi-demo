import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAdminUserDetail, getUserById, updateAdminUserIdentity } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';

type RouteContext = {
    params: Promise<{ id: string }>;
};

async function requireAdmin() {
    const session = await getSession();
    if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

    const user = await getUserById(Number(session.userId));
    if (!user || !isAdminRole(user.role)) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { user };
}

export async function GET(_request: Request, context: RouteContext) {
    try {
        const admin = await requireAdmin();
        if (admin.error) return admin.error;

        const { id } = await context.params;
        const userId = Number(id);
        if (!Number.isInteger(userId) || userId <= 0) {
            return NextResponse.json({ error: 'Invalid user' }, { status: 400 });
        }

        const user = await getAdminUserDetail(userId);
        if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        return NextResponse.json({ user }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0, must-revalidate',
            },
        });
    } catch (error) {
        console.error('GET /api/admin/users/[id] error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const admin = await requireAdmin();
        if (admin.error) return admin.error;

        const { id } = await context.params;
        const userId = Number(id);
        if (!Number.isInteger(userId) || userId <= 0) {
            return NextResponse.json({ error: 'Invalid user' }, { status: 400 });
        }

        const body = await request.json();
        await updateAdminUserIdentity(admin.user.id, userId, body);

        const user = await getAdminUserDetail(userId);
        return NextResponse.json({ success: true, user });
    } catch (error: any) {
        if (error?.message === 'User not found') {
            return NextResponse.json({ error: '用户不存在。' }, { status: 404 });
        }
        if (error?.message === 'Invalid username') {
            return NextResponse.json({ error: '用户名格式不正确。' }, { status: 400 });
        }
        if (error?.message === 'Username already taken') {
            return NextResponse.json({ error: '这个用户名已被使用。' }, { status: 409 });
        }
        if (error?.message === 'Student ID already verified') {
            return NextResponse.json({ error: '该学号已有认证主号，请先确认主号后再处理。' }, { status: 409 });
        }
        if (error?.message === 'Invalid student ID') {
            return NextResponse.json({ error: '学号只能包含字母和数字，长度 4-32 位。' }, { status: 400 });
        }
        if (error?.message === 'Missing subject') {
            return NextResponse.json({ error: '老师认证需要填写科目。' }, { status: 400 });
        }
        if (error?.message === 'Missing name') {
            return NextResponse.json({ error: '学生认证需要填写 Name。' }, { status: 400 });
        }

        console.error('PATCH /api/admin/users/[id] error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
