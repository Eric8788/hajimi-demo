'use client';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '@/lib/db';
import { motion } from 'framer-motion';

export default function Shell({ children, user }: { children: React.ReactNode, user: User | null }) {
    const router = useRouter();
    const pathname = usePathname();

    const navItems = [
        { icon: '🏠', path: '/dashboard', label: 'Home' },
        { icon: '🌏', path: '/resources', label: 'Resources' },
        { icon: '🧩', path: '/functions', label: 'Functions' },
    ];

    return (
        <div className="app-container">
            {/* Floating Glass Sidebar */}
            <aside className="glass-panel glass-sidebar">
                {navItems.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                        <div
                            key={item.path}
                            className="nav-icon"
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
                                        zIndex: -1,
                                    }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                />
                            )}
                            <span style={{ position: 'relative', zIndex: 1, color: isActive ? 'white' : 'inherit' }}>
                                {item.icon}
                            </span>
                        </div>
                    );
                })}

                <div style={{ marginTop: 'auto', textAlign: 'center' }}>
                    {user ? (
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
            </div>
        </div>
    );
}
