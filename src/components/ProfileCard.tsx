'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/db';

export default function ProfilePage({ user }: { user: User }) {
    const router = useRouter();
    const [bio, setBio] = useState(user.bio || '');
    const [avatar, setAvatar] = useState(user.avatar || '😊');
    const [grade, setGrade] = useState(user.grade || '');
    const [age, setAge] = useState<number | ''>(user.age || '');
    const [ethnicity, setEthnicity] = useState(user.ethnicity || '');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    };

    const handleSave = async () => {
        setLoading(true);
        await fetch('/api/profile', {
            method: 'POST',
            body: JSON.stringify({ bio, avatar, grade, age: age || undefined, ethnicity }),
        });
        setLoading(false);
        setIsEditing(false);
        router.refresh();
    };

    return (
        <div style={{ display: 'flex', gap: '50px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>

            {/* Left: Avatar & Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <div style={{
                    width: '160px', height: '160px',
                    background: 'linear-gradient(135deg, #fab1a0, #ff7675)',
                    borderRadius: '50%',
                    border: '8px solid rgba(255,255,255,0.9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '5rem',
                    boxShadow: '0 12px 24px rgba(255, 118, 117, 0.3)',
                    position: 'relative'
                }}>
                    {isEditing ? (
                        <input
                            value={avatar}
                            onChange={e => setAvatar(e.target.value)}
                            style={{ width: '80%', textAlign: 'center', background: 'transparent', border: 'none', fontSize: '5rem', outline: 'none', color: 'white' }}
                            maxLength={2}
                        />
                    ) : avatar}
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2d3436' }}>Level {user.level}</div>
                    <div style={{ fontSize: '1.2rem', opacity: 0.7, fontFamily: 'monospace' }}>{user.points} XP</div>
                </div>
            </div>

            {/* Right: Info */}
            <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                    <h2 style={{ fontSize: '3rem', marginBottom: '10px', background: 'linear-gradient(90deg, #6c5ce7, #a29bfe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {user.username}
                    </h2>

                    {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <textarea
                                value={bio}
                                onChange={e => setBio(e.target.value)}
                                placeholder="Tell us about yourself..."
                                style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #dfe6e9', fontSize: '1rem', background: 'rgba(255,255,255,0.8)', fontFamily: 'inherit', resize: 'vertical' }}
                                rows={2}
                            />
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <input
                                    value={grade}
                                    onChange={e => setGrade(e.target.value)}
                                    placeholder="Grade (e.g. 10th)"
                                    style={{ flex: 1, minWidth: '120px', padding: '10px 15px', borderRadius: '10px', border: '1px solid #dfe6e9', fontSize: '0.95rem' }}
                                />
                                <input
                                    type="number"
                                    value={age}
                                    onChange={e => setAge(e.target.value ? Number(e.target.value) : '')}
                                    placeholder="Age"
                                    min={10}
                                    max={100}
                                    style={{ width: '80px', padding: '10px 15px', borderRadius: '10px', border: '1px solid #dfe6e9', fontSize: '0.95rem' }}
                                />
                                <input
                                    value={ethnicity}
                                    onChange={e => setEthnicity(e.target.value)}
                                    placeholder="Ethnicity/Background"
                                    style={{ flex: 1, minWidth: '150px', padding: '10px 15px', borderRadius: '10px', border: '1px solid #dfe6e9', fontSize: '0.95rem' }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <p style={{ fontSize: '1.2rem', lineHeight: '1.5', color: '#636e72', margin: 0 }}>
                                {user.bio || 'No bio yet.'}
                            </p>
                            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', fontSize: '0.9rem', color: '#b2bec3' }}>
                                {user.grade && <span>📚 {user.grade}</span>}
                                {user.age && <span>🎂 {user.age} y/o</span>}
                                {user.ethnicity && <span>🌍 {user.ethnicity}</span>}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                    {isEditing ? (
                        <>
                            <button onClick={handleSave} className="btn btn-primary" disabled={loading}>
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button onClick={() => setIsEditing(false)} className="btn" style={{ background: 'transparent', border: '1px solid #dfe6e9' }}>
                                Cancel
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="btn"
                            style={{ background: 'white', border: '1px solid #dfe6e9', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
                        >
                            Edit Profile
                        </button>
                    )}

                    <button
                        onClick={handleLogout}
                        className="btn"
                        style={{ background: '#ffeaa7', color: '#d35400', border: '1px solid #ffd32a' }}
                    >
                        Logout
                    </button>
                </div>
            </div>

        </div>
    );
}
