'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from './Avatar';
import { User } from '@/lib/db';
import UserBadges from './UserBadges';
import { cachedJson } from '@/lib/clientJsonCache';
import { applyAvatarPatch, loadAvatarPatches } from '@/lib/clientAvatarHydration';
import AnimatedNumber from '@/components/reactbits/AnimatedNumber';
import SpotlightCard from '@/components/reactbits/SpotlightCard';

const PODIUM_LABELS = ['🥇', '🥈', '🥉'];
const WINDOW_TABS = [
    { id: 'all', label: '总榜' },
    { id: 'day', label: '日榜' },
    { id: 'week', label: '周榜' },
    { id: 'month', label: '月榜' },
] as const;
type LeaderboardWindow = (typeof WINDOW_TABS)[number]['id'] | 'custom';

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';

function formatShanghaiDate(date: Date) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: SHANGHAI_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function getDefaultCustomRange() {
    const today = formatShanghaiDate(new Date());
    return {
        startDate: `${today.slice(0, 8)}01`,
        endDate: today,
    };
}

function isValidRange(startDate: string, endDate: string) {
    return Boolean(startDate && endDate && startDate <= endDate);
}

export default function LeaderboardWidget({
    limit = 10,
    showViewAll = true,
    defaultWindow = 'week',
    subtitle,
    defaultRangeStart,
    defaultRangeEnd,
}: {
    limit?: number;
    showViewAll?: boolean;
    defaultWindow?: LeaderboardWindow;
    subtitle?: string;
    defaultRangeStart?: string;
    defaultRangeEnd?: string;
}) {
    const router = useRouter();
    const [leaderboard, setLeaderboard] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [windowType, setWindowType] = useState<LeaderboardWindow>(defaultWindow);
    const [customStartDate, setCustomStartDate] = useState(() => defaultRangeStart || getDefaultCustomRange().startDate);
    const [customEndDate, setCustomEndDate] = useState(() => defaultRangeEnd || getDefaultCustomRange().endDate);
    const hasValidCustomRange = isValidRange(customStartDate, customEndDate);
    const requestWindowType: LeaderboardWindow = windowType === 'custom' && hasValidCustomRange ? 'custom' : windowType === 'custom' ? 'month' : windowType;

    const markReloading = () => {
        setLoading(true);
        setError('');
    };

    const selectWindowType = (nextWindowType: LeaderboardWindow) => {
        markReloading();
        setWindowType(nextWindowType);
    };

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        const shouldLoadCustomStats = windowType === 'custom' && hasValidCustomRange;
        const rangeQuery = shouldLoadCustomStats
            ? `&start=${encodeURIComponent(customStartDate)}&end=${encodeURIComponent(customEndDate)}`
            : '';
        const cacheKey = shouldLoadCustomStats
            ? `leaderboard:${limit}:custom:all:${customStartDate}:${customEndDate}`
            : `leaderboard:${limit}:${requestWindowType}:all`;

        cachedJson<User[]>(
            cacheKey,
            `/api/leaderboard?limit=${limit}&window=${requestWindowType}&category=all${rangeQuery}`,
            45_000,
            { signal: controller.signal },
        )
            .then(data => {
                if (!active) return;
                if (Array.isArray(data)) {
                    setLeaderboard(data.slice(0, limit));
                    loadAvatarPatches(data.slice(0, limit).map(user => user.id), controller.signal)
                        .then(patches => {
                            if (!active || patches.size === 0) return;
                            setLeaderboard(current => current.map(user => applyAvatarPatch(user, patches)));
                        })
                        .catch(error => {
                            if (error instanceof DOMException && error.name === 'AbortError') return;
                            console.warn('Leaderboard avatars unavailable:', error);
                        });
                } else {
                    setLeaderboard([]);
                    setError('榜单暂时没有返回有效数据。');
                }
            })
            .catch(err => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                if (!active) return;
                console.error('Failed to load leaderboard:', err);
                setLeaderboard([]);
                setError('榜单暂时加载失败，稍后再试。');
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, [customEndDate, customStartDate, hasValidCustomRange, limit, requestWindowType, windowType]);

    const openProfile = (userId: number) => {
        router.push(`/profile/${userId}`);
    };

    if (loading) {
        return (
            <SpotlightCard className="glass-card full-width leaderboard-card leaderboard-card-loading" spotlightColor="rgba(108, 92, 231, 0.14)">
                <p>Loading Hall of Fame...</p>
            </SpotlightCard>
        );
    }

    return (
        <SpotlightCard className="glass-card full-width leaderboard-card" spotlightColor="rgba(253, 121, 168, 0.16)">
            <div className="leaderboard-head">
                <button type="button" className="leaderboard-title-button" onClick={() => router.push('/leaderboard')}>
                    <h3>🏆 Hall of Fame</h3>
                    <span>{subtitle || `Top ${limit} Members`}</span>
                </button>
                {showViewAll && (
                    <button type="button" className="leaderboard-view-all" onClick={() => router.push('/leaderboard')}>
                        View all →
                    </button>
                )}
            </div>
            {!showViewAll && (
                <div className="leaderboard-controls">
                    <div>
                        {WINDOW_TABS.map(tab => (
                            <button key={tab.id} type="button" className={windowType === tab.id ? 'is-active' : ''} onClick={() => selectWindowType(tab.id)}>
                                {tab.label}
                            </button>
                        ))}
                        <button
                            type="button"
                            className={windowType === 'custom' ? 'is-active' : ''}
                            onClick={() => selectWindowType('custom')}
                        >
                            自定义
                        </button>
                    </div>
                </div>
            )}
            {!showViewAll && (
                <div className="leaderboard-date-range" aria-label="Member XP custom date range">
                    <label>
                        <span>开始</span>
                        <input
                            type="date"
                            value={customStartDate}
                            max={customEndDate}
                            onChange={event => {
                                const nextStartDate = event.target.value;
                                markReloading();
                                setCustomStartDate(nextStartDate);
                                if (nextStartDate && customEndDate && nextStartDate > customEndDate) {
                                    setCustomEndDate(nextStartDate);
                                }
                                setWindowType('custom');
                            }}
                        />
                    </label>
                    <label>
                        <span>结束</span>
                        <input
                            type="date"
                            value={customEndDate}
                            min={customStartDate}
                            onChange={event => {
                                const nextEndDate = event.target.value;
                                markReloading();
                                setCustomEndDate(nextEndDate);
                                if (customStartDate && nextEndDate && nextEndDate < customStartDate) {
                                    setCustomStartDate(nextEndDate);
                                }
                                setWindowType('custom');
                            }}
                        />
                    </label>
                </div>
            )}
            
            <div className="leaderboard-list">
                {leaderboard.map((user, index) => (
                    <div 
                        key={user.id} 
                        className={`leaderboard-row${index < 3 ? ` is-podium is-rank-${index + 1}` : ''}`}
                    >
                        <div className="leaderboard-member">
                            <div className="leaderboard-rank">
                                {index < 3 ? PODIUM_LABELS[index] : index + 1}
                            </div>
                            <button
                                type="button"
                                className="leaderboard-avatar-button"
                                onClick={() => openProfile(user.id)}
                                aria-label={`View ${user.username}'s profile`}
                            >
                                <Avatar value={user.avatar} emoji={user.avatar_emoji} theme={user.avatar_theme} size={36} />
                            </button>
                            <div className="leaderboard-copy">
                                <div className="leaderboard-name-line">
                                    <button type="button" className="leaderboard-username" onClick={() => openProfile(user.id)}>
                                        {user.username}
                                    </button>
                                    <UserBadges user={user} compact iconOnly />
                                </div>
                                <span className="leaderboard-level">Level {user.level}</span>
                            </div>
                        </div>
                        <div className="leaderboard-score">
                            <AnimatedNumber value={user.points} />
                            <small>XP</small>
                        </div>
                    </div>
                ))}
                
                {leaderboard.length === 0 && (
                    <p className="leaderboard-empty">{error || 'No students in the hall yet.'}</p>
                )}
            </div>
        </SpotlightCard>
    );
}
