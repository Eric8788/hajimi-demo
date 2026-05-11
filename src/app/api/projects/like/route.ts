import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { rateProject } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { projectId, score } = await request.json();
        const userId = Number(session.userId);

        if (typeof score !== 'number' || score < 0.5 || score > 5.0) {
            return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
        }

        const result = await rateProject(userId, projectId, score);
        
        return NextResponse.json({ success: true, ...result });
    } catch (err) {
        console.error("Rate Project Error", err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

