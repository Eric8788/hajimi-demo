import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { togglePostLike, createComment, getComments, toggleBookmark, toggleCommentLike, deletePost, deleteComment, getPostAttachmentsForDelete, getCommentAttachmentForDelete, getUserById, createPostInteractionNotification, createCommentLikeNotification, createCommentNotification, countAttachmentsByUser, countRecentAttachmentsByUser } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';
import { isVerifiedAccount } from '@/lib/verification';
import { getInteractionBlockedMessage, isReadOnlyRole } from '@/lib/access';
import { del, put } from '@vercel/blob';
import { clearServerCache } from '@/lib/serverCache';

const MAX_ATTACHMENT_SIZE = 1 * 1024 * 1024;
const DAILY_ATTACHMENT_LIMIT = 5;
const TOTAL_ATTACHMENT_LIMIT = 30;
const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);

function safeFilename(name: string) {
    const extension = name.includes('.') ? name.split('.').pop() : 'file';
    const baseName = name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 60) || 'attachment';

    return `${baseName}.${extension?.replace(/[^a-zA-Z0-9]/g, '') || 'file'}`;
}

async function deleteBlobUrls(urls: string[]) {
    const cleanUrls = Array.from(new Set(urls.map(url => String(url || '').trim()).filter(Boolean)));
    if (cleanUrls.length === 0) return;

    try {
        await del(cleanUrls);
    } catch (error) {
        console.warn('Failed to delete forum blob:', error);
    }
}

async function uploadCommentAttachment(userId: number, file: File | null) {
    if (!file || file.size <= 0) return '';

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        throw new Response(JSON.stringify({ error: 'Only JPEG, PNG, WebP, or GIF images can be uploaded' }), { status: 415 });
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
        throw new Response(JSON.stringify({ error: 'Image must be 1 MB or smaller' }), { status: 413 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        throw new Response(JSON.stringify({ error: 'File uploads are not configured yet' }), { status: 503 });
    }

    const totalUploads = await countAttachmentsByUser(userId);
    if (totalUploads + 1 > TOTAL_ATTACHMENT_LIMIT) {
        throw new Response(JSON.stringify({ error: 'Image storage limit reached. Delete old image posts before uploading more.' }), { status: 429 });
    }

    const recentUploads = await countRecentAttachmentsByUser(userId);
    if (recentUploads + 1 > DAILY_ATTACHMENT_LIMIT) {
        throw new Response(JSON.stringify({ error: 'Daily image upload limit reached. Try again tomorrow.' }), { status: 429 });
    }

    const blobName = `forum/comments/${Date.now()}-${crypto.randomUUID()}-${safeFilename(file.name)}`;
    const blob = await put(blobName, file, {
        access: 'public',
        contentType: file.type || undefined,
    });

    return blob.url;
}

function jsonErrorFromResponse(response: Response) {
    return response.text().then(text => {
        try {
            return NextResponse.json(JSON.parse(text), { status: response.status });
        } catch {
            return NextResponse.json({ error: 'Upload failed' }, { status: response.status });
        }
    });
}

// POST: Handle actions (like, comment, bookmark, like_comment)
export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const userId = Number(session.userId);
        const user = await getUserById(userId);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const canModerate = isAdminRole(user.role);

        const contentType = request.headers.get('content-type') || '';
        const isMultipart = contentType.includes('multipart/form-data');
        const formData = isMultipart ? await request.formData() : null;
        const body = formData ? null : await request.json();
        const action = String(formData?.get('action') || body?.action || '');
        const postId = Number(formData?.get('postId') || body?.postId || 0);
        const commentId = Number(formData?.get('commentId') || body?.commentId || 0);
        const content = String(formData?.get('content') || body?.content || '');
        const parentCommentId = formData?.get('parentCommentId') || body?.parentCommentId;
        const interactionActions = new Set(['like', 'comment', 'bookmark', 'like_comment']);
        if (interactionActions.has(action) && !isVerifiedAccount(user)) {
            return NextResponse.json({ error: getInteractionBlockedMessage(user, '互动') }, { status: 403 });
        }
        if ((action === 'delete_post' || action === 'delete_comment') && isReadOnlyRole(user.role)) {
            return NextResponse.json({ error: getInteractionBlockedMessage(user, '管理互动内容') }, { status: 403 });
        }

        if (action === 'like') {
            if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
            const hasLiked = await togglePostLike(userId, postId);
            if (hasLiked) {
                await createPostInteractionNotification(userId, postId, 'post_like');
            }
            clearServerCache('posts:');
            return NextResponse.json({ success: true, hasLiked });
        }

        else if (action === 'comment') {
            const files = formData
                ?.getAll('file')
                .filter((value): value is File => value instanceof File && value.size > 0) || [];
            if (files.length > 1) {
                return NextResponse.json({ error: '评论每次最多上传 1 张图片。' }, { status: 400 });
            }
            const commentText = content.trim();
            if (!postId || (!commentText && files.length === 0)) return NextResponse.json({ error: 'Missing data' }, { status: 400 });
            let attachmentUrl = '';

            try {
                attachmentUrl = await uploadCommentAttachment(userId, files[0] || null);
                const newCommentId = await createComment(userId, postId, commentText, parentCommentId ? Number(parentCommentId) : null, attachmentUrl);
                if (newCommentId) {
                    await createCommentNotification(userId, newCommentId);
                }
            } catch (error) {
                if (attachmentUrl) {
                    await deleteBlobUrls([attachmentUrl]);
                }
                if (error instanceof Response) {
                    return jsonErrorFromResponse(error);
                }
                throw error;
            }

            clearServerCache('posts:');
            return NextResponse.json({ success: true });
        }

        else if (action === 'bookmark') {
            if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
            const isBookmarked = await toggleBookmark(userId, postId);
            if (isBookmarked) {
                await createPostInteractionNotification(userId, postId, 'post_bookmark');
            }
            clearServerCache('posts:');
            return NextResponse.json({ success: true, isBookmarked });
        }

        else if (action === 'like_comment') {
            if (!commentId) return NextResponse.json({ error: 'Missing commentId' }, { status: 400 });
            const hasLiked = await toggleCommentLike(userId, commentId);
            if (hasLiked) {
                await createCommentLikeNotification(userId, commentId);
            }
            clearServerCache('posts:');
            return NextResponse.json({ success: true, hasLiked });
        }

        else if (action === 'delete_post') {
            if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
            const attachmentUrls = await getPostAttachmentsForDelete(userId, postId, canModerate);
            const deleted = await deletePost(userId, postId, canModerate);
            if (!deleted) return NextResponse.json({ error: 'Cannot delete post' }, { status: 403 });
            await deleteBlobUrls(attachmentUrls);
            clearServerCache('posts:');
            return NextResponse.json({ success: true });
        }

        else if (action === 'delete_comment') {
            if (!commentId) return NextResponse.json({ error: 'Missing commentId' }, { status: 400 });
            const attachmentUrl = await getCommentAttachmentForDelete(userId, commentId, canModerate);
            const deleted = await deleteComment(userId, commentId, canModerate);
            if (!deleted) return NextResponse.json({ error: 'Cannot delete comment' }, { status: 403 });
            await deleteBlobUrls([attachmentUrl]);
            clearServerCache('posts:');
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
