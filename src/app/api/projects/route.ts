import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getProjects, createProject } from '@/lib/db';

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

        const body = await request.json();
        const userId = Number(session.userId);

        const projectId = await createProject({
            ...body,
            author_id: userId
        });

        return NextResponse.json({ success: true, projectId });
    } catch (err) {
        console.error("Create Project Error", err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
