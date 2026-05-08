/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/db';
import RoleBadge from './RoleBadge';
import Avatar from './Avatar';

function loadAvatarImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not read avatar image'));
        image.src = src;
    });
}

export default function ProfilePage({ user }: { user: User }) {
    const router = useRouter();
    const [bio, setBio] = useState(user.bio || '');
    const [avatar, setAvatar] = useState(user.avatar || '😊');
    const [grade, setGrade] = useState(user.grade || '');
    const [age, setAge] = useState<number | ''>(user.age || '');
    const [ethnicity, setEthnicity] = useState(user.ethnicity || '');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [avatarSource, setAvatarSource] = useState('');
    const [avatarZoom, setAvatarZoom] = useState(1);
    const [avatarOffsetX, setAvatarOffsetX] = useState(0);
    const [avatarOffsetY, setAvatarOffsetY] = useState(0);
    const [avatarError, setAvatarError] = useState('');

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    };

    const avatarIsImage = avatar.startsWith('data:image/') || avatar.startsWith('http://') || avatar.startsWith('https://');

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

    const handleAvatarFile = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        setAvatarError('');

        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setAvatarError('Please choose an image file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setAvatarSource(String(reader.result || ''));
            setAvatarZoom(1);
            setAvatarOffsetX(0);
            setAvatarOffsetY(0);
        };
        reader.onerror = () => setAvatarError('Could not read this image.');
        reader.readAsDataURL(file);
    };

    const applyCroppedAvatar = async () => {
        if (!avatarSource) return;
        setAvatarError('');

        try {
            const image = await loadAvatarImage(avatarSource);
            const canvas = document.createElement('canvas');
            const size = 256;
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Could not crop avatar');

            context.clearRect(0, 0, size, size);
            const baseScale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
            const scale = baseScale * avatarZoom;
            const width = image.naturalWidth * scale;
            const height = image.naturalHeight * scale;
            const x = (size - width) / 2 + avatarOffsetX;
            const y = (size - height) / 2 + avatarOffsetY;

            context.drawImage(image, x, y, width, height);
            setAvatar(canvas.toDataURL('image/webp', 0.86));
            setAvatarSource('');
        } catch {
            setAvatarError('Could not crop this image. Try another one.');
        }
    };

    return (
        <div style={{ display: 'flex', gap: '50px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>

            {/* Left: Avatar & Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <div className="profile-avatar-frame">
                    {avatarSource ? (
                        <img
                            src={avatarSource}
                            alt="Avatar crop preview"
                            className="profile-avatar-crop-preview"
                            style={{ transform: `translate(${avatarOffsetX * 0.62}px, ${avatarOffsetY * 0.62}px) scale(${avatarZoom})` }}
                        />
                    ) : (
                        <Avatar value={avatar} fallback="😊" size={160} style={{ fontSize: '5rem' }} />
                    )}
                </div>
                {isEditing && (
                    <div className="profile-avatar-editor">
                        <label className="btn profile-avatar-upload">
                            Upload image
                            <input type="file" accept="image/*" onChange={handleAvatarFile} />
                        </label>
                        <input
                            value={avatarSource || avatarIsImage ? '' : avatar}
                            onChange={e => setAvatar(e.target.value)}
                            placeholder="Or emoji"
                            className="glass-input"
                            maxLength={4}
                        />
                        {avatarSource && (
                            <div className="profile-avatar-crop-controls">
                                <label>
                                    Zoom
                                    <input type="range" min="1" max="2.2" step="0.05" value={avatarZoom} onChange={e => setAvatarZoom(Number(e.target.value))} />
                                </label>
                                <label>
                                    X
                                    <input type="range" min="-90" max="90" step="1" value={avatarOffsetX} onChange={e => setAvatarOffsetX(Number(e.target.value))} />
                                </label>
                                <label>
                                    Y
                                    <input type="range" min="-90" max="90" step="1" value={avatarOffsetY} onChange={e => setAvatarOffsetY(Number(e.target.value))} />
                                </label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button type="button" className="btn btn-primary" onClick={applyCroppedAvatar}>Use crop</button>
                                    <button type="button" className="btn" style={{ background: 'white', border: '1px solid #dfe6e9' }} onClick={() => setAvatarSource('')}>Cancel image</button>
                                </div>
                            </div>
                        )}
                        {avatarError && <div className="profile-avatar-error">{avatarError}</div>}
                    </div>
                )}
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
                    <div style={{ marginBottom: '16px' }}>
                        <RoleBadge role={user.role} showStudent />
                    </div>

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
