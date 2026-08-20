'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Comment, CommentsPage, User } from '@/lib/db';
import { canUseMemberInteractions, getInteractionBlockedMessage, isReadOnlyRole } from '@/lib/access';
import { isAdminRole } from '@/lib/roles';
import { applyAuthorAvatarPatch, loadAvatarPatches } from '@/lib/clientAvatarHydration';
import Avatar from './Avatar';
import UserBadges from './UserBadges';
import PostContentRenderer from './PostContentRenderer';
import { NOTIFICATION_TARGET_EVENT, type NotificationTargetDetail } from '@/lib/notificationNavigation';

type ArticleCommentsProps = {
    postId: number;
    currentUser: User | null;
};

function formatCommentDate(value: Date | string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
}

export default function ArticleComments({ postId, currentUser }: ArticleCommentsProps) {
    const router = useRouter();
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [draft, setDraft] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [commentTargetMessage, setCommentTargetMessage] = useState('');
    const [totalComments, setTotalComments] = useState(0);
    const [commentsPage, setCommentsPage] = useState(1);
    const [commentsTotalPages, setCommentsTotalPages] = useState(1);
    const [hotCommentId, setHotCommentId] = useState<number | null>(null);
    const [locationHash, setLocationHash] = useState(() => typeof window === 'undefined' ? '' : window.location.hash);
    const canInteract = canUseMemberInteractions(currentUser);
    const canModerate = isAdminRole(currentUser?.role);
    const isGuest = !currentUser;
    const isReadOnlyUser = isReadOnlyRole(currentUser?.role);

    const loadComments = useCallback(async ({ page = 1, commentId }: { page?: number; commentId?: number } = {}) => {
        setIsLoading(true);
        setError('');
        setCommentTargetMessage('');
        try {
            const params = new URLSearchParams({
                postId: String(postId),
                page: String(page),
                limit: '10',
            });
            if (commentId) params.set('commentId', String(commentId));
            const res = await fetch(`/api/posts/interact?${params.toString()}`, { cache: 'no-store' });
            const data = await res.json() as Partial<CommentsPage> & { error?: string };
            if (!res.ok || !Array.isArray(data.comments)) {
                throw new Error(data?.error || 'Could not load comments.');
            }

            const nextComments = data.comments as Comment[];
            setComments(nextComments);
            setCommentsPage(Number(data.page || page));
            setCommentsTotalPages(Math.max(1, Number(data.totalPages || 1)));
            setTotalComments(Number(data.total || 0));
            setHotCommentId(data.hotCommentId ? Number(data.hotCommentId) : null);
            if (commentId && data.targetFound === false) {
                setCommentTargetMessage('This comment is no longer available.');
            }
            loadAvatarPatches(nextComments.map(comment => comment.author_id))
                .then(patches => {
                    if (patches.size === 0) return;
                    setComments(current => current.map(comment => applyAuthorAvatarPatch(comment, patches)));
                })
                .catch(error => console.warn('Article comment avatars unavailable:', error));
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Could not load comments.');
        } finally {
            setIsLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        const syncHash = () => setLocationHash(window.location.hash || '');
        const handleNotificationTarget = (event: Event) => {
            const detail = (event as CustomEvent<NotificationTargetDetail>).detail;
            const nextHash = detail?.hash || window.location.hash || '';
            if (nextHash) setLocationHash(nextHash);
        };

        window.addEventListener('hashchange', syncHash);
        window.addEventListener(NOTIFICATION_TARGET_EVENT, handleNotificationTarget);
        return () => {
            window.removeEventListener('hashchange', syncHash);
            window.removeEventListener(NOTIFICATION_TARGET_EVENT, handleNotificationTarget);
        };
    }, []);

    useEffect(() => {
        const prefix = `#post-${postId}-comment-`;
        const rawCommentId = locationHash.startsWith(prefix) ? Number(locationHash.slice(prefix.length)) : 0;
        void loadComments(rawCommentId > 0 ? { commentId: rawCommentId } : { page: 1 });
    }, [loadComments, locationHash, postId]);

    useEffect(() => {
        if (isLoading || comments.length === 0) return;
        const hash = locationHash;
        if (!hash.startsWith(`#post-${postId}-comment-`)) return;

        const target = document.getElementById(hash.slice(1));
        if (!target) return;
        window.requestAnimationFrame(() => {
            target.scrollIntoView({ block: 'center' });
        });
    }, [comments, isLoading, locationHash, postId]);

    const openProfile = (authorId: number) => {
        if (!currentUser) {
            router.push('/login');
            return;
        }
        router.push(authorId === currentUser.id ? '/profile' : `/profile/${authorId}`);
    };

    const submitComment = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const content = draft.trim();
        if (!content || !canInteract) return;

        setIsSending(true);
        setError('');
        setMessage('');

        const formData = new FormData();
        formData.append('action', 'comment');
        formData.append('postId', String(postId));
        formData.append('content', content);

        const res = await fetch('/api/posts/interact', {
            method: 'POST',
            body: formData,
        });
        const data = await res.json().catch(() => null);

        if (res.ok) {
            setDraft('');
            setMessage('\u8bc4\u8bba\u5df2\u53d1\u9001\u3002');
            await loadComments({ page: 1 });
            window.dispatchEvent(new Event('hajimi-notifications-refresh'));
        } else {
            setError(data?.error || '\u8bc4\u8bba\u53d1\u9001\u5931\u8d25\u3002');
        }

        setIsSending(false);
    };

    const likeComment = async (commentId: number) => {
        if (!canInteract) return;
        const nextComments = comments.map(comment => {
            if (comment.id !== commentId) return comment;
            const nextLiked = !comment.has_liked;
            return {
                ...comment,
                has_liked: nextLiked,
                likes: Math.max(0, Number(comment.likes || 0) + (nextLiked ? 1 : -1)),
            };
        });
        setComments(nextComments);

        const res = await fetch('/api/posts/interact', {
            method: 'POST',
            body: JSON.stringify({ action: 'like_comment', commentId }),
        });
        if (!res.ok) {
            await loadComments({ page: commentsPage });
        } else {
            window.dispatchEvent(new Event('hajimi-notifications-refresh'));
        }
    };

    const deleteComment = async (commentId: number) => {
        const comment = comments.find(item => item.id === commentId);
        if (!comment || !currentUser || (comment.author_id !== currentUser.id && !canModerate)) return;
        if (!confirm(comment.author_id === currentUser.id ? 'Delete this comment?' : 'Delete this comment as admin?')) return;

        const res = await fetch('/api/posts/interact', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete_comment', commentId }),
        });

        if (res.ok) {
            setComments(current => current.filter(item => item.id !== commentId));
            await loadComments({ page: commentsPage });
        } else {
            const data = await res.json().catch(() => null);
            setError(data?.error || 'Could not delete comment.');
        }
    };

    const blockedMessage = isGuest
        ? '\u767b\u5f55\u540e\u53ef\u4ee5\u53c2\u4e0e\u957f\u6587\u8ba8\u8bba\u3002'
        : isReadOnlyUser
            ? getInteractionBlockedMessage(currentUser, '\u8bc4\u8bba')
            : '\u5b8c\u6210 Hajimi \u8ba4\u8bc1\u540e\u53ef\u4ee5\u8bc4\u8bba\u548c\u70b9\u8d5e\u3002';

    return (
        <section className="article-comments glass-panel" id="comments">
            <div className="article-comments-head">
                <div>
                    <span>Discussion</span>
                    <h2>{'\u8bc4\u8bba\u533a'}</h2>
                </div>
                <strong>{totalComments}</strong>
            </div>

            {error && <div className="article-comment-message is-error">{error}</div>}
            {message && <div className="article-comment-message">{message}</div>}
            {commentTargetMessage && <div className="article-comment-message">{commentTargetMessage}</div>}

            {canInteract ? (
                <form className="article-comment-compose" onSubmit={submitComment}>
                    <input
                        className="glass-input"
                        value={draft}
                        onChange={event => setDraft(event.target.value)}
                        placeholder={comments.length > 0 ? '\u56de\u590d\u8fd9\u7bc7\u957f\u6587...' : '\u5199\u4e0b\u7b2c\u4e00\u6761\u8bc4\u8bba...'}
                        maxLength={800}
                    />
                    <button type="submit" className="btn btn-primary" disabled={isSending || !draft.trim()}>
                        {isSending ? '\u53d1\u9001\u4e2d...' : '\u53d1\u9001'}
                    </button>
                </form>
            ) : (
                <div className="article-comment-blocked">
                    <span>{blockedMessage}</span>
                    <button type="button" onClick={() => router.push(isGuest ? '/login' : isReadOnlyUser ? '/functions' : '/profile')}>
                        {isGuest ? '\u767b\u5f55' : isReadOnlyUser ? '\u53bb\u9879\u76ee\u5385' : '\u53bb\u8ba4\u8bc1'}
                    </button>
                </div>
            )}

            <div className="article-comment-list">
                {isLoading ? (
                    <div className="article-comment-empty">Loading comments...</div>
                ) : comments.length === 0 ? (
                    <div className="article-comment-empty">{'\u8fd8\u6ca1\u6709\u8bc4\u8bba\uff0c\u7559\u4e0b\u4f60\u7684\u7b2c\u4e00\u4e2a\u60f3\u6cd5\u3002'}</div>
                ) : comments.map(comment => (
                    <article key={comment.id} id={`post-${postId}-comment-${comment.id}`} className="article-comment-row">
                        <button
                            type="button"
                            className="article-comment-avatar"
                            onClick={() => openProfile(comment.author_id)}
                            aria-label={`View ${comment.author_name || 'comment author'} profile`}
                        >
                            <Avatar
                                value={comment.author_avatar}
                                emoji={comment.author_avatar_emoji}
                                theme={comment.author_avatar_theme}
                                seed={comment.author_id}
                                fallback="\u{1F464}"
                                size={34}
                            />
                        </button>
                        <div className="article-comment-main">
                            <div className="article-comment-meta">
                                <div className="article-comment-author">
                                    {Number(comment.id) === Number(hotCommentId) && <span className="comment-hot-indicator" title="最火评论" aria-label="最火评论">🔥</span>}
                                    <strong>{comment.author_name}</strong>
                                    <UserBadges
                                        user={{
                                            username: comment.author_name || '',
                                            role: comment.author_role || 'student',
                                            is_creator: comment.author_is_creator,
                                            badge_preferences: comment.author_badge_preferences,
                                            verification_status: comment.author_verification_status || undefined,
                                        }}
                                        compact
                                        iconOnly
                                    />
                                    <span>{formatCommentDate(comment.created_at)}</span>
                                </div>
                                <div className="article-comment-actions">
                                    <button
                                        type="button"
                                        onClick={() => likeComment(comment.id)}
                                        disabled={!canInteract}
                                        className={comment.has_liked ? 'is-liked' : ''}
                                    >
                                        {comment.has_liked ? '\u2665' : '\u2661'} {comment.likes > 0 ? comment.likes : ''}
                                    </button>
                                    {currentUser && (comment.author_id === currentUser.id || canModerate) && (
                                        <button type="button" onClick={() => deleteComment(comment.id)}>
                                            {'\u5220\u9664'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="article-comment-content">
                                <PostContentRenderer content={comment.content} format="plain" />
                            </div>
                        </div>
                    </article>
                ))}
            </div>

            {!isLoading && !error && commentsTotalPages > 1 && (
                <div className="comment-pagination" aria-label="Comment pages">
                    <button
                        type="button"
                        className="comment-pagination-button"
                        onClick={() => loadComments({ page: commentsPage - 1 })}
                        disabled={isLoading || commentsPage <= 1}
                    >
                        Previous
                    </button>
                    <span>Page {commentsPage} of {commentsTotalPages} · {totalComments} {totalComments === 1 ? 'comment' : 'comments'}</span>
                    <button
                        type="button"
                        className="comment-pagination-button"
                        onClick={() => loadComments({ page: commentsPage + 1 })}
                        disabled={isLoading || commentsPage >= commentsTotalPages}
                    >
                        Next
                    </button>
                </div>
            )}
        </section>
    );
}
