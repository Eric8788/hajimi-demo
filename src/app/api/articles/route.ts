import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createArticle, deleteArticle, getUserById } from '@/lib/db';
import { canUseMemberInteractions, getInteractionBlockedMessage } from '@/lib/access';
import { isAdminRole } from '@/lib/roles';
import { clearServerCache } from '@/lib/serverCache';

const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 12000;
const HASHTAG_PATTERN = /^[\p{L}\p{N}_-]{1,24}$/u;

function normalizeHashtag(value: unknown) {
    return String(value || 'general')
        .trim()
        .replace(/^#+/, '')
        .replace(/\s+/g, '')
        .slice(0, 24) || 'general';
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await getUserById(Number(session.userId));
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!canUseMemberInteractions(user)) {
            return NextResponse.json({ error: getInteractionBlockedMessage(user, '\u5199\u6587\u7ae0') }, { status: 403 });
        }

        const body = await request.json();
        const title = String(body?.title || '').trim();
        const content = String(body?.content || '').trim();
        const tag = normalizeHashtag(body?.tag);
        const shareToForum = Boolean(body?.shareToForum);

        if (!title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }

        if (!content || content.replace(/\s+/g, '').length < 20) {
            return NextResponse.json({ error: 'Article content should be at least 20 characters.' }, { status: 400 });
        }

        if (content.length > MAX_CONTENT_LENGTH) {
            return NextResponse.json({ error: 'Article is too long. Please keep it under 12000 characters.' }, { status: 400 });
        }

        if (!HASHTAG_PATTERN.test(tag)) {
            return NextResponse.json({ error: 'Hashtags can use letters, numbers, Chinese characters, underscores, or hyphens' }, { status: 400 });
        }

        const result = await createArticle(user.id, title.slice(0, MAX_TITLE_LENGTH), content, tag, shareToForum);
        clearServerCache('posts:');

        return NextResponse.json({ success: true, articleId: result?.articleId, forumPostId: result?.forumPostId });
    } catch (error) {
        console.error('Article create error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await getUserById(Number(session.userId));
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        let articleId = Number(searchParams.get('articleId') || 0);

        if (!articleId) {
            const body = await request.json().catch(() => null);
            articleId = Number(body?.articleId || 0);
        }

        if (!Number.isInteger(articleId) || articleId <= 0) {
            return NextResponse.json({ error: 'Missing articleId' }, { status: 400 });
        }

        const deleted = await deleteArticle(user.id, articleId, isAdminRole(user.role));
        if (!deleted) {
            return NextResponse.json({ error: 'Cannot delete article' }, { status: 403 });
        }

        clearServerCache('posts:');
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Article delete error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
