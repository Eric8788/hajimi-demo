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
import { isReadOnlyRole } from '@/lib/access';
import { applyAvatarPatch, loadAvatarPatches } from '@/lib/clientAvatarHydration';

const PREFETCH_PATHS = ['/dashboard', '/resources', '/functions', '/alumni-map', '/leaderboard', '/profile', '/wallet'];
const SIDEBAR_STORAGE_KEY = 'hajimi-sidebar-expanded';

function getRoleLabel(role?: string | null) {
    const normalizedRole = String(role || '').toLowerCase();
    if (normalizedRole === 'admin') return 'Admin';
    if (normalizedRole === 'teacher') return 'Teacher';
    if (normalizedRole === 'parent') return 'Parent';
    if (normalizedRole === 'visitor') return 'Visitor';
    return 'Student';
}

function getUserStatusLabel(user?: User | null) {
    if (!user) return 'Guest mode';
    if (isReadOnlyRole(user.role)) return `${getRoleLabel(user.role)} · Read-only`;
    if (user.verification_status === 'verified') return `${getRoleLabel(user.role)} · Verified`;
    if (user.verification_status === 'pending') return `${getRoleLabel(user.role)} · Pending`;
    return `${getRoleLabel(user.role)} · Lv.${user.level || 1}`;
}

function formatCompactNumber(value?: number | null) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    if (value >= 10000) return `${Math.floor(value / 1000) / 10}w`;
    if (value >= 1000) return `${Math.floor(value / 100) / 10}k`;
    return String(value);
}

export default function Shell({ children, user }: { children: React.ReactNode, user: User | null }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();
    const [unreadCount, setUnreadCount] = useState(0);
    const [pendingPath, setPendingPath] = useState('');
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
    const [coinBalance, setCoinBalance] = useState<number | null>(null);
    const [hydratedUser, setHydratedUser] = useState<User | null>(user);
    const displayUser = hydratedUser || user;
    const isReadOnlyUser = isReadOnlyRole(displayUser?.role);

    const baseNavItems = [
        { icon: '🏠', path: '/dashboard', label: 'Dashboard', shortLabel: 'Home', meta: 'Today' },
        { icon: '💬', path: '/resources', label: 'Hallway', shortLabel: 'Hall', meta: 'Posts' },
        { icon: '🚀', path: '/functions', label: 'Function Hall', shortLabel: 'Hub', meta: 'Projects' },
        { icon: '🗺️', path: '/alumni-map', label: 'Alumni Map', shortLabel: 'Map', meta: 'Network' },
        { icon: '🏆', path: '/leaderboard', label: 'Leaderboard', shortLabel: 'Rank', meta: 'Ranks' },
        ...(isAdminRole(displayUser?.role) ? [{ icon: '🛡️', path: '/admin', label: 'Admin', shortLabel: 'Admin', meta: 'Review' }] : []),
    ];
    const navItems = baseNavItems;
    const prefetchPath = useCallback((path: string) => {
        if (path === pathname) return;
        router.prefetch(path);
    }, [pathname, router]);

    useEffect(() => {
        setHydratedUser(user);
    }, [user]);

    useEffect(() => {
        const savedPreference = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (savedPreference === '0') setIsSidebarExpanded(false);
        if (savedPreference === '1') setIsSidebarExpanded(true);
    }, []);

    useEffect(() => {
        if (!displayUser?.id) {
            setCoinBalance(null);
            return;
        }

        const controller = new AbortController();
        const scheduleIdle = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 1600));
        const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
        const idleId = scheduleIdle(async () => {
            try {
                const res = await fetch('/api/coins/wallet', { cache: 'no-store', signal: controller.signal });
                if (!res.ok) return;
                const data = await res.json();
                setCoinBalance(Number(data?.wallet?.balance ?? 0));
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                console.warn('Sidebar wallet unavailable:', error);
            }
        }, { timeout: 2600 });

        return () => {
            controller.abort();
            cancelIdle(idleId);
        };
    }, [displayUser?.id]);

    useEffect(() => {
        if (!user?.id) return;
        if (user.avatar?.startsWith('data:image/') || user.avatar?.startsWith('http')) return;

        const controller = new AbortController();
        let active = true;

        loadAvatarPatches([user.id], controller.signal)
            .then(patches => {
                if (!active || patches.size === 0) return;
                setHydratedUser(applyAvatarPatch(user, patches));
            })
            .catch(error => {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                console.warn('Sidebar avatar unavailable:', error);
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, [user]);

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
    const sidebarStateClass = isSidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed';
    const toggleSidebar = () => {
        setIsSidebarExpanded(current => {
            const nextValue = !current;
            window.localStorage.setItem(SIDEBAR_STORAGE_KEY, nextValue ? '1' : '0');
            return nextValue;
        });
    };

    return (
        <div className={`app-container ${sidebarStateClass}`}>
            {routePending && (
                <div className="route-transition-indicator" aria-live="polite" aria-label="Loading next Hajimi view">
                    <span />
                </div>
            )}
            {/* Fixed Glass Sidebar */}
            <aside className="glass-panel glass-sidebar" data-state={isSidebarExpanded ? 'expanded' : 'collapsed'} aria-label="Hajimi sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-brand" aria-label="Hajimi">
                        <span className="sidebar-logo-mark" aria-hidden="true">
                            <img className="sidebar-logo-image" src="/hajimi-logo-transparent.png" alt="" />
                        </span>
                        <span className="sidebar-brand-copy">
                            <span className="sidebar-brand-text">Hajimi</span>
                        </span>
                    </div>
                    <button type="button" className="sidebar-collapse-button" onClick={toggleSidebar} aria-label={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'} aria-expanded={isSidebarExpanded} title={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}>
                        <span aria-hidden="true">{isSidebarExpanded ? '‹' : '›'}</span>
                    </button>
                </div>

                <nav className="sidebar-nav" aria-label="Main navigation">
                    {navItems.map((item) => {
                        const isActive = item.path === '/admin'
                            ? pathname.startsWith('/admin')
                            : item.path === '/resources'
                                ? pathname.startsWith('/resources')
                                : pathname === item.path;
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
                                <span className="nav-copy">
                                    <span className="nav-label">{item.label}</span>
                                    <span className="nav-meta">{item.meta}</span>
                                </span>
                                <span className="nav-short-label">{item.shortLabel}</span>
                                {item.path === '/resources' && unreadCount > 0 && (
                                    <span className="sidebar-nav-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                <div className="sidebar-bottom">
                    {displayUser ? (
                        <div className="sidebar-account-panel">
                            <button
                                type="button"
                                className={`sidebar-user-card ${pathname === '/profile' ? 'is-active' : ''}`}
                                onClick={() => navigateTo('/profile')}
                                onPointerEnter={() => prefetchPath('/profile')}
                                onFocus={() => prefetchPath('/profile')}
                                title="Profile"
                                aria-current={pathname === '/profile' ? 'page' : undefined}
                            >
                                <Avatar value={displayUser.avatar} emoji={displayUser.avatar_emoji} theme={displayUser.avatar_theme} fallback="😊" size={42} />
                                <span className="sidebar-user-copy">
                                    <strong>{displayUser.username}</strong>
                                    <span className="sidebar-user-status">{getUserStatusLabel(displayUser)}</span>
                                    <span className="sidebar-user-balance">
                                        {formatCompactNumber(Number(displayUser.points || 0))} XP · 🪙 {formatCompactNumber(coinBalance)}
                                    </span>
                                </span>
                            </button>
                            <div className="sidebar-quick-actions" aria-label="Account shortcuts">
                                <NotificationsBell initialUnreadCount={unreadCount} shortLabel="Bell" />
                                {!isReadOnlyUser && (
                                    <button
                                        type="button"
                                        className={`sidebar-wallet-button ${pathname === '/wallet' ? 'is-active' : ''}`}
                                        onClick={() => navigateTo('/wallet')}
                                        onPointerEnter={() => prefetchPath('/wallet')}
                                        onFocus={() => prefetchPath('/wallet')}
                                        title="Wallet"
                                        aria-current={pathname === '/wallet' ? 'page' : undefined}
                                    >
                                        <span aria-hidden="true">💳</span>
                                        <span className="sidebar-action-label">Wallet</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className={`sidebar-settings-button sidebar-settings-action ${pathname === '/profile' ? 'is-active' : ''}`}
                                    onClick={() => navigateTo('/profile')}
                                    onPointerEnter={() => prefetchPath('/profile')}
                                    onFocus={() => prefetchPath('/profile')}
                                    title="Settings"
                                >
                                    <span aria-hidden="true">⚙️</span>
                                    <span className="sidebar-action-label">Set</span>
                                </button>
                            </div>
                            <div className="sidebar-collapsed-actions" aria-label="Collapsed account shortcuts">
                                <NotificationsBell initialUnreadCount={unreadCount} shortLabel="Bell" />
                                <button
                                    type="button"
                                    className={`sidebar-settings-button sidebar-settings-action ${pathname === '/profile' ? 'is-active' : ''}`}
                                    onClick={() => navigateTo('/profile')}
                                    onPointerEnter={() => prefetchPath('/profile')}
                                    onFocus={() => prefetchPath('/profile')}
                                    title="Settings"
                                >
                                    <span aria-hidden="true">⚙️</span>
                                    <span className="sidebar-bottom-short-label">Set</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="sidebar-account-panel">
                            <button
                                type="button"
                                className="sidebar-user-card"
                                onClick={() => navigateTo('/login')}
                                onPointerEnter={() => prefetchPath('/login')}
                                onFocus={() => prefetchPath('/login')}
                                title="Login"
                            >
                                <span className="sidebar-guest-avatar" aria-hidden="true">👤</span>
                                <span className="sidebar-user-copy">
                                    <strong>Guest</strong>
                                    <span className="sidebar-user-status">{getUserStatusLabel(null)}</span>
                                    <span className="sidebar-user-balance">XP -- · 🪙 --</span>
                                </span>
                            </button>
                            <div className="sidebar-collapsed-actions" aria-label="Collapsed guest shortcuts">
                                <button
                                    type="button"
                                    className="sidebar-settings-button sidebar-guest-action-button sidebar-notification-action"
                                    onClick={() => navigateTo('/login')}
                                    onPointerEnter={() => prefetchPath('/login')}
                                    onFocus={() => prefetchPath('/login')}
                                    title="Notifications"
                                    aria-label="Log in to see notifications"
                                >
                                    <span aria-hidden="true">🔔</span>
                                    <span className="sidebar-bottom-short-label">Bell</span>
                                </button>
                                <button
                                    type="button"
                                    className="sidebar-settings-button sidebar-guest-action-button sidebar-settings-action"
                                    onClick={() => navigateTo('/login')}
                                    onPointerEnter={() => prefetchPath('/login')}
                                    onFocus={() => prefetchPath('/login')}
                                    title="Settings"
                                    aria-label="Log in to open settings"
                                >
                                    <span aria-hidden="true">⚙️</span>
                                    <span className="sidebar-bottom-short-label">Set</span>
                                </button>
                            </div>
                        </div>
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
