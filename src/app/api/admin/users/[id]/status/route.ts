import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAdminUserDetail, getUserById, setAdminUserAccountStatus } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = await getUserById(Number(session.userId));
        if (!admin || !isAdminRole(admin.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await context.params;
        const userId = Number(id);
        if (!Number.isInteger(userId) || userId <= 0) {
            return NextResponse.json({ error: 'Invalid user' }, { status: 400 });
        }

        const body = await request.json();
        const action = String(body.action || '');
        const status = action === 'enable' ? 'active' : action === 'disable' ? 'disabled' : null;
        if (!status) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const reason = String(body.reason || '').trim().slice(0, 240);
        if (status === 'disabled' && reason.length < 2) {
            return NextResponse.json({ error: '请填写停用原因。' }, { status: 400 });
        }

        await setAdminUserAccountStatus(admin.id, userId, status, reason);
        const user = await getAdminUserDetail(userId);

        return NextResponse.json({ success: true, user });
    } catch (error: any) {
        if (error?.message === 'Cannot disable yourself') {
            return NextResponse.json({ error: '不能停用当前管理员自己的账号。' }, { status: 409 });
        }
        if (error?.message === 'Cannot disable last admin') {
            return NextResponse.json({ error: '不能停用最后一个可用管理员账号。' }, { status: 409 });
        }
        if (error?.message === 'User not found') {
            return NextResponse.json({ error: '用户不存在。' }, { status: 404 });
        }

        console.error('POST /api/admin/users/[id]/status error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
