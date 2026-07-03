import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '@/components/Shell';
import Avatar from '@/components/Avatar';
import UserBadges from '@/components/UserBadges';
import PostContentRenderer from '@/components/PostContentRenderer';
import ArticleComments from '@/components/ArticleComments';
import { getSession } from '@/lib/auth';
import { ensureArticleCommentPost, getArticleById, getUserById, type User } from '@/lib/db';

export const dynamic = 'force-dynamic';

function formatDate(value?: Date | string | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function estimateReadMinutes(text: string) {
    return Math.max(1, Math.ceil(text.replace(/\s+/g, '').length / 420));
}

function stripMarkdownSyntax(text: string) {
    return text
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
        .replace(/```[\s\S]*?```/g, match => match.replace(/```/g, ''))
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^>\s?/gm, '')
        .replace(/^\s*[-*]\s+/gm, '')
        .replace(/^\s*\d+[.)]\s+/gm, '')
        .replace(/[*_`~]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function getSafeUser(user: User | null) {
    return user;
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const articleId = Number(id);
    if (!Number.isInteger(articleId) || articleId <= 0) notFound();

    const session = await getSession();
    const viewer = session ? await getUserById(Number(session.userId)) : null;
    const article = await getArticleById(articleId);
    if (!article) notFound();

    const commentPostId = await ensureArticleCommentPost(article.id);
    const profileHref = viewer?.id === article.author_id ? '/profile' : `/profile/${article.author_id}`;
    const readMinutes = estimateReadMinutes(article.content);

    const authorBadgeUser = {
        username: article.author_name || '',
        role: article.author_role || 'student',
        badge_preferences: article.author_badge_preferences,
        verification_status: article.author_verification_status || undefined,
    };

    return (
        <Shell user={getSafeUser(viewer)}>
            <article className="article-read-shell">
                <div className="article-read-topbar">
                    <Link href={profileHref} className="article-back-link">
                        {'\u2190 \u8fd4\u56de'}
                    </Link>
                    {article.forum_post_id && article.forum_post_type !== 'article_thread' && (
                        <Link href={`/resources#post-${article.forum_post_id}`} className="article-forum-link">
                            Forum {'\u5361\u7247'}
                        </Link>
                    )}
                </div>

                <header className="article-read-hero glass-panel">
                    <Link href={profileHref} className="article-read-author">
                        <span className="article-read-avatar-frame">
                            <Avatar
                                value={article.author_avatar || undefined}
                                emoji={article.author_avatar_emoji}
                                theme={article.author_avatar_theme}
                                fallback="\u6587"
                                size={54}
                            />
                        </span>
                        <div>
                            <div className="article-read-author-line">
                                <strong>{article.author_name}</strong>
                                <UserBadges user={authorBadgeUser} compact iconOnly />
                            </div>
                            <span>{formatDate(article.created_at)}{' \u00b7 '}{readMinutes} min read{' \u00b7 '}#{article.tag || 'general'}</span>
                        </div>
                    </Link>
                    <h1>{article.title}</h1>
                    {article.excerpt && <p>{stripMarkdownSyntax(article.excerpt)}</p>}
                    <div className="article-read-stats" aria-label="Article stats">
                        <span>{readMinutes} min read</span>
                        <span>{article.comment_count || 0} comments</span>
                        <span>#{article.tag || 'general'}</span>
                    </div>
                </header>

                <section className="article-read-body glass-panel">
                    <PostContentRenderer content={article.content} format="markdown" className="article-read-content" />
                </section>

                {commentPostId && (
                    <ArticleComments postId={commentPostId} currentUser={viewer} />
                )}
            </article>
        </Shell>
    );
}
