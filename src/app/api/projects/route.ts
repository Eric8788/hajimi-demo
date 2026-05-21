import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getProjects } from '@/lib/db';

export async function GET() {
    try {
        const projects = await getProjects();
        return NextResponse.json(projects);
    } catch (err) {
        console.error("Fetch Projects Error", err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        await request.json().catch(() => null);
        return NextResponse.json(
            { error: '项目和新版本需要通过 Hub 申请流提交，管理员审核后才会发布。' },
            { status: 403 },
        );
    } catch (err) {
        console.error("Create Project Error", err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
