'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { FORUM_PROMOS, type ForumPromo } from '@/data/forumPromos';
import { isAdminRole } from '@/lib/roles';

const ADMIN_VERIFICATION_PROMO: ForumPromo & { href: string; cta: string } = {
    kicker: 'Hajimi Trust ✅',
    title: '认证审核入口',
    body: '处理同学提交的 Hajimi 认证，通过后他们就能发帖并进入 Hall of Fame。',
    notes: ['pending review', 'main account', 'Hall of Fame'],
    pin: '✓',
    accent: 'trust',
    href: '/admin/verifications',
    cta: '进入审核',
};

const PROMO_ACTIONS: Record<string, { href: string; cta: string }> = {
    '首次发帖立得 100 积分！': { href: '/resources', cta: '去 Forum' },
    '发布项目进 Hub 领 100 积分！': { href: '/functions', cta: '去 Hub' },
};

export default function DashboardPromoCarousel({ userRole }: { userRole?: string | null }) {
    const promos = useMemo(() => {
        const basePromos = FORUM_PROMOS.map(promo => ({
            ...promo,
            ...(PROMO_ACTIONS[promo.title] ?? { href: '/resources', cta: '查看详情' }),
        }));

        return isAdminRole(userRole) ? [...basePromos, ADMIN_VERIFICATION_PROMO] : basePromos;
    }, [userRole]);
    const [promoIndex, setPromoIndex] = useState(0);
    const activePromo = promos[promoIndex % promos.length];

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setPromoIndex(current => (current + 1) % promos.length);
        }, 5200);

        return () => window.clearInterval(intervalId);
    }, [promos.length]);

    return (
        <div className={`glass-card forum-welcome-board dashboard-promo-board is-${activePromo.accent}`}>
            <div className="forum-welcome-picture dashboard-promo-picture" aria-label="Hajimi dashboard promotional slides">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activePromo.title}
                        className="forum-welcome-slide"
                        initial={{ opacity: 0, x: 18 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -18 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                    >
                        <div className="forum-picture-copy dashboard-promo-copy">
                            <span className="forum-picture-kicker">{activePromo.kicker}</span>
                            <strong>{activePromo.title}</strong>
                            <span>{activePromo.body}</span>
                            <Link href={activePromo.href} className="dashboard-promo-action">
                                {activePromo.cta} →
                            </Link>
                        </div>
                        <div className="forum-picture-scene" aria-hidden="true">
                            <div className="forum-picture-pin">{activePromo.pin}</div>
                            <div className="forum-picture-note note-a">{activePromo.notes[0]}</div>
                            <div className="forum-picture-note note-b">{activePromo.notes[1]}</div>
                            <div className="forum-picture-note note-c">{activePromo.notes[2]}</div>
                            <div className="forum-picture-cat">
                                <span className="cat-ear left" />
                                <span className="cat-ear right" />
                                <span className="cat-eye left" />
                                <span className="cat-eye right" />
                                <span className="cat-smile" />
                            </div>
                            <div className="forum-picture-orbit one" />
                            <div className="forum-picture-orbit two" />
                        </div>
                    </motion.div>
                </AnimatePresence>
                <div className="forum-promo-dots" aria-label="Dashboard promotional slides">
                    {promos.map((promo, index) => (
                        <button
                            key={promo.title}
                            type="button"
                            className={index === promoIndex ? 'is-active' : ''}
                            aria-label={`Show ${promo.title}`}
                            onClick={() => setPromoIndex(index)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
