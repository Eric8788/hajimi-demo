'use client';

import { useEffect, useState } from 'react';
import Avatar from './Avatar';
import { User } from '@/lib/db';
import CreatorBadge from './CreatorBadge';
import RoleBadge from './RoleBadge';

export default function LeaderboardWidget({ limit = 10 }: { limit?: number }) {
    const [leaderboard, setLeaderboard] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/leaderboard')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setLeaderboard(data.slice(0, limit));
                }
            })
            .catch(err => console.error('Failed to load leaderboard:', err))
            .finally(() => setLoading(false));
    }, [limit]);

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
                <h3>🏆 Hall of Fame</h3>
                <span>Top {limit} Members</span>
            </div>
            
            <div className="leaderboard-list">
                {leaderboard.map((user, index) => (
                    <div 
                        key={user.id} 
                        className={`leaderboard-row${index === 0 ? ' is-top' : ''}`}
                    >
                        <div className="leaderboard-member">
                            <div
                                className="leaderboard-rank"
                                style={{ color: index === 0 ? '#d35400' : index === 1 ? '#636e72' : index === 2 ? '#e17055' : '#b2bec3' }}
                            >
                                {index + 1}
                            </div>
                            <Avatar value={user.avatar} size={36} />
                            <div className="leaderboard-copy">
                                <div className="leaderboard-name-line">
                                    <span className="leaderboard-username">{user.username}</span>
                                    <RoleBadge role={user.role} showStudent />
                                    {user.is_creator && <CreatorBadge compact />}
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
