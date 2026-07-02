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
    { value: 'manual', label: '????' },
    { value: 'verification_airdrop', label: '????' },
    { value: 'project_publish_reward', label: '??????' },
    { value: 'version_publish_reward', label: '?????' },
    { value: 'monthly_award', label: '????' },
    { value: 'teacher_bounty', label: '??????' },
    { value: 'content_award', label: '??/????' },
];

const VERIFICATION_FILTERS: Array<{ value: VerificationFilter; label: string }> = [
    { value: 'verified', label: 'Verified' },
    { value: 'all', label: '??' },
    { value: 'pending', label: '???' },
    { value: 'unverified', label: '???' },
    { value: 'rejected', label: '???' },
];

function formatTime(value: Date | string | null | undefined) {
    if (!value) return '';
    return new Date(value).toLocaleString('zh-CN');
}

function statusLabel(status: string) {
    if (status === 'approved') return '?????? token';
    if (status === 'completed') return '???';
    if (status === 'rejected') return '???';
    return '???';
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
    const [note, setNote] = useState('????');
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
                setMessage('H????????????????');
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
            setMessage('??????');
            return;
        }
        if (!Number.isInteger(parsedAmount) || parsedAmount < 1 || parsedAmount > 10000) {
            setMessage('??????? 1-10000 ????');
            return;
        }
        if (note.trim().length < 2) {
            setMessage('????????????');
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
                setMessage(data?.error || '???????????');
                return;
            }

            if (data?.batch) {
                setMessage(`?? ${data.count} ??????? ${parsedAmount} H??? ${data.totalAmount} H??`);
                clearSelection();
            } else {
                setMessage(`?? ${grantTargets[0].username} ?? ${parsedAmount} H??`);
            }
            await loadOverview();
        } catch (error) {
            console.error('Coin grant failed:', error);
            setMessage('???????????');
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
                setMessage(data?.error || '?????????');
                return;
            }
            setMessage('??????????');
            await loadOverview();
        } catch (error) {
            console.error('Coin redemption review failed:', error);
            setMessage('?????????');
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
                        placeholder="?? username / Name / ID"
                    />
                    <div className="admin-users-filters" aria-label="?????????">
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
                            <span>????????</span>
                        </label>
                        <strong>{visibleSelectedUserIds.length} / {overview.users.length}</strong>
                        {selectedUserIds.length > 0 && (
                            <button type="button" onClick={clearSelection}>??</button>
                        )}
                    </div>
                </div>
                {message && <div className="admin-verification-message">{message}</div>}
                <div className="admin-coin-user-list">
                    {overview.users.length === 0 ? (
                        <p className="admin-verification-empty">????????</p>
                    ) : overview.users.map(user => {
                        const userId = Number(user.user_id);
                        const checked = selectedUserIds.includes(userId);
                        return (
                            <div
                                key={user.user_id}
                                className={`admin-coin-user-row${Number(selectedUser?.user_id) === userId ? ' is-selected' : ''}${checked ? ' is-checked' : ''}`}
                            >
                                <label className="admin-coin-user-check" aria-label={`?? ${user.username}`}>
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleSelectedUser(userId)}
                                    />
                                </label>
                                <button type="button" onClick={() => setSelectedUserId(userId)}>
                                    <span>
                                        <strong>{user.username}</strong>
                                        <small>{formatHajimiId(user.user_id)} ? {user.role} ? {user.verification_status}</small>
                                    </span>
                                    <em>{Number(user.balance || 0).toLocaleString()} H?</em>
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
                        <h2>{isBatchGrant ? '???? H?' : '???? H?'}</h2>
                    </div>
                    {selectedUsers.length > 0 && <strong>{selectedUsers.length} selected</strong>}
                </div>
                {grantTargets.length > 0 ? (
                    <div className={`admin-coin-target${isBatchGrant ? ' is-batch' : ''}`}>
                        <strong>{isBatchGrant ? `${grantTargets.length} ???` : userLabel(grantTargets[0])}</strong>
                        <span>{isBatchGrant ? `????? ${grantTargets.length * Math.max(0, Math.floor(Number(amount) || 0))} H?` : `???? ${Number(grantTargets[0].balance || 0).toLocaleString()} H?`}</span>
                    </div>
                ) : (
                    <p className="admin-verification-empty">??????</p>
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
                    <span>????</span>
                    <input
                        className="glass-input"
                        value={amount}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        onChange={event => setAmount(event.target.value.replace(/[^\d]/g, '').slice(0, 5))}
                    />
                </label>
                <label>
                    <span>??</span>
                    <select className="glass-input" value={sourceType} onChange={event => setSourceType(event.target.value)}>
                        {SOURCE_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>
                <label>
                    <span>??</span>
                    <textarea
                        className="glass-input"
                        value={note}
                        maxLength={500}
                        onChange={event => setNote(event.target.value)}
                    />
                </label>
                <button type="submit" disabled={saving || grantTargets.length === 0}>
                    {saving ? '???...' : isBatchGrant ? `????? ${grantTargets.length} ?` : '?? H?'}
                </button>
            </form>

            <section className="glass-panel admin-coin-redemptions-panel">
                <div className="wallet-section-head">
                    <div>
                        <span>Token Requests</span>
                        <h2>????</h2>
                    </div>
                </div>
                {overview.redemptions.length === 0 ? (
                    <p className="admin-verification-empty">??????????</p>
                ) : (
                    <div className="admin-coin-redemption-list">
                        {overview.redemptions.map(request => (
                            <article key={request.id} className={`admin-coin-redemption-card is-${request.status}`}>
                                <div className="admin-coin-redemption-head">
                                    <div>
                                        <strong>{request.username} ? {request.amount} H?</strong>
                                        <span>{statusLabel(request.status)} ? {formatTime(request.created_at)}</span>
                                    </div>
                                    <em>{request.status}</em>
                                </div>
                                <p>{request.requested_note || '????????'}</p>
                                <textarea
                                    className="glass-input"
                                    value={reviewNotes[request.id] || ''}
                                    onChange={event => setReviewNotes(current => ({ ...current, [request.id]: event.target.value }))}
                                    placeholder="???? / token ????"
                                />
                                <div className="admin-coin-redemption-actions">
                                    {request.status === 'pending' && (
                                        <>
                                            <button type="button" onClick={() => updateRedemption(request.id, 'approve')} disabled={saving}>??</button>
                                            <button type="button" className="is-danger" onClick={() => updateRedemption(request.id, 'reject')} disabled={saving}>?????</button>
                                        </>
                                    )}
                                    {request.status === 'approved' && (
                                        <>
                                            <button type="button" onClick={() => updateRedemption(request.id, 'complete')} disabled={saving}>???? token</button>
                                            <button type="button" className="is-danger" onClick={() => updateRedemption(request.id, 'reject')} disabled={saving}>?????</button>
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
