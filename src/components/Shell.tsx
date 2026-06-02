/* eslint-disable @next/next/no-img-element */
'use client';
import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { User } from '@/lib/db';
import { motion } from 'framer-motion';
import NotificationsBell from './NotificationsBell';
import { APP_RELEASE_DATE, APP_VERSION_LABEL } from '@/lib/app-version';
import Avatar from './Avatar';
import { isAdminRole } from '@/lib/roles';

const PREFETCH_PATHS = ['/dashboard', '/resources', '/functions', '/alumni-map', '/leaderboard', '/profile'];

export default function Shell({ children, user }: { children: React.ReactNode, user: User | null }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();
    const [unreadCount, setUnreadCount] = useState(0);
    const [pendingPath, setPendingPath] = useState('');

    const navItems = [
        { icon: '🏠', path: '/dashboard', label: 'Home' },
        { icon: '💬', path: '/resources', label: 'Forum' },
        { icon: '🚀', path: '/functions', label: 'Hub' },
        { icon: '🗺️', path: '/alumni-map', label: 'Map' },
        { icon: '🏆', path: '/leaderboard', label: 'Rank' },
        ...(isAdminRole(user?.role) ? [{ icon: '🛡️', path: '/admin', label: 'Admin' }] : []),
    ];
    const prefetchPath = useCallback((path: string) => {
        if (path === pathname) return;
        router.prefetch(path);
    }, [pathname, router]);

    const loadUnreadCount = useCallback(async () => {
        if (!user) {
            setUnreadCount(0);
            return;
        }

        const res = await fetch('/api/notifications?mode=count', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        setUnreadCount(Number(data.unreadCount || 0));
    }, [user]);

    useEffect(() => {
        const scheduleIdle = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 1800));
        const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
        const initialLoad = scheduleIdle(loadUnreadCount, { timeout: 2600 });
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
            cancelIdle(initialLoad);
            window.clearInterval(interval);
            window.removeEventListener('hajimi-notifications-count', handleNotificationCount);
            window.removeEventListener('hajimi-notifications-refresh', handleRefresh);
        };
    }, [loadUnreadCount]);

    useEffect(() => {
        const scheduleIdle = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 1600));
        const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
        const idleId = scheduleIdle(() => {
            PREFETCH_PATHS.forEach(prefetchPath);
        }, { timeout: 3000 });

        return () => cancelIdle(idleId);
    }, [prefetchPath]);

    const navigateTo = (path: string) => {
        if (path === pathname) return;
        setPendingPath(path);
        prefetchPath(path);
        startTransition(() => {
            router.push(path);
        });
    };

    const activePendingPath = pendingPath !== pathname ? pendingPath : '';
    const routePending = Boolean(activePendingPath) || isPending;

    return (
        <div className="app-container">
            {routePending && (
                <div className="route-transition-indicator" aria-live="polite" aria-label="Loading next Hajimi view">
                    <span />
                </div>
            )}
            {/* Fixed Glass Sidebar */}
            <aside className="glass-panel glass-sidebar">
                <button
                    type="button"
                    className="sidebar-brand"
                    onClick={() => navigateTo('/dashboard')}
                    onPointerEnter={() => prefetchPath('/dashboard')}
                    onFocus={() => prefetchPath('/dashboard')}
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
                        <button
                            type="button"
                            key={item.path}
                            className={`nav-icon ${isActive ? 'is-active' : ''} ${activePendingPath === item.path ? 'is-pending' : ''}`}
                            onClick={() => navigateTo(item.path)}
                            onPointerEnter={() => prefetchPath(item.path)}
                            onFocus={() => prefetchPath(item.path)}
                            title={item.label}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <span className="nav-symbol">
                                {item.icon}
                            </span>
                            <span className="nav-label">{item.label}</span>
                            {item.path === '/resources' && unreadCount > 0 && (
                                <span className="sidebar-nav-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                            )}
                        </button>
                    );
                })}

                <div className="sidebar-bottom">
                    {user ? (
                        <>
                            <NotificationsBell initialUnreadCount={unreadCount} />
                            <button
                                type="button"
                                className="sidebar-avatar-button"
                                onClick={() => navigateTo('/profile')}
                                onPointerEnter={() => prefetchPath('/profile')}
                                onFocus={() => prefetchPath('/profile')}
                                title="Profile"
                            >
                                <Avatar value={user.avatar} theme={user.avatar_theme} fallback="😊" size={42} />
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className="sidebar-avatar-button"
                            onClick={() => navigateTo('/login')}
                            onPointerEnter={() => prefetchPath('/login')}
                            onFocus={() => prefetchPath('/login')}
                            title="Login"
                        >
                            👤
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content Area */}
            <div className={`main-content ${routePending ? 'is-route-pending' : ''}`}>
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
