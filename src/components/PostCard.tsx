/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useRef, useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Post, Comment, User } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import { isAdminRole } from '@/lib/roles';
import { canUseMemberInteractions, getInteractionBlockedMessage, isReadOnlyRole } from '@/lib/access';
import Avatar from './Avatar';
import UserBadges from './UserBadges';
import PostTextComposer, { type PostTextComposerApi } from './PostTextComposer';
import PostContentRenderer from './PostContentRenderer';
import { clearCachedJson } from '@/lib/clientJsonCache';
import { applyAuthorAvatarPatch, loadAvatarPatches } from '@/lib/clientAvatarHydration';
import { getImageDisplayUrl } from '@/lib/imageProxy';
import { getPostAttachmentUrls } from '@/lib/forumAttachments';
import {
    compressForumImageForUpload,
    formatFileSize,
    FORUM_ALLOWED_IMAGE_TYPES,
    FORUM_COMPRESSIBLE_IMAGE_TYPES,
    MAX_FORUM_IMAGE_SIZE,
} from '@/lib/clientImageUpload';
import { normalizePostContentFormat, type PostContentFormat } from '@/lib/forumContent';

function shortPreview(text?: string | null) {
    if (!text) return '';
    const compact = text.replace(/\s+/g, ' ').trim();
    return compact.length > 80 ? `${compact.slice(0, 80)}...` : compact;
}

function articleCardPreview(text?: string | null) {
    return shortPreview(
        String(text || '')
            .replace(/阅读全文[:：]\s*\/?articles\/\d+/gi, '')
            .replace(/Read full article[:：]\s*\/?articles\/\d+/gi, ''),
    );
}

function formatPostDate(value: Date | string) {
    return new Intl.DateTimeFormat('zh-CN', {
        month: 'short',
        day: 'numeric',
    }).format(new Date(value));
}

function formatShortDateTime(value: Date | string, action: '发帖' | '回复') {
    const date = new Intl.DateTimeFormat('zh-CN', {
        month: 'numeric',
        day: 'numeric',
    }).format(new Date(value));
    const time = new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(value));
    return `${date} ${time} ${action}`;
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

type CommentImageDraft = {
    file: File;
    previewUrl: string;
    status: string;
};

export default function PostCard({ post, currentUser, onDeleted, onGuestAction }: { post: Post, currentUser: User | null, onDeleted?: (id: number) => void, onGuestAction?: () => void }) {
    const router = useRouter();
    const isGuest = !currentUser;
    const canInteract = canUseMemberInteractions(currentUser);
    const isReadOnlyUser = isReadOnlyRole(currentUser?.role);
    const canModerate = isAdminRole(currentUser?.role);
    const canDeletePost = !!currentUser && (post.author_id === currentUser.id || canModerate);
    const canEditPost = !!currentUser && post.author_id === currentUser.id;
    const isArticleCard = post.type === 'article' && !!post.article_id;
    const [displayTitle, setDisplayTitle] = useState(post.title);
    const [displayContent, setDisplayContent] = useState(post.content);
    const [displayContentFormat, setDisplayContentFormat] = useState<PostContentFormat>(normalizePostContentFormat(post.content_format));
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
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsLoadError, setCommentsLoadError] = useState('');
    const [commentCount, setCommentCount] = useState(post.comment_count || 0);
    const [locationHash, setLocationHash] = useState('');

    const [newComment, setNewComment] = useState('');
    const [commentImage, setCommentImage] = useState<CommentImageDraft | null>(null);
    const [commentImageError, setCommentImageError] = useState('');
    const [sendingComment, setSendingComment] = useState(false);
    const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(post.title);
    const [editContent, setEditContent] = useState(post.content);
    const [editContentFormat, setEditContentFormat] = useState<PostContentFormat>(normalizePostContentFormat(post.content_format));
    const [editTag, setEditTag] = useState(post.tag || 'general');
    const [savingEdit, setSavingEdit] = useState(false);
    const [editError, setEditError] = useState('');
    const [interactionMessage, setInteractionMessage] = useState('');
    const editComposerRef = useRef<PostTextComposerApi | null>(null);

    const postAttachmentUrls = getPostAttachmentUrls(post);
    const [imageModalUrls, setImageModalUrls] = useState<string[]>([]);
    const [imageModalIndex, setImageModalIndex] = useState(0);
    const [attachmentImageFailed, setAttachmentImageFailed] = useState<Record<string, boolean>>({});
    const showImageModal = imageModalUrls.length > 0;
    const activeImageUrl = imageModalUrls[imageModalIndex] || '';
    const activeImageSrc = getImageDisplayUrl(activeImageUrl);

    useEffect(() => {
        setAttachmentImageFailed({});
    }, [post.attachment_url, post.attachment_urls]);

    useEffect(() => {
        return () => {
            if (commentImage) {
                URL.revokeObjectURL(commentImage.previewUrl);
            }
        };
    }, [commentImage]);

    const loadComments = useCallback(async () => {
        setCommentsLoading(true);
        setCommentsLoadError('');
        try {
            const res = await fetch(`/api/posts/interact?postId=${post.id}`, { cache: 'no-store' });
            const data = await res.json();
            if (Array.isArray(data)) {
                setComments(data);
                setCommentsLoaded(true);
                setCommentCount(data.length);
                setFeaturedComment(pickFeaturedComment(data));
                loadAvatarPatches(data.map(comment => comment.author_id))
                    .then(patches => {
                        if (patches.size === 0) return;
                        setComments(current => current.map(comment => applyAuthorAvatarPatch(comment, patches)));
                        setFeaturedComment(current => current ? applyAuthorAvatarPatch(current, patches) : current);
                    })
                    .catch(error => {
                        console.warn('Comment avatars unavailable:', error);
                    });
                return data;
            }

            console.error("Failed to load comments:", data);
        } catch (err) {
            console.error("Error loading comments:", err);
        } finally {
            setCommentsLoading(false);
        }

        setComments([]);
        setCommentsLoaded(false);
        setCommentsLoadError('Could not load comments. Try again.');
        return [];
    }, [post.id]);

    useEffect(() => {
        const syncHash = () => setLocationHash(window.location.hash || '');
        syncHash();
        window.addEventListener('hashchange', syncHash);

        return () => window.removeEventListener('hashchange', syncHash);
    }, []);

    useEffect(() => {
        const commentTargetPrefix = `#post-${post.id}-comment-`;
        if (!locationHash.startsWith(commentTargetPrefix)) return;

        let active = true;
        const targetId = locationHash.slice(1);

        const scrollToTarget = () => {
            const target = document.getElementById(targetId);
            target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };

        setShowComments(true);
        (commentsLoaded ? Promise.resolve(comments) : loadComments()).then(() => {
            if (!active) return;
            window.requestAnimationFrame(scrollToTarget);
            window.setTimeout(scrollToTarget, 260);
            window.setTimeout(scrollToTarget, 620);
        });

        return () => {
            active = false;
        };
    }, [comments, commentsLoaded, loadComments, locationHash, post.id]);

    useEffect(() => {
        setDisplayTitle(post.title);
        setDisplayContent(post.content);
        setDisplayContentFormat(normalizePostContentFormat(post.content_format));
        setDisplayTag(post.tag || 'general');
        setDisplayUpdatedAt(post.updated_at);
        setEditTitle(post.title);
        setEditContent(post.content);
        setEditContentFormat(normalizePostContentFormat(post.content_format));
        setEditTag(post.tag || 'general');
        setCommentCount(post.comment_count || 0);
        setFeaturedComment(post.featured_comment ?? null);
    }, [post.comment_count, post.content, post.content_format, post.featured_comment, post.tag, post.title, post.updated_at]);

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
            setInteractionMessage(getInteractionBlockedMessage(currentUser, '评论、点赞和收藏'));
            window.setTimeout(() => setInteractionMessage(''), 2600);
            return true;
        }

        return false;
    };

    const openImageModal = (urls: string[], index = 0) => {
        const cleanUrls = urls.map(url => String(url || '').trim()).filter(Boolean);
        if (cleanUrls.length === 0) return;
        setImageModalUrls(cleanUrls);
        setImageModalIndex(Math.min(Math.max(0, index), cleanUrls.length - 1));
    };

    const closeImageModal = () => {
        setImageModalUrls([]);
        setImageModalIndex(0);
    };

    const showPreviousImage = () => {
        setImageModalIndex(current => (current - 1 + imageModalUrls.length) % imageModalUrls.length);
    };

    const showNextImage = () => {
        setImageModalIndex(current => (current + 1) % imageModalUrls.length);
    };

    const markImageFailed = (url: string) => {
        setAttachmentImageFailed(current => ({ ...current, [url]: true }));
    };

    const makeReplyTarget = (comment: Comment | NonNullable<Post['featured_comment']>): Comment => ({
        id: comment.id,
        post_id: post.id,
        author_id: comment.author_id,
        content: comment.content,
        attachment_url: comment.attachment_url,
        likes: comment.likes,
        created_at: comment.created_at,
        reply_author_name: comment.reply_author_name,
        reply_content: comment.reply_content,
        author_name: comment.author_name,
        author_avatar: comment.author_avatar,
        author_avatar_emoji: comment.author_avatar_emoji,
        author_avatar_theme: comment.author_avatar_theme,
        author_role: comment.author_role,
        author_is_creator: comment.author_is_creator,
        author_badge_preferences: comment.author_badge_preferences,
        author_verification_status: comment.author_verification_status,
        has_liked: comment.has_liked,
    });

    const startReplyToComment = async (comment: Comment | NonNullable<Post['featured_comment']>) => {
        if (requireVerifiedInteraction()) return;
        setReplyingTo(makeReplyTarget(comment));
        setShowComments(true);
        if (!commentsLoaded) {
            await loadComments();
        }
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
        clearCachedJson('posts:');
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
        clearCachedJson('posts:');
        if (nextBookmarked) {
            window.dispatchEvent(new CustomEvent('hajimi-xp-feedback', { detail: { amount: 3, label: 'author saved' } }));
        }
        window.dispatchEvent(new Event('hajimi-notifications-refresh'));
    };

    const handleCommentLike = async (commentId: number) => {
        if (requireVerifiedInteraction()) return;
        const sourceComment = comments.find(c => c.id === commentId);
        const sourceFeatured = featuredComment?.id === commentId ? featuredComment : null;
        const nextLikedState = !(sourceComment?.has_liked ?? sourceFeatured?.has_liked ?? false);
        const updateLikes = (currentLikes: number) => Math.max(0, currentLikes + (nextLikedState ? 1 : -1));

        if (sourceComment) {
            const nextComments = comments.map(c => (
                c.id === commentId
                    ? { ...c, likes: updateLikes(c.likes), has_liked: nextLikedState }
                    : c
            ));
            setComments(nextComments);
            setFeaturedComment(pickFeaturedComment(nextComments));
        } else if (sourceFeatured) {
            setFeaturedComment({
                ...sourceFeatured,
                likes: updateLikes(sourceFeatured.likes),
                has_liked: nextLikedState,
            });
        }

        if (nextLikedState) {
            setCommentLikeBurst(commentId);
            window.setTimeout(() => setCommentLikeBurst(current => current === commentId ? null : current), 700);
        }
        await fetch('/api/posts/interact', {
            method: 'POST',
            body: JSON.stringify({ action: 'like_comment', commentId })
        });
        clearCachedJson('posts:');
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
            clearCachedJson('posts:');
            onDeleted(post.id);
        }
    };

    const startEditing = () => {
        setEditTitle(displayTitle);
        setEditContent(displayContent);
        setEditContentFormat('markdown');
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
        const syncedContent = editComposerRef.current?.sync() ?? editContent;
        const syncedContentFormat: PostContentFormat = 'markdown';

        const res = await fetch('/api/posts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                postId: post.id,
                title: editTitle,
                content: syncedContent,
                contentFormat: syncedContentFormat,
                tag: editTag,
            }),
        });

        if (res.ok) {
            clearCachedJson('posts:');
            setDisplayTitle(editTitle.trim());
            setDisplayContent(syncedContent.trim());
            setDisplayContentFormat(syncedContentFormat);
            setEditContent(syncedContent.trim());
            setEditContentFormat(syncedContentFormat);
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
            clearCachedJson('posts:');
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

    const clearCommentImage = () => {
        setCommentImage(current => {
            if (current) URL.revokeObjectURL(current.previewUrl);
            return null;
        });
        setCommentImageError('');
    };

    const prepareCommentImage = async (selectedFile: File) => {
        setCommentImageError('');

        if (!FORUM_ALLOWED_IMAGE_TYPES.includes(selectedFile.type)) {
            setCommentImageError('Only JPEG, PNG, WebP, or GIF images can be uploaded.');
            return;
        }

        if (selectedFile.type === 'image/gif' && selectedFile.size > MAX_FORUM_IMAGE_SIZE) {
            setCommentImageError('Animated GIFs must be 1 MB or smaller.');
            return;
        }

        let nextFile = selectedFile;
        let status = `Ready: ${formatFileSize(selectedFile.size)}.`;

        if (selectedFile.size > MAX_FORUM_IMAGE_SIZE) {
            if (!FORUM_COMPRESSIBLE_IMAGE_TYPES.has(selectedFile.type)) {
                setCommentImageError('Image must be 1 MB or smaller.');
                return;
            }

            try {
                nextFile = await compressForumImageForUpload(selectedFile);
            } catch {
                setCommentImageError('Could not optimize this image. Try a smaller JPEG, PNG, or WebP file.');
                return;
            }

            if (nextFile.size > MAX_FORUM_IMAGE_SIZE) {
                setCommentImageError(`This image is still ${formatFileSize(nextFile.size)} after compression. Try a smaller image or crop it first.`);
                return;
            }

            status = `Optimized from ${formatFileSize(selectedFile.size)} to ${formatFileSize(nextFile.size)}.`;
        }

        setCommentImage(current => {
            if (current) URL.revokeObjectURL(current.previewUrl);
            return {
                file: nextFile,
                previewUrl: URL.createObjectURL(nextFile),
                status,
            };
        });
    };

    const handleCommentImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0] || null;
        event.target.value = '';
        if (!selectedFile) return;
        await prepareCommentImage(selectedFile);
    };

    const submitComment = async (e: FormEvent) => {
        e.preventDefault();
        if (requireVerifiedInteraction()) return;
        if (!newComment.trim() && !commentImage) return;
        setSendingComment(true);
        const commentText = newComment.trim();
        const parentCommentId = replyingTo?.id;
        const formData = new FormData();
        formData.append('action', 'comment');
        formData.append('postId', String(post.id));
        formData.append('content', commentText);
        if (parentCommentId) formData.append('parentCommentId', String(parentCommentId));
        if (commentImage) formData.append('file', commentImage.file);

        const res = await fetch('/api/posts/interact', {
            method: 'POST',
            body: formData,
        });

        if (res.ok) {
            clearCachedJson('posts:');
            setCommentXpBurst(count => {
                const next = count + 1;
                window.setTimeout(() => setCommentXpBurst(current => current === next ? 0 : current), 800);
                return next;
            });
            setNewComment('');
            clearCommentImage();
            setReplyingTo(null);
            setShowComments(true);
            await loadComments();
        } else {
            const data = await res.json().catch(() => null);
            setCommentImageError(data?.error || 'Could not send this comment.');
        }
        setSendingComment(false);
    };

    const portalTarget = typeof document === 'undefined' ? null : document.body;
    const featuredCommentBadgeUser = featuredComment ? {
        username: featuredComment.author_name || '',
        role: featuredComment.author_role || 'student',
        is_creator: featuredComment.author_is_creator,
        badge_preferences: featuredComment.author_badge_preferences,
        verification_status: featuredComment.author_verification_status || undefined,
    } : null;
    const visibleComments = showComments ? comments : [];
    const hasFeaturedPreview = !isArticleCard && !isEditing && !showComments && featuredComment && featuredCommentBadgeUser;
    const hasVisibleComments = showComments && commentsLoaded && comments.length > 0;
    const hasCommentLoadingPlaceholder = showComments && commentsLoading && comments.length === 0;
    const hasCommentError = showComments && !!commentsLoadError;
    const commentComposer = canInteract ? (
        <form onSubmit={submitComment} className="comment-compose-form">
            {replyingTo && (
                <div className="comment-reply-pill">
                    Replying to @{replyingTo.author_name}
                    <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">×</button>
                </div>
            )}
            {commentImage && (
                <div className="comment-image-draft">
                    <img src={commentImage.previewUrl} alt="" />
                    <span>{commentImage.status}</span>
                    <button type="button" onClick={clearCommentImage} aria-label="Remove comment image">×</button>
                </div>
            )}
            {commentImageError && <div className="comment-image-error">{commentImageError}</div>}
            <input
                className="glass-input"
                style={{ flex: '1 1 220px', padding: '8px 12px', fontSize: '0.9rem', background: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '8px' }}
                placeholder={replyingTo ? `Reply to ${replyingTo.author_name}...` : 'Write a comment...'}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
            />
            <label className="comment-image-button" title="Attach image">
                🖼️
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleCommentImageChange}
                    disabled={sendingComment}
                />
            </label>
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }} disabled={sendingComment || (!newComment.trim() && !commentImage)}>
                Send
            </button>
        </form>
    ) : (
        <div className="forum-verification-callout">
            <span>{isGuest ? '登录后可以提交认证并参与评论。' : isReadOnlyUser ? getInteractionBlockedMessage(currentUser, '评论和回复') : '完成 Hajimi 认证后可以评论和回复。'}</span>
            <button type="button" onClick={() => router.push(isGuest ? '/login' : isReadOnlyUser ? '/functions' : '/profile')}>{isGuest ? '登录' : isReadOnlyUser ? '体验项目' : '去认证'}</button>
        </div>
    );
    const featuredCommentPreview = hasFeaturedPreview ? (
        <div className="featured-comment-preview">
            <div className="featured-comment-kicker">🔥 最火评论</div>
            <div className="featured-comment-body">
                <button
                    type="button"
                    className="avatar-link-button comment-avatar-button"
                    onClick={() => openProfile(featuredComment.author_id)}
                    aria-label={`View ${featuredComment.author_name || 'comment author'} profile`}
                >
                    <Avatar value={featuredComment.author_avatar} emoji={featuredComment.author_avatar_emoji} theme={featuredComment.author_avatar_theme} fallback="👤" size={24} style={{ fontSize: '0.8rem' }} />
                </button>
                <div className="featured-comment-copy">
                    <div className="featured-comment-author">
                        <span>{featuredComment.author_name}</span>
                        <UserBadges user={featuredCommentBadgeUser} compact iconOnly />
                        <small suppressHydrationWarning className="inline-exact-time-chip featured-comment-time-chip">
                            {formatShortDateTime(featuredComment.created_at, '回复')}
                        </small>
                    </div>
                    {featuredComment.reply_author_name && (
                        <div className="comment-reply-context">
                            Replying to @{featuredComment.reply_author_name}: {shortPreview(featuredComment.reply_content)}
                        </div>
                    )}
                    <div className="comment-content-line">
                        {featuredComment.content && <PostContentRenderer content={shortPreview(featuredComment.content)} format="plain" />}
                        {featuredComment.attachment_url && (
                            <button
                                type="button"
                                className="comment-image-thumb"
                                onClick={() => openImageModal([featuredComment.attachment_url || ''])}
                                aria-label="Open comment image"
                            >
                                <img src={getImageDisplayUrl(featuredComment.attachment_url)} alt="" />
                            </button>
                        )}
                    </div>
                    <div className="featured-comment-actions">
                        <motion.button
                            type="button"
                            onClick={() => handleCommentLike(featuredComment.id)}
                            className={`featured-comment-action reaction-button ${featuredComment.has_liked ? 'is-liked' : ''}`}
                            whileTap={{ scale: 0.86 }}
                            animate={commentLikeBurst === featuredComment.id ? { scale: [1, 1.16, 1] } : { scale: 1 }}
                            transition={{ duration: 0.25 }}
                        >
                            <AnimatePresence>
                                {commentLikeBurst === featuredComment.id && (
                                    <motion.span
                                        key={featuredComment.id}
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
                            {featuredComment.has_liked ? '❤️' : '🤍'} {featuredComment.likes}
                        </motion.button>
                        <button
                            type="button"
                            className="featured-comment-action"
                            onClick={() => startReplyToComment(featuredComment)}
                        >
                            Reply
                        </button>
                    </div>
                </div>
            </div>
        </div>
    ) : null;

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
                    <Avatar className="post-author-avatar" value={post.author_avatar} emoji={post.author_avatar_emoji} theme={post.author_avatar_theme} fallback="👤" size={40} style={{ fontSize: '1.2rem', border: '2px solid white' }} />
                </button>
                <div className="post-author-meta">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#2d3436' }}>{post.author_name}</span>
                        <UserBadges user={authorBadgeUser} compact iconOnly />
                    </div>
                    <div suppressHydrationWarning className="post-time-hover" style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                        <span>{formatPostDate(post.created_at)}</span>
                        <span className="inline-exact-time-chip post-exact-time-chip">{formatShortDateTime(post.created_at, '发帖')}</span>
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
                        {canEditPost && !isArticleCard && (
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
                {isArticleCard ? (
                    <div className="forum-article-card">
                        <span className="forum-article-card-mark">Article</span>
                        <div className="forum-article-card-copy">
                            <small>{'\u6765\u81ea\u4e2a\u4eba\u4e3b\u9875\u7684\u957f\u6587'}</small>
                            <h3>{displayTitle}</h3>
                            <p>{articleCardPreview(displayContent)}</p>
                            <div className="forum-article-card-meta">
                                <span>#{displayTag || 'general'}</span>
                                <span>{formatPostDate(post.created_at)}</span>
                                <span>{likes} likes</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="forum-article-open"
                            onClick={() => router.push(`/articles/${post.article_id}`)}
                        >
                            {'\u9605\u8bfb\u5168\u6587'}
                        </button>
                    </div>
                ) : isEditing ? (
                    <form onSubmit={saveEdit} className="post-edit-form">
                        <input
                            className="glass-input"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            maxLength={80}
                            required
                        />
                        <PostTextComposer
                            value={editContent}
                            onChange={setEditContent}
                            format={editContentFormat}
                            onFormatChange={setEditContentFormat}
                            editorRef={api => {
                                editComposerRef.current = api;
                            }}
                            rows={6}
                        />
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
                                <PostContentRenderer content={displayContent} format={displayContentFormat} />
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

                {postAttachmentUrls.length > 0 && (
                    <div className={`post-image-grid count-${Math.min(postAttachmentUrls.length, 3)}`} aria-label="Post images">
                        {postAttachmentUrls.slice(0, 3).map((url, index) => {
                            const imageSrc = getImageDisplayUrl(url);
                            const failed = attachmentImageFailed[url];

                            return (
                                <button
                                    key={url}
                                    type="button"
                                    className="post-image-attachment"
                                    onClick={() => openImageModal(postAttachmentUrls, index)}
                                    aria-label={`Open image ${index + 1}`}
                                >
                                    {imageSrc && !failed ? (
                                        <img
                                            src={imageSrc}
                                            alt=""
                                            loading="lazy"
                                            decoding="async"
                                            fetchPriority="low"
                                            onError={() => markImageFailed(url)}
                                        />
                                    ) : (
                                        <span className="post-image-fallback">
                                            <strong>图片暂时加载失败</strong>
                                            <small>点击可尝试打开原图</small>
                                        </span>
                                    )}
                                </button>
                            );
                        })}
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
                    onClick={isArticleCard ? () => router.push(`/articles/${post.article_id}`) : toggleComments}
                    className="reaction-button"
                    style={{
                        position: 'relative',
                        background: 'none', border: 'none', cursor: 'pointer', color: '#636e72',
                        display: isArticleCard ? 'none' : 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 600
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
                    <button type="button" onClick={() => router.push(isReadOnlyUser ? '/functions' : '/profile')}>{isReadOnlyUser ? '体验项目' : '去认证'}</button>
                </div>
            )}

            {/* Comments Section (Always Rendered if Loaded) */}
            <AnimatePresence>
                {!isArticleCard && (featuredCommentPreview || hasVisibleComments || hasCommentLoadingPlaceholder || hasCommentError) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div className="post-comments-panel">
                            {featuredCommentPreview}

                            {hasCommentLoadingPlaceholder && (
                                <div style={{ opacity: 0.58, fontStyle: 'italic', fontSize: '0.9rem', marginBottom: '10px' }}>Loading comments...</div>
                            )}

                            {hasCommentError && (
                                <div style={{ opacity: 0.65, fontStyle: 'italic', fontSize: '0.9rem', marginBottom: '10px' }}>{commentsLoadError}</div>
                            )}

                            {hasVisibleComments && (
                                <div className="post-comments-list">
                                    {visibleComments.map(c => (
                                        <div key={c.id} id={`post-${post.id}-comment-${c.id}`} className="comment-row-time-hover comment-row">
                                            <button
                                                type="button"
                                                className="avatar-link-button comment-avatar-button"
                                                onClick={() => openProfile(c.author_id)}
                                                aria-label={`View ${c.author_name || 'comment author'} profile`}
                                            >
                                                <Avatar value={c.author_avatar} emoji={c.author_avatar_emoji} theme={c.author_avatar_theme} fallback="👤" size={24} style={{ fontSize: '0.8rem' }} />
                                            </button>
                                            <div className="comment-main">
                                                <div className="comment-header-line">
                                                    <div className="comment-author-line">
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
                                                        <span suppressHydrationWarning className="inline-exact-time-chip comment-exact-time-chip">
                                                            {formatShortDateTime(c.created_at, '回复')}
                                                        </span>
                                                    </div>
                                                    <div className="comment-actions-line">
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
                                                                onClick={() => startReplyToComment(c)}
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
                                                <div className="comment-content-line" style={{ fontSize: '0.9rem', color: '#444', whiteSpace: 'pre-wrap' }}>
                                                    {c.content && <PostContentRenderer content={c.content} format="plain" />}
                                                    {c.attachment_url && (
                                                        <button
                                                            type="button"
                                                            className="comment-image-thumb"
                                                            onClick={() => openImageModal([c.attachment_url || ''])}
                                                            aria-label="Open comment image"
                                                        >
                                                            <img src={getImageDisplayUrl(c.attachment_url)} alt="" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Comment Input - Only visible when fully expanded or if no comments yet */}
                            {showComments && !commentsLoading && commentComposer}
                        </div>
                    </motion.div>
                )}
                {/* Always allow commenting even if no comments exist yet, if showComments is true */}
                {!isArticleCard && showComments && commentsLoaded && !commentsLoading && !commentsLoadError && comments.length === 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                    >
                        <div className="post-comments-panel">
                            <div style={{ opacity: 0.5, fontStyle: 'italic', fontSize: '0.9rem', marginBottom: '10px' }}>No comments yet.</div>
                            {commentComposer}
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
                            onClick={closeImageModal}
                            style={{
                                position: 'fixed', inset: 0,
                                background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)',
                                zIndex: 999999, /* Very high z-index */
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'default'
                            }}
                        >
                            {activeImageSrc && !attachmentImageFailed[activeImageUrl] ? (
                                <motion.img
                                    initial={{ scale: 0.9 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0.9 }}
                                    src={activeImageSrc}
                                    alt="Full size"
                                    onClick={e => e.stopPropagation()}
                                    onError={() => markImageFailed(activeImageUrl)}
                                    style={{
                                        maxWidth: '95vw', maxHeight: '95vh',
                                        borderRadius: '4px',
                                        boxShadow: '0 0 50px rgba(0,0,0,0.5)',
                                        objectFit: 'contain'
                                    }}
                                />
                            ) : (
                                <a
                                    href={activeImageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="post-image-modal-fallback"
                                >
                                    原图暂时无法通过站内加载，点击打开原图
                                </a>
                            )}

                            {imageModalUrls.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        className="post-image-modal-nav is-prev"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            showPreviousImage();
                                        }}
                                        aria-label="Previous image"
                                    >
                                        ‹
                                    </button>
                                    <button
                                        type="button"
                                        className="post-image-modal-nav is-next"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            showNextImage();
                                        }}
                                        aria-label="Next image"
                                    >
                                        ›
                                    </button>
                                    <div className="post-image-modal-count">
                                        {imageModalIndex + 1} / {imageModalUrls.length}
                                    </div>
                                </>
                            )}

                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeImageModal();
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
