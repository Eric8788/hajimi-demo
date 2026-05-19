'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from './Avatar';
import { User } from '@/lib/db';
import UserBadges from './UserBadges';

const PODIUM_LABELS = ['🥇', '🥈', '🥉'];

export default function LeaderboardWidget({ limit = 10, showViewAll = true }: { limit?: number; showViewAll?: boolean }) {
    const router = useRouter();
    const [leaderboard, setLeaderboard] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/leaderboard?limit=${limit}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setLeaderboard(data.slice(0, limit));
                }
            })
            .catch(err => console.error('Failed to load leaderboard:', err))
            .finally(() => setLoading(false));
    }, [limit]);

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
                    <span>Top {limit} Members</span>
                </button>
                {showViewAll && (
                    <button type="button" className="leaderboard-view-all" onClick={() => router.push('/leaderboard')}>
                        View all →
                    </button>
                )}
            </div>
            
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
                                <Avatar value={user.avatar} theme={user.avatar_theme} size={36} />
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
                    <p className="leaderboard-empty">No students in the hall yet.</p>
                )}
            </div>
        </div>
    );
}
