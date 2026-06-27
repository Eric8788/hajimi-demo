'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/lib/db';
import { formatHajimiId } from '@/lib/hajimiId';
import { isStrongPassword, PASSWORD_REQUIREMENT_MESSAGE } from '@/lib/passwordPolicy';
import { normalizeUsernameInput, validateUsername, USERNAME_REQUIREMENT_MESSAGE } from '@/lib/accountValidation';
import { getReadOnlyRoleLabel, isReadOnlyRole } from '@/lib/access';

type VerificationStatus = NonNullable<User['verification_status']>;

export default function AccountSettingsPanel({ user }: { user: User }) {
    const router = useRouter();
    const [newUsername, setNewUsername] = useState(user.username);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [accountError, setAccountError] = useState('');
    const [accountMessage, setAccountMessage] = useState('');
    const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(user.verification_status || 'unverified');
    const [verificationName, setVerificationName] = useState('');
    const [verificationType, setVerificationType] = useState<'student' | 'teacher'>(
        (user.role || '').toLowerCase() === 'teacher' ? 'teacher' : 'student',
    );
    const [verificationGrade, setVerificationGrade] = useState('G10');
    const [verificationSubject, setVerificationSubject] = useState('');
    const [verificationStudentId, setVerificationStudentId] = useState('');
    const [verificationError, setVerificationError] = useState('');
    const [verificationMessage, setVerificationMessage] = useState('');
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [verificationLoading, setVerificationLoading] = useState(false);
    const [dangerLoading, setDangerLoading] = useState(false);

    const hajimiId = formatHajimiId(user.id);
    const isReadOnlyUser = isReadOnlyRole(user.role);
    const verificationCopy = isReadOnlyUser
        ? `${getReadOnlyRoleLabel(user.role)}可以浏览公开内容并体验 Function Hall 项目，互动、发帖、打赏和项目投稿不会开放。`
        : verificationStatus === 'verified'
            ? '已认证，具备互动、发帖、榜单和项目申请权益。'
            : verificationStatus === 'pending'
                ? '认证正在审核中，审核通过后会自动解锁互动、发帖、榜单和项目申请。'
                : verificationStatus === 'rejected'
                    ? '认证未通过，可以修改信息后重新提交。'
                    : '认证通过后可以互动、发帖、进入 Hall of Fame 并提交 Hub 项目申请。';

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
            const data = await res.json().catch(() => null);
            if (!res.ok || data?.error) {
                setAccountError(data?.error || '账号设置保存失败，请稍后再试。');
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

    const handleLogout = async () => {
        setDangerLoading(true);
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    };

    const handleDeleteAccount = async () => {
        if (!confirm('WARNING: This will permanently delete your account and all your content (posts, comments, etc.). This action cannot be undone. Are you absolutely sure?')) {
            return;
        }

        setDangerLoading(true);
        const res = await fetch('/api/profile/delete', { method: 'POST' });
        if (res.ok) {
            window.location.href = '/';
        } else {
            alert('Failed to delete account');
            setDangerLoading(false);
        }
    };

    return (
        <section className="profile-settings-panel account-settings-panel">
            <div className="profile-settings-head">
                <div>
                    <span>Private Settings</span>
                    <h3>账号与认证</h3>
                    <p>这里的信息只用于登录、安全和认证审核，不会出现在公开主页。公开主页资料请回到 Profile 使用 Edit 修改。</p>
                </div>
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
                            <input value={newUsername} onChange={event => setNewUsername(event.target.value)} className="glass-input" />
                            <small>2-24 个字符；不能包含空格或 URL 特殊符号。</small>
                        </label>
                        <label className="profile-field-label">
                            新密码
                            <input
                                type="password"
                                value={newPassword}
                                onChange={event => setNewPassword(event.target.value)}
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
                                    onChange={event => setConfirmPassword(event.target.value)}
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
                        <h3>{isReadOnlyUser ? '参观账号权限' : 'Hajimi 认证'}</h3>
                        <p>{verificationCopy}</p>
                    </div>
                    <div className={`profile-verification-status is-${isReadOnlyUser ? 'pending' : verificationStatus}`}>
                        <strong>{isReadOnlyUser ? getReadOnlyRoleLabel(user.role) : verificationStatus === 'verified' ? '已认证' : verificationStatus === 'pending' ? '审核中' : verificationStatus === 'rejected' ? '需重新提交' : '未认证'}</strong>
                        <span>{isReadOnlyUser ? '这是毕业典礼参观身份：可浏览、可体验项目，不能参与互动。' : 'Name、年级/科目和学号信息仅管理员审核可见，主页不会公开。'}</span>
                    </div>
                    {!isReadOnlyUser && (verificationStatus === 'unverified' || verificationStatus === 'rejected') && (
                        <div className="profile-verification-form">
                            <label className="profile-field-label">
                                Name
                                <input value={verificationName} onChange={event => setVerificationName(event.target.value)} className="glass-input" placeholder="学校常用名 / English name" />
                                <small>不要写 legal name；用于审核和确认主号，不公开展示。</small>
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
                                        <select value={verificationGrade} onChange={event => setVerificationGrade(event.target.value)} className="glass-input">
                                            {['G10', 'G11', 'G12', 'G13'].map(grade => <option key={grade} value={grade}>{grade}</option>)}
                                        </select>
                                    </label>
                                    <label className="profile-field-label">
                                        学号（可选）
                                        <input value={verificationStudentId} onChange={event => setVerificationStudentId(event.target.value)} className="glass-input" />
                                        <small>只保存加密 hash 和后四位，用于确认主号。</small>
                                    </label>
                                </>
                            ) : (
                                <label className="profile-field-label">
                                    任教学科
                                    <input value={verificationSubject} onChange={event => setVerificationSubject(event.target.value)} className="glass-input" />
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
                <button type="button" onClick={handleLogout} className="btn profile-logout-button" disabled={dangerLoading}>
                    退出账号 / Log out
                </button>
                <button type="button" onClick={handleDeleteAccount} className="profile-delete-button" disabled={dangerLoading}>
                    Delete My Account
                </button>
            </div>
        </section>
    );
}
