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
    }, []);

    if (loading) {
        return (
            <div className="glass-card full-width" style={{ padding: '30px', textAlign: 'center' }}>
                <p style={{ opacity: 0.6 }}>Loading Hall of Fame...</p>
            </div>
        );
    }

    return (
        <div className="glass-card full-width" style={{ padding: '30px', background: 'rgba(255, 255, 255, 0.65)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.4rem', margin: 0 }}>🏆 Hall of Fame</h3>
                <span style={{ fontSize: '0.85rem', color: '#6c5ce7', fontWeight: 600 }}>Top {limit} Members</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {leaderboard.map((user, index) => (
                    <div 
                        key={user.id} 
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            background: index === 0 ? 'linear-gradient(90deg, rgba(255, 234, 167, 0.4), rgba(255, 255, 255, 0.4))' : 'rgba(255, 255, 255, 0.5)',
                            borderRadius: '12px',
                            border: index === 0 ? '1px solid rgba(253, 203, 110, 0.5)' : '1px solid rgba(255, 255, 255, 0.8)',
                            boxShadow: index === 0 ? '0 4px 12px rgba(253, 203, 110, 0.1)' : 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ 
                                width: '28px', 
                                fontWeight: 800, 
                                fontSize: '1.1rem', 
                                color: index === 0 ? '#d35400' : index === 1 ? '#636e72' : index === 2 ? '#e17055' : '#b2bec3',
                                textAlign: 'center'
                            }}>
                                {index + 1}
                            </div>
                            <Avatar value={user.avatar} size={36} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 700, color: '#2d3436' }}>{user.username}</span>
                                    <RoleBadge role={user.role} showStudent />
                                    {user.is_creator && <CreatorBadge compact />}
                                </div>
                                <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Level {user.level}</span>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 800, color: '#6c5ce7', fontSize: '1.05rem' }}>{user.points}</span>
                            <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.6 }}>XP</span>
                        </div>
                    </div>
                ))}
                
                {leaderboard.length === 0 && (
                    <p style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>No students in the hall yet.</p>
                )}
            </div>
        </div>
    );
}
