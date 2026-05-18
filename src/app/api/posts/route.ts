import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPosts, createPost, updatePost, countAttachmentsByUser, countRecentAttachmentsByUser, getUserById } from '@/lib/db';
import { isStaffRole } from '@/lib/roles';
import { put } from '@vercel/blob';

const MAX_ATTACHMENT_SIZE = 1 * 1024 * 1024;
const DAILY_ATTACHMENT_LIMIT = 5;
const TOTAL_ATTACHMENT_LIMIT = 30;
const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);
const HASHTAG_PATTERN = /^[\p{L}\p{N}_-]{1,24}$/u;

function safeFilename(name: string) {
    const extension = name.includes('.') ? name.split('.').pop() : 'file';
    const baseName = name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 60) || 'attachment';

    return `${baseName}.${extension?.replace(/[^a-zA-Z0-9]/g, '') || 'file'}`;
}

function normalizeHashtag(value: FormDataEntryValue | null) {
    return String(value || 'general')
        .trim()
        .replace(/^#+/, '')
        .replace(/\s+/g, '')
        .slice(0, 24) || 'general';
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sort = (searchParams.get('sort') || 'time') as 'time' | 'heat' | 'likes';
    const filter = (searchParams.get('filter') || 'all') as 'all' | 'saved';
    const tag = searchParams.get('tag') || undefined;
    const session = await getSession();

    try {
        const posts = await getPosts(sort, session ? Number(session.userId) : undefined, filter, tag);
        return NextResponse.json(posts, {
            headers: {
                'Cache-Control': 'no-store, max-age=0, must-revalidate'
            }
        });
    } catch {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = Number(session.userId);
        const user = await getUserById(userId);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const title = String(formData.get('title') || '').trim();
        const content = String(formData.get('content') || '').trim();
        let type = 'text';
        const tag = normalizeHashtag(formData.get('tag'));
        const file = formData.get('file') as File | null;

        if (!title || !content) {
            return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
        }

        if (tag === 'announcement' && !isStaffRole(user.role)) {
            return NextResponse.json({ error: 'Only teachers and admins can publish announcements' }, { status: 403 });
        }

        if (!HASHTAG_PATTERN.test(tag)) {
            return NextResponse.json({ error: 'Hashtags can use letters, numbers, Chinese characters, underscores, or hyphens' }, { status: 400 });
        }

        let attachmentUrl = '';

        if (file && file.size > 0) {
            if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
                return NextResponse.json({ error: 'Only JPEG, PNG, WebP, or GIF images can be uploaded' }, { status: 415 });
            }

            if (file.size > MAX_ATTACHMENT_SIZE) {
                return NextResponse.json({ error: 'Image must be 1 MB or smaller' }, { status: 413 });
            }

            if (!process.env.BLOB_READ_WRITE_TOKEN) {
                return NextResponse.json({ error: 'File uploads are not configured yet' }, { status: 503 });
            }

            const totalUploads = await countAttachmentsByUser(userId);
            if (totalUploads >= TOTAL_ATTACHMENT_LIMIT) {
                return NextResponse.json({ error: 'Image storage limit reached. Delete old image posts before uploading more.' }, { status: 429 });
            }

            const recentUploads = await countRecentAttachmentsByUser(userId);
            if (recentUploads >= DAILY_ATTACHMENT_LIMIT) {
                return NextResponse.json({ error: 'Daily image upload limit reached. Try again tomorrow.' }, { status: 429 });
            }

            const blobName = `forum/${Date.now()}-${crypto.randomUUID()}-${safeFilename(file.name)}`;
            const blob = await put(blobName, file, {
                access: 'public',
                contentType: file.type || undefined,
            });

            attachmentUrl = blob.url;
            type = 'image';
        }

        await createPost(userId, title, content, type, attachmentUrl, tag);
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = Number(session.userId);
        const user = await getUserById(userId);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const postId = Number(body.postId);
        const title = String(body.title || '').trim();
        const content = String(body.content || '').trim();
        const tag = normalizeHashtag(body.tag || 'general');

        if (!postId || !title || !content) {
            return NextResponse.json({ error: 'Post, title, and content are required' }, { status: 400 });
        }

        if (tag === 'announcement' && !isStaffRole(user.role)) {
            return NextResponse.json({ error: 'Only teachers and admins can publish announcements' }, { status: 403 });
        }

        if (!HASHTAG_PATTERN.test(tag)) {
            return NextResponse.json({ error: 'Hashtags can use letters, numbers, Chinese characters, underscores, or hyphens' }, { status: 400 });
        }

        const updated = await updatePost(userId, postId, title, content, tag);
        if (!updated) {
            return NextResponse.json({ error: 'Cannot edit post' }, { status: 403 });
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
