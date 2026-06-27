/* eslint-disable @next/next/no-img-element */
'use client';

import { useMemo, useRef, useState, type ChangeEvent, type PointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/lib/db';
import Avatar from './Avatar';
import BadgePill from './BadgePill';
import UserBadges from './UserBadges';
import { getAvailableBadges, normalizeBadgePreferences, type BadgeId } from '@/lib/badges';
import { AVATAR_EMOJIS, AVATAR_THEME_IDS, type AvatarThemeId } from '@/lib/avatarThemes';
import { clearCachedJson } from '@/lib/clientJsonCache';
import { formatHajimiId } from '@/lib/hajimiId';
import { getImageDisplayUrl } from '@/lib/imageProxy';

function loadProfileImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not read image'));
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
    const image = await loadProfileImage(source);
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

function getPreviewText(text?: string | null, max = 150) {
    const compact = (text || '').replace(/\s+/g, ' ').trim();
    return compact.length > max ? `${compact.slice(0, max)}...` : compact;
}

export default function PublicProfileSettingsPanel({ user }: { user: User }) {
    const router = useRouter();
    const [bio, setBio] = useState(user.bio || '');
    const [avatar, setAvatar] = useState(user.avatar || user.avatar_emoji || '😊');
    const [avatarEmoji, setAvatarEmoji] = useState(user.avatar_emoji || user.avatar || '😊');
    const [avatarTheme, setAvatarTheme] = useState<AvatarThemeId>((user.avatar_theme as AvatarThemeId) || 'lavender');
    const [profileImage, setProfileImage] = useState(user.profile_image || '');
    const [badgePreferences, setBadgePreferences] = useState<BadgeId[]>(normalizeBadgePreferences(user.badge_preferences));
    const [avatarSource, setAvatarSource] = useState('');
    const [avatarZoom, setAvatarZoom] = useState(1);
    const [avatarOffsetX, setAvatarOffsetX] = useState(0);
    const [avatarOffsetY, setAvatarOffsetY] = useState(0);
    const [avatarError, setAvatarError] = useState('');
    const [profileImageError, setProfileImageError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [saveMessage, setSaveMessage] = useState('');
    const [saving, setSaving] = useState(false);
    const dragState = useRef<{ pointerId: number | null; lastX: number; lastY: number }>({ pointerId: null, lastX: 0, lastY: 0 });

    const availableBadges = getAvailableBadges(user);
    const previewUser = useMemo(() => ({
        ...user,
        avatar,
        avatar_emoji: avatarEmoji,
        avatar_theme: avatarTheme,
        bio,
        profile_image: profileImage,
        badge_preferences: badgePreferences,
    }), [avatar, avatarEmoji, avatarTheme, badgePreferences, bio, profileImage, user]);
    const savedProfile = useMemo(() => ({
        bio: user.bio || '',
        avatar: user.avatar || user.avatar_emoji || '😊',
        avatarEmoji: user.avatar_emoji || user.avatar || '😊',
        avatarTheme: (user.avatar_theme as AvatarThemeId) || 'lavender',
        profileImage: user.profile_image || '',
        badgePreferences: normalizeBadgePreferences(user.badge_preferences),
    }), [user.avatar, user.avatar_emoji, user.avatar_theme, user.badge_preferences, user.bio, user.profile_image]);
    const avatarIsImage = avatar.startsWith('data:image/') || avatar.startsWith('http://') || avatar.startsWith('https://');
    const hajimiId = formatHajimiId(user.id);

    const hasChanges = () => (
        bio !== savedProfile.bio ||
        avatar !== savedProfile.avatar ||
        avatarEmoji !== savedProfile.avatarEmoji ||
        avatarTheme !== savedProfile.avatarTheme ||
        profileImage !== savedProfile.profileImage ||
        JSON.stringify(badgePreferences) !== JSON.stringify(savedProfile.badgePreferences)
    );

    const resetDraft = () => {
        setBio(savedProfile.bio);
        setAvatar(savedProfile.avatar);
        setAvatarEmoji(savedProfile.avatarEmoji);
        setAvatarTheme(savedProfile.avatarTheme);
        setProfileImage(savedProfile.profileImage);
        setBadgePreferences(savedProfile.badgePreferences);
        setAvatarSource('');
        setAvatarError('');
        setProfileImageError('');
        setSaveError('');
        setSaveMessage('');
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
            const image = await loadProfileImage(avatarSource);
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

    const toggleBadgePreference = (badgeId: BadgeId) => {
        setBadgePreferences(current => {
            if (current.includes(badgeId)) {
                return current.filter(id => id !== badgeId);
            }

            return [...current, badgeId].slice(0, 3);
        });
    };

    const savePublicProfile = async () => {
        setSaveError('');
        setSaveMessage('');

        if (!hasChanges()) {
            setSaveMessage('没有新的公开主页修改。');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/profile', {
                method: 'POST',
                body: JSON.stringify({
                    bio,
                    avatar,
                    avatar_emoji: avatarEmoji,
                    avatar_theme: avatarTheme,
                    profile_image: profileImage,
                    badge_preferences: badgePreferences,
                }),
            });
            const data = await res.json().catch(() => null);

            if (!res.ok || data?.error) {
                setSaveError(data?.error || '主页保存失败，请稍后再试。');
                return;
            }

            clearCachedJson('avatars:');
            setSaveMessage('公开主页已更新。');
            router.refresh();
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="settings-public-profile-panel">
            <div className="profile-settings-head settings-section-head">
                <div>
                    <span>Public Profile</span>
                    <h3>公开主页</h3>
                    <p>这里管理别人看到的头像、封面、简介和主页 badge；登录、安全和认证信息放在右侧。</p>
                </div>
                <button type="button" className="profile-hero-button" onClick={() => router.push('/profile')}>
                    预览主页
                </button>
            </div>

            <div className="settings-public-profile-grid">
                <div className="settings-profile-preview">
                    <div className={`settings-profile-preview-hero${profileImage ? ' has-image' : ''}`}>
                        {profileImage ? (
                            <img src={getImageDisplayUrl(profileImage)} alt={`${user.username}'s banner preview`} />
                        ) : (
                            <div />
                        )}
                    </div>
                    <div className="settings-profile-preview-body">
                        <Avatar value={avatar} emoji={avatarEmoji} theme={avatarTheme} fallback="😊" size={88} style={{ fontSize: '2.8rem' }} />
                        <div>
                            <h4>{user.username}</h4>
                            <UserBadges user={previewUser} compact />
                            <p>{getPreviewText(bio || '这个人还没有写主页介绍，但已经在 Hajimi 留下了一点痕迹。')}</p>
                            <small>{hajimiId}</small>
                        </div>
                    </div>
                </div>

                <div className="settings-public-profile-editors">
                    <section className="profile-avatar-settings profile-inline-editor">
                        <div className="profile-section-heading">
                            <h3>头像</h3>
                            <p>上传裁剪图片，或继续使用 emoji 头像。</p>
                        </div>
                        <div className="profile-avatar-editor-row">
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
                                    <Avatar value={avatar} emoji={avatarEmoji} theme={avatarTheme} fallback="😊" size={116} style={{ fontSize: '3.6rem' }} />
                                )}
                            </div>
                            <div className="profile-avatar-editor">
                                <label className="btn profile-avatar-upload">
                                    Upload image
                                    <input type="file" accept="image/*" onChange={handleAvatarFile} />
                                </label>
                                <input
                                    value={avatarSource || avatarIsImage ? '' : avatar}
                                    onChange={event => setAvatar(event.target.value)}
                                    placeholder="Or emoji"
                                    className="glass-input"
                                    maxLength={4}
                                />
                                <div className="profile-avatar-inline-selects">
                                    <select value={avatarEmoji} onChange={event => { setAvatarEmoji(event.target.value); setAvatar(event.target.value); }} className="glass-input">
                                        {AVATAR_EMOJIS.map(emoji => <option key={emoji} value={emoji}>{emoji}</option>)}
                                    </select>
                                    <select value={avatarTheme} onChange={event => setAvatarTheme(event.target.value as AvatarThemeId)} className="glass-input">
                                        {AVATAR_THEME_IDS.map(theme => <option key={theme} value={theme}>{theme}</option>)}
                                    </select>
                                </div>
                                {avatarSource && (
                                    <div className="profile-avatar-crop-controls">
                                        <label>
                                            Zoom
                                            <input type="range" min="1" max="2.2" step="0.05" value={avatarZoom} onChange={event => setAvatarZoom(Number(event.target.value))} />
                                        </label>
                                        <div className="profile-editor-button-row">
                                            <button type="button" className="btn btn-primary" onClick={applyCroppedAvatar}>Use crop</button>
                                            <button type="button" className="btn profile-secondary-button" onClick={() => setAvatarSource('')}>Cancel image</button>
                                        </div>
                                    </div>
                                )}
                                {avatarSource && <div className="profile-avatar-drag-hint">Drag avatar to reposition</div>}
                                {avatarError && <div className="profile-avatar-error">{avatarError}</div>}
                            </div>
                        </div>
                    </section>

                    <section className="settings-profile-field-card">
                        <div className="profile-section-heading">
                            <h3>封面与简介</h3>
                            <p>封面会显示在个人主页顶部，简介会出现在 About 和主页名片里。</p>
                        </div>
                        <label className="settings-cover-upload">
                            {profileImage ? (
                                <img src={getImageDisplayUrl(profileImage)} alt="Profile cover preview" />
                            ) : (
                                <span>Upload cover</span>
                            )}
                            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleProfileImageFile} />
                        </label>
                        {profileImage && (
                            <button type="button" className="profile-secondary-button settings-remove-cover" onClick={() => setProfileImage('')}>
                                移除封面
                            </button>
                        )}
                        {profileImageError && <div className="profile-account-error">{profileImageError}</div>}
                        <label className="profile-field-label">
                            主页简介
                            <textarea
                                value={bio}
                                onChange={event => setBio(event.target.value)}
                                placeholder="写一段主页介绍：最近在做什么、擅长什么、想认识什么同学。"
                                className="glass-input settings-profile-bio-input"
                                rows={4}
                            />
                        </label>
                    </section>

                    <section className="profile-badge-editor profile-inline-editor">
                        <div className="profile-section-heading">
                            <h3>主页 badge</h3>
                            <p>最多显示 3 个；管理员、老师、认证等身份仍会保留。</p>
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
                </div>
            </div>

            {(saveError || saveMessage) && (
                <div className={`settings-save-status ${saveError ? 'is-error' : 'is-success'}`}>
                    {saveError || saveMessage}
                </div>
            )}
            <div className="settings-action-bar">
                <button type="button" className="profile-secondary-button" onClick={resetDraft} disabled={saving}>
                    还原修改
                </button>
                <button type="button" className="btn btn-primary" onClick={savePublicProfile} disabled={saving}>
                    {saving ? '保存中' : '保存公开主页'}
                </button>
            </div>
        </section>
    );
}
