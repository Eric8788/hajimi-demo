/* eslint-disable @next/next/no-img-element */
'use client';

import { useRef, useState, type ChangeEvent, type PointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/lib/db';
import Avatar from './Avatar';
import { AVATAR_EMOJIS, AVATAR_THEME_IDS, type AvatarThemeId } from '@/lib/avatarThemes';
import { clearCachedJson } from '@/lib/clientJsonCache';
import { formatHajimiId } from '@/lib/hajimiId';

function loadProfileImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not read image'));
        image.src = src;
    });
}

export default function PublicProfileSettingsPanel({ user }: { user: User }) {
    const router = useRouter();
    const [bio, setBio] = useState(user.bio || '');
    const [avatar, setAvatar] = useState(user.avatar || user.avatar_emoji || '😊');
    const [avatarEmoji, setAvatarEmoji] = useState(user.avatar_emoji || user.avatar || '😊');
    const [avatarTheme, setAvatarTheme] = useState<AvatarThemeId>((user.avatar_theme as AvatarThemeId) || 'lavender');
    const [avatarSource, setAvatarSource] = useState('');
    const [avatarZoom, setAvatarZoom] = useState(1);
    const [avatarOffsetX, setAvatarOffsetX] = useState(0);
    const [avatarOffsetY, setAvatarOffsetY] = useState(0);
    const [avatarError, setAvatarError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [saveMessage, setSaveMessage] = useState('');
    const [saving, setSaving] = useState(false);
    const dragState = useRef<{ pointerId: number | null; lastX: number; lastY: number }>({ pointerId: null, lastX: 0, lastY: 0 });

    const savedProfile = {
        bio: user.bio || '',
        avatar: user.avatar || user.avatar_emoji || '😊',
        avatarEmoji: user.avatar_emoji || user.avatar || '😊',
        avatarTheme: (user.avatar_theme as AvatarThemeId) || 'lavender',
    };
    const avatarIsImage = avatar.startsWith('data:image/') || avatar.startsWith('http://') || avatar.startsWith('https://');
    const hajimiId = formatHajimiId(user.id);

    const hasProfileChanges = () => (
        bio !== savedProfile.bio ||
        avatar !== savedProfile.avatar ||
        avatarEmoji !== savedProfile.avatarEmoji ||
        avatarTheme !== savedProfile.avatarTheme
    );

    const resetDraft = () => {
        setBio(savedProfile.bio);
        setAvatar(savedProfile.avatar);
        setAvatarEmoji(savedProfile.avatarEmoji);
        setAvatarTheme(savedProfile.avatarTheme);
        setAvatarSource('');
        setAvatarError('');
        setSaveError('');
        setSaveMessage('');
    };

    const handleAvatarFile = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        setAvatarError('');

        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setAvatarError('请选择图片文件。');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setAvatarSource(String(reader.result || ''));
            setAvatarZoom(1);
            setAvatarOffsetX(0);
            setAvatarOffsetY(0);
        };
        reader.onerror = () => setAvatarError('无法读取这张图片。');
        reader.readAsDataURL(file);
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
            setAvatarError('无法裁剪这张图片，请换一张试试。');
        }
    };

    const savePublicProfile = async () => {
        const profileChanged = hasProfileChanges();
        setSaveError('');
        setSaveMessage('');

        if (!profileChanged) {
            setSaveMessage('没有新的公开资料修改。');
            return;
        }

        setSaving(true);
        try {
            const profileRes = await fetch('/api/profile', {
                method: 'POST',
                body: JSON.stringify({
                    bio,
                    avatar,
                    avatar_emoji: avatarEmoji,
                    avatar_theme: avatarTheme,
                }),
            });
            const profileData = await profileRes.json().catch(() => null);

            if (!profileRes.ok || profileData?.error) {
                setSaveError(profileData?.error || '公开资料保存失败，请稍后再试。');
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
        <section className="settings-public-profile-panel settings-basic-profile-panel">
            <div className="profile-settings-head settings-section-head">
                <div>
                    <span>Public Profile</span>
                    <h3>公开主页</h3>
                    <p>这里只调整头像和个性签名；公开显示名沿用登录用户名，避免重复填写同一名称。</p>
                </div>
            </div>

            <div className="settings-basic-profile-grid">
                <section className="profile-avatar-settings profile-inline-editor">
                    <div className="profile-section-heading">
                        <h3>个人头像</h3>
                        <p>上传并裁剪图片，或继续使用 emoji 头像。</p>
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
                                onChange={event => {
                                    setAvatar(event.target.value);
                                    setAvatarEmoji(event.target.value || avatarEmoji);
                                }}
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
                        <h3>主页签名</h3>
                        <p>显示名：{user.username} · {hajimiId}</p>
                    </div>
                    <label className="profile-field-label">
                        个性签名
                        <textarea
                            value={bio}
                            onChange={event => setBio(event.target.value)}
                            placeholder="写一句会出现在主页名片和 About 里的签名。"
                            className="glass-input settings-profile-bio-input"
                            rows={5}
                        />
                    </label>
                </section>
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
                    {saving ? '保存中' : '保存公开资料'}
                </button>
            </div>
        </section>
    );
}
