import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getProjects } from '@/lib/db';
import { cachedServerValue } from '@/lib/serverCache';

export async function GET() {
    try {
        const projects = await cachedServerValue('projects:list', 60_000, getProjects);
        return NextResponse.json(projects, {
            headers: {
                'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120',
            },
        });
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
