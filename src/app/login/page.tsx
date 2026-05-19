/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import ParticleBackground from '@/components/ParticleBackground';
import { isStrongPassword, PASSWORD_REQUIREMENT_MESSAGE } from '@/lib/passwordPolicy';
import { normalizeUsernameInput, validateUsername, USERNAME_REQUIREMENT_MESSAGE } from '@/lib/accountValidation';
import { AVATAR_EMOJIS, AVATAR_THEMES, AVATAR_THEME_IDS } from '@/lib/avatarThemes';

const AVATAR_THEME_LABELS: Record<string, string> = {
    lavender: '薰衣草',
    peach: '蜜桃',
    rose: '玫瑰',
    sunny: '阳光',
    mint: '薄荷',
    sky: '晴空',
    ocean: '海洋',
    sand: '沙滩',
    berry: '莓果',
    charcoal: '灰调',
};

export default function LoginPage() {
    const router = useRouter();
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [verificationEnabled, setVerificationEnabled] = useState(false);
    const [verificationType, setVerificationType] = useState<'student' | 'teacher'>('student');
    const [verifiedName, setVerifiedName] = useState('');
    const [verifiedGrade, setVerifiedGrade] = useState('G10');
    const [verifiedSubject, setVerifiedSubject] = useState('');
    const [studentId, setStudentId] = useState('');
    const [bio, setBio] = useState('');
    const [avatarEmoji, setAvatarEmoji] = useState('');
    const [avatarTheme, setAvatarTheme] = useState('lavender');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const selectedAvatarTheme = AVATAR_THEMES[avatarTheme as keyof typeof AVATAR_THEMES] || AVATAR_THEMES.lavender;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        const cleanUsername = normalizeUsernameInput(username);
        if (isRegister && !validateUsername(cleanUsername)) {
            setError(USERNAME_REQUIREMENT_MESSAGE);
            return;
        }
        if (isRegister && !isStrongPassword(password)) {
            setError(PASSWORD_REQUIREMENT_MESSAGE);
            return;
        }
        if (isRegister && password !== confirmPassword) {
            setError('两次输入的密码不一致。');
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: cleanUsername,
                    password,
                    confirmPassword,
                    isRegister,
                    inviteCode,
                    bio: isRegister ? bio : undefined,
                    avatar: isRegister ? {
                        useDefault: !avatarEmoji.trim(),
                        emoji: avatarEmoji,
                        theme: avatarTheme,
                    } : undefined,
                    verification: isRegister && verificationEnabled ? {
                        enabled: true,
                        type: verificationType,
                        name: verifiedName,
                        grade: verifiedGrade,
                        subject: verifiedSubject,
                        studentId,
                    } : undefined,
                }),
            });

            const data = await res.json().catch(() => ({ error: 'Login failed. Please try again.' }));

            if (res.ok) {
                router.replace('/dashboard');
                window.setTimeout(() => {
                    window.location.assign('/dashboard');
                }, 1200);
                return;
            }

            setError(data.error || 'Login failed. Please try again.');
            setIsSubmitting(false);
        } catch {
            setError('Network error. Please try again.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="auth-container">
            <ParticleBackground />
            <div className="glass-panel auth-card">
                <div className="auth-brand-row">
                    <span className="auth-logo-mark"><img className="auth-logo-image" src="/hajimi-logo.png" alt="" /></span>
                    <span>Hajimi</span>
                </div>
                <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>
                    {isRegister ? 'Join Hajimi' : 'Welcome Back'}
                </h1>
                <p style={{ textAlign: 'center', marginBottom: '30px', color: '#888' }}>
                    {isRegister ? 'Start your high school adventure' : 'Login to your account'}
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="glass-input"
                            placeholder="Username"
                            autoComplete={isRegister ? 'username' : 'username'}
                        />
                        {isRegister && (
                            <div className="auth-field-hint">
                                2-24 characters. No spaces or URL symbols.
                            </div>
                        )}
                    </div>

                    {isRegister && (
                        <div>
                            <input
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                required
                                className="glass-input"
                                placeholder="Invite code"
                                autoComplete="off"
                            />
                        </div>
                    )}

                    {isRegister && (
                        <div className="auth-verification-card">
                            <label className="auth-verification-toggle">
                                <input
                                    type="checkbox"
                                    checked={verificationEnabled}
                                    onChange={(e) => setVerificationEnabled(e.target.checked)}
                                />
                                <span>提交 Hajimi 认证（可跳过）</span>
                            </label>
                            <p>认证通过后可以发帖并进入 Hall of Fame；公开主页不会展示真实姓名或学号。</p>
                            {verificationEnabled && (
                                <div className="auth-verification-fields">
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
                                    <input
                                        type="text"
                                        value={verifiedName}
                                        onChange={(e) => setVerifiedName(e.target.value)}
                                        className="glass-input"
                                        placeholder="真实姓名"
                                        autoComplete="name"
                                    />
                                    {verificationType === 'student' ? (
                                        <>
                                            <select value={verifiedGrade} onChange={(e) => setVerifiedGrade(e.target.value)} className="glass-input">
                                                {['G10', 'G11', 'G12', 'G13'].map(grade => (
                                                    <option key={grade} value={grade}>{grade}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="text"
                                                value={studentId}
                                                onChange={(e) => setStudentId(e.target.value)}
                                                className="glass-input"
                                                placeholder="学号（可选）"
                                                autoComplete="off"
                                            />
                                        </>
                                    ) : (
                                        <input
                                            type="text"
                                            value={verifiedSubject}
                                            onChange={(e) => setVerifiedSubject(e.target.value)}
                                            className="glass-input"
                                            placeholder="任教学科"
                                            autoComplete="off"
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {isRegister && (
                        <div className="auth-avatar-card">
                            <div className="auth-avatar-card-head">
                                <div>
                                    <strong>头像设置</strong>
                                    <p>可以随机，也可以自己选 emoji 和底色。</p>
                                </div>
                                <button type="button" className="auth-avatar-random" onClick={() => {
                                    const nextEmoji = AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
                                    const nextTheme = AVATAR_THEME_IDS[Math.floor(Math.random() * AVATAR_THEME_IDS.length)];
                                    setAvatarEmoji(nextEmoji);
                                    setAvatarTheme(nextTheme);
                                }}>
                                    随机
                                </button>
                            </div>
                            <div className="auth-avatar-preview" style={{ background: selectedAvatarTheme.background, color: selectedAvatarTheme.color }}>
                                <span>{avatarEmoji || '😊'}</span>
                            </div>
                            <div className="auth-avatar-fields">
                                <select value={avatarEmoji} onChange={(e) => setAvatarEmoji(e.target.value)} className="glass-input">
                                    <option value="">随机 emoji</option>
                                    {AVATAR_EMOJIS.map(emoji => (
                                        <option key={emoji} value={emoji}>{emoji}</option>
                                    ))}
                                </select>
                                <select value={avatarTheme} onChange={(e) => setAvatarTheme(e.target.value)} className="glass-input">
                                    {AVATAR_THEME_IDS.map(theme => (
                                        <option key={theme} value={theme}>{AVATAR_THEME_LABELS[theme] || theme}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {isRegister && (
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            maxLength={180}
                            className="glass-input auth-bio-input"
                            placeholder="一句话介绍自己（可选）"
                            rows={3}
                        />
                    )}

                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={isRegister ? 8 : undefined}
                            className="glass-input"
                            placeholder="Password"
                            autoComplete={isRegister ? 'new-password' : 'current-password'}
                        />
                        {isRegister && (
                            <div className="auth-field-hint">
                                At least 8 characters with uppercase, lowercase, and a number.
                            </div>
                        )}
                    </div>

                    {isRegister && (
                        <div>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={8}
                                className="glass-input"
                                placeholder="Confirm password"
                                autoComplete="new-password"
                            />
                        </div>
                    )}

                    {error && (
                        <div style={{
                            background: 'rgba(255, 118, 117, 0.2)',
                            color: '#d63031',
                            padding: '10px',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            textAlign: 'center'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary auth-submit"
                        style={{ justifyContent: 'center' }}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (isRegister ? 'Creating...' : 'Signing in...') : (isRegister ? 'Create Account' : 'Sign In')}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '30px', fontSize: '0.9rem', color: '#666' }}>
                    {isRegister ? 'Already a student?' : "New here?"}{' '}
                    <button
                            type="button"
                            onClick={() => {
                                setIsRegister(!isRegister);
                                setError('');
                                setInviteCode('');
                                setConfirmPassword('');
                                setVerificationEnabled(false);
                                setVerifiedName('');
                                setVerifiedGrade('G10');
                                setVerifiedSubject('');
                                setStudentId('');
                                setBio('');
                                setAvatarEmoji('');
                                setAvatarTheme('lavender');
                                setIsSubmitting(false);
                            }}
                            className="auth-switch-btn"
                        >
                            {isRegister ? 'Log in' : 'Create account'}
                        </button>
                    </p>
                </div>

                <style jsx>{`
	        .auth-container {
	          position: relative;
	          display: flex;
	          justify-content: center;
	          align-items: center;
	          min-height: 100vh;
	          padding: 28px;
	          overflow: hidden;
	          background:
	            radial-gradient(circle at 50% 18%, rgba(162,155,254,0.08), transparent 32%),
	            linear-gradient(135deg, rgba(255,255,255,0.9), rgba(245,247,255,0.72));
	        }
	        .auth-card {
	           position: relative;
	           z-index: 2;
	           width: 100%;
	           max-width: 420px;
	           padding: 42px;
	           background: rgba(255, 255, 255, 0.64);
	           border: 1px solid rgba(255,255,255,0.78);
	           box-shadow: 0 24px 70px rgba(108, 92, 231, 0.16);
	           transition: transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease;
	        }
	        .auth-brand-row {
	          display: flex;
	          align-items: center;
	          justify-content: center;
	          gap: 10px;
	          margin-bottom: 22px;
	          color: #6c5ce7;
	          font-weight: 900;
	          letter-spacing: 0;
	        }
	        .auth-logo-mark {
	          width: 38px;
	          height: 38px;
	          display: inline-flex;
	          align-items: center;
	          justify-content: center;
	          border-radius: 12px;
	          background: rgba(255,255,255,0.92);
	          border: 2px solid rgba(162,155,254,0.25);
	          box-shadow: 0 8px 22px rgba(108,92,231,0.14);
	          overflow: hidden;
	        }
	        .auth-logo-image {
	          width: 32px;
	          height: 32px;
	          display: block;
	          object-fit: contain;
	          border-radius: 8px;
	        }
	        .auth-submit {
	          transition: transform 0.22s ease, box-shadow 0.22s ease;
	        }
	        .auth-submit:hover {
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 18px 42px rgba(108,92,231,0.34);
	        }
	        .auth-submit:disabled {
	          cursor: wait;
	          opacity: 0.72;
	          transform: none;
	        }
	        .glass-input {
	          width: 100%;
	          padding: 16px;
	          border: 1px solid rgba(255,255,255,0.74);
	          background: rgba(255,255,255,0.58);
	          backdrop-filter: blur(14px);
	          border-radius: 12px;
	          font-size: 1.15rem;
	          font-weight: 600;
	          outline: none;
          transition: all 0.3s;
        }
	        .glass-input[type="password"] {
	          letter-spacing: 0.15em;
	        }
          .auth-field-hint {
            color: #636e72;
            font-size: 0.78rem;
            margin-top: 8px;
            line-height: 1.4;
            font-weight: 700;
          }
          .auth-verification-card {
            padding: 16px;
            border-radius: 18px;
            background: rgba(255,255,255,0.45);
            border: 1px solid rgba(108,92,231,0.16);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
          }
          .auth-verification-card p {
            margin: 8px 0 0;
            color: #636e72;
            font-size: 0.78rem;
            line-height: 1.45;
            font-weight: 650;
          }
          .auth-verification-toggle {
            display: flex;
            align-items: center;
            gap: 10px;
            color: #2d3436;
            font-weight: 900;
            cursor: pointer;
          }
          .auth-verification-toggle input {
            accent-color: #6c5ce7;
          }
          .auth-verification-fields {
            display: grid;
            gap: 10px;
            margin-top: 14px;
          }
          .auth-avatar-card {
            padding: 16px;
            border-radius: 18px;
            background: rgba(255,255,255,0.45);
            border: 1px solid rgba(108,92,231,0.16);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
            display: grid;
            gap: 12px;
          }
          .auth-avatar-card-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
          }
          .auth-avatar-card-head strong {
            display: block;
            color: #2d3436;
            font-size: 0.92rem;
            margin-bottom: 4px;
          }
          .auth-avatar-card-head p {
            margin: 0;
            color: #636e72;
            font-size: 0.78rem;
            line-height: 1.45;
            font-weight: 650;
          }
          .auth-avatar-random {
            border: 1px solid rgba(108,92,231,0.18);
            border-radius: 999px;
            background: rgba(255,255,255,0.62);
            color: #6c5ce7;
            font-weight: 850;
            padding: 8px 12px;
            cursor: pointer;
          }
          .auth-avatar-preview {
            width: 72px;
            height: 72px;
            border-radius: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            box-shadow: 0 10px 24px rgba(108,92,231,0.16);
          }
          .auth-avatar-fields {
            display: grid;
            gap: 10px;
          }
          .auth-bio-input {
            resize: vertical;
            min-height: 92px;
            line-height: 1.5;
            letter-spacing: 0;
          }
          .auth-verification-fields .glass-input {
            padding: 12px 14px;
            font-size: 0.95rem;
          }
          .auth-verification-tabs {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            padding: 4px;
            border-radius: 14px;
            background: rgba(255,255,255,0.54);
          }
          .auth-verification-tabs button {
            border: none;
            border-radius: 12px;
            padding: 9px 12px;
            color: #636e72;
            font-weight: 850;
            background: transparent;
            cursor: pointer;
          }
          .auth-verification-tabs button.is-active {
            color: white;
            background: linear-gradient(135deg, #a29bfe, #6c5ce7);
            box-shadow: 0 8px 18px rgba(108,92,231,0.18);
          }
	        .glass-input:focus {
	          background: #fff;
	          box-shadow: 0 0 0 4px rgba(162,155,254,0.18), 0 10px 26px rgba(108,92,231,0.08);
	          border-color: var(--primary);
	        }
          .auth-switch-btn {
            color: var(--primary);
            cursor: pointer;
            font-weight: 600;
            background: none;
            border: none;
            padding: 0;
            font: inherit;
            transition: color 0.2s ease, transform 0.2s ease;
          }
          .auth-switch-btn:hover {
            color: #6c5ce7;
            transform: translateY(-1px);
          }
        @media (max-width: 640px) {
          .auth-card {
            padding: 30px 20px;
            margin: 20px;
            border-radius: 20px;
          }
          h1 {
            font-size: 1.8rem;
          }
          .glass-input {
            padding: 14px;
            font-size: 0.95rem;
          }
        }
      `}</style>
        </div>
    );
}
