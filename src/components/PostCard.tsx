/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Post, Comment, User } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import { isAdminRole } from '@/lib/roles';
import RoleBadge from './RoleBadge';
import Avatar from './Avatar';

export default function PostCard({ post, currentUser, onDeleted, onGuestAction }: { post: Post, currentUser: User | null, onDeleted?: (id: number) => void, onGuestAction?: () => void }) {
    const router = useRouter();
    const isGuest = !currentUser;
    const canModerate = isAdminRole(currentUser?.role);
    const canDeletePost = !!currentUser && (post.author_id === currentUser.id || canModerate);
    const isAnnouncement = post.tag === 'announcement';
    const [likes, setLikes] = useState(post.likes);
    const [hasLiked, setHasLiked] = useState(!!post.has_liked);
    const [isBookmarked, setIsBookmarked] = useState(post.is_bookmarked || false);
    const [expanded, setExpanded] = useState(false);
    const [likeBurst, setLikeBurst] = useState(0);
    const [bookmarkBurst, setBookmarkBurst] = useState(0);
    const [commentLikeBurst, setCommentLikeBurst] = useState<number | null>(null);

    // Comments
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentsLoaded, setCommentsLoaded] = useState(false);

    const [newComment, setNewComment] = useState('');
    const [sendingComment, setSendingComment] = useState(false);

    // Image Modal State
    const [showImageModal, setShowImageModal] = useState(false);

    useEffect(() => {
        // Auto-load top 3 comments if they exist
        // Using a flag to prevent double-fetching in strict mode or rapid updates
        let isActive = true;

        if (post.comment_count && post.comment_count > 0 && !commentsLoaded) {
            fetch(`/api/posts/interact?postId=${post.id}`, { cache: 'no-store' })
                .then(res => res.json())
                .then(data => {
                    if (!isActive) return;
                    if (Array.isArray(data)) {
                        setComments(data);
                        setCommentsLoaded(true);
                    } else {
                        console.error("Failed to load comments:", data);
                        setComments([]);
                        setCommentsLoaded(true);
                    }
                })
                .catch(err => {
                    if (!isActive) return;
                    console.error("Error loading comments:", err);
                    setComments([]);
                    setCommentsLoaded(true);
                });
        }

        return () => { isActive = false; };
    }, [post.comment_count, post.id, commentsLoaded]);

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

    const handleLike = async () => {
        if (isGuest) { onGuestAction?.(); return; }
        // Optimistic toggle
        const newLikedState = !hasLiked;
        setHasLiked(newLikedState);
        setLikes(p => newLikedState ? p + 1 : p - 1);
        if (newLikedState) setLikeBurst(count => count + 1);

        await fetch('/api/posts/interact', {
            method: 'POST',
            body: JSON.stringify({ action: 'like', postId: post.id })
        });
        window.dispatchEvent(new Event('hajimi-notifications-refresh'));
    };

    const handleBookmark = async () => {
        if (isGuest) { onGuestAction?.(); return; }
        const nextBookmarked = !isBookmarked;
        setIsBookmarked(nextBookmarked);
        if (nextBookmarked) setBookmarkBurst(count => count + 1);
        await fetch('/api/posts/interact', {
            method: 'POST',
            body: JSON.stringify({ action: 'bookmark', postId: post.id })
        });
        window.dispatchEvent(new Event('hajimi-notifications-refresh'));
    };

    const handleCommentLike = async (commentId: number) => {
        if (isGuest) { onGuestAction?.(); return; }
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
            setComments(current => current.filter(c => c.id !== commentId));
        }
    };

    const toggleComments = async () => {
        if (!showComments) {
            setShowComments(true);
            // Always fetch fresh comments when opening, or if not loaded
            if (!commentsLoaded || true) { // Force refresh on open to be safe? Or just stick to no-store if not loaded.
                // Actually, if we want to see new comments, we should re-fetch.
                // For now, let's just respect commentsLoaded but ensure NO CACHE if we do fetch.
            }

            if (!commentsLoaded) {
                const res = await fetch(`/api/posts/interact?postId=${post.id}`, { cache: 'no-store' });
                const data = await res.json();
                if (Array.isArray(data)) {
                    setComments(data);
                    setCommentsLoaded(true);
                }
            }
        } else {
            setShowComments(false);
        }
    };

    const submitComment = async (e: FormEvent) => {
        e.preventDefault();
        if (isGuest) { onGuestAction?.(); return; }
        if (!newComment.trim()) return;
        setSendingComment(true);

        const res = await fetch('/api/posts/interact', {
            method: 'POST',
            body: JSON.stringify({ action: 'comment', postId: post.id, content: newComment })
        });

        if (res.ok) {
            setComments(current => [
                ...current,
                {
                    id: Date.now(),
                    post_id: post.id,
                    author_id: currentUser.id,
                    content: newComment,
                    likes: 0,
                    created_at: new Date(),
                    author_name: currentUser.username,
                    author_avatar: currentUser.avatar,
                    author_role: currentUser.role,
                }
            ]);
            setNewComment('');
            if (!showComments) setShowComments(true); // Auto expand if adding new
        }
        setSendingComment(false);
    };

    const visibleComments = showComments ? comments : comments.slice(0, 2);
    const portalTarget = typeof document === 'undefined' ? null : document.body;

    return (
        <div
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
                    <Avatar className="post-author-avatar" value={post.author_avatar} fallback="👤" size={40} style={{ background: '#fab1a0', fontSize: '1.2rem', border: '2px solid white' }} />
                </button>
                <div className="post-author-meta">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#2d3436' }}>{post.author_name}</span>
                        <RoleBadge role={post.author_role} compact />
                    </div>
                    <div suppressHydrationWarning style={{ fontSize: '0.8rem', opacity: 0.6 }}>{new Date(post.created_at).toLocaleDateString()}</div>
                </div>

                <div className="post-card-actions">
                    <div className={`post-tag-badge ${isAnnouncement ? 'is-announcement' : ''}`}>
                        {isAnnouncement ? '📢 announcement' : `#${post.tag || 'general'}`}
                    </div>
                    {/* Bookmark Button */}
                    <motion.button
                        onClick={handleBookmark}
                        className="reaction-button"
                        whileTap={{ scale: 0.82 }}
                        animate={bookmarkBurst ? { scale: [1, 1.22, 1], rotate: [0, -8, 7, 0] } : { scale: 1, rotate: 0 }}
                        transition={{ duration: 0.32 }}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem',
                            color: isBookmarked ? '#fdcb6e' : '#b2bec3', transition: 'color 0.2s'
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
                    {/* Delete Button (Owner or Moderator) */}
                    {canDeletePost && (
                        <button
                            onClick={handleDeletePost}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#b2bec3', transition: 'color 0.2s' }}
                            title={post.author_id === currentUser?.id ? 'Delete Post' : 'Admin Delete Post'}
                        >🗑️</button>
                    )}
                </div>
            </div>

            {/* Content Body */}
            <div>
                <h3 style={{ marginBottom: '10px', fontSize: '1.2rem' }}>{post.title}</h3>

                {/* Truncated Text */}
                <div style={{
                    position: 'relative',
                    maxHeight: expanded ? 'none' : '100px',
                    overflow: 'hidden',
                    lineHeight: '1.6',
                    color: '#4a4a4a'
                }}>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{post.content}</p>
                    {/* Fade Out Overlay if truncated */}
                    {!expanded && post.content.length > 150 && (
                        <div style={{
                            position: 'absolute', bottom: 0, left: 0, width: '100%', height: '40px',
                            background: 'linear-gradient(transparent, rgba(255,255,255,0.9))',
                            display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
                        }} />
                    )}
                </div>

                {/* Expand Button */}
                {post.content.length > 150 && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        style={{ background: 'none', border: 'none', color: '#6c5ce7', fontSize: '0.9rem', marginTop: '5px', cursor: 'pointer', fontWeight: 600 }}
                    >
                        {expanded ? 'Show Less' : 'Read More...'}
                    </button>
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
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: '#636e72',
                        display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 600
                    }}
                >
                    💬 Comment {commentsLoaded && comments.length > 0 ? `(${comments.length})` : ''}
                </button>
            </div>

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
                                            <Avatar value={c.author_avatar} fallback="👤" size={24} style={{ background: '#b2bec3', fontSize: '0.8rem' }} />
                                        </button>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{c.author_name}</span>
                                                    <RoleBadge role={c.author_role} compact />
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
                                                                    +1
                                                                </motion.span>
                                                            )}
                                                        </AnimatePresence>
                                                        {c.has_liked ? '❤️' : '🤍'}
                                                    </motion.button>
                                                    {!isGuest && currentUser && (c.author_id === currentUser.id || canModerate) && (
                                                        <button
                                                            onClick={() => handleDeleteComment(c.id)}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#b2bec3', fontSize: '0.8rem' }}
                                                            title={c.author_id === currentUser.id ? 'Delete Comment' : 'Admin Delete Comment'}
                                                        >🗑️</button>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: '#444' }}>{c.content}</div>
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
                                <form onSubmit={submitComment} style={{ display: 'flex', gap: '10px' }}>
                                    <input
                                        className="glass-input"
                                        style={{ flex: 1, padding: '8px 12px', fontSize: '0.9rem', background: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '8px' }}
                                        placeholder="Write a comment..."
                                        value={newComment}
                                        onChange={e => setNewComment(e.target.value)}
                                    />
                                    <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} disabled={sendingComment}>
                                        Send
                                    </button>
                                </form>
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
