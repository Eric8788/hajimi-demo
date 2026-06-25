'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import type { AdminAuditEvent, AdminReviewSummary, AdminReviewTask, Notification } from '@/lib/db';
import Avatar from './Avatar';

type NotificationTab = 'review' | 'activity' | 'all';

function notificationText(notification: Notification) {
    const actor = notification.actor_name || 'Someone';
    const title = notification.post_title ? `「${notification.post_title}」` : 'your post';

    if (notification.type === 'post_like') {
        return `${actor} liked ${title}`;
    }

    if (notification.type === 'post_bookmark') {
        return `${actor} saved ${title}`;
    }

    return `${actor} liked your comment`;
}

function shortNotificationPreview(text?: string | null) {
    if (!text) return '';
    const compact = text.replace(/\s+/g, ' ').trim();
    return compact.length > 72 ? `${compact.slice(0, 72)}...` : compact;
}

function notificationHref(notification: Notification) {
    if (notification.type === 'comment_like' && notification.post_id && notification.comment_id) {
        return `/resources#post-${notification.post_id}-comment-${notification.comment_id}`;
    }

    if (notification.post_id) {
        return `/resources#post-${notification.post_id}`;
    }

    return '/resources';
}

function notificationPreview(notification: Notification) {
    if (notification.type === 'comment_like') {
        const commentPreview = shortNotificationPreview(notification.comment_content);
        if (commentPreview) return `“${commentPreview}”`;
        if (notification.post_title) return `in 「${notification.post_title}」`;
    }

    return '';
}

function reviewTaskIcon(task: AdminReviewTask) {
    return task.kind === 'verification' ? '✅' : '🚀';
}

function formatNotificationTime(value: Date | string | null | undefined) {
    if (!value) return '';
    return new Date(value).toLocaleString();
}

export default function NotificationsBell({ initialUnreadCount = 0 }: { initialUnreadCount?: number }) {
    const router = useRouter();
    const popoverRef = useRef<HTMLDivElement | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [reviewSummary, setReviewSummary] = useState<AdminReviewSummary | null>(null);
    const [reviewHistory, setReviewHistory] = useState<AdminAuditEvent[]>([]);
    const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
    const [activityTabCount, setActivityTabCount] = useState(initialUnreadCount);
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<NotificationTab>('activity');

    const reviewCount = reviewSummary?.totalCount ?? 0;
    const displayCount = unreadCount + reviewCount;
    const hasReviewTasks = reviewCount > 0;
    const visibleTabs = useMemo<NotificationTab[]>(
        () => (reviewSummary || reviewHistory.length > 0 ? ['review', 'activity', 'all'] : ['activity']),
        [reviewHistory.length, reviewSummary],
    );

    const loadNotifications = useCallback(async () => {
        const res = await fetch('/api/notifications', { cache: 'no-store' });
        if (!res.ok) return;

        const data = await res.json();
        const nextUnreadCount = Number(data.unreadCount || 0);
        const nextReviewSummary = data.reviewSummary && typeof data.reviewSummary === 'object'
            ? data.reviewSummary as AdminReviewSummary
            : null;

        const nextNotifications = Array.isArray(data.notifications) ? data.notifications : [];

        setNotifications(nextNotifications);
        setActivityTabCount(Math.max(nextNotifications.length, nextUnreadCount));
        setUnreadCount(nextUnreadCount);
        setReviewSummary(nextReviewSummary);
        setReviewHistory(Array.isArray(data.reviewHistory) ? data.reviewHistory : []);
        setActiveTab(current => {
            const hasReviewSurface = Boolean(nextReviewSummary) || (Array.isArray(data.reviewHistory) && data.reviewHistory.length > 0);
            if (!hasReviewSurface && current !== 'activity') return 'activity';
            if (nextReviewSummary?.totalCount && current === 'activity' && nextUnreadCount === 0) return 'review';
            return current;
        });
        window.dispatchEvent(new CustomEvent('hajimi-notifications-count', { detail: { unreadCount: nextUnreadCount } }));
    }, []);

    useEffect(() => {
        setUnreadCount(initialUnreadCount);
        setActivityTabCount(current => Math.max(current, initialUnreadCount));
    }, [initialUnreadCount]);

    useEffect(() => {
        const initialLoad = window.setTimeout(loadNotifications, 3600);
        const interval = window.setInterval(loadNotifications, 45000);

        const handleRefresh = () => loadNotifications();
        window.addEventListener('hajimi-notifications-refresh', handleRefresh);

        return () => {
            window.clearTimeout(initialLoad);
            window.clearInterval(interval);
            window.removeEventListener('hajimi-notifications-refresh', handleRefresh);
        };
    }, [loadNotifications]);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (target && popoverRef.current?.contains(target)) return;
            setIsOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [isOpen]);

    const markActivityRead = async () => {
        if (unreadCount <= 0) return;
        setUnreadCount(0);
        setNotifications(current => current.map(item => ({ ...item, read_at: item.read_at || new Date() })));
        window.dispatchEvent(new CustomEvent('hajimi-notifications-count', { detail: { unreadCount: 0 } }));
        await fetch('/api/notifications', { method: 'PATCH' });
    };

    const toggleOpen = async () => {
        const nextOpen = !isOpen;
        setIsOpen(nextOpen);

        if (nextOpen) {
            setActiveTab(hasReviewTasks || reviewHistory.length > 0 ? 'review' : 'activity');
            await loadNotifications();
            await markActivityRead();
        }
    };

    const goTo = (href: string) => {
        setIsOpen(false);
        router.push(href);
    };

    const renderReviewTasks = () => {
        if (!reviewSummary && reviewHistory.length === 0) {
            return (
                <div className="notification-empty">
                    暂时没有新的审核。认证和项目申请会出现在这里。
                </div>
            );
        }

        return (
            <>
                {reviewSummary && (
                    <>
                        <div className="notification-review-summary">
                            <button type="button" onClick={() => goTo('/admin/verifications')}>
                                <strong>{reviewSummary.verificationCount}</strong>
                                <span>认证审核</span>
                            </button>
                            <button type="button" onClick={() => goTo('/admin/project-submissions')}>
                                <strong>{reviewSummary.projectSubmissionCount}</strong>
                                <span>项目申请</span>
                            </button>
                        </div>
                        {reviewSummary.tasks.length === 0 ? (
                            <div className="notification-empty">
                                暂时没有新的审核。下面会保留最近处理记录。
                            </div>
                        ) : (
                            <div className="notification-list">
                                {reviewSummary.tasks.map(task => (
                                    <button
                                        type="button"
                                        key={task.id}
                                        className="notification-review-row"
                                        onClick={() => goTo(task.href)}
                                    >
                                        <span className="notification-review-icon">{reviewTaskIcon(task)}</span>
                                        <span className="notification-copy">
                                            <span className="notification-message">{task.title}</span>
                                            <span className="notification-time">
                                                {task.description} {task.created_at ? `· ${formatNotificationTime(task.created_at)}` : ''}
                                            </span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
                {reviewHistory.length > 0 && (
                    <>
                        <div className="notification-section-divider">最近审核记录</div>
                        <div className="notification-list">
                            {reviewHistory.map(event => (
                                <button
                                    type="button"
                                    key={`${event.id}-${event.event_type}`}
                                    className="notification-review-row"
                                    onClick={() => goTo('/admin')}
                                >
                                    <span className="notification-review-icon">{event.target_type === 'project_submission' ? '🚀' : event.target_type === 'user' ? '🛡️' : '✅'}</span>
                                    <span className="notification-copy">
                                        <span className="notification-message">{event.summary}</span>
                                        <span className="notification-time">
                                            {event.actor_name ? `by ${event.actor_name}` : 'legacy record'} · {formatNotificationTime(event.created_at)}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </>
        );
    };

    const renderActivityNotifications = () => {
        if (notifications.length === 0) {
            return (
                <div className="notification-empty">
                    Likes, saves and comment likes will show up here.
                </div>
            );
        }

        return (
            <div className="notification-list">
                {notifications.map(notification => {
                    const preview = notificationPreview(notification);

                    return (
                        <button
                            type="button"
                            key={notification.id}
                            className={`notification-row ${notification.read_at ? '' : 'is-unread'}`}
                            onClick={() => goTo(notificationHref(notification))}
                        >
                            <Avatar value={notification.actor_avatar} emoji={notification.actor_avatar_emoji} theme={notification.actor_avatar_theme} fallback="👤" size={28} />
                            <span className="notification-copy">
                                <span
                                    className="notification-message"
                                    style={{ fontWeight: notification.read_at ? 600 : 800 }}
                                    title={notificationText(notification)}
                                >
                                    {notificationText(notification)}
                                </span>
                                {preview && (
                                    <span className="notification-preview" title={preview}>
                                        {preview}
                                    </span>
                                )}
                                <span suppressHydrationWarning className="notification-time">
                                    {formatNotificationTime(notification.created_at)}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <div ref={popoverRef} style={{ position: 'relative', marginBottom: '14px' }}>
            <motion.button
                type="button"
                className={`notification-trigger ${displayCount > 0 ? 'has-unread' : ''}`}
                onClick={toggleOpen}
                whileHover={{ y: -2, scale: 1.05 }}
                whileTap={{ scale: 0.88 }}
                animate={displayCount > 0 ? { rotate: [0, -8, 8, -5, 0] } : { rotate: 0 }}
                transition={{ duration: 0.45 }}
                title="Notifications"
                style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.8)',
                    background: displayCount > 0 ? 'linear-gradient(135deg, #fd79a8, #a29bfe)' : 'rgba(255,255,255,0.42)',
                    color: displayCount > 0 ? 'white' : '#6c5ce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.15rem',
                    cursor: 'pointer',
                    boxShadow: displayCount > 0 ? '0 8px 18px rgba(253, 121, 168, 0.24)' : 'none',
                    position: 'relative',
                }}
            >
                🔔
                {displayCount > 0 && (
                    <span
                        style={{
                            position: 'absolute',
                            top: '-5px',
                            right: '-5px',
                            minWidth: '18px',
                            height: '18px',
                            borderRadius: '999px',
                            background: '#ff7675',
                            color: 'white',
                            fontSize: '0.68rem',
                            fontWeight: 900,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid white',
                        }}
                    >
                        {displayCount > 9 ? '9+' : displayCount}
                    </span>
                )}
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="notification-popover"
                        initial={{ opacity: 0, x: -8, scale: 0.96 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -8, scale: 0.96 }}
                    >
                        <div className="notification-head">
                            <div>
                                <strong>通知中心</strong>
                                {reviewSummary && (
                                    <span>{reviewCount > 0 ? `${reviewCount} 个审核待办` : '审核已清空'}</span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                aria-label="Close notifications"
                            >
                                ×
                            </button>
                        </div>

                        {visibleTabs.length > 1 && (
                            <div className="notification-tabs" role="tablist" aria-label="通知分类">
                                <button type="button" className={activeTab === 'review' ? 'is-active' : ''} onClick={() => setActiveTab('review')}>
                                    审核 {reviewCount > 0 ? reviewCount : ''}
                                </button>
                                <button type="button" className={activeTab === 'activity' ? 'is-active' : ''} onClick={() => setActiveTab('activity')}>
                                    互动 {activityTabCount > 0 ? activityTabCount : ''}
                                </button>
                                <button type="button" className={activeTab === 'all' ? 'is-active' : ''} onClick={() => setActiveTab('all')}>
                                    全部
                                </button>
                            </div>
                        )}

                        <div className="notification-drawer-body">
                            {(activeTab === 'review' || activeTab === 'all') && renderReviewTasks()}
                            {activeTab === 'all' && reviewSummary && <div className="notification-section-divider">互动通知</div>}
                            {(activeTab === 'activity' || activeTab === 'all') && renderActivityNotifications()}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
