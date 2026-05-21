/* eslint-disable @next/next/no-img-element */
'use client';
import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { User } from '@/lib/db';
import { motion } from 'framer-motion';
import NotificationsBell from './NotificationsBell';
import { APP_RELEASE_DATE, APP_VERSION_LABEL } from '@/lib/app-version';
import Avatar from './Avatar';

export default function Shell({ children, user }: { children: React.ReactNode, user: User | null }) {
    const router = useRouter();
    const pathname = usePathname();
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const navItems = [
        { icon: '🏠', path: '/dashboard', label: 'Home' },
        { icon: '💬', path: '/resources', label: 'Forum' },
        { icon: '🚀', path: '/functions', label: 'Hub' },
        { icon: '🗺️', path: '/alumni-map', label: 'Map' },
        { icon: '🏆', path: '/leaderboard', label: 'Rank' },
    ];
    const loadUnreadCount = useCallback(async () => {
        if (!user) {
            setUnreadCount(0);
            return;
        }

        const res = await fetch('/api/notifications', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        setUnreadCount(Number(data.unreadCount || 0));
    }, [user]);

    useEffect(() => {
        const initialLoad = window.setTimeout(loadUnreadCount, 0);
        const interval = window.setInterval(loadUnreadCount, 45000);

        const handleNotificationCount = (event: Event) => {
            const customEvent = event as CustomEvent<{ unreadCount?: number }>;
            if (typeof customEvent.detail?.unreadCount === 'number') {
                setUnreadCount(customEvent.detail.unreadCount);
            }
        };

        const handleRefresh = () => loadUnreadCount();
        window.addEventListener('hajimi-notifications-count', handleNotificationCount);
        window.addEventListener('hajimi-notifications-refresh', handleRefresh);

        return () => {
            window.clearTimeout(initialLoad);
            window.clearInterval(interval);
            window.removeEventListener('hajimi-notifications-count', handleNotificationCount);
            window.removeEventListener('hajimi-notifications-refresh', handleRefresh);
        };
    }, [loadUnreadCount]);

    const handleLogout = async () => {
        if (isLoggingOut) return;

        setIsLoggingOut(true);
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.replace('/login');
            router.refresh();
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <div className="app-container">
            {/* Fixed Glass Sidebar */}
            <aside className="glass-panel glass-sidebar">
                <button
                    type="button"
                    className="sidebar-brand"
                    onClick={() => router.push('/dashboard')}
                    aria-label="Go to Hajimi home"
                >
                    <span className="sidebar-logo-mark" aria-hidden="true">
                        <img className="sidebar-logo-image" src="/hajimi-logo-transparent.png" alt="" />
                    </span>
                    <span className="sidebar-brand-text">Hajimi</span>
                </button>

                {navItems.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                        <div
                            key={item.path}
                            className={`nav-icon ${isActive ? 'is-active' : ''}`}
                            onClick={() => router.push(item.path)}
                            title={item.label}
                        >
                            <span className="nav-symbol">
                                {item.icon}
                            </span>
                            <span className="nav-label">{item.label}</span>
                            {item.path === '/resources' && unreadCount > 0 && (
                                <span className="sidebar-nav-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                            )}
                        </div>
                    );
                })}

                <div className="sidebar-bottom">
                    {user ? (
                        <>
                            <NotificationsBell />
                            <button
                                type="button"
                                className="sidebar-logout-button"
                                onClick={handleLogout}
                                title={isLoggingOut ? '正在退出...' : '退出登录'}
                                aria-label="退出登录"
                                disabled={isLoggingOut}
                            >
                                <span aria-hidden="true">↪</span>
                                <span>{isLoggingOut ? '...' : '退出'}</span>
                            </button>
                            <button
                                type="button"
                                className="sidebar-avatar-button"
                                onClick={() => router.push('/profile')}
                                title="Profile"
                            >
                                <Avatar value={user.avatar} theme={user.avatar_theme} fallback="😊" size={42} />
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className="sidebar-avatar-button"
                            onClick={() => router.push('/login')}
                            title="Login"
                        >
                            👤
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="main-content">
                <motion.div
                    key={pathname}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {children}
                </motion.div>
                {pathname !== '/alumni-map' && (
                    <footer className="app-version-footer">
                        {APP_VERSION_LABEL} · {APP_RELEASE_DATE}
                    </footer>
                )}
            </div>
        </div>
    );
}
