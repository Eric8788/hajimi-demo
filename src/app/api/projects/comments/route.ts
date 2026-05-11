import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { addProjectComment, getProjectComments } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = Number(searchParams.get('projectId'));
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

        const { projectId, content } = await request.json();
        const userId = Number(session.userId);

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
        const commentId = Number(searchParams.get('commentId'));
        const userId = Number(session.userId);

        if (!commentId) return NextResponse.json({ error: 'Missing commentId' }, { status: 400 });

        // @ts-ignore
        await import('@/lib/db').then(m => m.deleteProjectComment(commentId, userId));
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Delete Comment Error", err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
