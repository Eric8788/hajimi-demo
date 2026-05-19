'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Notification } from '@/lib/db';
import Avatar from './Avatar';

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

export default function NotificationsBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    const loadNotifications = useCallback(async () => {
        const res = await fetch('/api/notifications', { cache: 'no-store' });
        if (!res.ok) return;

        const data = await res.json();
        const nextUnreadCount = Number(data.unreadCount || 0);
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadCount(nextUnreadCount);
        window.dispatchEvent(new CustomEvent('hajimi-notifications-count', { detail: { unreadCount: nextUnreadCount } }));
    }, []);

    useEffect(() => {
        const initialLoad = window.setTimeout(loadNotifications, 0);
        const interval = window.setInterval(loadNotifications, 45000);

        const handleRefresh = () => loadNotifications();
        window.addEventListener('hajimi-notifications-refresh', handleRefresh);

        return () => {
            window.clearTimeout(initialLoad);
            window.clearInterval(interval);
            window.removeEventListener('hajimi-notifications-refresh', handleRefresh);
        };
    }, [loadNotifications]);

    const toggleOpen = async () => {
        const nextOpen = !isOpen;
        setIsOpen(nextOpen);

        if (nextOpen && unreadCount > 0) {
            setUnreadCount(0);
            setNotifications(current => current.map(item => ({ ...item, read_at: item.read_at || new Date() })));
            window.dispatchEvent(new CustomEvent('hajimi-notifications-count', { detail: { unreadCount: 0 } }));
            await fetch('/api/notifications', { method: 'PATCH' });
        }
    };

    return (
        <div style={{ position: 'relative', marginBottom: '14px' }}>
            <motion.button
                type="button"
                className={`notification-trigger ${unreadCount > 0 ? 'has-unread' : ''}`}
                onClick={toggleOpen}
                whileHover={{ y: -2, scale: 1.05 }}
                whileTap={{ scale: 0.88 }}
                animate={unreadCount > 0 ? { rotate: [0, -8, 8, -5, 0] } : { rotate: 0 }}
                transition={{ duration: 0.45 }}
                title="Notifications"
                style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.8)',
                    background: unreadCount > 0 ? 'linear-gradient(135deg, #fd79a8, #a29bfe)' : 'rgba(255,255,255,0.42)',
                    color: unreadCount > 0 ? 'white' : '#6c5ce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.15rem',
                    cursor: 'pointer',
                    boxShadow: unreadCount > 0 ? '0 8px 18px rgba(253, 121, 168, 0.24)' : 'none',
                    position: 'relative',
                }}
            >
                🔔
                {unreadCount > 0 && (
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
                        {unreadCount > 9 ? '9+' : unreadCount}
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                            <strong style={{ color: '#2d3436' }}>Notifications</strong>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                style={{ border: 'none', background: 'transparent', color: '#b2bec3', cursor: 'pointer', fontSize: '1rem' }}
                            >
                                ×
                            </button>
                        </div>

                        {notifications.length === 0 ? (
                            <div style={{ color: '#636e72', fontSize: '0.86rem', lineHeight: 1.5, padding: '12px 4px' }}>
                                Likes and saves on your posts will show up here.
                            </div>
                        ) : (
                            <div className="notification-list">
                                {notifications.map(notification => (
                                    <div
                                        key={notification.id}
                                        className={`notification-row ${notification.read_at ? '' : 'is-unread'}`}
                                    >
                                        <Avatar value={notification.actor_avatar} theme={notification.actor_avatar_theme} fallback="👤" size={28} />
                                        <div className="notification-copy">
                                            <div
                                                className="notification-message"
                                                style={{ fontWeight: notification.read_at ? 600 : 800 }}
                                                title={notificationText(notification)}
                                            >
                                                {notificationText(notification)}
                                            </div>
                                            <div suppressHydrationWarning className="notification-time">
                                                {new Date(notification.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
