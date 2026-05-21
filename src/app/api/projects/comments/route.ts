import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { addProjectComment, deleteProjectComment, getProjectComments, getUserById } from '@/lib/db';
import { isVerifiedAccount } from '@/lib/verification';

function parsePositiveInteger(value: string | null | unknown) {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = parsePositiveInteger(searchParams.get('projectId'));
        if (!projectId) return NextResponse.json([]);

        const session = await getSession();
        const userId = session ? Number(session.userId) : null;

        const comments = await getProjectComments(projectId);
        const commentsWithOwnership = comments.map(c => ({
            ...c,
            is_own_comment: userId ? c.author_id === userId : false
        }));
        
        return NextResponse.json(commentsWithOwnership);
    } catch (err) {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const projectId = parsePositiveInteger(body?.projectId);
        const content = String(body?.content || '').trim();
        if (!projectId) {
            return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
        }
        if (!content || content.length > 500) {
            return NextResponse.json({ error: 'Project comments must be 1-500 characters.' }, { status: 400 });
        }

        const userId = Number(session.userId);
        const user = await getUserById(userId);
        if (!isVerifiedAccount(user)) {
            return NextResponse.json({ error: '完成 Hajimi 认证后可以评论项目。' }, { status: 403 });
        }

        const commentId = await addProjectComment(userId, projectId, content);
        return NextResponse.json({ success: true, commentId });
    } catch (err) {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const commentId = parsePositiveInteger(searchParams.get('commentId'));
        const userId = Number(session.userId);

        if (!commentId) return NextResponse.json({ error: 'Missing commentId' }, { status: 400 });

        await deleteProjectComment(commentId, userId);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Delete Comment Error", err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
