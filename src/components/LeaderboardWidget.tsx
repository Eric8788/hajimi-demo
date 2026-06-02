'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from './Avatar';
import { User } from '@/lib/db';
import UserBadges from './UserBadges';
import { cachedJson } from '@/lib/clientJsonCache';
import { applyAvatarPatch, loadAvatarPatches } from '@/lib/clientAvatarHydration';

const PODIUM_LABELS = ['🥇', '🥈', '🥉'];
const WINDOW_TABS = [
    { id: 'all', label: '总榜' },
    { id: 'day', label: '日榜' },
    { id: 'week', label: '周榜' },
    { id: 'month', label: '月榜' },
] as const;
type LeaderboardWindow = (typeof WINDOW_TABS)[number]['id'];

export default function LeaderboardWidget({
    limit = 10,
    showViewAll = true,
    defaultWindow = 'all',
    subtitle,
}: {
    limit?: number;
    showViewAll?: boolean;
    defaultWindow?: LeaderboardWindow;
    subtitle?: string;
}) {
    const router = useRouter();
    const [leaderboard, setLeaderboard] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [windowType, setWindowType] = useState<LeaderboardWindow>(defaultWindow);

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        setLoading(true);
        setError('');
        cachedJson<User[]>(
            `leaderboard:${limit}:${windowType}:all`,
            `/api/leaderboard?limit=${limit}&window=${windowType}&category=all`,
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
    }, [limit, windowType]);

    const openProfile = (userId: number) => {
        router.push(`/profile/${userId}`);
    };

    if (loading) {
        return (
            <div className="glass-card full-width leaderboard-card leaderboard-card-loading">
                <p>Loading Hall of Fame...</p>
            </div>
        );
    }

    return (
        <div className="glass-card full-width leaderboard-card">
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
                            <button key={tab.id} type="button" className={windowType === tab.id ? 'is-active' : ''} onClick={() => setWindowType(tab.id)}>
                                {tab.label}
                            </button>
                        ))}
                    </div>
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
                            <span>{user.points}</span>
                            <small>XP</small>
                        </div>
                    </div>
                ))}
                
                {leaderboard.length === 0 && (
                    <p className="leaderboard-empty">{error || 'No students in the hall yet.'}</p>
                )}
            </div>
        </div>
    );
}
