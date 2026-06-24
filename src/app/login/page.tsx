/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import ParticleBackground from '@/components/ParticleBackground';
import { isStrongPassword, PASSWORD_REQUIREMENT_MESSAGE } from '@/lib/passwordPolicy';
import { normalizeUsernameInput, validateUsername, USERNAME_REQUIREMENT_MESSAGE } from '@/lib/accountValidation';
import { AVATAR_EMOJIS, AVATAR_THEMES, AVATAR_THEME_IDS } from '@/lib/avatarThemes';
import { STUDENT_GRADES, STUDENT_GRADE_COPY } from '@/lib/grades';

type RegistrationRole = 'student' | 'teacher' | 'parent' | 'visitor';
type RegisterStep = 1 | 2 | 3;

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

const ROLE_OPTIONS: Array<{ id: RegistrationRole; label: string; meta: string; note: string }> = [
    { id: 'student', label: '学生', meta: STUDENT_GRADE_COPY, note: '完整参与社区互动' },
    { id: 'teacher', label: '老师', meta: '任教学科', note: '完成审核后开放老师权限' },
    { id: 'visitor', label: '家长 / 访客', meta: '参观账号', note: '浏览 Hallway 与项目体验' },
];

const ROLE_STEP_OPTIONS = ROLE_OPTIONS;

const REGISTER_STEPS: Array<{ id: RegisterStep; label: string }> = [
    { id: 1, label: '身份' },
    { id: 2, label: '信息' },
    { id: 3, label: '完成' },
];

export default function LoginPage() {
    const router = useRouter();
    const [isRegister, setIsRegister] = useState(false);
    const [registerStep, setRegisterStep] = useState<RegisterStep>(1);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [registrationRole, setRegistrationRole] = useState<RegistrationRole>('student');
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
    const requiresVerification = registrationRole === 'student' || registrationRole === 'teacher';

    const resetRegisterFields = () => {
        setRegistrationRole('student');
        setVerifiedName('');
        setVerifiedGrade('G10');
        setVerifiedSubject('');
        setStudentId('');
        setBio('');
        setAvatarEmoji('');
        setAvatarTheme('lavender');
        setRegisterStep(1);
    };

    const selectRegistrationRole = (role: RegistrationRole) => {
        setRegistrationRole(role);
        setError('');
    };

    const validateRegisterStep = (step: RegisterStep, cleanUsername = normalizeUsernameInput(username)) => {
        if (step === 2 && !validateUsername(cleanUsername)) {
            setError(USERNAME_REQUIREMENT_MESSAGE);
            return false;
        }
        if (step === 2 && requiresVerification && verifiedName.trim().length < 2) {
            setError('请填写用于审核的 Name，至少 2 个字符。');
            return false;
        }
        if (step === 2 && registrationRole === 'teacher' && verifiedSubject.trim().length < 2) {
            setError('老师认证请填写任教学科。');
            return false;
        }
        if (step === 3 && !isStrongPassword(password)) {
            setError(PASSWORD_REQUIREMENT_MESSAGE);
            return false;
        }
        if (step === 3 && password !== confirmPassword) {
            setError('两次输入的密码不一致。');
            return false;
        }

        return true;
    };

    const submitAuth = async (cleanUsername: string) => {
        setIsSubmitting(true);

        try {
            const verification = isRegister && requiresVerification ? {
                type: registrationRole,
                name: verifiedName,
                grade: verifiedGrade,
                subject: verifiedSubject,
                studentId,
            } : undefined;

            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: cleanUsername,
                    password,
                    confirmPassword,
                    isRegister,
                    role: isRegister ? registrationRole : undefined,
                    bio: isRegister ? bio : undefined,
                    avatar: isRegister ? {
                        useDefault: !avatarEmoji.trim(),
                        emoji: avatarEmoji,
                        theme: avatarTheme,
                    } : undefined,
                    verification,
                }),
            });

            const data = await res.json().catch(() => ({ error: '操作失败，请稍后再试。' }));

            if (res.ok) {
                const nextPath = data.role === 'parent' || data.role === 'visitor' ? '/functions' : '/dashboard';
                router.replace(nextPath);
                window.setTimeout(() => {
                    window.location.assign(nextPath);
                }, 1200);
                return;
            }

            setError(data.error || '操作失败，请稍后再试。');
            setIsSubmitting(false);
        } catch {
            setError('网络连接不稳定，请稍后再试。');
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        const cleanUsername = normalizeUsernameInput(username);

        if (isRegister) {
            if (!validateRegisterStep(registerStep, cleanUsername)) return;

            if (registerStep < 3) {
                setRegisterStep((registerStep + 1) as RegisterStep);
                return;
            }

            if (!validateRegisterStep(2, cleanUsername)) {
                setRegisterStep(2);
                return;
            }
            await submitAuth(cleanUsername);
            return;
        }

        await submitAuth(cleanUsername);
    };

    return (
        <div className="auth-container">
            <ParticleBackground />
            <div className={`glass-panel auth-card ${isRegister ? `is-register register-step-${registerStep}` : 'is-login'}`}>
                <section className="auth-intro" aria-label="Hajimi welcome">
                    <div className="auth-brand-row">
                        <span className="auth-logo-mark"><img className="auth-logo-image" src="/hajimi-logo.png" alt="" /></span>
                        <span>Hajimi</span>
                    </div>
                    <div className="auth-intro-copy">
                        <span className="auth-kicker">{isRegister ? '毕业展示入口' : 'AI Club 社区'}</span>
                        <h1>{isRegister ? '加入 Hajimi' : '欢迎回来'}</h1>
                        <p>
                            {isRegister
                                ? `${STUDENT_GRADE_COPY}、老师、家长和访客都可以从这里进入 Hajimi。`
                                : '回到 Hallway、Dashboard 和 Function Hall。'}
                        </p>
                    </div>
                    {isRegister && registerStep === 1 && (
                        <div className="auth-role-summary">
                            <strong>先选择身份</strong>
                            <p>学生、老师、家长和访客会看到适合自己的注册信息。</p>
                        </div>
                    )}
                </section>

                <section className="auth-form-panel" aria-label={isRegister ? '注册表单' : '登录表单'}>
                    <form onSubmit={handleSubmit} className="auth-form">
                        {!isRegister ? (
                            <>
                                <label className="auth-field">
                                    <span>用户名</span>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                        className="glass-input auth-input"
                                        placeholder="2-24 个字符"
                                        autoComplete="username"
                                    />
                                </label>

                                <label className="auth-field">
                                    <span>密码</span>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="glass-input auth-input"
                                        placeholder="输入密码"
                                        autoComplete="current-password"
                                    />
                                </label>

                                {error && <div className="auth-error">{error}</div>}

                                <button type="submit" className="btn btn-primary auth-submit" disabled={isSubmitting}>
                                    {isSubmitting ? '登录中...' : '登录'}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="auth-stepper" aria-label="注册步骤">
                                    {REGISTER_STEPS.map(step => (
                                        <span
                                            key={step.id}
                                            className={registerStep === step.id ? 'is-current' : registerStep > step.id ? 'is-done' : ''}
                                            aria-current={registerStep === step.id ? 'step' : undefined}
                                        >
                                            <b>{step.id}</b>
                                            {step.label}
                                        </span>
                                    ))}
                                </div>

                                {registerStep === 1 && (
                                    <div className="auth-section auth-role-step">
                                        <div className="auth-section-head">
                                            <strong>选择身份</strong>
                                            <span>选好后点击下一步</span>
                                        </div>
                                        <div className="auth-role-grid" role="radiogroup" aria-label="注册身份">
                                            {ROLE_STEP_OPTIONS.map(option => (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={registrationRole === option.id}
                                                    className={registrationRole === option.id ? 'is-active' : ''}
                                                    onClick={() => selectRegistrationRole(option.id)}
                                                >
                                                    <strong>{option.label}</strong>
                                                    <em>{option.meta}</em>
                                                    <span>{option.note}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {registerStep === 2 && (
                                    <>
                                        <label className="auth-field">
                                            <span>用户名</span>
                                            <input
                                                type="text"
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                required
                                                className="glass-input auth-input"
                                                placeholder="2-24 个字符"
                                                autoComplete="username"
                                            />
                                            <small>2-24 个字符，不使用空格或网址符号。</small>
                                        </label>

                                        {requiresVerification ? (
                                            <div className="auth-section auth-verification-card">
                                                <div className="auth-section-head">
                                                    <strong>{registrationRole === 'teacher' ? '老师认证' : '学生认证'}</strong>
                                                    <span>{registrationRole === 'teacher' ? '填写任教学科' : 'G7-G13 与毕业生同权限'}</span>
                                                </div>
                                                <div className="auth-verification-fields">
                                                    <label className="auth-field">
                                                        <span>姓名Name</span>
                                                        <input
                                                            type="text"
                                                            value={verifiedName}
                                                            onChange={(e) => setVerifiedName(e.target.value)}
                                                            className="glass-input auth-input"
                                                            placeholder="学校常用名 / 英文名"
                                                            autoComplete="name"
                                                            required
                                                        />
                                                        <small>只用于账号审核，不会公开展示。</small>
                                                    </label>

                                                    {registrationRole === 'student' ? (
                                                        <div className="auth-two-col">
                                                            <label className="auth-field">
                                                                <span>年级</span>
                                                                <select value={verifiedGrade} onChange={(e) => setVerifiedGrade(e.target.value)} className="glass-input auth-input" required>
                                                                    {STUDENT_GRADES.map(grade => (
                                                                        <option key={grade} value={grade}>{grade === '毕业生' ? '毕业生（同学生权限）' : grade}</option>
                                                                    ))}
                                                                </select>
                                                                <small>选择与你当前情况最接近的一项。</small>
                                                            </label>
                                                            <label className="auth-field">
                                                                <span>学号（可选）</span>
                                                                <input
                                                                    type="text"
                                                                    value={studentId}
                                                                    onChange={(e) => setStudentId(e.target.value)}
                                                                    className="glass-input auth-input"
                                                                    placeholder="选填"
                                                                    autoComplete="off"
                                                                />
                                                                <small>没有学号可以不填。</small>
                                                            </label>
                                                        </div>
                                                    ) : (
                                                        <label className="auth-field">
                                                            <span>任教学科</span>
                                                            <input
                                                                type="text"
                                                                value={verifiedSubject}
                                                                onChange={(e) => setVerifiedSubject(e.target.value)}
                                                                className="glass-input auth-input"
                                                                placeholder="例如：AI / CS / English"
                                                                autoComplete="off"
                                                                required
                                                            />
                                                        </label>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="auth-section auth-visitor-note">
                                                <strong>家长 / 访客参观账号</strong>
                                                <p>无需提交认证。可以浏览论坛、打开项目体验；发帖、评论、点赞、收藏、打赏和兑换会保持关闭。</p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {registerStep === 3 && (
                                    <>
                                        <div className="auth-section auth-profile-card">
                                            <div className="auth-avatar-row">
                                                <div className="auth-avatar-preview" style={{ background: selectedAvatarTheme.background, color: selectedAvatarTheme.color }}>
                                                    <span>{avatarEmoji || '😊'}</span>
                                                </div>
                                                <div className="auth-avatar-copy">
                                                    <strong>头像设置</strong>
                                                    <small>可以随机生成，也可以自己选择。</small>
                                                </div>
                                                <button type="button" className="auth-avatar-random" onClick={() => {
                                                    const nextEmoji = AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
                                                    const nextTheme = AVATAR_THEME_IDS[Math.floor(Math.random() * AVATAR_THEME_IDS.length)];
                                                    setAvatarEmoji(nextEmoji);
                                                    setAvatarTheme(nextTheme);
                                                }} aria-label="随机生成头像">
                                                    随机
                                                </button>
                                            </div>
                                            <div className="auth-avatar-controls">
                                                <div className="auth-field">
                                                    <span>Emoji</span>
                                                    <details className="auth-choice-select auth-emoji-select">
                                                        <summary>
                                                            <i className="auth-emoji-swatch">{avatarEmoji || '😊'}</i>
                                                            <b>{avatarEmoji || '随机 emoji'}</b>
                                                        </summary>
                                                        <div className="auth-choice-menu auth-emoji-menu">
                                                            <button
                                                                type="button"
                                                                className={!avatarEmoji ? 'is-active' : ''}
                                                                onClick={(event) => {
                                                                    setAvatarEmoji('');
                                                                    event.currentTarget.closest('details')?.removeAttribute('open');
                                                                }}
                                                            >
                                                                <i className="auth-emoji-swatch">😊</i>
                                                                <span>随机 emoji</span>
                                                            </button>
                                                            {AVATAR_EMOJIS.map(emoji => (
                                                                <button
                                                                    key={emoji}
                                                                    type="button"
                                                                    className={avatarEmoji === emoji ? 'is-active' : ''}
                                                                    onClick={(event) => {
                                                                        setAvatarEmoji(emoji);
                                                                        event.currentTarget.closest('details')?.removeAttribute('open');
                                                                    }}
                                                                >
                                                                    <i className="auth-emoji-swatch">{emoji}</i>
                                                                    <span>{emoji}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </details>
                                                </div>
                                                <div className="auth-field">
                                                    <span>背景色</span>
                                                    <details className="auth-choice-select auth-color-select">
                                                        <summary>
                                                            <i style={{ background: selectedAvatarTheme.background }} />
                                                            <b>{AVATAR_THEME_LABELS[avatarTheme] || avatarTheme}</b>
                                                        </summary>
                                                        <div className="auth-choice-menu auth-color-menu">
                                                            {AVATAR_THEME_IDS.map(theme => (
                                                                <button
                                                                    key={theme}
                                                                    type="button"
                                                                    className={avatarTheme === theme ? 'is-active' : ''}
                                                                    onClick={(event) => {
                                                                        setAvatarTheme(theme);
                                                                        event.currentTarget.closest('details')?.removeAttribute('open');
                                                                    }}
                                                                >
                                                                    <i style={{ background: AVATAR_THEMES[theme].background }} />
                                                                    <span>{AVATAR_THEME_LABELS[theme] || theme}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </details>
                                                </div>
                                            </div>
                                        </div>

                                        <label className="auth-field">
                                            <span>密码</span>
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                minLength={8}
                                                className="glass-input auth-input"
                                                placeholder="至少 8 位"
                                                autoComplete="new-password"
                                            />
                                            <small>至少 8 位，并包含大小写字母和数字。</small>
                                        </label>

                                        <label className="auth-field">
                                            <span>确认密码</span>
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                required
                                                minLength={8}
                                                className="glass-input auth-input"
                                                placeholder="再输入一次密码"
                                                autoComplete="new-password"
                                            />
                                        </label>
                                    </>
                                )}

                                {error && <div className="auth-error">{error}</div>}

                                <div className="auth-nav-row">
                                    {registerStep > 1 ? (
                                        <button
                                            type="button"
                                            className="auth-secondary-action"
                                            onClick={() => {
                                                setError('');
                                                setRegisterStep((registerStep - 1) as RegisterStep);
                                            }}
                                        >
                                            上一步
                                        </button>
                                    ) : (
                                        <span className="auth-nav-spacer" />
                                    )}
                                    <button type="submit" className="btn btn-primary auth-submit" disabled={isSubmitting}>
                                        {isSubmitting ? '创建中...' : registerStep < 3 ? '下一步' : '完成注册'}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>

                    <p className="auth-switch-copy">
                        {isRegister ? '已有账号？' : '第一次来？'}{' '}
                        <button
                            type="button"
                            onClick={() => {
                                setIsRegister(!isRegister);
                                setError('');
                                setPassword('');
                                setConfirmPassword('');
                                resetRegisterFields();
                                setIsSubmitting(false);
                            }}
                            className="auth-switch-btn"
                        >
                            {isRegister ? '登录' : '创建账号'}
                        </button>
                    </p>
                </section>
            </div>

            <style jsx>{`
                .auth-container {
                    position: relative;
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    min-height: 100vh;
                    padding: 34px;
                    overflow: auto;
                    background:
                        radial-gradient(circle at 50% 18%, rgba(162,155,254,0.08), transparent 32%),
                        linear-gradient(135deg, rgba(255,255,255,0.9), rgba(245,247,255,0.72));
                }

                .auth-card {
                    position: relative;
                    z-index: 2;
                    width: min(100%, 980px);
                    padding: 0;
                    overflow: hidden;
                    background: rgba(255, 255, 255, 0.64);
                    border: 1px solid rgba(255,255,255,0.78);
                    box-shadow: 0 28px 80px rgba(108, 92, 231, 0.16);
                    display: grid;
                    grid-template-columns: minmax(260px, 0.82fr) minmax(380px, 1.18fr);
                    min-height: 560px;
                    margin: auto 0;
                }

                .auth-card.is-login {
                    width: min(100%, 760px);
                    grid-template-columns: minmax(240px, 0.85fr) minmax(320px, 1fr);
                    min-height: 440px;
                }

                .auth-card.is-login .auth-intro {
                    justify-content: center;
                }

                .auth-card.register-step-2 .auth-intro,
                .auth-card.register-step-3 .auth-intro {
                    justify-content: center;
                }

                .auth-intro {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    gap: 28px;
                    padding: 36px;
                    background:
                        radial-gradient(circle at 24% 16%, rgba(162,155,254,0.34), transparent 34%),
                        radial-gradient(circle at 84% 80%, rgba(85,239,196,0.2), transparent 30%),
                        linear-gradient(145deg, rgba(255,255,255,0.66), rgba(241,245,255,0.48));
                    border-right: 1px solid rgba(108,92,231,0.12);
                }

                .auth-brand-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: #6c5ce7;
                    font-weight: 900;
                    letter-spacing: 0;
                }

                .auth-logo-mark {
                    width: 40px;
                    height: 40px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 14px;
                    background: rgba(255,255,255,0.92);
                    border: 2px solid rgba(162,155,254,0.25);
                    box-shadow: 0 8px 22px rgba(108,92,231,0.14);
                    overflow: hidden;
                }

                .auth-logo-image {
                    width: 33px;
                    height: 33px;
                    display: block;
                    object-fit: contain;
                    border-radius: 9px;
                }

                .auth-kicker {
                    display: inline-flex;
                    width: fit-content;
                    padding: 7px 10px;
                    border-radius: 999px;
                    background: rgba(108,92,231,0.1);
                    color: #6c5ce7;
                    font-size: 0.72rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0;
                }

                .auth-intro-copy h1 {
                    margin: 14px 0 12px;
                    font-size: clamp(2rem, 4vw, 3.4rem);
                    line-height: 1;
                    color: #2d3436;
                    letter-spacing: 0;
                }

                .auth-intro-copy p,
                .auth-role-summary p,
                .auth-visitor-note p {
                    margin: 0;
                    color: #636e72;
                    font-size: 0.95rem;
                    line-height: 1.62;
                    font-weight: 650;
                }

                .auth-role-summary,
                .auth-visitor-note {
                    padding: 16px;
                    border-radius: 18px;
                    background: rgba(255,255,255,0.54);
                    border: 1px solid rgba(108,92,231,0.13);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.78);
                }

                .auth-role-summary strong,
                .auth-visitor-note strong {
                    display: block;
                    margin-bottom: 6px;
                    color: #2d3436;
                    font-weight: 900;
                }

                .auth-form-panel {
                    padding: 34px;
                    background: rgba(255,255,255,0.34);
                }

                .auth-form {
                    display: grid;
                    gap: 14px;
                }

                .auth-stepper {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 8px;
                    padding: 6px;
                    border-radius: 16px;
                    background: rgba(255,255,255,0.5);
                    border: 1px solid rgba(108,92,231,0.1);
                }

                .auth-stepper span {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 7px;
                    min-height: 34px;
                    border-radius: 12px;
                    color: #636e72;
                    font-size: 0.74rem;
                    font-weight: 850;
                    letter-spacing: 0;
                }

                .auth-stepper b {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 19px;
                    height: 19px;
                    border-radius: 999px;
                    background: rgba(108,92,231,0.1);
                    color: #6c5ce7;
                    font-size: 0.68rem;
                    font-weight: 900;
                }

                .auth-stepper span.is-current {
                    color: #2d3436;
                    background: rgba(255,255,255,0.92);
                    box-shadow: 0 8px 20px rgba(108,92,231,0.1);
                }

                .auth-stepper span.is-current b,
                .auth-stepper span.is-done b {
                    background: #6c5ce7;
                    color: white;
                }

                .auth-field {
                    display: grid;
                    gap: 8px;
                }

                .auth-field span,
                .auth-section-head strong {
                    color: #2d3436;
                    font-size: 0.84rem;
                    font-weight: 900;
                }

                .auth-field small,
                .auth-section-head span,
                .auth-profile-toggle small {
                    color: #636e72;
                    font-size: 0.74rem;
                    line-height: 1.4;
                    font-weight: 700;
                }

                .auth-input {
                    padding: 13px 14px;
                    border-radius: 14px;
                    min-height: 48px;
                    font-size: 0.96rem;
                    font-weight: 700;
                    letter-spacing: 0;
                }

                .auth-input[type="password"] {
                    letter-spacing: 0.08em;
                }

                .auth-section {
                    display: grid;
                    gap: 12px;
                    padding: 14px;
                    border-radius: 18px;
                    background: rgba(255,255,255,0.46);
                    border: 1px solid rgba(108,92,231,0.14);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.72);
                }

                .auth-role-step {
                    gap: 14px;
                }

                .auth-section-head {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    gap: 12px;
                }

                .auth-role-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 10px;
                }

                .auth-role-grid > button {
                    display: grid;
                    align-content: start;
                    gap: 4px;
                    border: 1px solid rgba(108,92,231,0.14);
                    border-radius: 15px;
                    background: rgba(255,255,255,0.6);
                    color: #636e72;
                    min-height: 106px;
                    padding: 12px;
                    cursor: pointer;
                    text-align: left;
                    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
                }

                .auth-role-grid > button:hover {
                    transform: translateY(-1px);
                    border-color: rgba(108,92,231,0.3);
                }

                .auth-role-grid > button strong,
                .auth-role-grid > button em,
                .auth-role-grid > button span {
                    display: block;
                }

                .auth-role-grid > button strong {
                    color: #2d3436;
                    font-size: 0.9rem;
                }

                .auth-role-grid > button em {
                    color: #6c5ce7;
                    font-size: 0.68rem;
                    font-style: normal;
                    font-weight: 900;
                    margin-bottom: 5px;
                }

                .auth-role-grid > button span {
                    font-size: 0.71rem;
                    line-height: 1.32;
                    font-weight: 750;
                }

                .auth-role-grid > button.is-active {
                    border-color: rgba(108,92,231,0.42);
                    background: linear-gradient(135deg, rgba(162,155,254,0.28), rgba(255,255,255,0.88));
                    box-shadow: 0 10px 24px rgba(108,92,231,0.13);
                }

                .auth-readonly-group {
                    grid-column: 1 / -1;
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    border-radius: 15px;
                    border: 1px solid rgba(108,92,231,0.14);
                    background: rgba(255,255,255,0.54);
                    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
                }

                .auth-readonly-group.is-active {
                    border-color: rgba(108,92,231,0.34);
                    background: linear-gradient(135deg, rgba(162,155,254,0.18), rgba(255,255,255,0.86));
                    box-shadow: 0 10px 24px rgba(108,92,231,0.1);
                }

                .auth-readonly-copy {
                    display: grid;
                    gap: 4px;
                    min-width: 0;
                }

                .auth-readonly-copy strong,
                .auth-readonly-copy em,
                .auth-readonly-copy span {
                    display: block;
                }

                .auth-readonly-copy strong {
                    color: #2d3436;
                    font-size: 0.92rem;
                    font-weight: 900;
                }

                .auth-readonly-copy em {
                    color: #6c5ce7;
                    font-size: 0.68rem;
                    font-style: normal;
                    font-weight: 900;
                }

                .auth-readonly-copy span {
                    color: #636e72;
                    font-size: 0.71rem;
                    line-height: 1.36;
                    font-weight: 750;
                }

                .auth-readonly-options {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(72px, 1fr));
                    gap: 8px;
                    min-width: 170px;
                }

                .auth-readonly-options button {
                    display: grid;
                    gap: 3px;
                    min-height: 54px;
                    padding: 8px 10px;
                    border-radius: 13px;
                    border: 1px solid rgba(108,92,231,0.14);
                    background: rgba(255,255,255,0.66);
                    color: #636e72;
                    cursor: pointer;
                    text-align: left;
                    transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
                }

                .auth-readonly-options button:hover {
                    transform: translateY(-1px);
                    border-color: rgba(108,92,231,0.28);
                }

                .auth-readonly-options button.is-active {
                    border-color: rgba(108,92,231,0.42);
                    background: rgba(255,255,255,0.92);
                }

                .auth-readonly-options button strong {
                    color: #2d3436;
                    font-size: 0.82rem;
                    font-weight: 900;
                }

                .auth-readonly-options button span {
                    color: #636e72;
                    font-size: 0.68rem;
                    line-height: 1.2;
                    font-weight: 750;
                }

                .auth-verification-fields,
                .auth-profile-fields {
                    display: grid;
                    gap: 12px;
                }

                .auth-two-col {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 10px;
                    align-items: stretch;
                }

                .auth-two-col .auth-field {
                    grid-template-rows: auto 48px auto;
                    align-content: start;
                }

                .auth-profile-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    border: none;
                    background: transparent;
                    padding: 0;
                    color: #2d3436;
                    cursor: pointer;
                    text-align: left;
                }

                .auth-profile-toggle span {
                    min-width: 0;
                }

                .auth-profile-toggle-copy {
                    display: grid;
                    gap: 3px;
                    flex: 1;
                }

                .auth-profile-toggle strong {
                    font-size: 0.88rem;
                    font-weight: 900;
                }

                .auth-profile-toggle-preview {
                    width: 38px;
                    height: 38px;
                    border-radius: 13px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex: 0 0 auto;
                    font-size: 1.05rem;
                    box-shadow: 0 6px 14px rgba(108,92,231,0.12);
                }

                .auth-profile-toggle b,
                .auth-avatar-random,
                .auth-secondary-action {
                    border: 1px solid rgba(108,92,231,0.18);
                    border-radius: 999px;
                    background: rgba(255,255,255,0.62);
                    color: #6c5ce7;
                    font-size: 0.78rem;
                    font-weight: 850;
                    padding: 7px 11px;
                    cursor: pointer;
                }

                .auth-review-strip {
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr);
                    gap: 4px 10px;
                    align-items: center;
                    padding: 13px 14px;
                    border-radius: 16px;
                    border: 1px solid rgba(108,92,231,0.12);
                    background: rgba(255,255,255,0.52);
                }

                .auth-review-strip span {
                    grid-row: span 2;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 52px;
                    height: 34px;
                    padding: 0 11px;
                    border-radius: 999px;
                    color: #6c5ce7;
                    background: rgba(108,92,231,0.1);
                    font-size: 0.78rem;
                    font-weight: 900;
                }

                .auth-review-strip strong {
                    color: #2d3436;
                    font-size: 0.9rem;
                    font-weight: 900;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .auth-review-strip em {
                    color: #636e72;
                    font-size: 0.72rem;
                    font-style: normal;
                    font-weight: 750;
                }

                .auth-avatar-row {
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 9px;
                }

                .auth-profile-card {
                    gap: 12px;
                    padding: 12px;
                }

                .auth-avatar-preview {
                    width: 48px;
                    height: 48px;
                    border-radius: 15px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.24rem;
                    box-shadow: 0 8px 18px rgba(108,92,231,0.13);
                }

                .auth-avatar-copy {
                    display: grid;
                    gap: 3px;
                    min-width: 0;
                }

                .auth-avatar-copy strong {
                    color: #2d3436;
                    font-size: 0.8rem;
                    font-weight: 900;
                }

                .auth-avatar-copy small {
                    color: #636e72;
                    font-size: 0.7rem;
                    line-height: 1.35;
                    font-weight: 700;
                }

                .auth-avatar-controls {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 10px;
                    align-items: start;
                }

                .auth-choice-select {
                    position: relative;
                    width: 100%;
                }

                .auth-choice-select summary {
                    list-style: none;
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    min-height: 48px;
                    padding: 12px 14px;
                    border-radius: 14px;
                    border: 1px solid rgba(108,92,231,0.14);
                    background: rgba(255,255,255,0.56);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.72);
                    color: #2d3436;
                    cursor: pointer;
                    font-size: 0.84rem;
                    font-weight: 850;
                    user-select: none;
                }

                .auth-choice-select summary::-webkit-details-marker {
                    display: none;
                }

                .auth-choice-select summary::after {
                    content: "⌄";
                    margin-left: auto;
                    color: #6c5ce7;
                    font-size: 0.88rem;
                    line-height: 1;
                }

                .auth-choice-select[open] summary {
                    border-color: rgba(108,92,231,0.32);
                    background: rgba(255,255,255,0.88);
                }

                .auth-choice-select i,
                .auth-color-menu button i {
                    display: inline-block;
                    width: 22px;
                    height: 22px;
                    flex: 0 0 22px;
                    border-radius: 999px;
                    border: 2px solid rgba(255,255,255,0.92);
                    box-shadow: 0 4px 10px rgba(45,52,54,0.12);
                }

                .auth-choice-select b {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .auth-choice-menu {
                    position: absolute;
                    z-index: 20;
                    top: calc(100% + 7px);
                    left: 0;
                    right: 0;
                    display: grid;
                    gap: 6px;
                    max-height: 210px;
                    overflow: auto;
                    padding: 8px;
                    border-radius: 16px;
                    border: 1px solid rgba(108,92,231,0.16);
                    background: rgba(255,255,255,0.96);
                    box-shadow: 0 18px 40px rgba(108,92,231,0.16);
                    backdrop-filter: blur(18px);
                }

                .auth-choice-menu button {
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    min-height: 38px;
                    padding: 7px 9px;
                    border: 1px solid transparent;
                    border-radius: 12px;
                    background: rgba(255,255,255,0.5);
                    color: #2d3436;
                    cursor: pointer;
                    font-size: 0.76rem;
                    font-weight: 850;
                    text-align: left;
                }

                .auth-choice-menu button:hover,
                .auth-choice-menu button.is-active {
                    border-color: rgba(108,92,231,0.24);
                    background: rgba(162,155,254,0.14);
                }

                .auth-emoji-menu {
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                }

                .auth-emoji-menu button {
                    justify-content: center;
                    min-height: 42px;
                }

                .auth-emoji-menu button:first-child {
                    grid-column: 1 / -1;
                    justify-content: flex-start;
                }

                .auth-emoji-menu button:not(:first-child) span {
                    display: none;
                }

                .auth-emoji-swatch {
                    display: inline-flex !important;
                    align-items: center;
                    justify-content: center;
                    background: rgba(162,155,254,0.12);
                    color: #2d3436;
                    font-style: normal;
                    font-size: 0.98rem;
                }

                .auth-bio-input {
                    resize: vertical;
                    min-height: 72px;
                    line-height: 1.5;
                }

                .auth-error {
                    background: rgba(255, 118, 117, 0.16);
                    color: #d63031;
                    padding: 12px 14px;
                    border: 1px solid rgba(214,48,49,0.12);
                    border-radius: 14px;
                    font-size: 0.85rem;
                    font-weight: 750;
                    text-align: center;
                }

                .auth-submit {
                    justify-content: center;
                    min-height: 48px;
                    transition: transform 0.22s ease, box-shadow 0.22s ease;
                }

                .auth-submit:hover {
                    transform: translateY(-2px) scale(1.01);
                    box-shadow: 0 18px 42px rgba(108,92,231,0.34);
                }

                .auth-submit:disabled {
                    cursor: wait;
                    opacity: 0.72;
                    transform: none;
                }

                .auth-nav-row {
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr);
                    gap: 10px;
                    align-items: center;
                }

                .auth-nav-row .auth-submit {
                    min-width: 0;
                }

                .auth-secondary-action {
                    min-height: 44px;
                    min-width: 86px;
                    color: #636e72;
                    font-size: 0.82rem;
                    background: rgba(255,255,255,0.72);
                }

                .auth-secondary-action:hover {
                    color: #6c5ce7;
                    border-color: rgba(108,92,231,0.3);
                }

                .auth-nav-spacer {
                    display: block;
                    width: 1px;
                }

                .auth-switch-copy {
                    margin: 20px 0 0;
                    color: #666;
                    font-size: 0.9rem;
                    text-align: center;
                }

                .auth-switch-btn {
                    color: var(--primary);
                    cursor: pointer;
                    font-weight: 700;
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

                @media (max-width: 920px) {
                    .auth-container {
                        align-items: flex-start;
                        padding: 20px;
                        overflow: auto;
                    }

                    .auth-card,
                    .auth-card.is-login {
                        width: min(100%, 620px);
                        grid-template-columns: 1fr;
                        min-height: 0;
                    }

                    .auth-intro {
                        padding: 26px;
                        border-right: 0;
                        border-bottom: 1px solid rgba(108,92,231,0.12);
                    }

                    .auth-form-panel {
                        padding: 24px;
                        max-height: none;
                        overflow: visible;
                    }

                    .auth-role-grid {
                        grid-template-columns: repeat(3, minmax(0, 1fr));
                    }
                }

                @media (max-width: 560px) {
                    .auth-container {
                        padding: 12px;
                    }

                    .auth-intro,
                    .auth-form-panel {
                        padding: 20px;
                    }

                    .auth-intro-copy h1 {
                        font-size: 2rem;
                    }

                    .auth-section-head,
                    .auth-two-col,
                    .auth-avatar-controls {
                        grid-template-columns: 1fr;
                    }

                    .auth-section-head {
                        display: grid;
                        gap: 4px;
                    }

                    .auth-role-grid {
                        grid-template-columns: 1fr;
                    }

                    .auth-role-grid > button {
                        min-height: auto;
                    }

                    .auth-avatar-row {
                        grid-template-columns: auto minmax(0, 1fr);
                    }

                    .auth-avatar-random {
                        grid-column: 1 / -1;
                        width: 100%;
                    }

                    .auth-readonly-group {
                        grid-template-columns: 1fr;
                    }

                    .auth-readonly-options {
                        min-width: 0;
                    }
                }
            `}</style>
        </div>
    );
}
