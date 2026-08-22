'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from './Avatar';
import SpotlightCard from './reactbits/SpotlightCard';
import type { PresenceSummary } from '@/lib/db';

type PresencePanelProps = {
    userId?: number | null;
    variant?: 'card' | 'sidebar';
    limit?: number;
};

const HEARTBEAT_MS = 90_000;
const FETCH_MS = 60_000;
const DEFAULT_SUMMARY: PresenceSummary = {
    onlineCount: 0,
    members: [],
    todayMemberCount: 0,
    todayMembers: [],
    windowSeconds: 300,
    generatedAt: '',
};

function formatOnlineLabel(count: number) {
    if (count <= 0) return 'No one online';
    if (count === 1) return '1 online';
    return `${count} online`;
}

export default function PresencePanel({ userId, variant = 'card', limit = 8 }: PresencePanelProps) {
    const router = useRouter();
    const [summary, setSummary] = useState<PresenceSummary>(DEFAULT_SUMMARY);
    const [isLoading, setIsLoading] = useState(true);
    const isAuthenticated = Boolean(userId);
    const visibleMembers = summary.members.slice(0, limit);
    const extraCount = Math.max(0, summary.onlineCount - visibleMembers.length);
    const visibleTodayMembers = summary.todayMembers.slice(0, limit);
    const todayExtraCount = Math.max(0, summary.todayMemberCount - visibleTodayMembers.length);

    const formatLastSeen = (value: string | Date) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '时间未知';
        return new Intl.DateTimeFormat('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Shanghai',
        }).format(date);
    };

    const loadPresence = useCallback(async (mode: 'read' | 'touch' = 'read', signal?: AbortSignal) => {
        if (document.visibilityState === 'hidden') return;

        try {
            const method = mode === 'touch' && isAuthenticated ? 'POST' : 'GET';
            const res = await fetch(`/api/presence?limit=${limit}`, {
                method,
                cache: 'no-store',
                signal,
            });
            if (!res.ok) throw new Error(`Presence failed: ${res.status}`);

            const data = await res.json() as PresenceSummary;
            setSummary({
                onlineCount: Number(data.onlineCount || 0),
                members: Array.isArray(data.members) ? data.members : [],
                todayMemberCount: Number(data.todayMemberCount || 0),
                todayMembers: Array.isArray(data.todayMembers) ? data.todayMembers : [],
                windowSeconds: Number(data.windowSeconds || 300),
                generatedAt: data.generatedAt || '',
            });
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            console.warn('Presence unavailable:', error);
        } finally {
            if (!signal?.aborted) setIsLoading(false);
        }
    }, [isAuthenticated, limit]);

    useEffect(() => {
        const controller = new AbortController();
        void loadPresence(isAuthenticated ? 'touch' : 'read', controller.signal);

        const interval = window.setInterval(() => {
            void loadPresence(isAuthenticated ? 'touch' : 'read', controller.signal);
        }, isAuthenticated ? HEARTBEAT_MS : FETCH_MS);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void loadPresence(isAuthenticated ? 'touch' : 'read', controller.signal);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            controller.abort();
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isAuthenticated, loadPresence]);

    const openProfile = (memberId: number) => {
        router.push(`/profile/${memberId}`);
    };

    const avatarStack = (
        <div className="presence-avatar-stack" aria-label="Online members">
            {visibleMembers.map((member) => (
                <button
                    key={member.id}
                    type="button"
                    className="presence-avatar-button"
                    onClick={() => openProfile(member.id)}
                    title={member.username}
                    aria-label={`View ${member.username}'s profile`}
                >
                    <Avatar
                        value={member.avatar}
                        emoji={member.avatar_emoji}
                        theme={member.avatar_theme}
                        seed={member.id}
                        size={variant === 'sidebar' ? 24 : 38}
                    />
                    <span className="presence-dot" aria-hidden="true" />
                    {variant !== 'sidebar' && <span className="presence-member-name">{member.username}</span>}
                </button>
            ))}
            {extraCount > 0 && (
                <span className="presence-extra" aria-label={`${extraCount} more online members`}>
                    +{extraCount}
                </span>
            )}
        </div>
    );

    if (variant === 'sidebar') {
        if (isLoading && summary.onlineCount === 0) return null;

        return (
            <div className="sidebar-presence-strip" aria-label="Online members">
                <div className="sidebar-presence-copy">
                    <span className="presence-live-dot" aria-hidden="true" />
                    <span>{formatOnlineLabel(summary.onlineCount)}</span>
                </div>
                {visibleMembers.length > 0 && avatarStack}
            </div>
        );
    }

    return (
        <SpotlightCard className="glass-card full-width presence-card" spotlightColor="rgba(55, 198, 208, 0.18)">
            <div className="presence-card-head">
                <div>
                    <span className="dashboard-widget-kicker">Live Campus</span>
                    <h3>{'\u5728\u7ebf\u6210\u5458'}</h3>
                    <p>See who is around Hajimi right now.</p>
                </div>
                <div className="presence-count-pill">
                    <span className="presence-live-dot" aria-hidden="true" />
                    {isLoading ? 'Checking...' : formatOnlineLabel(summary.onlineCount)}
                </div>
            </div>

            <div className="presence-card-body">
                <div className="presence-card-main">
                    {visibleMembers.length > 0 ? avatarStack : (
                        <p className="presence-empty">No classmates are active in the last few minutes.</p>
                    )}
                </div>
                <div className="presence-card-aside">
                    <strong>{summary.windowSeconds ? Math.round(summary.windowSeconds / 60) : 5} min</strong>
                    <p className="presence-note">Active window. Avatars open member profiles.</p>
                </div>
            </div>

            {isAuthenticated && (
                <div className="presence-today-section">
                    <div className="presence-today-head">
                        <div>
                            <strong>今日来过</strong>
                            <span>{summary.todayMemberCount} 人</span>
                        </div>
                        <small>最后上线时间</small>
                    </div>
                    {visibleTodayMembers.length > 0 ? (
                        <div className="presence-today-list">
                            {visibleTodayMembers.map(member => {
                                const lastSeen = new Date(member.last_seen_at);
                                return (
                                    <button
                                        key={member.id}
                                        type="button"
                                        className="presence-today-member"
                                        onClick={() => openProfile(member.id)}
                                    >
                                        <Avatar
                                            value={member.avatar}
                                            emoji={member.avatar_emoji}
                                            theme={member.avatar_theme}
                                            seed={member.id}
                                            size={30}
                                        />
                                        <span>{member.username}</span>
                                        <time dateTime={Number.isNaN(lastSeen.getTime()) ? undefined : lastSeen.toISOString()}>
                                            {formatLastSeen(member.last_seen_at)}
                                        </time>
                                    </button>
                                );
                            })}
                            {todayExtraCount > 0 && <span className="presence-today-more">还有 {todayExtraCount} 人</span>}
                        </div>
                    ) : (
                        <p className="presence-today-empty">今天还没有其他成员上线。</p>
                    )}
                </div>
            )}
        </SpotlightCard>
    );
}
