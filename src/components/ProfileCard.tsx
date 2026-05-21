/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, type Post, type Project } from '@/lib/db';
import Avatar from './Avatar';
import { getAvailableBadges, normalizeBadgePreferences, type BadgeId } from '@/lib/badges';
import BadgePill from './BadgePill';
import UserBadges from './UserBadges';
import { formatHajimiId } from '@/lib/hajimiId';
import { isStrongPassword, PASSWORD_REQUIREMENT_MESSAGE } from '@/lib/passwordPolicy';
import { normalizeUsernameInput, validateUsername, USERNAME_REQUIREMENT_MESSAGE } from '@/lib/accountValidation';
import { AVATAR_EMOJIS, AVATAR_THEME_IDS, type AvatarThemeId } from '@/lib/avatarThemes';

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

function formatDate(value?: Date | string | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function stripMarkdownLinks(text: string) {
    return text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1');
}

function getPreviewText(text?: string | null, max = 118) {
    const compact = stripMarkdownLinks(text || '').replace(/\s+/g, ' ').trim();
    return compact.length > max ? `${compact.slice(0, max)}...` : compact;
}

function estimateReadMinutes(text?: string | null) {
    const length = (text || '').replace(/\s+/g, '').length;
    return Math.max(1, Math.ceil(length / 420));
}

function getTagLabel(tag?: string | null) {
    if (!tag || tag === 'general') return '#General';
    if (tag === 'announcement') return '#Announcement';
    return `#${tag}`;
}

function getPostHref(postId: number) {
    return `/resources#post-${postId}`;
}

function getRoleLabel(user: User) {
    const role = (user.role || 'student').toLowerCase();
    if (role === 'admin') return '管理员';
    if (role === 'teacher') return '老师';
    return '学生';
}

type ProfileCardProps = {
    user: User;
    readOnly?: boolean;
    posts?: Post[];
    projects?: Project[];
};

export default function ProfilePage({ user, readOnly = false, posts = [], projects = [] }: ProfileCardProps) {
    const router = useRouter();
    const [bio, setBio] = useState(user.bio || '');
    const [avatar, setAvatar] = useState(user.avatar || '😊');
    const [avatarEmoji, setAvatarEmoji] = useState(user.avatar_emoji || user.avatar || '😊');
    const [avatarTheme, setAvatarTheme] = useState<AvatarThemeId>((user.avatar_theme as AvatarThemeId) || 'lavender');
    const [profileImage, setProfileImage] = useState(user.profile_image || '');
    const [newUsername, setNewUsername] = useState(user.username);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [accountError, setAccountError] = useState('');
    const [accountMessage, setAccountMessage] = useState('');
    const [badgePreferences, setBadgePreferences] = useState<BadgeId[]>(normalizeBadgePreferences(user.badge_preferences));
    const [verificationStatus, setVerificationStatus] = useState(user.verification_status || 'unverified');
    const [verificationName, setVerificationName] = useState('');
    const [verificationType, setVerificationType] = useState<'student' | 'teacher'>(
        (user.role || '').toLowerCase() === 'teacher' ? 'teacher' : 'student',
    );
    const [verificationGrade, setVerificationGrade] = useState('G10');
    const [verificationSubject, setVerificationSubject] = useState('');
    const [verificationStudentId, setVerificationStudentId] = useState('');
    const [verificationError, setVerificationError] = useState('');
    const [verificationMessage, setVerificationMessage] = useState('');
    const [verificationLoading, setVerificationLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [loading, setLoading] = useState(false);
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [avatarSource, setAvatarSource] = useState('');
    const [avatarZoom, setAvatarZoom] = useState(1);
    const [avatarOffsetX, setAvatarOffsetX] = useState(0);
    const [avatarOffsetY, setAvatarOffsetY] = useState(0);
    const [avatarError, setAvatarError] = useState('');
    const [profileImageError, setProfileImageError] = useState('');
    const [profileSaveError, setProfileSaveError] = useState('');
    const [profileSaveMessage, setProfileSaveMessage] = useState('');
    const dragState = useRef<{ pointerId: number | null; lastX: number; lastY: number }>({ pointerId: null, lastX: 0, lastY: 0 });
    const avatarSettingsRef = useRef<HTMLElement | null>(null);
    const avatarEmojiInputRef = useRef<HTMLInputElement | null>(null);
    const [pendingAvatarFocus, setPendingAvatarFocus] = useState(false);

    const avatarIsImage = avatar.startsWith('data:image/') || avatar.startsWith('http://') || avatar.startsWith('https://');
    const totalXp = Number(user.points || 0);
    const displayLevel = Math.max(Number(user.level || 1), Math.floor(Math.sqrt(totalXp / 50)) + 1);
    const xpForCurrentLevel = 50 * Math.pow(displayLevel - 1, 2);
    const xpForNextLevel = 50 * Math.pow(displayLevel, 2);
    const xpInCurrentLevel = totalXp - xpForCurrentLevel;
    const xpRequiredForLevel = xpForNextLevel - xpForCurrentLevel;
    const progressPercent = Math.min(100, Math.round((xpInCurrentLevel / xpRequiredForLevel) * 100));
    const xpToNext = xpForNextLevel - totalXp;
    const savedProfile = useMemo(() => ({
        bio: user.bio || '',
        avatar: user.avatar || '😊',
        avatarEmoji: user.avatar_emoji || user.avatar || '😊',
        avatarTheme: (user.avatar_theme as AvatarThemeId) || 'lavender',
        profileImage: user.profile_image || '',
        badgePreferences: normalizeBadgePreferences(user.badge_preferences),
    }), [user.avatar, user.avatar_emoji, user.avatar_theme, user.badge_preferences, user.bio, user.profile_image]);
    const availableBadges = getAvailableBadges(user);
    const profileUser = { ...user, avatar, avatar_emoji: avatarEmoji, avatar_theme: avatarTheme, bio, profile_image: profileImage, badge_preferences: badgePreferences };
    const hajimiId = formatHajimiId(user.id);
    const featuredPost = posts[0];
    const recentPosts = posts.slice(featuredPost ? 1 : 0, featuredPost ? 5 : 4);
    const heroIntro = bio || '这个人还没有写主页介绍，但已经在 Hajimi 留下了一点痕迹。';
    const hasContent = posts.length > 0 || projects.length > 0 || profileImage || bio;
    const verificationCopy = verificationStatus === 'verified'
        ? '已认证，具备互动、发帖、榜单和项目申请权益。'
        : verificationStatus === 'pending'
            ? '认证正在审核中，审核通过后会自动解锁互动、发帖、榜单和项目申请。'
            : verificationStatus === 'rejected'
                ? '认证未通过，可以修改信息后重新提交。'
                : '认证通过后可以互动、发帖、进入 Hall of Fame 并提交 Hub 项目申请。';

    const activities = useMemo(() => {
        const items: { id: string; icon: string; title: string; meta: string; href?: string }[] = [];

        posts.slice(0, 3).forEach(post => {
            items.push({
                id: `post-${post.id}`,
                icon: '✍️',
                title: `发布了《${post.title}》`,
                meta: formatDate(post.created_at) || '最近',
                href: getPostHref(post.id),
            });
        });

        projects.slice(0, 2).forEach(project => {
            items.push({
                id: `project-${project.id}`,
                icon: project.emoji || '🚀',
                title: `发布项目 ${project.title}`,
                meta: project.status === 'live' ? 'Live project' : 'Coming soon',
            });
        });

        if (user.streak_count > 0) {
            items.push({ id: 'streak', icon: '🔥', title: `连续签到 ${user.streak_count} 天`, meta: 'Learning streak' });
        }

        if (items.length === 0) {
            items.push({ id: 'empty', icon: '✨', title: '主页内容正在准备中', meta: 'Creator space' });
        }

        return items.slice(0, 5);
    }, [posts, projects, user.streak_count]);

    const toggleBadgePreference = (badgeId: BadgeId) => {
        setBadgePreferences(current => {
            if (current.includes(badgeId)) {
                return current.filter(id => id !== badgeId);
            }

            return [...current, badgeId].slice(0, 3);
        });
    };

    const hasProfileChanges = () => (
        bio !== savedProfile.bio ||
        avatar !== savedProfile.avatar ||
        avatarEmoji !== savedProfile.avatarEmoji ||
        avatarTheme !== savedProfile.avatarTheme ||
        profileImage !== savedProfile.profileImage ||
        JSON.stringify(badgePreferences) !== JSON.stringify(savedProfile.badgePreferences)
    );

    useEffect(() => {
        if (!isEditing || !pendingAvatarFocus || readOnly) return;

        const frameId = window.requestAnimationFrame(() => {
            avatarSettingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            avatarEmojiInputRef.current?.focus({ preventScroll: true });
            setPendingAvatarFocus(false);
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [isEditing, pendingAvatarFocus, readOnly]);

    const openAvatarEditor = () => {
        if (readOnly) return;
        setPendingAvatarFocus(true);
        setIsEditing(true);
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    };

    const handleCancelProfileEdit = () => {
        setBio(savedProfile.bio);
        setAvatar(savedProfile.avatar);
        setAvatarEmoji(savedProfile.avatarEmoji);
        setAvatarTheme(savedProfile.avatarTheme);
        setProfileImage(savedProfile.profileImage);
        setBadgePreferences(savedProfile.badgePreferences);
        setAvatarSource('');
        setAvatarError('');
        setProfileImageError('');
        setProfileSaveError('');
        setProfileSaveMessage('');
        setIsEditing(false);
    };

    const handleSavePublicProfile = async () => {
        setProfileSaveError('');
        setProfileSaveMessage('');

        if (!hasProfileChanges()) {
            setAvatarSource('');
            setAvatarError('');
            setProfileImageError('');
            setIsEditing(false);
            setProfileSaveMessage('没有新的修改，已回到主页。');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/profile', {
                method: 'POST',
                body: JSON.stringify({ bio, avatar, avatar_emoji: avatarEmoji, avatar_theme: avatarTheme, profile_image: profileImage, badge_preferences: badgePreferences }),
            });
            const data = await res.json().catch(() => null);

            if (!res.ok || data?.error) {
                setProfileSaveError(data?.error || '主页保存失败，请稍后再试。');
                return;
            }

            setIsEditing(false);
            setProfileSaveMessage('主页已更新。');
            router.refresh();
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAccount = async () => {
        const cleanUsername = normalizeUsernameInput(newUsername);
        setAccountError('');
        setAccountMessage('');

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

        if (cleanUsername === user.username && newPassword === '') {
            setAccountError('没有需要保存的账号修改。');
            return;
        }

        setSettingsLoading(true);
        try {
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
                return;
            }

            setNewPassword('');
            setConfirmPassword('');
            setAccountMessage('账号设置已更新。');
            router.refresh();
        } finally {
            setSettingsLoading(false);
        }
    };

    const submitVerification = async () => {
        setVerificationError('');
        setVerificationMessage('');
        setVerificationLoading(true);

        try {
            const res = await fetch('/api/profile/verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: verificationType,
                    name: verificationName,
                    grade: verificationGrade,
                    subject: verificationSubject,
                    studentId: verificationStudentId,
                }),
            });
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                setVerificationError(data?.error || '认证提交失败，请稍后再试。');
                return;
            }

            setVerificationStatus('pending');
            setVerificationMessage('认证已提交，等待管理员审核。');
            setVerificationStudentId('');
        } finally {
            setVerificationLoading(false);
        }
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

    const renderAvatarEditor = () => (
        <section className="profile-avatar-settings profile-inline-editor" ref={avatarSettingsRef}>
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
                        <Avatar value={avatar} fallback="😊" size={116} style={{ fontSize: '3.6rem' }} />
                    )}
                </div>
                <div className="profile-avatar-editor">
                    <label className="btn profile-avatar-upload">
                        Upload image
                        <input type="file" accept="image/*" onChange={handleAvatarFile} />
                    </label>
                    <input
                        ref={avatarEmojiInputRef}
                        value={avatarSource || avatarIsImage ? '' : avatar}
                        onChange={e => setAvatar(e.target.value)}
                        placeholder="Or emoji"
                        className="glass-input"
                        maxLength={4}
                    />
                    <div className="profile-avatar-inline-selects">
                        <select value={avatarEmoji} onChange={e => { setAvatarEmoji(e.target.value); setAvatar(e.target.value); }} className="glass-input">
                            {AVATAR_EMOJIS.map(emoji => (
                                <option key={emoji} value={emoji}>{emoji}</option>
                            ))}
                        </select>
                        <select value={avatarTheme} onChange={e => setAvatarTheme(e.target.value as AvatarThemeId)} className="glass-input">
                            {AVATAR_THEME_IDS.map(theme => (
                                <option key={theme} value={theme}>{theme}</option>
                            ))}
                        </select>
                    </div>
                    {avatarSource && (
                        <div className="profile-avatar-crop-controls">
                            <label>
                                Zoom
                                <input type="range" min="1" max="2.2" step="0.05" value={avatarZoom} onChange={e => setAvatarZoom(Number(e.target.value))} />
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
    );

    const renderHero = () => {
        const canEditAvatar = !readOnly;
        const avatarContent = (
            <Avatar value={avatar} fallback="😊" size={104} style={{ fontSize: '3.2rem' }} />
        );

        return (
        <section className={`profile-hero${isEditing && !readOnly ? ' is-editing' : ''}${profileImage ? ' has-profile-image' : ' is-default-banner'}`}>
            <div className="profile-hero-media">
                {profileImage ? (
                    <img src={profileImage} alt={`${user.username}'s banner`} />
                ) : (
                    <div className="profile-hero-gradient" />
                )}
            </div>
            <div className="profile-hero-shade" />
            {isEditing && !readOnly && (
                <div className="profile-hero-media-actions">
                    <label className="profile-hero-button profile-hero-file-button">
                        更换封面
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleProfileImageFile} />
                    </label>
                    {profileImage && (
                        <button type="button" className="profile-hero-button" onClick={() => setProfileImage('')}>
                            移除封面
                        </button>
                    )}
                    {profileImageError && <span className="profile-hero-media-error">{profileImageError}</span>}
                </div>
            )}
            <div className="profile-hero-content">
                {canEditAvatar ? (
                    <button type="button" className="profile-hero-avatar profile-hero-avatar-button" onClick={openAvatarEditor} aria-label="编辑头像">
                        {avatarContent}
                        <span className="profile-hero-avatar-hint">Edit</span>
                    </button>
                ) : (
                    <div className="profile-hero-avatar">
                        {avatarContent}
                    </div>
                )}
                <div className="profile-hero-copy">
                    <div className="profile-hero-name-row">
                        <h2>{user.username}</h2>
                        <UserBadges user={profileUser} />
                    </div>
                    <p className="profile-hero-subtitle">{getRoleLabel(user)} · Hajimi ID {hajimiId}</p>
                    {isEditing && !readOnly ? (
                        <textarea
                            value={bio}
                            onChange={e => setBio(e.target.value)}
                            placeholder="写一段主页介绍：最近在做什么、擅长什么、想认识什么同学。"
                            className="glass-input profile-hero-bio-input"
                            rows={3}
                        />
                    ) : (
                        <p className="profile-hero-bio">{getPreviewText(heroIntro, 150)}</p>
                    )}
                </div>
                {!readOnly && (
                <div className="profile-hero-actions">
                    {isEditing ? (
                        <>
                            <button type="button" className="profile-hero-button is-primary" onClick={handleSavePublicProfile} disabled={loading}>
                                {loading ? '保存中' : '保存'}
                            </button>
                            <button type="button" className="profile-hero-button" onClick={handleCancelProfileEdit}>
                                取消
                            </button>
                            <button type="button" className="profile-hero-button" onClick={() => setShowSettings(value => !value)}>
                                设置
                            </button>
                        </>
                    ) : (
                        <>
                            <button type="button" className="profile-hero-button is-primary" onClick={() => setIsEditing(true)}>
                                Edit
                            </button>
                            <button type="button" className="profile-hero-button" onClick={() => setShowSettings(value => !value)}>
                                设置
                            </button>
                        </>
                    )}
                </div>
                )}
            </div>
            {isEditing && !readOnly && (
                <div className="profile-hero-edit-dock">
                    {renderAvatarEditor()}
                    {renderBadgeEditor()}
                </div>
            )}
        </section>
        );
    };

    const renderBadgeEditor = () => (
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
    );

    const renderSettingsPanel = () => (
        <section className="profile-settings-panel">
            <div className="profile-settings-head">
                <div>
                    <span>Private Settings</span>
                    <h3>账号与认证</h3>
                    <p>这里的信息只用于登录、安全和认证审核，不会出现在公开主页。</p>
                </div>
                <button type="button" className="profile-secondary-button btn" onClick={() => setShowSettings(false)}>
                    收起
                </button>
            </div>

            <div className="profile-settings-grid">
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
                            <input value={newUsername} onChange={e => setNewUsername(e.target.value)} className="glass-input" />
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
                        {accountMessage && <div className="profile-verification-success">{accountMessage}</div>}
                        <button type="button" className="btn btn-primary profile-account-save" onClick={handleSaveAccount} disabled={settingsLoading}>
                            {settingsLoading ? '保存中' : '保存账号设置'}
                        </button>
                    </div>
                </section>

                <section className="profile-verification-editor">
                    <div className="profile-section-heading">
                        <h3>Hajimi 认证</h3>
                        <p>{verificationCopy}</p>
                    </div>
                    <div className={`profile-verification-status is-${verificationStatus}`}>
                        <strong>{verificationStatus === 'verified' ? '已认证' : verificationStatus === 'pending' ? '审核中' : verificationStatus === 'rejected' ? '需重新提交' : '未认证'}</strong>
                        <span>Name、年级/科目和学号信息仅管理员审核可见，主页不会公开。</span>
                    </div>
                    {(verificationStatus === 'unverified' || verificationStatus === 'rejected') && (
                        <div className="profile-verification-form">
                            <label className="profile-field-label">
                                Name
                                <input value={verificationName} onChange={e => setVerificationName(e.target.value)} className="glass-input" placeholder="学校常用名 / English name" />
                                <small>不要求 legal name；用于审核和确认主号，不公开展示。</small>
                            </label>
                            <div className="auth-verification-tabs">
                                <button
                                    type="button"
                                    className={verificationType === 'student' ? 'is-active' : ''}
                                    onClick={() => setVerificationType('student')}
                                >
                                    学生
                                </button>
                                <button
                                    type="button"
                                    className={verificationType === 'teacher' ? 'is-active' : ''}
                                    onClick={() => setVerificationType('teacher')}
                                >
                                    老师
                                </button>
                            </div>
                            {verificationType === 'student' ? (
                                <>
                                    <label className="profile-field-label">
                                        年级
                                        <select value={verificationGrade} onChange={e => setVerificationGrade(e.target.value)} className="glass-input">
                                            {['G10', 'G11', 'G12', 'G13'].map(grade => <option key={grade} value={grade}>{grade}</option>)}
                                        </select>
                                    </label>
                                    <label className="profile-field-label">
                                        学号（可选）
                                        <input value={verificationStudentId} onChange={e => setVerificationStudentId(e.target.value)} className="glass-input" />
                                        <small>只保存加密 hash 和后四位，用于确认主号。</small>
                                    </label>
                                </>
                            ) : (
                                <label className="profile-field-label">
                                    任教学科
                                    <input value={verificationSubject} onChange={e => setVerificationSubject(e.target.value)} className="glass-input" />
                                </label>
                            )}
                            {verificationError && <div className="profile-account-error">{verificationError}</div>}
                            {verificationMessage && <div className="profile-verification-success">{verificationMessage}</div>}
                            <button type="button" className="btn btn-primary profile-verification-submit" onClick={submitVerification} disabled={verificationLoading}>
                                {verificationLoading ? 'Submitting...' : '提交认证'}
                            </button>
                        </div>
                    )}
                    {verificationMessage && verificationStatus === 'pending' && <div className="profile-verification-success">{verificationMessage}</div>}
                </section>
            </div>

            <div className="profile-danger-actions">
                <button type="button" onClick={handleLogout} className="btn profile-logout-button">
                    退出账号 / Log out
                </button>
                <button type="button" onClick={handleDeleteAccount} className="profile-delete-button">
                    Delete My Account
                </button>
            </div>
        </section>
    );

    return (
        <div className={`profile-home${isEditing && !readOnly ? ' is-editing' : ''}`}>
            {renderHero()}
            {!readOnly && (profileSaveError || profileSaveMessage) && (
                <div className={`profile-save-toast ${profileSaveError ? 'is-error' : 'is-success'}`}>
                    {profileSaveError || profileSaveMessage}
                </div>
            )}
            {!readOnly && showSettings && renderSettingsPanel()}

            <div className="profile-home-grid">
                <aside className="profile-home-sidebar">
                    <section className="profile-side-section">
                        <h3>About</h3>
                        <p>{getPreviewText(heroIntro, 180)}</p>
                        <div className="profile-mini-meta">
                            <span>{getRoleLabel(user)}</span>
                            <span>{hajimiId}</span>
                        </div>
                    </section>

                    <section className="profile-side-section">
                        <h3>Stats</h3>
                        <div className="profile-stat-grid">
                            <div><strong>Lv.{displayLevel}</strong><span>Level</span></div>
                            <div><strong>{totalXp}</strong><span>XP</span></div>
                            <div><strong>{posts.length}</strong><span>Posts</span></div>
                            <div><strong>{projects.length}</strong><span>Projects</span></div>
                        </div>
                        <div className="profile-level-progress" aria-label={`Level progress ${progressPercent}%`}>
                            <span style={{ width: `${progressPercent}%` }} />
                        </div>
                        <p className="profile-level-next">{xpToNext} XP to Level {displayLevel + 1}</p>
                    </section>

                    <section className="profile-side-section">
                        <h3>Achievements</h3>
                        <div className="profile-achievement-list">
                            {user.streak_count > 0 && <span>🔥 {user.streak_count} Day Streak</span>}
                            {user.is_creator && <span>🛠️ Creator</span>}
                            {user.verification_status === 'verified' && <span>✅ Hajimi 认证</span>}
                            <span>✨ Hajimi member</span>
                        </div>
                    </section>

                    {projects.length > 0 && (
                        <section className="profile-side-section">
                            <h3>Links</h3>
                            <div className="profile-link-list">
                                {projects.filter(project => project.url).slice(0, 3).map(project => (
                                    <a key={project.id} href={project.url || '#'} target="_blank" rel="noopener noreferrer">
                                        {project.emoji || '🚀'} {project.title}
                                    </a>
                                ))}
                            </div>
                        </section>
                    )}
                </aside>

                <main className="profile-feed">
                    {featuredPost ? (
                        <section className="profile-featured-post">
                            <div className="profile-feed-label">Featured Post</div>
                            <Link href={getPostHref(featuredPost.id)} className="profile-featured-content profile-post-link-card" aria-label={`打开论坛帖子：${featuredPost.title}`}>
                                {featuredPost.attachment_url && (
                                    <img src={featuredPost.attachment_url} alt="" />
                                )}
                                <div>
                                    <span>{getTagLabel(featuredPost.tag)}</span>
                                    <h3>{featuredPost.title}</h3>
                                    <p>{getPreviewText(featuredPost.content, 170)}</p>
                                    <div className="profile-post-meta">
                                        <span>{formatDate(featuredPost.created_at)}</span>
                                        <span>{estimateReadMinutes(featuredPost.content)} min read</span>
                                        <span>{featuredPost.likes} likes</span>
                                    </div>
                                </div>
                            </Link>
                        </section>
                    ) : (profileImage || bio) ? (
                        <section className="profile-featured-post">
                            <div className="profile-feed-label">Profile Note</div>
                            <div className="profile-featured-content">
                                {profileImage && (
                                    <img src={profileImage} alt={`${user.username}'s profile note`} />
                                )}
                                <div>
                                    <span>#Profile</span>
                                    <h3>{user.username} 的主页动态</h3>
                                    <p>{getPreviewText(heroIntro, 180)}</p>
                                    <div className="profile-post-meta">
                                        <span>Personal note</span>
                                        <span>{projects.length} projects</span>
                                        <span>{posts.length} posts</span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <section className="profile-empty-featured">
                            <div className="profile-feed-label">Featured Post</div>
                            <h3>{readOnly ? '还没有置顶内容' : '写下你的第一篇主页内容'}</h3>
                            <p>{readOnly ? '这个主页还在生长中。' : '去 Forum 发第一篇帖子后，它会自动出现在这里。'}</p>
                        </section>
                    )}

                    <section className="profile-feed-section">
                        <div className="profile-feed-heading">
                            <div>
                                <span>Recent Posts</span>
                                <h3>最近文章</h3>
                            </div>
                            {!readOnly && <button type="button" onClick={() => router.push('/resources')}>写文章</button>}
                        </div>
                        <div className="profile-post-list">
                            {recentPosts.length > 0 ? recentPosts.map(post => (
                                <Link key={post.id} href={getPostHref(post.id)} className="profile-post-list-item profile-post-link-card" aria-label={`打开论坛帖子：${post.title}`}>
                                    {post.attachment_url && <img src={post.attachment_url} alt="" />}
                                    <div>
                                        <h4>{post.title}</h4>
                                        <p>{getPreviewText(post.content, 96)}</p>
                                        <div className="profile-post-meta">
                                            <span>{getTagLabel(post.tag)}</span>
                                            <span>{formatDate(post.created_at)}</span>
                                            <span>{post.comment_count || 0} comments</span>
                                        </div>
                                    </div>
                                </Link>
                            )) : (
                                <div className="profile-empty-row">{hasContent ? '暂无更多文章。' : '这个主页还没有文章。'}</div>
                            )}
                        </div>
                    </section>

                    <section className="profile-feed-section">
                        <div className="profile-feed-heading">
                            <div>
                                <span>Pinned Projects</span>
                                <h3>项目展示</h3>
                            </div>
                            {!readOnly && <button type="button" onClick={() => router.push('/functions')}>去 Hub</button>}
                        </div>
                        <div className="profile-project-grid">
                            {projects.length > 0 ? projects.slice(0, 4).map(project => (
                                <article key={project.id} className="profile-project-card">
                                    <div className="profile-project-icon">{project.emoji || '🚀'}</div>
                                    <div>
                                        <h4>{project.title}</h4>
                                        <p>{getPreviewText(project.description, 82)}</p>
                                        <div className="profile-project-meta">
                                            <span>{project.status === 'live' ? 'Live' : 'Coming soon'}</span>
                                            <span>⭐ {Number(project.rating || 0).toFixed(1)}</span>
                                        </div>
                                    </div>
                                </article>
                            )) : (
                                <div className="profile-empty-row">暂无公开项目。</div>
                            )}
                        </div>
                    </section>

                    <section className="profile-feed-section">
                        <div className="profile-feed-heading">
                            <div>
                                <span>Activity</span>
                                <h3>最近动态</h3>
                            </div>
                        </div>
                        <div className="profile-activity-list">
                            {activities.map(item => item.href ? (
                                <Link key={item.id} href={item.href} className="profile-activity-item profile-activity-link">
                                    <span>{item.icon}</span>
                                    <div>
                                        <strong>{item.title}</strong>
                                        <small>{item.meta}</small>
                                    </div>
                                </Link>
                            ) : (
                                <div key={item.id} className="profile-activity-item">
                                    <span>{item.icon}</span>
                                    <div>
                                        <strong>{item.title}</strong>
                                        <small>{item.meta}</small>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
