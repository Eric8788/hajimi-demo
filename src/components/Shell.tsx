'use client';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '@/lib/db';
import { motion } from 'framer-motion';
import NotificationsBell from './NotificationsBell';
import { APP_RELEASE_DATE, APP_VERSION_LABEL } from '@/lib/app-version';

export default function Shell({ children, user }: { children: React.ReactNode, user: User | null }) {
    const router = useRouter();
    const pathname = usePathname();

    const navItems = [
        { icon: '🏠', path: '/dashboard', label: '主页' },
        { icon: '🌏', path: '/resources', label: '走廊' },
        { icon: '🧩', path: '/functions', label: '项目' },
    ];

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
                    <span className="sidebar-logo-mark">H</span>
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
                            style={{ position: 'relative' }}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="active-nav-bg"
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        borderRadius: '18px',
                                        background: '#a29bfe',
                                        zIndex: 0,
                                    }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                />
                            )}
                            <span className="nav-symbol" style={{ color: isActive ? 'white' : 'inherit' }}>
                                {item.icon}
                            </span>
                            <span className="nav-label" style={{ color: isActive ? 'white' : undefined }}>{item.label}</span>
                        </div>
                    );
                })}

                <div className="sidebar-bottom">
                    {user ? (
                        <>
                            <NotificationsBell />
                            <div
                                onClick={() => router.push('/profile')}
                                style={{
                                    width: '48px', height: '48px',
                                    background: 'linear-gradient(135deg, #fab1a0, #ff7675)',
                                    borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                                    border: '2px solid rgba(255,255,255,0.8)'
                                }}
                            >
                                {user.avatar || '😊'}
                            </div>
                        </>
                    ) : (
                        <div
                            onClick={() => router.push('/login')}
                            title="Login"
                            style={{
                                width: '48px', height: '48px',
                                background: 'linear-gradient(135deg, #a29bfe, #6c5ce7)',
                                borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.3rem',
                                cursor: 'pointer',
                                boxShadow: '0 4px 10px rgba(108,92,231,0.3)',
                                border: '2px solid rgba(255,255,255,0.8)'
                            }}
                        >
                            👤
                        </div>
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
                <footer className="app-version-footer">
                    {APP_VERSION_LABEL} · {APP_RELEASE_DATE}
                </footer>
            </div>
        </div>
    );
}
