/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useMemo, useRef, useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Post, Comment, User, type CommentsPage, type RecentLiker } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import { isAdminRole } from '@/lib/roles';
import { canUseMemberInteractions, getInteractionBlockedMessage, isReadOnlyRole } from '@/lib/access';
import Avatar from './Avatar';
import UserBadges from './UserBadges';
import PostTextComposer, { type PostTextComposerApi } from './PostTextComposer';
import PostContentRenderer from './PostContentRenderer';
import { clearCachedJson } from '@/lib/clientJsonCache';
import { applyAuthorAvatarPatch, applyAvatarPatch, loadAvatarPatches } from '@/lib/clientAvatarHydration';
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
import { NOTIFICATION_TARGET_EVENT, type NotificationTargetDetail } from '@/lib/notificationNavigation';

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

type CommentImageDraft = {
    file: File;
    previewUrl: string;
    status: string;
};

function getMarkdownImageUrls(content: string) {
    return Array.from(content.matchAll(/!\[[^\]\n]*\]\((https?:\/\/[^\s)]+)\)/g))
        .map(match => match[1])
        .filter(Boolean);
}

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
    const isAnnouncement = displayTag === 'announcement';
    const [likes, setLikes] = useState(post.likes);
    const [hasLiked, setHasLiked] = useState(!!post.has_liked);
    const [recentLikers, setRecentLikers] = useState<RecentLiker[]>(post.recent_likers || []);
    const likeRequestRef = useRef(false);
    const [likeRequestPending, setLikeRequestPending] = useState(false);
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
    const [recentComments, setRecentComments] = useState<Comment[]>(post.recent_comments || []);
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentsLoaded, setCommentsLoaded] = useState(false);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsLoadError, setCommentsLoadError] = useState('');
    const [commentCount, setCommentCount] = useState(post.comment_count || 0);
    const [commentsPage, setCommentsPage] = useState(1);
    const [commentsTotalPages, setCommentsTotalPages] = useState(Math.max(1, Math.ceil((post.comment_count || 0) / 10)));
    const [hotCommentId, setHotCommentId] = useState<number | null>(post.hot_comment_id ? Number(post.hot_comment_id) : null);
    const [commentTargetMessage, setCommentTargetMessage] = useState('');
    const [locationHash, setLocationHash] = useState('');
    const [notificationTargetRequest, setNotificationTargetRequest] = useState(0);

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

    const postAttachmentUrls = useMemo(() => getPostAttachmentUrls(post), [post]);
    const visiblePostAttachmentUrls = useMemo(() => {
        const inlineImageUrls = new Set(getMarkdownImageUrls(displayContent));
        return postAttachmentUrls.filter(url => !inlineImageUrls.has(url));
    }, [displayContent, postAttachmentUrls]);
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

    const loadComments = useCallback(async ({ page = 1, commentId }: { page?: number; commentId?: number } = {}): Promise<CommentsPage | null> => {
        setCommentsLoading(true);
        setCommentsLoadError('');
        setCommentTargetMessage('');
        try {
            const params = new URLSearchParams({
                postId: String(post.id),
                page: String(page),
                limit: '10',
            });
            if (commentId) params.set('commentId', String(commentId));
            const res = await fetch(`/api/posts/interact?${params.toString()}`, { cache: 'no-store' });
            const data = await res.json() as Partial<CommentsPage>;
            if (Array.isArray(data.comments)) {
                const nextComments = data.comments as Comment[];
                setComments(nextComments);
                setCommentsLoaded(true);
                setCommentsPage(Number(data.page || page));
                setCommentsTotalPages(Math.max(1, Number(data.totalPages || 1)));
                setCommentCount(Number(data.total || 0));
                setHotCommentId(data.hotCommentId ? Number(data.hotCommentId) : null);
                if (Number(data.page || page) === 1) {
                    setRecentComments(nextComments.slice(0, 3));
                }
                if (commentId && data.targetFound === false) {
                    setCommentTargetMessage('This comment is no longer available.');
                }
                loadAvatarPatches(nextComments.map(comment => comment.author_id))
                    .then(patches => {
                        if (patches.size === 0) return;
                        setComments(current => current.map(comment => applyAuthorAvatarPatch(comment, patches)));
                        setRecentComments(current => current.map(comment => applyAuthorAvatarPatch(comment, patches)));
                    })
                    .catch(error => {
                        console.warn('Comment avatars unavailable:', error);
                    });
                return data as CommentsPage;
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
        return null;
    }, [post.id]);

    useEffect(() => {
        const syncHash = () => setLocationHash(window.location.hash || '');
        const handleNotificationTarget = (event: Event) => {
            const detail = (event as CustomEvent<NotificationTargetDetail>).detail;
            const nextHash = detail?.hash || window.location.hash || '';
            if (!nextHash) return;
            setLocationHash(nextHash);
            setNotificationTargetRequest(current => current + 1);
        };

        syncHash();
        window.addEventListener('hashchange', syncHash);
        window.addEventListener(NOTIFICATION_TARGET_EVENT, handleNotificationTarget);

        return () => {
            window.removeEventListener('hashchange', syncHash);
            window.removeEventListener(NOTIFICATION_TARGET_EVENT, handleNotificationTarget);
        };
    }, []);

    useEffect(() => {
        const commentTargetPrefix = `#post-${post.id}-comment-`;
        if (!locationHash.startsWith(commentTargetPrefix)) return;

        let active = true;
        const targetId = locationHash.slice(1);
        const targetCommentId = Number(locationHash.slice(commentTargetPrefix.length));

        const scrollToTarget = () => {
            const target = document.getElementById(targetId);
            target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };

        setShowComments(true);
        loadComments({ commentId: targetCommentId }).then(() => {
            if (!active) return;
            window.requestAnimationFrame(scrollToTarget);
            window.setTimeout(scrollToTarget, 260);
            window.setTimeout(scrollToTarget, 620);
        });

        return () => {
            active = false;
        };
    }, [loadComments, locationHash, notificationTargetRequest, post.id]);

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
        setLikes(post.likes);
        setHasLiked(!!post.has_liked);
        setRecentLikers(post.recent_likers || []);
        setRecentComments(post.recent_comments || []);
        setCommentsPage(1);
        setCommentsTotalPages(Math.max(1, Math.ceil((post.comment_count || 0) / 10)));
        setHotCommentId(post.hot_comment_id ? Number(post.hot_comment_id) : null);
    }, [post.comment_count, post.content, post.content_format, post.has_liked, post.hot_comment_id, post.likes, post.recent_comments, post.recent_likers, post.tag, post.title, post.updated_at]);

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

    const makeReplyTarget = (comment: Comment): Comment => ({
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

    const startReplyToComment = async (comment: Comment, fromPreview = false) => {
        if (requireVerifiedInteraction()) return;
        setReplyingTo(makeReplyTarget(comment));
        setShowComments(true);
        if (fromPreview || !commentsLoaded) {
            await loadComments({ page: 1 });
        }
    };

    const handleLike = async () => {
        if (requireVerifiedInteraction() || likeRequestRef.current) return;
        likeRequestRef.current = true;
        setLikeRequestPending(true);
        const previousLiked = hasLiked;
        const previousLikes = likes;
        // Optimistic toggle
        const newLikedState = !previousLiked;
        setHasLiked(newLikedState);
        setLikes(p => Math.max(0, newLikedState ? p + 1 : p - 1));
        if (newLikedState) {
            setLikeBurst(count => {
                const next = count + 1;
                window.setTimeout(() => setLikeBurst(current => current === next ? 0 : current), 700);
                return next;
            });
        }

        try {
            const response = await fetch('/api/posts/interact', {
                method: 'POST',
                body: JSON.stringify({ action: 'like', postId: post.id })
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.error || 'Could not update this like.');
            }
            if (typeof data?.hasLiked === 'boolean') setHasLiked(data.hasLiked);
            if (typeof data?.likes === 'number') setLikes(data.likes);
            if (Array.isArray(data?.recent_likers)) {
                const nextRecentLikers = data.recent_likers as RecentLiker[];
                setRecentLikers(nextRecentLikers);
                void loadAvatarPatches(nextRecentLikers.map(liker => liker.id))
                    .then(patches => {
                        if (patches.size === 0) return;
                        setRecentLikers(current => current.map(liker => applyAvatarPatch(liker, patches)));
                    })
                    .catch(error => console.warn('Recent liker avatars unavailable:', error));
            }
            clearCachedJson('posts:');
            window.dispatchEvent(new Event('hajimi-notifications-refresh'));
        } catch (error) {
            setHasLiked(previousLiked);
            setLikes(previousLikes);
            setInteractionMessage(error instanceof Error ? error.message : 'Could not update this like.');
            window.setTimeout(() => setInteractionMessage(''), 2600);
        } finally {
            likeRequestRef.current = false;
            setLikeRequestPending(false);
        }
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
        const sourceRecent = recentComments.find(c => c.id === commentId);
        const nextLikedState = !(sourceComment?.has_liked ?? sourceRecent?.has_liked ?? false);
        const updateLikes = (currentLikes: number) => Math.max(0, currentLikes + (nextLikedState ? 1 : -1));

        if (sourceComment) {
            setComments(current => current.map(c => (
                c.id === commentId
                    ? { ...c, likes: updateLikes(c.likes), has_liked: nextLikedState }
                    : c
            )));
        }
        if (sourceRecent) {
            setRecentComments(current => current.map(c => (
                c.id === commentId
                    ? { ...c, likes: updateLikes(c.likes), has_liked: nextLikedState }
                    : c
            )));
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
        const comment = comments.find(c => c.id === commentId) || recentComments.find(c => c.id === commentId);
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
            setComments(current => current.filter(c => c.id !== commentId));
            setRecentComments(current => current.filter(c => c.id !== commentId));
            setCommentCount(current => Math.max(0, current - 1));
            await loadComments({ page: commentsLoaded ? commentsPage : 1 });
        }
    };

    const toggleComments = async () => {
        if (!showComments) {
            setShowComments(true);
            await loadComments({ page: 1 });
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
            await loadComments({ page: 1 });
        } else {
            const data = await res.json().catch(() => null);
            setCommentImageError(data?.error || 'Could not send this comment.');
        }
        setSendingComment(false);
    };

    const portalTarget = typeof document === 'undefined' ? null : document.body;
    const previewComments = recentComments.slice(0, 3);
    const hasPreviewComments = !isArticleCard && !isEditing && !showComments && previewComments.length > 0;
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
    const renderCommentRow = (comment: Comment, fromPreview = false) => {
        const commentBadgeUser = {
            username: comment.author_name || '',
            role: comment.author_role || 'student',
            is_creator: comment.author_is_creator,
            badge_preferences: comment.author_badge_preferences,
            verification_status: comment.author_verification_status || undefined,
        };
        const isHot = Number(comment.id) === Number(hotCommentId);

        return (
            <div key={comment.id} id={`post-${post.id}-comment-${comment.id}`} className="comment-row-time-hover comment-row">
                <button
                    type="button"
                    className="avatar-link-button comment-avatar-button"
                    onClick={() => openProfile(comment.author_id)}
                    aria-label={`View ${comment.author_name || 'comment author'} profile`}
                >
                    <Avatar value={comment.author_avatar} emoji={comment.author_avatar_emoji} theme={comment.author_avatar_theme} fallback="👤" size={24} style={{ fontSize: '0.8rem' }} />
                </button>
                <div className="comment-main">
                    <div className="comment-header-line">
                        <div className="comment-author-line">
                            {isHot && <span className="comment-hot-indicator" title="最火评论" aria-label="最火评论">🔥</span>}
                            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{comment.author_name}</span>
                            <UserBadges user={commentBadgeUser} compact iconOnly />
                            <span suppressHydrationWarning className="inline-exact-time-chip comment-exact-time-chip">
                                {formatShortDateTime(comment.created_at, '回复')}
                            </span>
                        </div>
                        <div className="comment-actions-line">
                            {comment.likes > 0 && <span>{comment.likes} likes</span>}
                            <motion.button
                                type="button"
                                onClick={() => handleCommentLike(comment.id)}
                                className="reaction-button"
                                whileTap={{ scale: 0.84 }}
                                animate={commentLikeBurst === comment.id ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                                transition={{ duration: 0.25 }}
                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: comment.has_liked ? '#ff7675' : '#b2bec3' }}
                            >
                                <AnimatePresence>
                                    {commentLikeBurst === comment.id && (
                                        <motion.span
                                            key={comment.id}
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
                                {comment.has_liked ? '❤️' : '🤍'}
                            </motion.button>
                            {!isGuest && canInteract && (
                                <button
                                    type="button"
                                    onClick={() => startReplyToComment(comment, fromPreview)}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6c5ce7', fontSize: '0.8rem', fontWeight: 700 }}
                                    title={`Reply to ${comment.author_name}`}
                                >Reply</button>
                            )}
                            {!isGuest && currentUser && (comment.author_id === currentUser.id || canModerate) && (
                                <button
                                    type="button"
                                    onClick={() => handleDeleteComment(comment.id)}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#b2bec3', fontSize: '0.8rem' }}
                                    title={comment.author_id === currentUser.id ? 'Delete Comment' : 'Admin Delete Comment'}
                                >🗑️</button>
                            )}
                        </div>
                    </div>
                    {comment.reply_author_name && (
                        <div className="comment-reply-context">
                            Replying to @{comment.reply_author_name}: {shortPreview(comment.reply_content)}
                        </div>
                    )}
                    <div className="comment-content-line" style={{ fontSize: '0.9rem', color: '#444', whiteSpace: 'pre-wrap' }}>
                        {comment.content && <PostContentRenderer content={comment.content} format="plain" />}
                        {comment.attachment_url && (
                            <button
                                type="button"
                                className="comment-image-thumb"
                                onClick={() => openImageModal([comment.attachment_url || ''])}
                                aria-label="Open comment image"
                            >
                                <img src={getImageDisplayUrl(comment.attachment_url)} alt="" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

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
                            allowInlineImagePaste={false}
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

                {visiblePostAttachmentUrls.length > 0 && (
                    <div className={`post-image-grid count-${Math.min(visiblePostAttachmentUrls.length, 3)}`} aria-label="Post images">
                        {visiblePostAttachmentUrls.slice(0, 3).map((url, index) => {
                            const imageSrc = getImageDisplayUrl(url);
                            const failed = attachmentImageFailed[url];

                            return (
                                <button
                                    key={url}
                                    type="button"
                                    className="post-image-attachment"
                                    onClick={() => openImageModal(visiblePostAttachmentUrls, index)}
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
                <div className="post-like-cluster">
                    <motion.button
                        onClick={handleLike}
                        disabled={likeRequestPending}
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
                        {hasLiked ? '❤️' : '🤍'} {likes}
                    </motion.button>
                    {recentLikers.length > 0 && (
                        <div className="post-like-avatar-stack" aria-label="Recent likes">
                            {recentLikers.slice(0, 3).map(liker => (
                                <button
                                    key={liker.id}
                                    type="button"
                                    className="post-like-avatar-link"
                                    onClick={event => {
                                        event.stopPropagation();
                                        openProfile(liker.id);
                                    }}
                                    title={liker.username}
                                    aria-label={`查看 ${liker.username} 的主页`}
                                >
                                    <Avatar
                                        value={liker.avatar}
                                        emoji={liker.avatar_emoji}
                                        theme={liker.avatar_theme}
                                        fallback="👤"
                                        size={24}
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

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
                    💬 Comment {commentCount > 0 ? `(${commentCount})` : ''}
                </button>
            </div>
            {interactionMessage && (
                <div className="forum-verification-callout post-interaction-callout" style={{ marginTop: '12px' }}>
                    <span>{interactionMessage}</span>
                    <button type="button" onClick={() => router.push(isReadOnlyUser ? '/functions' : '/profile')}>{isReadOnlyUser ? '体验项目' : '去认证'}</button>
                </div>
            )}

            {/* Comments Section: recent preview first, full comments on demand */}
            <AnimatePresence>
                {!isArticleCard && (hasPreviewComments || showComments || hasCommentLoadingPlaceholder || hasCommentError) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div className="post-comments-panel">
                            {hasPreviewComments && (
                                <div className="post-comments-preview" aria-label="Recent comments">
                                    {previewComments.map(comment => renderCommentRow(comment, true))}
                                </div>
                            )}

                            {hasCommentLoadingPlaceholder && (
                                <div className="comment-status-message">Loading comments...</div>
                            )}

                            {hasCommentError && (
                                <div className="comment-status-message is-error">{commentsLoadError}</div>
                            )}

                            {commentTargetMessage && (
                                <div className="comment-status-message">{commentTargetMessage}</div>
                            )}

                            {hasVisibleComments && (
                                <div className="post-comments-list">
                                    {comments.map(comment => renderCommentRow(comment))}
                                </div>
                            )}

                            {showComments && commentsLoaded && !commentsLoading && !commentsLoadError && commentCount === 0 && (
                                <div className="comment-status-message">No comments yet.</div>
                            )}

                            {showComments && commentsLoaded && commentsTotalPages > 1 && (
                                <div className="comment-pagination" aria-label="Comment pages">
                                    <button
                                        type="button"
                                        className="comment-pagination-button"
                                        onClick={() => loadComments({ page: commentsPage - 1 })}
                                        disabled={commentsLoading || commentsPage <= 1}
                                    >
                                        Previous
                                    </button>
                                    <span>Page {commentsPage} of {commentsTotalPages} · {commentCount} {commentCount === 1 ? 'comment' : 'comments'}</span>
                                    <button
                                        type="button"
                                        className="comment-pagination-button"
                                        onClick={() => loadComments({ page: commentsPage + 1 })}
                                        disabled={commentsLoading || commentsPage >= commentsTotalPages}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}

                            {showComments && !commentsLoading && !commentsLoadError && commentComposer}
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
