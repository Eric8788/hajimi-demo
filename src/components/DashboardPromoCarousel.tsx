'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { FORUM_PROMOS, type ForumPromo } from '@/data/forumPromos';
import { isAdminRole } from '@/lib/roles';

type DashboardPromoBase = ForumPromo & { href: string; cta: string };
type DashboardPromo = DashboardPromoBase;

const ADMIN_VERIFICATION_PROMO: DashboardPromoBase = {
    kicker: 'Hajimi Trust ✅',
    title: '认证审核入口',
    body: '处理同学提交的 Hajimi 认证，通过后他们就能互动、发帖、提交项目并进入 Hall of Fame。',
    notes: ['pending review', 'main account', 'Hall of Fame'],
    pin: '✓',
    accent: 'trust',
    href: '/admin/verifications',
    cta: '进入审核',
};

const MEMBER_VERIFICATION_PROMO: DashboardPromoBase = {
    kicker: 'Hajimi Trust ✅',
    title: '完成 Hajimi 认证',
    body: '认证通过后就能互动、发帖、提交 Hub 项目申请，并展示认证 badge。',
    notes: ['verified badge', 'main account', 'creator access'],
    pin: '✓',
    accent: 'trust',
    href: '/profile',
    cta: '去认证',
};

const PROMO_ACTIONS: Record<string, { href: string; cta: string }> = {
    'Hajimi XP 怎么获得？': { href: '/resources', cta: '去 Forum' },
    '提交项目进 Hub，审核后上线！': { href: '/functions', cta: '去 Hub' },
};

export default function DashboardPromoCarousel({ userRole }: { userRole?: string | null }) {
    const promos = useMemo(() => {
        const basePromos: DashboardPromoBase[] = FORUM_PROMOS.map(promo => ({
            ...promo,
            ...(PROMO_ACTIONS[promo.title] ?? { href: '/resources', cta: '查看详情' }),
        }));
        const verificationPromo = isAdminRole(userRole) ? ADMIN_VERIFICATION_PROMO : MEMBER_VERIFICATION_PROMO;

        return [basePromos[0], verificationPromo, ...basePromos.slice(1)];
    }, [userRole]);
    const [promoIndex, setPromoIndex] = useState(0);
    const activePromo = promos[promoIndex % promos.length];

    const showPreviousPromo = () => {
        setPromoIndex(current => (current - 1 + promos.length) % promos.length);
    };

    const showNextPromo = () => {
        setPromoIndex(current => (current + 1) % promos.length);
    };

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
                <div className="forum-promo-controls dashboard-promo-switcher" aria-label="切换 dashboard 广告">
                    <button
                        type="button"
                        className="forum-promo-arrow"
                        aria-label="上一条 Dashboard 广告"
                        onClick={showPreviousPromo}
                    >
                        ‹
                    </button>
                    <div className="forum-promo-dots" role="tablist" aria-label="Dashboard promotional dots">
                        {promos.map((promo, index) => (
                            <button
                                key={promo.title}
                                type="button"
                                className={index === promoIndex ? 'is-active' : ''}
                                aria-label={`Show ${promo.title}`}
                                title={promo.title}
                                aria-selected={index === promoIndex}
                                role="tab"
                                onMouseEnter={() => setPromoIndex(index)}
                                onFocus={() => setPromoIndex(index)}
                                onClick={() => setPromoIndex(index)}
                            />
                        ))}
                    </div>
                    <button
                        type="button"
                        className="forum-promo-arrow"
                        aria-label="下一条 Dashboard 广告"
                        onClick={showNextPromo}
                    >
                        ›
                    </button>
                </div>
            </div>
        </div>
    );
}
