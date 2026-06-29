'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CoinRedemptionRequest, CoinWallet } from '@/lib/db';
import { formatHajimiId } from '@/lib/hajimiId';

type AdminCoinUser = CoinWallet & {
    username: string;
    role: string;
    verification_status: string;
    account_status?: string;
    last_grant_amount?: number | null;
    last_grant_source_type?: string | null;
    last_grant_note?: string | null;
    last_grant_at?: Date | string | null;
};

type AdminCoinOverview = {
    users: AdminCoinUser[];
    redemptions: CoinRedemptionRequest[];
};

const SOURCE_OPTIONS = [
    { value: 'manual', label: '手动发放' },
    { value: 'verification_airdrop', label: '认证启动金' },
    { value: 'project_publish_reward', label: '项目发布奖励' },
    { value: 'version_publish_reward', label: '新版本奖励' },
    { value: 'monthly_award', label: '月榜奖励' },
    { value: 'teacher_bounty', label: '老师项目悬赏' },
    { value: 'content_award', label: '内容/活动奖励' },
];

type CoinUserFilter = 'verified' | 'all' | 'pending' | 'rejected' | 'disabled';

const USER_FILTERS: { value: CoinUserFilter; label: string }[] = [
    { value: 'verified', label: '已认证' },
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待审核' },
    { value: 'rejected', label: '已拒绝' },
    { value: 'disabled', label: '已停用' },
];

function formatTime(value: Date | string | null | undefined) {
    if (!value) return '';
    return new Date(value).toLocaleString('zh-CN');
}

function formatCompactTime(value: Date | string | null | undefined) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function sourceLabel(value: string | null | undefined) {
    return SOURCE_OPTIONS.find(option => option.value === value)?.label || value || '发放';
}

function statusLabel(status: string) {
    if (status === 'approved') return '已通过，待发 token';
    if (status === 'completed') return '已完成';
    if (status === 'rejected') return '已拒绝';
    return '待审核';
}

function userStatusLabel(user: AdminCoinUser) {
    if ((user.account_status || 'active') === 'disabled') return '已停用';
    if (user.verification_status === 'verified') return '已认证';
    if (user.verification_status === 'pending') return '待审核';
    if (user.verification_status === 'rejected') return '已拒绝';
    return '未认证';
}

function lastGrantLabel(user: AdminCoinUser) {
    if (!user.last_grant_at || !user.last_grant_amount) return '暂无发放记录';
    return `上次 +${Number(user.last_grant_amount).toLocaleString()} · ${formatCompactTime(user.last_grant_at)}`;
}

export default function AdminCoinsPanel({ initialOverview }: { initialOverview: AdminCoinOverview }) {
    const [overview, setOverview] = useState(initialOverview);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<CoinUserFilter>('verified');
    const [selectedUserId, setSelectedUserId] = useState<number | null>(initialOverview.users[0]?.user_id ?? null);
    const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
    const [amount, setAmount] = useState('10');
    const [sourceType, setSourceType] = useState('verification_airdrop');
    const [note, setNote] = useState('认证启动金 10 H币');
    const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const selectedUser = useMemo(
        () => overview.users.find(user => Number(user.user_id) === Number(selectedUserId)) || overview.users[0] || null,
        [overview.users, selectedUserId],
    );
    const eligibleBatchUsers = useMemo(
        () => overview.users.filter(user => user.verification_status === 'verified' && (user.account_status || 'active') !== 'disabled'),
        [overview.users],
    );
    const selectedBatchUsers = useMemo(
        () => overview.users.filter(user => selectedBatchIds.includes(Number(user.user_id))),
        [overview.users, selectedBatchIds],
    );
    const batchTotal = selectedBatchIds.length * Math.max(0, Math.floor(Number(amount) || 0));

    const loadOverview = async (nextQuery = query, nextFilter = filter) => {
        const params = new URLSearchParams();
        if (nextQuery.trim()) params.set('query', nextQuery.trim());
        if (nextFilter === 'disabled') {
            params.set('accountStatus', 'disabled');
        } else if (nextFilter !== 'all') {
            params.set('verification', nextFilter);
            params.set('accountStatus', 'active');
        }
        const res = await fetch(`/api/admin/coins?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load coin admin data');
        const data = await res.json();
        setOverview(data);
        setSelectedUserId(current => current && data.users?.some((user: AdminCoinUser) => Number(user.user_id) === Number(current))
            ? current
            : data.users?.[0]?.user_id ?? null);
        setSelectedBatchIds(current => current.filter(id => data.users?.some((user: AdminCoinUser) => Number(user.user_id) === id)));
    };

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            loadOverview(query, filter).catch(error => {
                console.error('Failed to load coin admin data:', error);
                setMessage('H币管理数据加载失败，请稍后刷新。');
            });
        }, 180);
        return () => window.clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, filter]);

    const toggleBatchUser = (user: AdminCoinUser) => {
        if (user.verification_status !== 'verified' || (user.account_status || 'active') === 'disabled') {
            setMessage('批量空投只支持已认证且未停用的成员。');
            return;
        }
        const userId = Number(user.user_id);
        setSelectedBatchIds(current => current.includes(userId)
            ? current.filter(id => id !== userId)
            : [...current, userId]);
    };

    const selectAllEligible = () => {
        setSelectedBatchIds(eligibleBatchUsers.map(user => Number(user.user_id)));
    };

    const submitBatchGrant = async (event: React.FormEvent) => {
        event.preventDefault();
        setMessage('');
        const parsedAmount = Math.floor(Number(amount));
        if (selectedBatchIds.length === 0) {
            setMessage('请先勾选要批量空投的已认证成员。');
            return;
        }
        if (!Number.isInteger(parsedAmount) || parsedAmount < 1 || parsedAmount > 10000) {
            setMessage('空投数量需要是 1-10000 的整数。');
            return;
        }
        if (note.trim().length < 2) {
            setMessage('批量空投必须填写备注。');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/admin/coins/batch-grant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetUserIds: selectedBatchIds,
                    amount: parsedAmount,
                    sourceType,
                    note,
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setMessage(data?.error || '批量空投失败，请稍后再试。');
                return;
            }
            setMessage(`已向 ${data?.recipientCount || selectedBatchIds.length} 名成员空投 ${data?.amountEach || parsedAmount} H币。`);
            setSelectedBatchIds([]);
            await loadOverview();
        } catch (error) {
            console.error('Coin batch grant failed:', error);
            setMessage('批量空投失败，请稍后再试。');
        } finally {
            setSaving(false);
        }
    };

    const submitGrant = async (event: React.FormEvent) => {
        event.preventDefault();
        setMessage('');
        const parsedAmount = Math.floor(Number(amount));
        if (!selectedUser) {
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
                    targetUserId: selectedUser.user_id,
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
            setMessage(`已向 ${selectedUser.username} 发放 ${parsedAmount} H币。`);
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
                    <div className="admin-users-filters admin-coin-filters">
                        {USER_FILTERS.map(item => (
                            <button
                                key={item.value}
                                type="button"
                                className={filter === item.value ? 'is-active' : ''}
                                onClick={() => {
                                    setFilter(item.value);
                                    setSelectedBatchIds([]);
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <div className="admin-coin-batch-toolbar">
                        <div>
                            <strong>{selectedBatchIds.length} 已选</strong>
                            <span>当前可空投 {eligibleBatchUsers.length} 人</span>
                        </div>
                        <button type="button" onClick={selectAllEligible} disabled={eligibleBatchUsers.length === 0 || saving}>
                            全选当前已认证
                        </button>
                        <button type="button" onClick={() => setSelectedBatchIds([])} disabled={selectedBatchIds.length === 0 || saving}>
                            清空
                        </button>
                    </div>
                </div>
                {message && <div className="admin-verification-message">{message}</div>}
                <div className="admin-coin-user-list">
                    {overview.users.length === 0 ? (
                        <p className="admin-verification-empty">没有匹配的成员。</p>
                    ) : overview.users.map(user => {
                        const userId = Number(user.user_id);
                        const isBatchEligible = user.verification_status === 'verified' && (user.account_status || 'active') !== 'disabled';
                        const isSelectedBatch = selectedBatchIds.includes(userId);
                        return (
                            <article
                                key={user.user_id}
                                className={`admin-coin-user-row${Number(selectedUser?.user_id) === userId ? ' is-selected' : ''}${isSelectedBatch ? ' is-batch-selected' : ''}`}
                            >
                                <label className="admin-coin-user-check" title={isBatchEligible ? '加入本次批量空投' : '只支持已认证且未停用的成员'}>
                                    <input
                                        type="checkbox"
                                        checked={isSelectedBatch}
                                        disabled={!isBatchEligible || saving}
                                        onChange={() => toggleBatchUser(user)}
                                        aria-label={`选择 ${user.username} 参与批量空投`}
                                    />
                                </label>
                                <button
                                    type="button"
                                    className="admin-coin-user-main"
                                    onClick={() => setSelectedUserId(userId)}
                                >
                                    <span>
                                        <strong>{user.username}</strong>
                                        <small>{formatHajimiId(user.user_id)} · {user.role} · {userStatusLabel(user)}</small>
                                    </span>
                                </button>
                                <div
                                    className="admin-coin-user-metrics"
                                    title={user.last_grant_at
                                        ? `${sourceLabel(user.last_grant_source_type)}：+${Number(user.last_grant_amount || 0).toLocaleString()} H币 · ${formatTime(user.last_grant_at)}${user.last_grant_note ? ` · ${user.last_grant_note}` : ''}`
                                        : '暂无管理员发放记录'}
                                >
                                    <strong>{Number(user.balance || 0).toLocaleString()} H币</strong>
                                    <span>{lastGrantLabel(user)}</span>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>

            <form className="glass-panel admin-coin-grant-panel" onSubmit={submitGrant}>
                <div className="wallet-section-head">
                    <div>
                        <span>Grant</span>
                        <h2>单用户人工发放 H币</h2>
                    </div>
                </div>
                {selectedUser ? (
                    <div className="admin-coin-target">
                        <div>
                            <strong>{selectedUser.username}</strong>
                            <small>{lastGrantLabel(selectedUser)}</small>
                        </div>
                        <span>当前余额 {Number(selectedUser.balance || 0).toLocaleString()} H币</span>
                    </div>
                ) : (
                    <p className="admin-verification-empty">请选择成员。</p>
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
                <button type="submit" disabled={saving || !selectedUser}>
                    {saving ? '处理中...' : '发放给当前成员'}
                </button>
            </form>

            <form className="glass-panel admin-coin-batch-panel" onSubmit={submitBatchGrant}>
                <div className="wallet-section-head">
                    <div>
                        <span>Verified Airdrop</span>
                        <h2>批量空投 H币</h2>
                    </div>
                    <strong>{selectedBatchIds.length} 人</strong>
                </div>
                <div className="admin-coin-batch-summary">
                    <div>
                        <span>每人</span>
                        <strong>{Math.max(0, Math.floor(Number(amount) || 0)).toLocaleString()} H币</strong>
                    </div>
                    <div>
                        <span>合计</span>
                        <strong>{batchTotal.toLocaleString()} H币</strong>
                    </div>
                </div>
                {selectedBatchUsers.length === 0 ? (
                    <p className="admin-verification-empty">从左侧已认证成员列表勾选本次空投对象。</p>
                ) : (
                    <div className="admin-coin-batch-preview">
                        {selectedBatchUsers.slice(0, 10).map(user => (
                            <span key={user.user_id}>{user.username}</span>
                        ))}
                        {selectedBatchUsers.length > 10 && <span>+{selectedBatchUsers.length - 10}</span>}
                    </div>
                )}
                <label>
                    <span>每人空投数量</span>
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
                    <span>统一备注</span>
                    <textarea
                        className="glass-input"
                        value={note}
                        maxLength={500}
                        onChange={event => setNote(event.target.value)}
                    />
                </label>
                <p className="admin-coin-batch-note">认证启动金建议每人 10 H币；已发过 3 H币的老用户可补发 7 H币。批量发放只写入 H币钱包和 coin_transactions 账本，不修改 XP、等级或排行榜。</p>
                <button type="submit" disabled={saving || selectedBatchIds.length === 0}>
                    {saving ? '处理中...' : '一次性空投'}
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
