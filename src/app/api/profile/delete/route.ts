import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    return NextResponse.json(
        { error: '账号删除仅限管理员在后台操作。' },
        { status: 403 },
    );
}
