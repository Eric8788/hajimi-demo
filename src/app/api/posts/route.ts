import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPosts, getPostsPage, createPostWithAttachments, updatePost, countAttachmentsByUser, countRecentAttachmentsByUser, getUserById } from '@/lib/db';
import { isStaffRole } from '@/lib/roles';
import { isVerifiedAccount } from '@/lib/verification';
import { getInteractionBlockedMessage } from '@/lib/access';
import { del, put } from '@vercel/blob';
import { cachedServerValue, clearServerCache } from '@/lib/serverCache';
import { normalizePostContentFormat } from '@/lib/forumContent';
import { getRequestLogContext, logApiError } from '@/lib/apiLog';

const MAX_ATTACHMENT_SIZE = 1 * 1024 * 1024;
const MAX_POST_ATTACHMENTS = 3;
const DAILY_ATTACHMENT_LIMIT = 5;
const TOTAL_ATTACHMENT_LIMIT = 30;
const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);
const HASHTAG_PATTERN = /^[\p{L}\p{N}_-]{1,24}$/u;
const MAX_TITLE_LENGTH = 80;
const INLINE_IMAGE_PLACEHOLDER_PREFIX = 'hajimi-inline-image:';

type InlineImageFile = {
    id: string;
    file: File;
};

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

function getPostFiles(formData: FormData) {
    const files = formData
        .getAll('files')
        .filter((value): value is File => value instanceof File && value.size > 0);
    const legacyFile = formData.get('file');

    if (files.length === 0 && legacyFile instanceof File && legacyFile.size > 0) {
        files.push(legacyFile);
    }

    return files;
}

function getInlineImageFiles(formData: FormData): InlineImageFile[] {
    return Array.from(formData.entries())
        .map(([key, value]) => {
            const match = /^inlineImage:(.+)$/.exec(key);
            if (!match || !(value instanceof File) || value.size <= 0) return null;

            return {
                id: match[1],
                file: value,
            };
        })
        .filter((value): value is InlineImageFile => Boolean(value));
}

function replaceInlineImagePlaceholders(content: string, uploadedInlineImages: Map<string, string>) {
    let missingInlineImage = '';
    const nextContent = content.replace(/!\[([^\]\n]*)\]\(hajimi-inline-image:([^)]+)\)/g, (match, alt: string, id: string) => {
        const url = uploadedInlineImages.get(id);
        if (!url) {
            missingInlineImage = id;
            return match;
        }

        return `![${String(alt || 'image').replace(/[\[\]\n\r]/g, ' ').trim() || 'image'}](${url})`;
    });

    if (missingInlineImage) {
        throw new Response(JSON.stringify({ error: 'Inline image upload is missing. Paste the image again and retry.' }), { status: 400 });
    }

    if (nextContent.includes(INLINE_IMAGE_PLACEHOLDER_PREFIX)) {
        throw new Response(JSON.stringify({ error: 'Inline image upload is incomplete. Paste the image again and retry.' }), { status: 400 });
    }

    return nextContent;
}

async function cleanupUploadedBlobs(urls: string[]) {
    if (urls.length === 0) return;

    try {
        await del(urls);
    } catch (error) {
        console.warn('Failed to clean up uploaded post blobs:', error);
    }
}

async function uploadPostImage(file: File) {
    const blobName = `forum/${Date.now()}-${crypto.randomUUID()}-${safeFilename(file.name)}`;
    const blob = await put(blobName, file, {
        access: 'public',
        contentType: file.type || undefined,
    });

    return blob.url;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sort = (searchParams.get('sort') || 'time') as 'time' | 'heat' | 'likes';
        const requestedFilter = searchParams.get('filter') || 'all';
        const filter = requestedFilter === 'saved' || requestedFilter === 'following'
            ? requestedFilter
            : 'all';
        const tag = searchParams.get('tag') || undefined;
        const paged = searchParams.get('page') === '1';
        const requestedLimit = Number(searchParams.get('limit') || 15);
        const requestedOffset = Number(searchParams.get('offset') || 0);
        const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 30) : 15;
        const offset = Number.isFinite(requestedOffset) ? Math.max(Math.floor(requestedOffset), 0) : 0;
        const session = await getSession();
        if (filter === 'following') {
            if (!session) {
                return NextResponse.json({ error: '请登录后查看关注流。' }, { status: 401 });
            }

            const viewer = await getUserById(Number(session.userId));
            if (!viewer || !isVerifiedAccount(viewer)) {
                return NextResponse.json({ error: getInteractionBlockedMessage(viewer, '查看关注用户的帖子') }, { status: 403 });
            }
        }
        const isPublicList = !session && filter === 'all';
        if (paged) {
            const page = isPublicList
                ? await cachedServerValue(
                    `posts:public-page:${sort}:${filter}:${tag || 'all'}:${limit}:${offset}`,
                    30_000,
                    () => getPostsPage(sort, undefined, filter, tag, { limit, offset }),
                )
                : await getPostsPage(sort, session ? Number(session.userId) : undefined, filter, tag, { limit, offset });

            return NextResponse.json(page, {
                headers: {
                    'Cache-Control': isPublicList
                        ? 'public, max-age=15, s-maxage=30, stale-while-revalidate=90'
                        : 'private, no-cache, no-store, max-age=0, must-revalidate',
                },
            });
        }

        const posts = isPublicList
            ? await cachedServerValue(
                `posts:public:${sort}:${filter}:${tag || 'all'}`,
                30_000,
                () => getPosts(sort, undefined, filter, tag),
            )
            : await getPosts(sort, session ? Number(session.userId) : undefined, filter, tag);
        return NextResponse.json(posts, {
            headers: {
                'Cache-Control': isPublicList
                    ? 'public, max-age=15, s-maxage=30, stale-while-revalidate=90'
                    : 'private, no-cache, no-store, max-age=0, must-revalidate',
            }
        });
    } catch (error) {
        logApiError('/api/posts', error, getRequestLogContext(request));
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

        if (!isVerifiedAccount(user)) {
            return NextResponse.json({ error: getInteractionBlockedMessage(user, '发帖') }, { status: 403 });
        }

        const formData = await request.formData();
        const title = String(formData.get('title') || '').trim();
        const content = String(formData.get('content') || '').trim();
        const contentFormat = normalizePostContentFormat(formData.get('contentFormat'));
        let type = 'text';
        const tag = normalizeHashtag(formData.get('tag'));
        const files = getPostFiles(formData);
        const inlineImages = getInlineImageFiles(formData);
        const allImageFiles = [...files, ...inlineImages.map(item => item.file)];
        const hasFiles = allImageFiles.length > 0;

        if (!title) {
            return NextResponse.json({ error: '标题必填，内容可以选填。' }, { status: 400 });
        }

        if (tag === 'announcement' && !isStaffRole(user.role)) {
            return NextResponse.json({ error: 'Only teachers and admins can publish announcements' }, { status: 403 });
        }

        if (!HASHTAG_PATTERN.test(tag)) {
            return NextResponse.json({ error: 'Hashtags can use letters, numbers, Chinese characters, underscores, or hyphens' }, { status: 400 });
        }

        const attachmentUrls: string[] = [];
        const inlineImageUrls = new Map<string, string>();
        let finalContent = content;

        if (hasFiles) {
            if (allImageFiles.length > MAX_POST_ATTACHMENTS) {
                return NextResponse.json({ error: `最多一次上传 ${MAX_POST_ATTACHMENTS} 张图片。` }, { status: 400 });
            }

            for (const file of allImageFiles) {
                if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
                    return NextResponse.json({ error: 'Only JPEG, PNG, WebP, or GIF images can be uploaded' }, { status: 415 });
                }

                if (file.size > MAX_ATTACHMENT_SIZE) {
                    return NextResponse.json({ error: 'Each image must be 1 MB or smaller' }, { status: 413 });
                }
            }

            if (!process.env.BLOB_READ_WRITE_TOKEN) {
                return NextResponse.json({ error: 'File uploads are not configured yet' }, { status: 503 });
            }

            const totalUploads = await countAttachmentsByUser(userId);
            if (totalUploads + allImageFiles.length > TOTAL_ATTACHMENT_LIMIT) {
                return NextResponse.json({ error: 'Image storage limit reached. Delete old image posts before uploading more.' }, { status: 429 });
            }

            const recentUploads = await countRecentAttachmentsByUser(userId);
            if (recentUploads + allImageFiles.length > DAILY_ATTACHMENT_LIMIT) {
                return NextResponse.json({ error: 'Daily image upload limit reached. Try again tomorrow.' }, { status: 429 });
            }

            try {
                for (const file of files) {
                    attachmentUrls.push(await uploadPostImage(file));
                }

                for (const inlineImage of inlineImages) {
                    const url = await uploadPostImage(inlineImage.file);
                    attachmentUrls.push(url);
                    inlineImageUrls.set(inlineImage.id, url);
                }
            } catch (error) {
                await cleanupUploadedBlobs(attachmentUrls);
                throw error;
            }

            try {
                finalContent = replaceInlineImagePlaceholders(content, inlineImageUrls);
            } catch (error) {
                await cleanupUploadedBlobs(attachmentUrls);
                if (error instanceof Response) {
                    const text = await error.text();
                    return NextResponse.json(JSON.parse(text), { status: error.status });
                }
                throw error;
            }

            type = 'image';
        }

        if (finalContent.includes(INLINE_IMAGE_PLACEHOLDER_PREFIX)) {
            await cleanupUploadedBlobs(attachmentUrls);
            return NextResponse.json({ error: 'Inline image upload is incomplete. Paste the image again and retry.' }, { status: 400 });
        }

        try {
            await createPostWithAttachments(userId, title.slice(0, MAX_TITLE_LENGTH), finalContent, type, attachmentUrls, tag, contentFormat);
        } catch (error) {
            await cleanupUploadedBlobs(attachmentUrls);
            throw error;
        }
        clearServerCache('posts:');
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        logApiError('/api/posts', err, getRequestLogContext(request));
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

        if (!isVerifiedAccount(user)) {
            return NextResponse.json({ error: getInteractionBlockedMessage(user, '编辑帖子') }, { status: 403 });
        }

        const body = await request.json();
        const postId = Number(body.postId);
        const title = String(body.title || '').trim();
        const content = String(body.content || '').trim();
        const contentFormat = normalizePostContentFormat(body.contentFormat);
        const tag = normalizeHashtag(body.tag || 'general');

        if (!postId || !title) {
            return NextResponse.json({ error: 'Post and title are required' }, { status: 400 });
        }

        if (tag === 'announcement' && !isStaffRole(user.role)) {
            return NextResponse.json({ error: 'Only teachers and admins can publish announcements' }, { status: 403 });
        }

        if (!HASHTAG_PATTERN.test(tag)) {
            return NextResponse.json({ error: 'Hashtags can use letters, numbers, Chinese characters, underscores, or hyphens' }, { status: 400 });
        }

        const updated = await updatePost(userId, postId, title.slice(0, MAX_TITLE_LENGTH), content, tag, contentFormat);
        if (!updated) {
            return NextResponse.json({ error: 'Cannot edit post' }, { status: 403 });
        }

        clearServerCache('posts:');
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        logApiError('/api/posts', err, getRequestLogContext(request));
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
