'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AdminAuditEvent, AdminUserDetail, AdminUserSummary, AccountStatus } from '@/lib/db';
import type { VerificationStatus, VerificationType } from '@/lib/verification';
import { formatHajimiId } from '@/lib/hajimiId';
import Avatar from './Avatar';
import { STUDENT_GRADES } from '@/lib/grades';

type UserFilter = 'all' | VerificationStatus | 'disabled';

const FILTERS: { value: UserFilter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'verified', label: '已认证' },
    { value: 'pending', label: '待审核' },
    { value: 'rejected', label: '已拒绝' },
    { value: 'disabled', label: '已停用' },
];

function statusLabel(status?: VerificationStatus | null) {
    if (status === 'verified') return '已认证';
    if (status === 'pending') return '待审核';
    if (status === 'rejected') return '已拒绝';
    return '未认证';
}

function accountLabel(status?: AccountStatus | null) {
    return status === 'disabled' ? '已停用' : '可用';
}

function auditTime(value: Date | string | null | undefined) {
    if (!value) return '';
    return new Date(value).toLocaleString('zh-CN');
}

function eventMeta(event: AdminAuditEvent) {
    const actor = event.actor_name ? `by ${event.actor_name}` : 'legacy record';
    const target = event.target_username ? ` · ${event.target_username}` : '';
    return `${actor}${target} · ${auditTime(event.created_at)}`;
}

export default function AdminUsersPanel() {
    const [users, setUsers] = useState<AdminUserSummary[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [detail, setDetail] = useState<AdminUserDetail | null>(null);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<UserFilter>('all');
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [message, setMessage] = useState('');
    const [identityVisible, setIdentityVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        username: '',
        verification_status: 'unverified' as VerificationStatus,
        verification_type: 'student' as VerificationType,
        verified_name: '',
        verified_grade: 'G10',
        verified_subject: '',
        student_id: '',
        verification_note: '',
    });

    const selectedSummary = useMemo(
        () => users.find(user => user.id === selectedId) || users[0] || null,
        [selectedId, users],
    );

    const loadUsers = async () => {
        setLoadingUsers(true);
        const params = new URLSearchParams();
        if (query.trim()) params.set('query', query.trim());
        if (filter === 'disabled') {
            params.set('accountStatus', 'disabled');
        } else if (filter !== 'all') {
            params.set('verification', filter);
            params.set('accountStatus', 'active');
        }

        try {
            const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to load users');
            const data = await res.json();
            const nextUsers = Array.isArray(data.users) ? data.users as AdminUserSummary[] : [];
            setUsers(nextUsers);
            setSelectedId(current => current && nextUsers.some(user => user.id === current) ? current : nextUsers[0]?.id ?? null);
        } catch (error) {
            console.error('Failed to load admin users:', error);
            setUsers([]);
            setMessage('成员列表加载失败，请稍后刷新。');
        } finally {
            setLoadingUsers(false);
        }
    };

    const loadDetail = async (userId: number | null) => {
        if (!userId) {
            setDetail(null);
            return;
        }

        setLoadingDetail(true);
        try {
            const res = await fetch(`/api/admin/users/${userId}`, { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to load user detail');
            const data = await res.json();
            const nextDetail = data.user as AdminUserDetail;
            setDetail(nextDetail);
            setForm({
                username: nextDetail.username,
                verification_status: nextDetail.verification_status || 'unverified',
                verification_type: nextDetail.verification_type || 'student',
                verified_name: nextDetail.verified_name || '',
                verified_grade: nextDetail.verified_grade || 'G10',
                verified_subject: nextDetail.verified_subject || '',
                student_id: '',
                verification_note: nextDetail.verification_note || '',
            });
        } catch (error) {
            console.error('Failed to load admin user detail:', error);
            setDetail(null);
            setMessage('成员详情加载失败，请重新选择。');
        } finally {
            setLoadingDetail(false);
        }
    };

    useEffect(() => {
        const timeout = window.setTimeout(loadUsers, 180);
        return () => window.clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, filter]);

    useEffect(() => {
        setIdentityVisible(false);
        loadDetail(selectedId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    const saveIdentity = async () => {
        if (!detail) return;
        setSaving(true);
        setMessage('');

        try {
            const res = await fetch(`/api/admin/users/${detail.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setMessage(data?.error || '保存失败，请稍后再试。');
                return;
            }

            setDetail(data.user);
            setForm(current => ({ ...current, student_id: '' }));
            setMessage('成员认证资料已保存。');
            await loadUsers();
        } catch (error) {
            console.error('Failed to save admin user identity:', error);
            setMessage('保存请求失败，请稍后再试。');
        } finally {
            setSaving(false);
        }
    };

    const changeAccountStatus = async (action: 'disable' | 'enable') => {
        if (!detail) return;
        const reason = action === 'disable'
            ? window.prompt(`停用 ${detail.username} 的原因（会进入管理员审计记录）`) || ''
            : window.prompt(`恢复 ${detail.username} 的原因（可留空）`) || '管理员恢复账号';

        if (action === 'disable' && reason.trim().length < 2) {
            setMessage('停用账号需要填写原因。');
            return;
        }

        setSaving(true);
        setMessage('');
        try {
            const res = await fetch(`/api/admin/users/${detail.id}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, reason }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setMessage(data?.error || '账号状态更新失败。');
                return;
            }

            setDetail(data.user);
            setMessage(action === 'disable' ? '账号已停用。' : '账号已恢复。');
            await loadUsers();
        } catch (error) {
            console.error('Failed to change admin user status:', error);
            setMessage('账号状态请求失败，请稍后再试。');
        } finally {
            setSaving(false);
        }
    };

    const deleteAccount = async () => {
        if (!detail) return;
        const confirmUsername = window.prompt(`永久删除 ${detail.username}？\n\n这会删除该账号、测试发帖、评论、项目互动和项目申请，不能撤销。\n请输入完整用户名确认。`) || '';
        if (confirmUsername !== detail.username) {
            setMessage('删除已取消：用户名确认不一致。');
            return;
        }

        setSaving(true);
        setMessage('');
        try {
            const res = await fetch(`/api/admin/users/${detail.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmUsername }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setMessage(data?.error || '删除失败，请稍后再试。');
                return;
            }

            setDetail(null);
            setSelectedId(null);
            setMessage(`${confirmUsername} 已删除。`);
            await loadUsers();
        } catch (error) {
            console.error('Failed to delete admin user:', error);
            setMessage('删除请求失败，请稍后再试。');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="admin-users-shell">
            <section className="admin-users-list-panel">
                <div className="admin-users-toolbar">
                    <input
                        className="glass-input"
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder="搜索 username / Name / ID"
                    />
                    <div className="admin-users-filters">
                        {FILTERS.map(item => (
                            <button
                                key={item.value}
                                type="button"
                                className={filter === item.value ? 'is-active' : ''}
                                onClick={() => setFilter(item.value)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {message && <div className="admin-verification-message">{message}</div>}

                <div className="admin-users-list">
                    {loadingUsers ? (
                        <p className="admin-verification-empty">Loading members...</p>
                    ) : users.length === 0 ? (
                        <p className="admin-verification-empty">没有匹配的成员。</p>
                    ) : (
                        users.map(user => (
                            <button
                                key={user.id}
                                type="button"
                                className={`admin-user-row${selectedSummary?.id === user.id ? ' is-selected' : ''}`}
                                onClick={() => setSelectedId(user.id)}
                            >
                                <Avatar value={user.avatar} theme={user.avatar_theme} fallback={user.avatar_emoji || '👤'} size={44} />
                                <span>
                                    <strong>{user.username}</strong>
                                    <small>{formatHajimiId(user.id)} · {user.role} · Lv.{user.level}</small>
                                </span>
                                <em className={`admin-user-status is-${user.account_status === 'disabled' ? 'disabled' : user.verification_status || 'unverified'}`}>
                                    {user.account_status === 'disabled' ? '已停用' : statusLabel(user.verification_status)}
                                </em>
                            </button>
                        ))
                    )}
                </div>
            </section>

            <aside className="admin-user-detail-panel">
                {!detail || loadingDetail ? (
                    <p className="admin-verification-empty">{loadingDetail ? 'Loading detail...' : '请选择一个成员。'}</p>
                ) : (
                    <>
                        <div className="admin-user-detail-hero">
                            <Avatar value={detail.avatar} theme={detail.avatar_theme} fallback={detail.avatar_emoji || '👤'} size={64} />
                            <div>
                                <span>{formatHajimiId(detail.id)} · {detail.role}</span>
                                <h2>{detail.username}</h2>
                                <p>{accountLabel(detail.account_status)} · {statusLabel(detail.verification_status)} · {detail.points.toLocaleString()} XP</p>
                            </div>
                        </div>

                        <section className="admin-user-section">
                            <div className="admin-user-section-head">
                                <div>
                                    <h3>公开账号摘要</h3>
                                    <p>这些是管理员列表可以直接显示的非敏感字段。</p>
                                </div>
                            </div>
                            <div className="admin-user-kv"><span>账号状态</span><strong>{accountLabel(detail.account_status)}</strong></div>
                            <div className="admin-user-kv"><span>注册时间</span><strong>{auditTime(detail.created_at)}</strong></div>
                            <div className="admin-user-kv"><span>等级</span><strong>Lv.{detail.level}</strong></div>
                            {detail.disabled_reason && <div className="admin-user-kv"><span>停用原因</span><strong>{detail.disabled_reason}</strong></div>}
                        </section>

                        <section className="admin-user-section">
                            <div className="admin-user-section-head">
                                <div>
                                    <h3>实名/认证信息</h3>
                                    <p>点击后在同一块遮罩区域内显示，不额外展开页面高度。</p>
                                </div>
                            </div>
                            <div className="admin-identity-reveal">
                                {!identityVisible ? (
                                    <div className="admin-identity-mask">
                                        <strong>敏感信息已折叠</strong>
                                        <span>只在管理员详情面板内显示 Name、年级/科目和学号后四位。</span>
                                        <button type="button" onClick={() => setIdentityVisible(true)}>显示实名信息</button>
                                    </div>
                                ) : (
                                    <div className="admin-identity-fields">
                                        <label>
                                            <span>Username</span>
                                            <input className="glass-input" value={form.username} onChange={event => setForm(current => ({ ...current, username: event.target.value }))} />
                                        </label>
                                        <label>
                                            <span>认证状态</span>
                                            <select className="glass-input" value={form.verification_status} onChange={event => setForm(current => ({ ...current, verification_status: event.target.value as VerificationStatus }))}>
                                                <option value="unverified">未认证</option>
                                                <option value="pending">待审核</option>
                                                <option value="verified">已认证</option>
                                                <option value="rejected">已拒绝</option>
                                            </select>
                                        </label>
                                        <label>
                                            <span>身份类型</span>
                                            <select className="glass-input" value={form.verification_type} onChange={event => setForm(current => ({ ...current, verification_type: event.target.value as VerificationType }))}>
                                                <option value="student">student</option>
                                                <option value="teacher">teacher</option>
                                            </select>
                                        </label>
                                        <label>
                                            <span>Name</span>
                                            <input className="glass-input" value={form.verified_name} onChange={event => setForm(current => ({ ...current, verified_name: event.target.value }))} />
                                        </label>
                                        {form.verification_type === 'student' ? (
                                            <>
                                                <label>
                                                    <span>年级</span>
                                                    <select className="glass-input" value={form.verified_grade} onChange={event => setForm(current => ({ ...current, verified_grade: event.target.value }))}>
                                                        {STUDENT_GRADES.map(grade => (
                                                            <option key={grade} value={grade}>{grade}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label>
                                                    <span>新学号</span>
                                                    <input className="glass-input" value={form.student_id} onChange={event => setForm(current => ({ ...current, student_id: event.target.value }))} placeholder={`当前后四位：${detail.student_id_last4 || '未提交'}`} />
                                                </label>
                                            </>
                                        ) : (
                                            <label>
                                                <span>科目</span>
                                                <input className="glass-input" value={form.verified_subject} onChange={event => setForm(current => ({ ...current, verified_subject: event.target.value }))} />
                                            </label>
                                        )}
                                        <label className="is-wide">
                                            <span>审核备注</span>
                                            <textarea className="glass-input" value={form.verification_note} onChange={event => setForm(current => ({ ...current, verification_note: event.target.value }))} />
                                        </label>
                                        <div className="admin-identity-actions">
                                            <button type="button" onClick={() => setIdentityVisible(false)}>收起实名信息</button>
                                            <button type="button" className="is-primary" onClick={saveIdentity} disabled={saving}>{saving ? '保存中...' : '保存资料'}</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="admin-user-section">
                            <div className="admin-user-section-head">
                                <div>
                                    <h3>最近维护记录</h3>
                                    <p>只展示新的审计事件；旧审核记录会在审核历史里以 legacy 形式补齐。</p>
                                </div>
                            </div>
                            {detail.recent_audit_events.length === 0 ? (
                                <p className="admin-verification-empty">暂无维护记录。</p>
                            ) : (
                                <div className="admin-audit-list">
                                    {detail.recent_audit_events.map(event => (
                                        <article key={event.id} className="admin-audit-row">
                                            <span className="admin-audit-dot" />
                                            <div>
                                                <strong>{event.summary}</strong>
                                                <p>{eventMeta(event)}</p>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="admin-user-section admin-danger-section">
                            <h3>危险区</h3>
                            <p>优先使用停用账号保留记录；如果是测试账号，可以输入完整用户名后永久删除。</p>
                            {detail.account_status === 'disabled' ? (
                                <button type="button" onClick={() => changeAccountStatus('enable')} disabled={saving}>恢复账号</button>
                            ) : (
                                <button type="button" onClick={() => changeAccountStatus('disable')} disabled={saving}>停用账号</button>
                            )}
                            <button type="button" className="is-delete" onClick={deleteAccount} disabled={saving || detail.role === 'admin'}>
                                永久删除测试账号
                            </button>
                        </section>
                    </>
                )}
            </aside>
        </div>
    );
}
