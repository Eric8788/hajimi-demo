import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '@/components/Shell';
import Avatar from '@/components/Avatar';
import UserBadges from '@/components/UserBadges';
import { getSession } from '@/lib/auth';
import { getArticleById, getUserById, type User } from '@/lib/db';

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

function getSafeUser(user: User | null) {
    if (!user?.avatar?.startsWith('data:image/')) return user;
    return {
        ...user,
        avatar: user.avatar_emoji || '\u6587',
    };
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const articleId = Number(id);
    if (!Number.isInteger(articleId) || articleId <= 0) notFound();

    const session = await getSession();
    const viewer = session ? await getUserById(Number(session.userId)) : null;
    const article = await getArticleById(articleId);
    if (!article) notFound();

    const authorBadgeUser = {
        username: article.author_name || '',
        role: article.author_role || 'student',
        badge_preferences: article.author_badge_preferences,
        verification_status: article.author_verification_status || undefined,
    };

    return (
        <Shell user={getSafeUser(viewer)}>
            <article className="article-read-shell">
                <header className="article-read-hero glass-panel">
                    <div className="article-read-author">
                        <Avatar
                            value={article.author_avatar || undefined}
                            emoji={article.author_avatar_emoji}
                            theme={article.author_avatar_theme}
                            fallback="\u6587"
                            size={48}
                        />
                        <div>
                            <div className="article-read-author-line">
                                <strong>{article.author_name}</strong>
                                <UserBadges user={authorBadgeUser} compact iconOnly />
                            </div>
                            <span>{formatDate(article.created_at)}{' · '}{estimateReadMinutes(article.content)} min read{' · '}#{article.tag || 'general'}</span>
                        </div>
                    </div>
                    <h1>{article.title}</h1>
                    {article.excerpt && <p>{article.excerpt}</p>}
                    <div className="article-read-actions">
                        <Link href={viewer?.id === article.author_id ? '/profile' : `/profile/${article.author_id}`}>
                            {'\u4f5c\u8005\u4e3b\u9875'}
                        </Link>
                        {article.forum_post_id && (
                            <Link href={`/resources#post-${article.forum_post_id}`}>
                                Forum {'\u5361\u7247'}
                            </Link>
                        )}
                    </div>
                </header>

                <section className="article-read-body glass-panel">
                    {article.content.split(/\n{2,}/).map((paragraph, index) => (
                        <p key={`${index}-${paragraph.slice(0, 12)}`}>
                            {paragraph}
                        </p>
                    ))}
                </section>
            </article>
        </Shell>
    );
}
