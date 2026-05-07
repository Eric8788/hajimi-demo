'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Notification } from '@/lib/db';

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
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadCount(Number(data.unreadCount || 0));
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
            await fetch('/api/notifications', { method: 'PATCH' });
        }
    };

    return (
        <div style={{ position: 'relative', marginBottom: '14px' }}>
            <motion.button
                type="button"
                onClick={toggleOpen}
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {notifications.map(notification => (
                                    <div
                                        key={notification.id}
                                        style={{
                                            display: 'flex',
                                            gap: '10px',
                                            padding: '10px',
                                            borderRadius: '12px',
                                            background: notification.read_at ? 'rgba(255,255,255,0.52)' : 'rgba(162,155,254,0.12)',
                                        }}
                                    >
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#fab1a0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            {notification.actor_avatar || '👤'}
                                        </div>
                                        <div>
                                            <div style={{ color: '#2d3436', fontSize: '0.86rem', fontWeight: notification.read_at ? 600 : 800, lineHeight: 1.35 }}>
                                                {notificationText(notification)}
                                            </div>
                                            <div suppressHydrationWarning style={{ color: '#9aa1a7', fontSize: '0.74rem', marginTop: '3px' }}>
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
