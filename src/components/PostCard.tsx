/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Post, Comment, User } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import { isAdminRole } from '@/lib/roles';
import Avatar from './Avatar';
import UserBadges from './UserBadges';
import PostTextComposer from './PostTextComposer';

const LINK_PATTERN = /\[([^\]]{1,120})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/g;

function safeExternalUrl(url: string) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
    } catch {
        return '';
    }
}

function renderRichText(text: string) {
    const lines = text.split('\n');

    return lines.map((line, lineIndex) => {
        const parts: ReactNode[] = [];
        let lastIndex = 0;

        for (const match of line.matchAll(LINK_PATTERN)) {
            const matchIndex = match.index ?? 0;
            if (matchIndex > lastIndex) {
                parts.push(line.slice(lastIndex, matchIndex));
            }

            const rawHref = match[2] || match[3] || '';
            const label = match[1] || match[3] || rawHref;
            const href = safeExternalUrl(rawHref);
            const rawText = match[0];

            if (href) {
                parts.push(
                    <a key={`${lineIndex}-${matchIndex}`} href={href} target="_blank" rel="noopener noreferrer" className="post-rich-link">
                        {label}
                    </a>
                );
            } else {
                parts.push(rawText);
            }

            lastIndex = matchIndex + rawText.length;
        }

        if (lastIndex < line.length) {
            parts.push(line.slice(lastIndex));
        }

        return (
            <span key={lineIndex}>
                {parts}
                {lineIndex < lines.length - 1 && <br />}
            </span>
        );
    });
}

function shortPreview(text?: string | null) {
    if (!text) return '';
    const compact = text.replace(/\s+/g, ' ').trim();
    return compact.length > 80 ? `${compact.slice(0, 80)}...` : compact;
}

function pickFeaturedComment(comments: Comment[]) {
    const replyCounts = comments.reduce<Record<number, number>>((counts, comment) => {
        if (comment.parent_comment_id) {
            counts[comment.parent_comment_id] = (counts[comment.parent_comment_id] || 0) + 1;
        }
        return counts;
    }, {});

    return [...comments].sort((a, b) => {
        if (b.likes !== a.likes) return b.likes - a.likes;
        const replyDelta = (replyCounts[b.id] || 0) - (replyCounts[a.id] || 0);
        if (replyDelta !== 0) return replyDelta;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })[0] ?? null;
}

export default function PostCard({ post, currentUser, onDeleted, onGuestAction }: { post: Post, currentUser: User | null, onDeleted?: (id: number) => void, onGuestAction?: () => void }) {
    const router = useRouter();
    const isGuest = !currentUser;
    const canInteract = currentUser?.verification_status === 'verified';
    const canModerate = isAdminRole(currentUser?.role);
    const canDeletePost = !!currentUser && (post.author_id === currentUser.id || canModerate);
    const canEditPost = !!currentUser && post.author_id === currentUser.id;
    const [displayTitle, setDisplayTitle] = useState(post.title);
    const [displayContent, setDisplayContent] = useState(post.content);
    const [displayTag, setDisplayTag] = useState(post.tag || 'general');
    const [displayUpdatedAt, setDisplayUpdatedAt] = useState<Date | string | undefined>(post.updated_at);
    const [featuredComment, setFeaturedComment] = useState(post.featured_comment ?? null);
    const isAnnouncement = displayTag === 'announcement';
    const [likes, setLikes] = useState(post.likes);
    const [hasLiked, setHasLiked] = useState(!!post.has_liked);
    const [isBookmarked, setIsBookmarked] = useState(post.is_bookmarked || false);
    const [expanded, setExpanded] = useState(false);
    const [likeBurst, setLikeBurst] = useState(0);
    const [bookmarkBurst, setBookmarkBurst] = useState(0);
    const [commentLikeBurst, setCommentLikeBurst] = useState<number | null>(null);
    const [commentXpBurst, setCommentXpBurst] = useState(0);
    const authorBadgeUser = {
        username: post.author_name || '',
        role: post.author_role || 'student',
        is_creator: post.author_is_creator,
        badge_preferences: post.author_badge_preferences,
        verification_status: post.author_verification_status || undefined,
    };

    // Comments
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentsLoaded, setCommentsLoaded] = useState(false);
    const [commentCount, setCommentCount] = useState(post.comment_count || 0);

    const [newComment, setNewComment] = useState('');
    const [sendingComment, setSendingComment] = useState(false);
    const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(post.title);
    const [editContent, setEditContent] = useState(post.content);
    const [editTag, setEditTag] = useState(post.tag || 'general');
    const [savingEdit, setSavingEdit] = useState(false);
    const [editError, setEditError] = useState('');
    const [interactionMessage, setInteractionMessage] = useState('');

    // Image Modal State
    const [showImageModal, setShowImageModal] = useState(false);

    const loadComments = useCallback(async () => {
        try {
            const res = await fetch(`/api/posts/interact?postId=${post.id}`, { cache: 'no-store' });
            const data = await res.json();
            if (Array.isArray(data)) {
                setComments(data);
                setCommentsLoaded(true);
                setCommentCount(data.length);
                setFeaturedComment(pickFeaturedComment(data));
                return data;
            }

            console.error("Failed to load comments:", data);
        } catch (err) {
            console.error("Error loading comments:", err);
        }

        setComments([]);
        setCommentsLoaded(true);
        return [];
    }, [post.id]);

    useEffect(() => {
        setDisplayTitle(post.title);
        setDisplayContent(post.content);
        setDisplayTag(post.tag || 'general');
        setDisplayUpdatedAt(post.updated_at);
        setEditTitle(post.title);
        setEditContent(post.content);
        setEditTag(post.tag || 'general');
        setCommentCount(post.comment_count || 0);
        setFeaturedComment(post.featured_comment ?? null);
    }, [post.comment_count, post.content, post.featured_comment, post.tag, post.title, post.updated_at]);

    // Lock Body Scroll when Modal is Open
    useEffect(() => {
        if (showImageModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto'; // Revert to default
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [showImageModal]);

    const openProfile = (authorId: number) => {
        if (!currentUser) {
            onGuestAction?.();
            return;
        }

        router.push(authorId === currentUser.id ? '/profile' : `/profile/${authorId}`);
    };

    const requireVerifiedInteraction = () => {
        if (isGuest) {
            onGuestAction?.();
            return true;
        }

        if (!canInteract) {
            setInteractionMessage('完成 Hajimi 认证后可以评论、点赞和收藏。');
            window.setTimeout(() => setInteractionMessage(''), 2600);
            return true;
        }

        return false;
    };

    const handleLike = async () => {
        if (requireVerifiedInteraction()) return;
        // Optimistic toggle
        const newLikedState = !hasLiked;
        setHasLiked(newLikedState);
        setLikes(p => newLikedState ? p + 1 : p - 1);
        if (newLikedState) {
            setLikeBurst(count => {
                const next = count + 1;
                window.setTimeout(() => setLikeBurst(current => current === next ? 0 : current), 700);
                return next;
            });
        }

        await fetch('/api/posts/interact', {
            method: 'POST',
            body: JSON.stringify({ action: 'like', postId: post.id })
        });
        window.dispatchEvent(new Event('hajimi-notifications-refresh'));
    };

    const handleBookmark = async () => {
        if (requireVerifiedInteraction()) return;
        const nextBookmarked = !isBookmarked;
        setIsBookmarked(nextBookmarked);
        if (nextBookmarked) {
            setBookmarkBurst(count => {
                const next = count + 1;
                window.setTimeout(() => setBookmarkBurst(current => current === next ? 0 : current), 700);
                return next;
            });
        }
        await fetch('/api/posts/interact', {
            method: 'POST',
            body: JSON.stringify({ action: 'bookmark', postId: post.id })
        });
        if (nextBookmarked) {
            window.dispatchEvent(new CustomEvent('hajimi-xp-feedback', { detail: { amount: 3, label: 'author saved' } }));
        }
        window.dispatchEvent(new Event('hajimi-notifications-refresh'));
    };

    const handleCommentLike = async (commentId: number) => {
        if (requireVerifiedInteraction()) return;
        // Optimistic toggle for comment likes
        let likedNow = false;
        setComments(current => current.map(c => {
            if (c.id === commentId) {
                const newLikedState = !c.has_liked;
                likedNow = newLikedState;
                return { ...c, likes: newLikedState ? c.likes + 1 : c.likes - 1, has_liked: newLikedState };
            }
            return c;
        }));
        setFeaturedComment(currentFeatured => {
            const nextComments = comments.map(c => {
                if (c.id === commentId) {
                    const newLikedState = !c.has_liked;
                    return { ...c, likes: newLikedState ? c.likes + 1 : c.likes - 1, has_liked: newLikedState };
                }
                return c;
            });
            return nextComments.length > 0 ? pickFeaturedComment(nextComments) : currentFeatured;
        });
        if (likedNow) {
            setCommentLikeBurst(commentId);
            window.setTimeout(() => setCommentLikeBurst(current => current === commentId ? null : current), 700);
        }
        await fetch('/api/posts/interact', {
            method: 'POST',
            body: JSON.stringify({ action: 'like_comment', commentId })
        });
        window.dispatchEvent(new Event('hajimi-notifications-refresh'));
    };

    const handleDeletePost = async () => {
        const message = post.author_id === currentUser?.id
            ? 'Delete this post? This cannot be undone.'
            : 'Delete this post as an admin? This cannot be undone.';
        if (!confirm(message)) return;
        const res = await fetch('/api/posts/interact', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete_post', postId: post.id })
        });
        if (res.ok && onDeleted) {
            onDeleted(post.id);
        }
    };

    const startEditing = () => {
        setEditTitle(displayTitle);
        setEditContent(displayContent);
        setEditTag(displayTag);
        setEditError('');
        setIsEditing(true);
        setExpanded(true);
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setEditError('');
    };

    const saveEdit = async (e: FormEvent) => {
        e.preventDefault();
        if (!editTitle.trim()) {
            setEditError('Title is required.');
            return;
        }

        setSavingEdit(true);
        setEditError('');

        const res = await fetch('/api/posts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                postId: post.id,
                title: editTitle,
                content: editContent,
                tag: editTag,
            }),
        });

        if (res.ok) {
            setDisplayTitle(editTitle.trim());
            setDisplayContent(editContent.trim());
            setDisplayTag(editTag.trim().replace(/^#+/, '').replace(/\s+/g, '').slice(0, 24) || 'general');
            setDisplayUpdatedAt(new Date());
            setIsEditing(false);
        } else {
            const data = await res.json().catch(() => null);
            setEditError(data?.error || 'Could not save this edit.');
        }

        setSavingEdit(false);
    };

    const handleDeleteComment = async (commentId: number) => {
        const comment = comments.find(c => c.id === commentId);
        const message = comment?.author_id === currentUser?.id
            ? 'Delete this comment?'
            : 'Delete this comment as an admin?';
        if (!confirm(message)) return;
        const res = await fetch('/api/posts/interact', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete_comment', commentId })
        });
        if (res.ok) {
            setComments(current => {
                const nextComments = current.filter(c => c.id !== commentId);
                setFeaturedComment(pickFeaturedComment(nextComments));
                return nextComments;
            });
            setCommentCount(current => Math.max(0, current - 1));
        }
    };

    const toggleComments = async () => {
        if (!showComments) {
            setShowComments(true);
            await loadComments();
        } else {
            setShowComments(false);
        }
    };

    const submitComment = async (e: FormEvent) => {
        e.preventDefault();
        if (requireVerifiedInteraction()) return;
        if (!newComment.trim()) return;
        setSendingComment(true);
        const commentText = newComment.trim();
        const parentCommentId = replyingTo?.id;

        const res = await fetch('/api/posts/interact', {
            method: 'POST',
            body: JSON.stringify({ action: 'comment', postId: post.id, content: commentText, parentCommentId })
        });

        if (res.ok) {
            setCommentXpBurst(count => {
                const next = count + 1;
                window.setTimeout(() => setCommentXpBurst(current => current === next ? 0 : current), 800);
                return next;
            });
            setNewComment('');
            setReplyingTo(null);
            setShowComments(true);
            await loadComments();
        }
        setSendingComment(false);
    };

    const visibleComments = showComments ? comments : comments.slice(0, 2);
    const portalTarget = typeof document === 'undefined' ? null : document.body;
    const featuredCommentBadgeUser = featuredComment ? {
        username: featuredComment.author_name || '',
        role: featuredComment.author_role || 'student',
        is_creator: featuredComment.author_is_creator,
        badge_preferences: featuredComment.author_badge_preferences,
        verification_status: featuredComment.author_verification_status || undefined,
    } : null;

    return (
        <div
            id={`post-${post.id}`}
            className="glass-card"
            style={{
                transition: 'all 0.3s',
                borderColor: isAnnouncement ? 'rgba(253, 203, 110, 0.85)' : undefined,
                boxShadow: isAnnouncement ? '0 14px 32px rgba(253, 203, 110, 0.18)' : undefined,
            }}
        >
            {/* Header */}
            <div className="post-card-header">
                <button
                    type="button"
                    className="avatar-link-button post-author-avatar-button"
                    onClick={() => openProfile(post.author_id)}
                    aria-label={`View ${post.author_name || 'author'} profile`}
                >
                    <Avatar className="post-author-avatar" value={post.author_avatar} theme={post.author_avatar_theme} fallback="👤" size={40} style={{ fontSize: '1.2rem', border: '2px solid white' }} />
                </button>
                <div className="post-author-meta">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#2d3436' }}>{post.author_name}</span>
                        <UserBadges user={authorBadgeUser} compact iconOnly />
                    </div>
                    <div suppressHydrationWarning style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                        {new Date(post.created_at).toLocaleDateString()}
                        {displayUpdatedAt && <span> · edited</span>}
                    </div>
                </div>

                <div className="post-card-actions">
                    <div className={`post-tag-badge ${isAnnouncement ? 'is-announcement' : ''}`}>
                        {isAnnouncement ? '📢 announcement' : `#${displayTag || 'general'}`}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '34px' }}>
                        {/* Bookmark Button */}
                        <motion.button
                            onClick={handleBookmark}
                            className="reaction-button"
                            whileTap={{ scale: 0.82 }}
                            animate={bookmarkBurst ? { scale: [1, 1.22, 1], rotate: [0, -8, 7, 0] } : { scale: 1, rotate: 0 }}
                            transition={{ duration: 0.32 }}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem',
                                color: isBookmarked ? '#fdcb6e' : '#b2bec3', transition: 'color 0.2s',
                                display: 'flex', alignItems: 'center', padding: 0
                            }}
                            title="Bookmark"
                        >
                            <AnimatePresence>
                                {bookmarkBurst > 0 && (
                                    <motion.span
                                        key={bookmarkBurst}
                                        className="reaction-burst"
                                        initial={{ opacity: 0, y: 8, scale: 0.8 }}
                                        animate={{ opacity: 1, y: -8, scale: 1 }}
                                        exit={{ opacity: 0, y: -18, scale: 0.7 }}
                                        transition={{ duration: 0.45 }}
                                    >
                                        saved
                                    </motion.span>
                                )}
                            </AnimatePresence>
                            {isBookmarked ? '⭐' : '☆'}
                        </motion.button>
                        {canEditPost && (
                            <button
                                onClick={startEditing}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem',
                                    color: '#6c5ce7', transition: 'color 0.2s',
                                    display: 'flex', alignItems: 'center', padding: 0
                                }}
                                title="Edit Post"
                            >✏️</button>
                        )}
                        {/* Delete Button (Owner or Moderator) */}
                        {canDeletePost && (
                            <button
                                onClick={handleDeletePost}
                                style={{ 
                                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', 
                                    color: '#b2bec3', transition: 'color 0.2s',
                                    display: 'flex', alignItems: 'center', padding: 0
                                }}
                                title={post.author_id === currentUser?.id ? 'Delete Post' : 'Admin Delete Post'}
                            >🗑️</button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Body */}
            <div>
                {isEditing ? (
                    <form onSubmit={saveEdit} className="post-edit-form">
                        <input
                            className="glass-input"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            maxLength={80}
                            required
                        />
                        <PostTextComposer value={editContent} onChange={setEditContent} rows={6} />
                        <div className="post-edit-helper">
                            <span>Links: select text and enter a domain like www.baidu.com</span>
                            <input
                                className="glass-input"
                                value={editTag}
                                onChange={e => setEditTag(e.target.value)}
                                maxLength={24}
                                aria-label="Post tag"
                            />
                        </div>
                        {editError && <div className="post-edit-error">{editError}</div>}
                        <div className="post-edit-actions">
                            <button type="button" className="btn" onClick={cancelEditing}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                                {savingEdit ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <>
                        <h3 style={{ marginBottom: '10px', fontSize: '1.2rem' }}>{displayTitle}</h3>

                        {/* Truncated Text */}
                        {displayContent.trim() && (
                            <div style={{
                                position: 'relative',
                                maxHeight: expanded ? 'none' : '100px',
                                overflow: 'hidden',
                                lineHeight: '1.6',
                                color: '#4a4a4a'
                            }}>
                                <p style={{ whiteSpace: 'pre-wrap' }}>{renderRichText(displayContent)}</p>
                                {/* Fade Out Overlay if truncated */}
                                {!expanded && displayContent.length > 150 && (
                                    <div style={{
                                        position: 'absolute', bottom: 0, left: 0, width: '100%', height: '40px',
                                        background: 'linear-gradient(transparent, rgba(255,255,255,0.9))',
                                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
                                    }} />
                                )}
                            </div>
                        )}

                        {/* Expand Button */}
                        {displayContent.length > 150 && (
                            <button
                                onClick={() => setExpanded(!expanded)}
                                style={{ background: 'none', border: 'none', color: '#6c5ce7', fontSize: '0.9rem', marginTop: '5px', cursor: 'pointer', fontWeight: 600 }}
                            >
                                {expanded ? 'Show Less' : 'Read More...'}
                            </button>
                        )}
                    </>
                )}

                {/* Attachment / Thumbnail */}
                {post.attachment_url && (
                    <div style={{ marginTop: '15px' }}>
                        {post.type === 'image' ? (
                            <button
                                type="button"
                                className="post-image-attachment"
                                onClick={() => setShowImageModal(true)}
                                aria-label="Open image"
                            >
                                <img src={post.attachment_url} alt="Post attachment" />
                            </button>
                        ) : (
                            <a href={post.attachment_url} target="_blank" className="btn" style={{ background: '#dfe6e9', color: '#2d3436', fontSize: '0.9rem', padding: '10px 15px' }}>
                                📎 Download Attachment
                            </a>
                        )}
                    </div>
                )}

                {!isEditing && !showComments && featuredComment && featuredCommentBadgeUser && (
                    <div className="featured-comment-preview">
                        <div className="featured-comment-kicker">🔥 最火评论</div>
                        <div className="featured-comment-body">
                            <button
                                type="button"
                                className="avatar-link-button comment-avatar-button"
                                onClick={() => openProfile(featuredComment.author_id)}
                                aria-label={`View ${featuredComment.author_name || 'comment author'} profile`}
                            >
                                <Avatar value={featuredComment.author_avatar} theme={featuredComment.author_avatar_theme} fallback="👤" size={24} style={{ fontSize: '0.8rem' }} />
                            </button>
                            <div className="featured-comment-copy">
                                <div className="featured-comment-author">
                                    <span>{featuredComment.author_name}</span>
                                    <UserBadges user={featuredCommentBadgeUser} compact iconOnly />
                                    {featuredComment.likes > 0 && <small>{featuredComment.likes} likes</small>}
                                </div>
                                {featuredComment.reply_author_name && (
                                    <div className="comment-reply-context">
                                        Replying to @{featuredComment.reply_author_name}: {shortPreview(featuredComment.reply_content)}
                                    </div>
                                )}
                                <div>{renderRichText(shortPreview(featuredComment.content))}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Actions Bar */}
            <div style={{ marginTop: '20px', display: 'flex', gap: '20px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '15px' }}>
                <motion.button
                    onClick={handleLike}
                    className="reaction-button"
                    whileTap={{ scale: 0.84 }}
                    animate={likeBurst ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                    transition={{ duration: 0.28 }}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: hasLiked ? '#ff7675' : '#636e72',
                        display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 600,
                        transition: 'color 0.18s'
                    }}
                >
                    <AnimatePresence>
                        {likeBurst > 0 && (
                            <motion.span
                                key={likeBurst}
                                className="reaction-burst"
                                initial={{ opacity: 0, y: 8, scale: 0.7 }}
                                animate={{ opacity: 1, y: -10, scale: 1 }}
                                exit={{ opacity: 0, y: -22, scale: 0.6 }}
                                transition={{ duration: 0.45 }}
                            >
                                +1
                            </motion.span>
                        )}
                    </AnimatePresence>
                    {hasLiked || likes > post.likes ? '❤️' : '🤍'} {likes}
                </motion.button>

                <button
                    onClick={toggleComments}
                    className="reaction-button"
                    style={{
                        position: 'relative',
                        background: 'none', border: 'none', cursor: 'pointer', color: '#636e72',
                        display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 600
                    }}
                >
                    <AnimatePresence>
                        {commentXpBurst > 0 && (
                            <motion.span
                                key={commentXpBurst}
                                className="reaction-burst"
                                initial={{ opacity: 0, y: 8, scale: 0.7 }}
                                animate={{ opacity: 1, y: -10, scale: 1 }}
                                exit={{ opacity: 0, y: -22, scale: 0.6 }}
                                transition={{ duration: 0.45 }}
                            >
                                +5 XP
                            </motion.span>
                        )}
                    </AnimatePresence>
                    💬 Comment {commentCount > 0 ? `(${commentsLoaded ? comments.length : commentCount})` : ''}
                </button>
            </div>
            {interactionMessage && (
                <div className="forum-verification-callout post-interaction-callout" style={{ marginTop: '12px' }}>
                    <span>{interactionMessage}</span>
                    <button type="button" onClick={() => router.push('/profile')}>去认证</button>
                </div>
            )}

            {/* Comments Section (Always Rendered if Loaded) */}
            <AnimatePresence>
                {(commentsLoaded && comments.length > 0) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{ background: 'rgba(255,255,255,0.4)', borderRadius: '12px', padding: '15px', marginTop: '15px' }}>
                            {/* Comments List... */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '15px', maxHeight: showComments ? '300px' : 'none', overflowY: showComments ? 'auto' : 'visible' }}>
                                {visibleComments.map(c => (
                                    <div key={c.id} style={{ display: 'flex', gap: '10px' }} title={`Commented on ${new Date(c.created_at).toLocaleString()}`}>
                                        <button
                                            type="button"
                                            className="avatar-link-button comment-avatar-button"
                                            onClick={() => openProfile(c.author_id)}
                                            aria-label={`View ${c.author_name || 'comment author'} profile`}
                                        >
                                            <Avatar value={c.author_avatar} theme={c.author_avatar_theme} fallback="👤" size={24} style={{ fontSize: '0.8rem' }} />
                                        </button>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{c.author_name}</span>
                                                    <UserBadges
                                                        user={{
                                                            username: c.author_name || '',
                                                            role: c.author_role || 'student',
                                                            is_creator: c.author_is_creator,
                                                            badge_preferences: c.author_badge_preferences,
                                                            verification_status: c.author_verification_status || undefined,
                                                        }}
                                                        compact
                                                        iconOnly
                                                    />
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#b2bec3', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    {c.likes > 0 && <span>{c.likes} likes</span>}
                                                    <motion.button
                                                        onClick={() => handleCommentLike(c.id)}
                                                        className="reaction-button"
                                                        whileTap={{ scale: 0.84 }}
                                                        animate={commentLikeBurst === c.id ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                                                        transition={{ duration: 0.25 }}
                                                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: c.has_liked ? '#ff7675' : '#b2bec3' }}
                                                    >
                                                        <AnimatePresence>
                                                            {commentLikeBurst === c.id && (
                                                                <motion.span
                                                                    key={c.id}
                                                                    className="reaction-burst"
                                                                    initial={{ opacity: 0, y: 8, scale: 0.7 }}
                                                                    animate={{ opacity: 1, y: -8, scale: 1 }}
                                                                    exit={{ opacity: 0, y: -18, scale: 0.6 }}
                                                                    transition={{ duration: 0.42 }}
                                                                >
                                                                    liked
                                                                </motion.span>
                                                            )}
                                                        </AnimatePresence>
                                                        {c.has_liked ? '❤️' : '🤍'}
                                                    </motion.button>
                                                    {!isGuest && canInteract && (
                                                        <button
                                                            onClick={() => {
                                                                setReplyingTo(c);
                                                                setShowComments(true);
                                                            }}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6c5ce7', fontSize: '0.8rem', fontWeight: 700 }}
                                                            title={`Reply to ${c.author_name}`}
                                                        >Reply</button>
                                                    )}
                                                    {!isGuest && currentUser && (c.author_id === currentUser.id || canModerate) && (
                                                        <button
                                                            onClick={() => handleDeleteComment(c.id)}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#b2bec3', fontSize: '0.8rem' }}
                                                            title={c.author_id === currentUser.id ? 'Delete Comment' : 'Admin Delete Comment'}
                                                        >🗑️</button>
                                                    )}
                                                </div>
                                            </div>
                                            {c.reply_author_name && (
                                                <div className="comment-reply-context">
                                                    Replying to @{c.reply_author_name}: {shortPreview(c.reply_content)}
                                                </div>
                                            )}
                                            <div style={{ fontSize: '0.9rem', color: '#444', whiteSpace: 'pre-wrap' }}>{renderRichText(c.content)}</div>
                                        </div>
                                    </div>
                                ))}

                                {!showComments && comments.length > 2 && (
                                    <div
                                        onClick={() => setShowComments(true)}
                                        style={{ fontSize: '0.85rem', color: '#6c5ce7', cursor: 'pointer', fontWeight: 600 }}
                                    >
                                        View all {comments.length} comments...
                                    </div>
                                )}
                            </div>

                            {/* Comment Input - Only visible when fully expanded or if no comments yet */}
                            {showComments && (
                                canInteract ? (
                                <form onSubmit={submitComment} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    {replyingTo && (
                                        <div className="comment-reply-pill">
                                            Replying to @{replyingTo.author_name}
                                            <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">×</button>
                                        </div>
                                    )}
                                    <input
                                        className="glass-input"
                                        style={{ flex: '1 1 220px', padding: '8px 12px', fontSize: '0.9rem', background: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '8px' }}
                                        placeholder={replyingTo ? `Reply to ${replyingTo.author_name}...` : 'Write a comment...'}
                                        value={newComment}
                                        onChange={e => setNewComment(e.target.value)}
                                    />
                                    <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} disabled={sendingComment}>
                                        Send
                                    </button>
                                </form>
                                ) : (
                                    <div className="forum-verification-callout">
                                        <span>{isGuest ? '登录后可以提交认证并参与评论。' : '完成 Hajimi 认证后可以评论和回复。'}</span>
                                        <button type="button" onClick={() => router.push(isGuest ? '/login' : '/profile')}>{isGuest ? '登录' : '去认证'}</button>
                                    </div>
                                )
                            )}
                        </div>
                    </motion.div>
                )}
                {/* Always allow commenting even if no comments exist yet, if showComments is true */}
                {showComments && comments.length === 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                    >
                        <div style={{ background: 'rgba(255,255,255,0.4)', borderRadius: '12px', padding: '15px', marginTop: '15px' }}>
                            <div style={{ opacity: 0.5, fontStyle: 'italic', fontSize: '0.9rem', marginBottom: '10px' }}>No comments yet.</div>
                            {canInteract ? (
                            <form onSubmit={submitComment} style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    className="glass-input"
                                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.9rem', background: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '8px' }}
                                    placeholder="Be the first to comment..."
                                    value={newComment}
                                    onChange={e => setNewComment(e.target.value)}
                                />
                                <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} disabled={sendingComment}>
                                    Send
                                </button>
                            </form>
                            ) : (
                                <div className="forum-verification-callout">
                                    <span>{isGuest ? '登录后可以提交认证并参与评论。' : '完成 Hajimi 认证后可以成为第一个评论的人。'}</span>
                                    <button type="button" onClick={() => router.push(isGuest ? '/login' : '/profile')}>{isGuest ? '登录' : '去认证'}</button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Image Modal - PORTAL to body */}
            {portalTarget && createPortal(
                <AnimatePresence>
                    {showImageModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowImageModal(false)}
                            style={{
                                position: 'fixed', inset: 0,
                                background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)',
                                zIndex: 999999, /* Very high z-index */
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'default'
                            }}
                        >
                            <motion.img
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0.9 }}
                                src={post.attachment_url}
                                alt="Full size"
                                onClick={e => e.stopPropagation()}
                                style={{
                                    maxWidth: '95vw', maxHeight: '95vh',
                                    borderRadius: '4px',
                                    boxShadow: '0 0 50px rgba(0,0,0,0.5)',
                                    objectFit: 'contain'
                                }}
                            />

                            <div
                                onClick={(e) => {
                                    e.stopPropagation(); // Ensure button click handles logic
                                    setShowImageModal(false);
                                }}
                                style={{
                                    position: 'absolute', top: '30px', right: '30px',
                                    color: 'white', fontSize: '2.5rem', cursor: 'pointer',
                                    zIndex: 1000000,
                                    width: '60px', height: '60px', textAlign: 'center',
                                    background: 'rgba(255,255,255,0.15)', borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    lineHeight: .8, paddingBottom: '5px',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                            >
                                ×
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
