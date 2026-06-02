import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById, rateProject } from '@/lib/db';
import { isVerifiedAccount } from '@/lib/verification';
import { clearServerCache } from '@/lib/serverCache';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { projectId, score } = await request.json();
        const normalizedProjectId = Number(projectId);
        const normalizedScore = Number(score);
        const userId = Number(session.userId);
        const user = await getUserById(userId);
        if (!isVerifiedAccount(user)) {
            return NextResponse.json({ error: '完成 Hajimi 认证后可以评分项目。' }, { status: 403 });
        }

        if (!Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
            return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
        }

        if (!Number.isFinite(normalizedScore) || normalizedScore < 0.5 || normalizedScore > 5.0 || !Number.isInteger(normalizedScore * 2)) {
            return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
        }

        const result = await rateProject(userId, normalizedProjectId, normalizedScore);
        clearServerCache('projects:');
        
        return NextResponse.json({ success: true, ...result });
    } catch (err) {
        console.error("Rate Project Error", err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
