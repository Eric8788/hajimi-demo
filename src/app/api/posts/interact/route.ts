import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { togglePostLike, createComment, getComments, toggleBookmark, toggleCommentLike, deletePost, deleteComment, getPostAttachmentForDelete, getUserById, createPostInteractionNotification, createCommentLikeNotification } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';
import { isVerifiedAccount } from '@/lib/verification';
import { del } from '@vercel/blob';

// POST: Handle actions (like, comment, bookmark, like_comment)
export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const userId = Number(session.userId);
        const user = await getUserById(userId);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const canModerate = isAdminRole(user.role);

        const body = await request.json();
        const { action, postId, commentId, content, parentCommentId } = body;
        const interactionActions = new Set(['like', 'comment', 'bookmark', 'like_comment']);
        if (interactionActions.has(action) && !isVerifiedAccount(user)) {
            return NextResponse.json({ error: '完成 Hajimi 认证后可以互动。' }, { status: 403 });
        }

        if (action === 'like') {
            if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
            const hasLiked = await togglePostLike(userId, postId);
            if (hasLiked) {
                await createPostInteractionNotification(userId, postId, 'post_like');
            }
            return NextResponse.json({ success: true, hasLiked });
        }

        else if (action === 'comment') {
            if (!postId || !content) return NextResponse.json({ error: 'Missing data' }, { status: 400 });
            await createComment(userId, postId, content, parentCommentId ? Number(parentCommentId) : null);
            return NextResponse.json({ success: true });
        }

        else if (action === 'bookmark') {
            if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
            const isBookmarked = await toggleBookmark(userId, postId);
            if (isBookmarked) {
                await createPostInteractionNotification(userId, postId, 'post_bookmark');
            }
            return NextResponse.json({ success: true, isBookmarked });
        }

        else if (action === 'like_comment') {
            if (!commentId) return NextResponse.json({ error: 'Missing commentId' }, { status: 400 });
            const hasLiked = await toggleCommentLike(userId, commentId);
            if (hasLiked) {
                await createCommentLikeNotification(userId, commentId);
            }
            return NextResponse.json({ success: true, hasLiked });
        }

        else if (action === 'delete_post') {
            if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
            const attachmentUrl = await getPostAttachmentForDelete(userId, postId, canModerate);
            const deleted = await deletePost(userId, postId, canModerate);
            if (!deleted) return NextResponse.json({ error: 'Cannot delete post' }, { status: 403 });
            if (attachmentUrl) {
                try {
                    await del(attachmentUrl);
                } catch (error) {
                    console.warn('Failed to delete post blob:', error);
                }
            }
            return NextResponse.json({ success: true });
        }

        else if (action === 'delete_comment') {
            if (!commentId) return NextResponse.json({ error: 'Missing commentId' }, { status: 400 });
            const deleted = await deleteComment(userId, commentId, canModerate);
            if (!deleted) return NextResponse.json({ error: 'Cannot delete comment' }, { status: 403 });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

// GET: Fetch comments for a post
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    const session = await getSession();

    if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 });

    try {
        const comments = await getComments(Number(postId), session ? Number(session.userId) : undefined);
        return NextResponse.json(comments, {
            headers: {
                'Cache-Control': 'no-store, max-age=0, must-revalidate',
            }
        });
    } catch (error) {
        console.error("API GET /interact Error:", error);
        return NextResponse.json({ error: 'Internal Error', details: String(error) }, { status: 500 });
    }
}
