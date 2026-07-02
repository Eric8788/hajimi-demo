'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CoinRedemptionRequest, CoinWallet } from '@/lib/db';
import { formatHajimiId } from '@/lib/hajimiId';

type VerificationFilter = 'all' | 'verified' | 'pending' | 'unverified' | 'rejected';

type AdminCoinUser = CoinWallet & {
    username: string;
    role: string;
    verification_status: string;
};

type AdminCoinOverview = {
    users: AdminCoinUser[];
    redemptions: CoinRedemptionRequest[];
};

const SOURCE_OPTIONS = [
    { value: 'manual', label: '手动发放' },
    { value: 'verification_airdrop', label: '认证空投' },
    { value: 'project_publish_reward', label: '项目发布奖励' },
    { value: 'version_publish_reward', label: '新版本奖励' },
    { value: 'monthly_award', label: '月榜奖励' },
    { value: 'teacher_bounty', label: '老师项目悬赏' },
    { value: 'content_award', label: '内容/活动奖励' },
];

const VERIFICATION_FILTERS: Array<{ value: VerificationFilter; label: string }> = [
    { value: 'verified', label: 'Verified' },
    { value: 'all', label: '全部' },
    { value: 'pending', label: '审核中' },
    { value: 'unverified', label: '未认证' },
    { value: 'rejected', label: '已拒绝' },
];

function formatTime(value: Date | string | null | undefined) {
    if (!value) return '';
    return new Date(value).toLocaleString('zh-CN');
}

function statusLabel(status: string) {
    if (status === 'approved') return '已通过，待发 token';
    if (status === 'completed') return '已完成';
    if (status === 'rejected') return '已拒绝';
    return '待审核';
}

function userLabel(user: AdminCoinUser) {
    return `${user.username} (${formatHajimiId(user.user_id)})`;
}

export default function AdminCoinsPanel({ initialOverview }: { initialOverview: AdminCoinOverview }) {
    const [overview, setOverview] = useState(initialOverview);
    const [query, setQuery] = useState('');
    const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>('verified');
    const [selectedUserId, setSelectedUserId] = useState<number | null>(initialOverview.users[0]?.user_id ?? null);
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [amount, setAmount] = useState('3');
    const [sourceType, setSourceType] = useState('verification_airdrop');
    const [note, setNote] = useState('认证空投');
    const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const visibleUserIds = useMemo(
        () => overview.users.map(user => Number(user.user_id)),
        [overview.users],
    );

    const visibleSelectedUserIds = useMemo(
        () => selectedUserIds.filter(id => visibleUserIds.includes(id)),
        [selectedUserIds, visibleUserIds],
    );

    const selectedUsers = useMemo(
        () => overview.users.filter(user => selectedUserIds.includes(Number(user.user_id))),
        [overview.users, selectedUserIds],
    );

    const selectedUser = useMemo(
        () => overview.users.find(user => Number(user.user_id) === Number(selectedUserId)) || overview.users[0] || null,
        [overview.users, selectedUserId],
    );

    const grantTargets = selectedUsers.length > 0
        ? selectedUsers
        : selectedUser
            ? [selectedUser]
            : [];
    const isBatchGrant = selectedUsers.length > 1;
    const allVisibleSelected = overview.users.length > 0 && visibleSelectedUserIds.length === overview.users.length;

    const loadOverview = async (nextQuery = query, nextVerification = verificationFilter) => {
        const params = new URLSearchParams();
        if (nextQuery.trim()) params.set('query', nextQuery.trim());
        params.set('verification', nextVerification);
        params.set('limit', '120');
        const res = await fetch(`/api/admin/coins?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load coin admin data');
        const data = await res.json();
        setOverview(data);
        setSelectedUserId(current => current && data.users?.some((user: AdminCoinUser) => Number(user.user_id) === Number(current))
            ? current
            : data.users?.[0]?.user_id ?? null);
        setSelectedUserIds(current => current.filter(id => data.users?.some((user: AdminCoinUser) => Number(user.user_id) === id)));
    };

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            loadOverview(query, verificationFilter).catch(error => {
                console.error('Failed to load coin admin data:', error);
                setMessage('H币管理数据加载失败，请稍后刷新。');
            });
        }, 180);
        return () => window.clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, verificationFilter]);

    const toggleSelectedUser = (userId: number) => {
        setSelectedUserIds(current => current.includes(userId)
            ? current.filter(id => id !== userId)
            : [...current, userId]);
    };

    const toggleAllVisible = () => {
        setSelectedUserIds(current => {
            const visibleSet = new Set(visibleUserIds);
            if (allVisibleSelected) return current.filter(id => !visibleSet.has(id));
            return Array.from(new Set([...current, ...visibleUserIds]));
        });
    };

    const clearSelection = () => {
        setSelectedUserIds([]);
    };

    const submitGrant = async (event: React.FormEvent) => {
        event.preventDefault();
        setMessage('');
        const parsedAmount = Math.floor(Number(amount));
        if (grantTargets.length === 0) {
            setMessage('请选择成员。');
            return;
        }
        if (!Number.isInteger(parsedAmount) || parsedAmount < 1 || parsedAmount > 10000) {
            setMessage('发放数量需要是 1-10000 的整数。');
            return;
        }
        if (note.trim().length < 2) {
            setMessage('管理员发币必须填写备注。');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/admin/coins/grant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetUserId: grantTargets.length === 1 ? grantTargets[0].user_id : undefined,
                    targetUserIds: grantTargets.length > 1 ? grantTargets.map(user => user.user_id) : undefined,
                    amount: parsedAmount,
                    sourceType,
                    note,
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setMessage(data?.error || '发币失败，请稍后再试。');
                return;
            }

            if (data?.batch) {
                setMessage(`已向 ${data.count} 位成员批量发放 ${parsedAmount} H币，共 ${data.totalAmount} H币。`);
                clearSelection();
            } else {
                setMessage(`已向 ${grantTargets[0].username} 发放 ${parsedAmount} H币。`);
            }
            await loadOverview();
        } catch (error) {
            console.error('Coin grant failed:', error);
            setMessage('发币失败，请稍后再试。');
        } finally {
            setSaving(false);
        }
    };

    const updateRedemption = async (requestId: number, action: 'approve' | 'reject' | 'complete') => {
        setSaving(true);
        setMessage('');
        try {
            const res = await fetch('/api/admin/coins/redemptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId,
                    action,
                    reviewNote: reviewNotes[requestId] || '',
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setMessage(data?.error || '兑换状态更新失败。');
                return;
            }
            setMessage('兑换申请状态已更新。');
            await loadOverview();
        } catch (error) {
            console.error('Coin redemption review failed:', error);
            setMessage('兑换状态更新失败。');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="admin-coins-grid">
            <section className="glass-panel admin-coins-users">
                <div className="admin-users-toolbar">
                    <input
                        className="glass-input"
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder="搜索 username / Name / ID"
                    />
                    <div className="admin-users-filters" aria-label="按认证状态筛选成员">
                        {VERIFICATION_FILTERS.map(option => (
                            <button
                                key={option.value}
                                type="button"
                                className={verificationFilter === option.value ? 'is-active' : ''}
                                onClick={() => setVerificationFilter(option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <div className="admin-coin-selection-bar">
                        <label>
                            <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={toggleAllVisible}
                                disabled={overview.users.length === 0}
                            />
                            <span>选择当前筛选结果</span>
                        </label>
                        <strong>{visibleSelectedUserIds.length} / {overview.users.length}</strong>
                        {selectedUserIds.length > 0 && (
                            <button type="button" onClick={clearSelection}>清空</button>
                        )}
                    </div>
                </div>
                {message && <div className="admin-verification-message">{message}</div>}
                <div className="admin-coin-user-list">
                    {overview.users.length === 0 ? (
                        <p className="admin-verification-empty">没有匹配的成员。</p>
                    ) : overview.users.map(user => {
                        const userId = Number(user.user_id);
                        const checked = selectedUserIds.includes(userId);
                        return (
                            <div
                                key={user.user_id}
                                className={`admin-coin-user-row${Number(selectedUser?.user_id) === userId ? ' is-selected' : ''}${checked ? ' is-checked' : ''}`}
                            >
                                <label className="admin-coin-user-check" aria-label={`选择 ${user.username}`}>
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleSelectedUser(userId)}
                                    />
                                </label>
                                <button type="button" onClick={() => setSelectedUserId(userId)}>
                                    <span>
                                        <strong>{user.username}</strong>
                                        <small>{formatHajimiId(user.user_id)} · {user.role} · {user.verification_status}</small>
                                    </span>
                                    <em>{Number(user.balance || 0).toLocaleString()} H币</em>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </section>

            <form className="glass-panel admin-coin-grant-panel" onSubmit={submitGrant}>
                <div className="wallet-section-head">
                    <div>
                        <span>{isBatchGrant ? 'Batch Grant' : 'Grant'}</span>
                        <h2>{isBatchGrant ? '批量发放 H币' : '人工发放 H币'}</h2>
                    </div>
                    {selectedUsers.length > 0 && <strong>{selectedUsers.length} selected</strong>}
                </div>
                {grantTargets.length > 0 ? (
                    <div className={`admin-coin-target${isBatchGrant ? ' is-batch' : ''}`}>
                        <strong>{isBatchGrant ? `${grantTargets.length} 位成员` : userLabel(grantTargets[0])}</strong>
                        <span>{isBatchGrant ? `合计将发放 ${grantTargets.length * Math.max(0, Math.floor(Number(amount) || 0))} H币` : `当前余额 ${Number(grantTargets[0].balance || 0).toLocaleString()} H币`}</span>
                    </div>
                ) : (
                    <p className="admin-verification-empty">请选择成员。</p>
                )}
                {isBatchGrant && (
                    <div className="admin-coin-batch-preview">
                        {grantTargets.slice(0, 8).map(user => (
                            <span key={user.user_id}>{user.username}</span>
                        ))}
                        {grantTargets.length > 8 && <span>+{grantTargets.length - 8}</span>}
                    </div>
                )}
                <label>
                    <span>发放数量</span>
                    <input
                        className="glass-input"
                        value={amount}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        onChange={event => setAmount(event.target.value.replace(/[^\d]/g, '').slice(0, 5))}
                    />
                </label>
                <label>
                    <span>来源</span>
                    <select className="glass-input" value={sourceType} onChange={event => setSourceType(event.target.value)}>
                        {SOURCE_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>
                <label>
                    <span>备注</span>
                    <textarea
                        className="glass-input"
                        value={note}
                        maxLength={500}
                        onChange={event => setNote(event.target.value)}
                    />
                </label>
                <button type="submit" disabled={saving || grantTargets.length === 0}>
                    {saving ? '处理中...' : isBatchGrant ? `批量发放给 ${grantTargets.length} 人` : '发放 H币'}
                </button>
            </form>

            <section className="glass-panel admin-coin-redemptions-panel">
                <div className="wallet-section-head">
                    <div>
                        <span>Token Requests</span>
                        <h2>兑换审核</h2>
                    </div>
                </div>
                {overview.redemptions.length === 0 ? (
                    <p className="admin-verification-empty">暂无待处理兑换申请。</p>
                ) : (
                    <div className="admin-coin-redemption-list">
                        {overview.redemptions.map(request => (
                            <article key={request.id} className={`admin-coin-redemption-card is-${request.status}`}>
                                <div className="admin-coin-redemption-head">
                                    <div>
                                        <strong>{request.username} · {request.amount} H币</strong>
                                        <span>{statusLabel(request.status)} · {formatTime(request.created_at)}</span>
                                    </div>
                                    <em>{request.status}</em>
                                </div>
                                <p>{request.requested_note || '未填写用途说明。'}</p>
                                <textarea
                                    className="glass-input"
                                    value={reviewNotes[request.id] || ''}
                                    onChange={event => setReviewNotes(current => ({ ...current, [request.id]: event.target.value }))}
                                    placeholder="审核备注 / token 发放记录"
                                />
                                <div className="admin-coin-redemption-actions">
                                    {request.status === 'pending' && (
                                        <>
                                            <button type="button" onClick={() => updateRedemption(request.id, 'approve')} disabled={saving}>通过</button>
                                            <button type="button" className="is-danger" onClick={() => updateRedemption(request.id, 'reject')} disabled={saving}>拒绝并退款</button>
                                        </>
                                    )}
                                    {request.status === 'approved' && (
                                        <>
                                            <button type="button" onClick={() => updateRedemption(request.id, 'complete')} disabled={saving}>标记已发 token</button>
                                            <button type="button" className="is-danger" onClick={() => updateRedemption(request.id, 'reject')} disabled={saving}>撤回并退款</button>
                                        </>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
