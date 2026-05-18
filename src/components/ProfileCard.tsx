/* eslint-disable @next/next/no-img-element */
'use client';

import { useRef, useState, type ChangeEvent, type PointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/db';
import Avatar from './Avatar';
import { getAvailableBadges, normalizeBadgePreferences, type BadgeId } from '@/lib/badges';
import BadgePill from './BadgePill';
import UserBadges from './UserBadges';
import { formatHajimiId } from '@/lib/hajimiId';
import { isStrongPassword, PASSWORD_REQUIREMENT_MESSAGE } from '@/lib/passwordPolicy';
import { normalizeUsernameInput, validateUsername, USERNAME_REQUIREMENT_MESSAGE } from '@/lib/accountValidation';


function loadAvatarImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not read avatar image'));
        image.src = src;
    });
}

function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read this image.'));
        reader.readAsDataURL(file);
    });
}

async function compressProfileImage(file: File) {
    const source = await fileToDataUrl(file);
    const image = await loadAvatarImage(source);
    const maxSize = 1200;
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare this image.');
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/webp', 0.82);
}

export default function ProfilePage({ user, readOnly = false }: { user: User; readOnly?: boolean }) {
    const router = useRouter();
    const [bio, setBio] = useState(user.bio || '');
    const [avatar, setAvatar] = useState(user.avatar || '😊');
    const [profileImage, setProfileImage] = useState(user.profile_image || '');
    const [newUsername, setNewUsername] = useState(user.username);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [accountError, setAccountError] = useState('');
    const [badgePreferences, setBadgePreferences] = useState<BadgeId[]>(normalizeBadgePreferences(user.badge_preferences));
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [avatarSource, setAvatarSource] = useState('');
    const [avatarZoom, setAvatarZoom] = useState(1);
    const [avatarOffsetX, setAvatarOffsetX] = useState(0);
    const [avatarOffsetY, setAvatarOffsetY] = useState(0);
    const [avatarError, setAvatarError] = useState('');
    const [profileImageError, setProfileImageError] = useState('');
    const dragState = useRef<{ pointerId: number | null; lastX: number; lastY: number }>({ pointerId: null, lastX: 0, lastY: 0 });

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    };

    const avatarIsImage = avatar.startsWith('data:image/') || avatar.startsWith('http://') || avatar.startsWith('https://');
    const totalXp = Number(user.points || 0);
    const displayLevel = Math.max(Number(user.level || 1), Math.floor(Math.sqrt(totalXp / 50)) + 1);
    const xpForCurrentLevel = 50 * Math.pow(displayLevel - 1, 2);
    const xpForNextLevel = 50 * Math.pow(displayLevel, 2);
    const xpInCurrentLevel = totalXp - xpForCurrentLevel;
    const xpRequiredForLevel = xpForNextLevel - xpForCurrentLevel;
    
    const progressPercent = Math.min(100, Math.round((xpInCurrentLevel / xpRequiredForLevel) * 100));
    const xpToNext = xpForNextLevel - totalXp;
    const availableBadges = getAvailableBadges(user);
    const hajimiId = formatHajimiId(user.id);

    const toggleBadgePreference = (badgeId: BadgeId) => {
        setBadgePreferences(current => {
            if (current.includes(badgeId)) {
                return current.filter(id => id !== badgeId);
            }

            return [...current, badgeId].slice(0, 3);
        });
    };

    const handleSave = async () => {
        const cleanUsername = normalizeUsernameInput(newUsername);
        setAccountError('');

        if (cleanUsername !== user.username && !validateUsername(cleanUsername)) {
            setAccountError(USERNAME_REQUIREMENT_MESSAGE);
            return;
        }

        if (newPassword) {
            if (!isStrongPassword(newPassword)) {
                setAccountError(PASSWORD_REQUIREMENT_MESSAGE);
                return;
            }
            if (newPassword !== confirmPassword) {
                setAccountError('两次输入的密码不一致。');
                return;
            }
        }

        setLoading(true);
        // Profile basics
        await fetch('/api/profile', {
            method: 'POST',
            body: JSON.stringify({ bio, avatar, profile_image: profileImage, badge_preferences: badgePreferences }),
        });

        // Account security if changed
        if (newUsername !== user.username || newPassword !== '') {
            const res = await fetch('/api/profile/account', {
                method: 'POST',
                body: JSON.stringify({ 
                    username: cleanUsername !== user.username ? cleanUsername : undefined,
                    password: newPassword !== '' ? newPassword : undefined,
                    confirmPassword: newPassword !== '' ? confirmPassword : undefined,
                }),
            });
            const data = await res.json();
            if (data.error) {
                setAccountError(data.error);
                setLoading(false);
                return;
            }
        }

        setLoading(false);
        setIsEditing(false);
        setNewPassword('');
        setConfirmPassword('');
        router.refresh();
    };

    const handleDeleteAccount = async () => {
        if (!confirm('WARNING: This will permanently delete your account and all your content (posts, comments, etc.). This action cannot be undone. Are you absolutely sure?')) {
            return;
        }

        setLoading(true);
        const res = await fetch('/api/profile/delete', { method: 'POST' });
        if (res.ok) {
            window.location.href = '/';
        } else {
            alert('Failed to delete account');
            setLoading(false);
        }
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

    const handleProfileImageFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        setProfileImageError('');

        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setProfileImageError('Please choose an image file.');
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            setProfileImageError('Image must be 8 MB or smaller.');
            return;
        }

        try {
            setProfileImage(await compressProfileImage(file));
        } catch {
            setProfileImageError('Could not read this image. Try a smaller JPEG, PNG, or WebP file.');
        }
    };

    const clampAvatarOffset = (value: number) => Math.max(-120, Math.min(120, value));

    const handleAvatarDragStart = (event: PointerEvent<HTMLDivElement>) => {
        if (!avatarSource) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragState.current = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
    };

    const handleAvatarDragMove = (event: PointerEvent<HTMLDivElement>) => {
        if (!avatarSource || dragState.current.pointerId !== event.pointerId) return;

        const dx = event.clientX - dragState.current.lastX;
        const dy = event.clientY - dragState.current.lastY;
        dragState.current.lastX = event.clientX;
        dragState.current.lastY = event.clientY;
        setAvatarOffsetX(value => clampAvatarOffset(value + dx * 1.6));
        setAvatarOffsetY(value => clampAvatarOffset(value + dy * 1.6));
    };

    const handleAvatarDragEnd = (event: PointerEvent<HTMLDivElement>) => {
        if (dragState.current.pointerId !== event.pointerId) return;
        dragState.current.pointerId = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
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
        <div className="profile-card-layout">
            <aside className="profile-identity-card">
                <div className="profile-identity-top">
                    <div
                        className={`profile-avatar-frame ${avatarSource ? 'is-draggable' : ''}`}
                        onPointerDown={handleAvatarDragStart}
                        onPointerMove={handleAvatarDragMove}
                        onPointerUp={handleAvatarDragEnd}
                        onPointerCancel={handleAvatarDragEnd}
                    >
                        {avatarSource ? (
                            <img
                                src={avatarSource}
                                alt="Avatar crop preview"
                                className="profile-avatar-crop-preview"
                                style={{ transform: `translate(${avatarOffsetX * 0.62}px, ${avatarOffsetY * 0.62}px) scale(${avatarZoom})` }}
                            />
                        ) : (
                            <Avatar value={avatar} fallback="😊" size={148} style={{ fontSize: '4.6rem' }} />
                        )}
                    </div>
                    <div className="profile-identity-copy">
                        <h2>{user.username}</h2>
                        <div className="profile-badge-row">
                            <UserBadges user={{ ...user, badge_preferences: badgePreferences }} />
                        </div>
                        <span className="hajimi-id-chip">Hajimi ID {hajimiId}</span>
                    </div>
                </div>

                {avatarSource && <div className="profile-avatar-drag-hint">Drag to reposition</div>}
                {isEditing && !readOnly && (
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
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button type="button" className="btn btn-primary" onClick={applyCroppedAvatar}>Use crop</button>
                                    <button type="button" className="btn" style={{ background: 'white', border: '1px solid #dfe6e9' }} onClick={() => setAvatarSource('')}>Cancel image</button>
                                </div>
                            </div>
                        )}
                        {avatarError && <div className="profile-avatar-error">{avatarError}</div>}
                    </div>
                )}

                <div className="profile-level-card">
                    <div className="profile-level-row">
                        <span>Level {displayLevel}</span>
                        <span>{totalXp} XP</span>
                    </div>
                    <div className="profile-level-progress" aria-label={`Level progress ${progressPercent}%`}>
                        <span style={{ width: `${progressPercent}%` }} />
                    </div>
                    <div className="profile-level-next">
                        {xpToNext} XP to Level {displayLevel + 1}
                    </div>
                    {user.streak_count > 0 && (
                        <div className="profile-streak-chip">
                            🔥 {user.streak_count} Day Streak
                        </div>
                    )}
                </div>
            </aside>

            <section className="profile-details-stack">
                {isEditing ? (
                    <>
                        <section className="profile-composer-card">
                            <div className="profile-section-heading">
                                <h3>主页图文</h3>
                                <p>像发一条个人动态一样介绍自己。</p>
                            </div>
                            <textarea
                                value={bio}
                                onChange={e => setBio(e.target.value)}
                                placeholder="写一段会出现在主页上的介绍，可以像朋友圈/微博一样随意一点。"
                                className="glass-input profile-bio-input"
                                rows={5}
                            />
                            <div className="profile-image-composer">
                                {profileImage ? (
                                    <div className="profile-image-preview">
                                        <img src={profileImage} alt="Profile post preview" />
                                        <button type="button" onClick={() => setProfileImage('')}>Remove image</button>
                                    </div>
                                ) : (
                                    <label className="profile-image-upload">
                                        <span>＋</span>
                                        <strong>Upload profile image</strong>
                                        <small>JPEG, PNG, WebP. 会压缩后保存。</small>
                                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleProfileImageFile} />
                                    </label>
                                )}
                                {profileImageError && <div className="profile-account-error">{profileImageError}</div>}
                            </div>
                        </section>

                        <section className="profile-badge-editor">
                            <div className="profile-section-heading">
                                <h3>主页 badge</h3>
                                <p>最多显示 3 个；其他位置会自动使用 emoji 简版。</p>
                            </div>
                            <div className="profile-badge-options">
                                {availableBadges.map(badge => {
                                    const active = badgePreferences.includes(badge.id);
                                    const disabled = !active && badgePreferences.length >= 3;

                                    return (
                                        <button
                                            key={badge.id}
                                            type="button"
                                            className={`profile-badge-option${active ? ' is-active' : ''}`}
                                            onClick={() => toggleBadgePreference(badge.id)}
                                            disabled={disabled}
                                        >
                                            <BadgePill badge={badge} compact />
                                            <span>{active ? '显示中' : disabled ? '已满' : '显示'}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="profile-account-editor">
                            <div className="profile-account-head">
                                <div>
                                    <h4>账号设置</h4>
                                    <p>公开身份仍然只展示昵称和 Hajimi ID。</p>
                                </div>
                                <span>{hajimiId}</span>
                            </div>
                            <div className="profile-account-fields">
                                <label className="profile-field-label">
                                    用户名
                                    <input
                                        value={newUsername}
                                        onChange={e => setNewUsername(e.target.value)}
                                        className="glass-input"
                                    />
                                    <small>2-24 个字符；不能包含空格或 URL 特殊符号。</small>
                                </label>
                                <label className="profile-field-label">
                                    新密码
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="留空则不修改"
                                        className="glass-input"
                                        autoComplete="new-password"
                                    />
                                    <small>至少 8 位，并包含大小写字母和数字。</small>
                                </label>
                                {newPassword && (
                                    <label className="profile-field-label">
                                        再输入一次新密码
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            placeholder="确认新密码"
                                            className="glass-input"
                                            autoComplete="new-password"
                                        />
                                    </label>
                                )}
                                {accountError && <div className="profile-account-error">{accountError}</div>}
                                <div>
                                    <button
                                        type="button"
                                        onClick={handleDeleteAccount}
                                        className="profile-delete-button"
                                    >
                                        Delete My Account Permanently
                                    </button>
                                </div>
                            </div>
                        </section>
                    </>
                ) : (
                    <section className="profile-post-card">
                        {profileImage && (
                            <div className="profile-post-image">
                                <img src={profileImage} alt={`${user.username}'s profile post`} />
                            </div>
                        )}
                        <div className="profile-post-body">
                            <p>{user.bio || 'No post yet. Edit your profile to add a profile note.'}</p>
                        </div>
                    </section>
                )}

                {!readOnly && (
                    <div className="profile-action-row">
                        {isEditing ? (
                            <>
                                <button onClick={handleSave} className="btn btn-primary" disabled={loading}>
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button onClick={() => setIsEditing(false)} className="btn profile-secondary-button">
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="btn profile-secondary-button"
                            >
                                Edit Profile
                            </button>
                        )}

                        <button
                            onClick={handleLogout}
                            className="btn profile-logout-button"
                        >
                            Logout
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
}
