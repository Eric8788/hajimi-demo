'use client';

import { useMemo, useState } from 'react';
import type { CoinWalletOverview } from '@/lib/db';
import { getInteractionBlockedMessage, isReadOnlyRole } from '@/lib/access';
import { clearCachedJsonKey, setCachedJson } from '@/lib/clientJsonCache';
import {
    COIN_REDEMPTION_BASE_MONTHLY_LIMIT,
    COIN_REDEMPTION_MAX_AMOUNT,
    COIN_REDEMPTION_MIN_AMOUNT,
    COIN_REDEMPTION_MONTHLY_POOL,
    isAdditionalCoinRedemption,
    validateCoinRedemptionRequest,
} from '@/lib/coinRules';
import AnimatedNumber from '@/components/reactbits/AnimatedNumber';
import SpotlightCard from '@/components/reactbits/SpotlightCard';

const COIN_BALANCE_CACHE_KEY = 'coins:wallet-balance';
const COIN_BALANCE_CACHE_TTL_MS = 60000;

function scopedCoinBalanceCacheKey(userId?: number | string | null) {
    return `${COIN_BALANCE_CACHE_KEY}:${userId || 'guest'}`;
}

function formatTime(value: Date | string | null | undefined) {
    if (!value) return '';
    return new Date(value).toLocaleString('zh-CN');
}

function transactionLabel(type: string, sourceType: string) {
    if (type === 'tip_sent') return '项目打赏';
    if (type === 'tip_received') return '收到打赏';
    if (type === 'redemption_hold') return '兑换冻结';
    if (type === 'redemption_refund') return '兑换退回';
    if (type === 'hasdaq_ipo_buy') return 'Hasdaq IPO 认购';
    if (type === 'hasdaq_buy') return 'Hasdaq 买入';
    if (type === 'hasdaq_sell') return 'Hasdaq 卖出';
    if (sourceType === 'verification_airdrop') return '认证空投';
    if (sourceType === 'project_publish_reward') return '项目发布奖励';
    if (sourceType === 'version_publish_reward') return '新版本奖励';
    if (sourceType === 'monthly_award') return '月榜奖励';
    if (sourceType === 'teacher_bounty') return '老师项目悬赏';
    if (sourceType === 'content_award') return '内容/活动奖励';
    return '管理员发放';
}

function redemptionLabel(status: string) {
    if (status === 'approved') return '已通过';
    if (status === 'rejected') return '已拒绝';
    if (status === 'completed') return '已完成';
    return '待审核';
}

export default function WalletPanel({ initialOverview, verified, readOnlyRole }: { initialOverview: CoinWalletOverview; verified: boolean; readOnlyRole?: string | null }) {
    const [overview, setOverview] = useState(initialOverview);
    const [amount, setAmount] = useState(String(COIN_REDEMPTION_MIN_AMOUNT));
    const [requestedNote, setRequestedNote] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const visibleTransactions = useMemo(() => overview.transactions.slice(0, 30), [overview.transactions]);
    const coinBalanceCacheKey = scopedCoinBalanceCacheKey(overview.wallet.user_id);
    const amountPreview = Number.isInteger(Number(amount)) ? Number(amount) : null;
    const isAdditionalRequest = isAdditionalCoinRedemption(amountPreview);

    const refreshWallet = async () => {
        clearCachedJsonKey(coinBalanceCacheKey);
        const res = await fetch('/api/coins/wallet', { cache: 'no-store' });
        if (!res.ok) throw new Error('Wallet refresh failed');
        const data = await res.json();
        setOverview(data);
        const nextBalance = Number(data?.wallet?.balance);
        if (Number.isFinite(nextBalance)) {
            setCachedJson(coinBalanceCacheKey, { wallet: { balance: nextBalance } }, COIN_BALANCE_CACHE_TTL_MS);
            window.dispatchEvent(new CustomEvent('hajimi-wallet-balance', { detail: { balance: nextBalance } }));
        }
    };

    const submitRedemption = async (event: React.FormEvent) => {
        event.preventDefault();
        setMessage('');

        const validation = validateCoinRedemptionRequest(amount, requestedNote);
        if (!verified) {
            setMessage(isReadOnlyRole(readOnlyRole)
                ? getInteractionBlockedMessage({ role: readOnlyRole, verification_status: 'unverified' }, '申请兑换 token')
                : '完成 Hajimi 认证后可以申请兑换 token。');
            return;
        }
        if (!validation.ok && validation.reason === 'invalid_amount') {
            setMessage(`兑换申请最低 ${COIN_REDEMPTION_MIN_AMOUNT} H币，最高 ${COIN_REDEMPTION_MAX_AMOUNT} H币。`);
            return;
        }
        if (!validation.ok && validation.reason === 'missing_additional_note') {
            setMessage(`超过每人每月基础 ${COIN_REDEMPTION_BASE_MONTHLY_LIMIT} H币的追加申请必须填写用途说明。`);
            return;
        }
        if (!validation.ok) return;
        if (validation.amount > Number(overview.wallet.balance || 0)) {
            setMessage('H币余额不足，无法冻结兑换额度。');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/coins/redemptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: validation.amount, requestedNote }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setMessage(data?.error || '兑换申请提交失败，请稍后再试。');
                return;
            }
            setMessage(`已提交 ${validation.amount} H币${validation.isAdditional ? '追加' : ''} token 兑换申请，H币已冻结等待管理员审核。`);
            setRequestedNote('');
            await refreshWallet();
        } catch (error) {
            console.error('Coin redemption failed:', error);
            setMessage('兑换申请提交失败，请稍后再试。');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="wallet-grid">
            <SpotlightCard className="glass-panel wallet-card wallet-balance-card" spotlightColor="rgba(108, 92, 231, 0.2)">
                <span>Available</span>
                <strong><AnimatedNumber value={overview.wallet.balance} /> H币</strong>
                <p>累计获得 <AnimatedNumber value={overview.wallet.earned_total} /> · 已消费/冻结 <AnimatedNumber value={overview.wallet.spent_total} /></p>
            </SpotlightCard>

            <form className="glass-panel wallet-card wallet-redemption-card" onSubmit={submitRedemption}>
                <div className="wallet-section-head">
                    <div>
                        <span>Token Redemption</span>
                        <h2>兑换 token 额度</h2>
                    </div>
                    <strong>最低 {COIN_REDEMPTION_MIN_AMOUNT} H币</strong>
                </div>
                <p className="wallet-redemption-rule">
                    公共兑换池 {COIN_REDEMPTION_MONTHLY_POOL} H币/月；每人每月基础额度 {COIN_REDEMPTION_BASE_MONTHLY_LIMIT} H币，超过部分作为追加申请由管理员人工审核。
                </p>
                <label>
                    <span>兑换数量</span>
                    <input
                        className="glass-input"
                        value={amount}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        onChange={event => setAmount(event.target.value.replace(/[^\d]/g, '').slice(0, 5))}
                    />
                </label>
                <label>
                    <span>用途说明{isAdditionalRequest ? '（追加申请必填）' : ''}</span>
                    <textarea
                        className="glass-input"
                        value={requestedNote}
                        maxLength={500}
                        onChange={event => setRequestedNote(event.target.value)}
                        placeholder="例如：用于 Sailer 2D 新版本调试、课堂 demo、模型测试。"
                    />
                </label>
                {isAdditionalRequest && (
                    <p className="wallet-redemption-hint">这笔申请超过基础额度，请写清用途，管理员会按当月剩余额度审核。</p>
                )}
                <button type="submit" disabled={submitting || !verified}>
                    {submitting ? '提交中...' : '提交兑换申请'}
                </button>
                {message && <p className="wallet-message">{message}</p>}
            </form>

            <section className="glass-panel wallet-card wallet-history-card">
                <div className="wallet-section-head">
                    <div>
                        <span>Ledger</span>
                        <h2>最近交易</h2>
                    </div>
                </div>
                {visibleTransactions.length === 0 ? (
                    <p className="wallet-empty">还没有 H币交易。管理员发币或项目打赏后会出现在这里。</p>
                ) : (
                    <div className="wallet-transaction-list">
                        {visibleTransactions.map(transaction => (
                            <article key={transaction.id} className="wallet-transaction-row">
                                <div>
                                    <strong>{transactionLabel(transaction.type, transaction.source_type)}</strong>
                                    <p>{transaction.note || transaction.counterparty_username || 'Hajimi Coin'}</p>
                                    <small>{formatTime(transaction.created_at)}</small>
                                </div>
                                <span className={transaction.amount >= 0 ? 'is-positive' : 'is-negative'}>
                                    {transaction.amount > 0 ? '+' : ''}{transaction.amount} H币
                                </span>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <section className="glass-panel wallet-card wallet-redemption-list-card">
                <div className="wallet-section-head">
                    <div>
                        <span>Requests</span>
                        <h2>兑换申请</h2>
                    </div>
                </div>
                {overview.redemptions.length === 0 ? (
                    <p className="wallet-empty">暂无兑换申请。</p>
                ) : (
                    <div className="wallet-redemption-list">
                        {overview.redemptions.map(request => (
                            <article key={request.id} className={`wallet-redemption-row is-${request.status}`}>
                                <div>
                                    <strong>
                                        {request.amount} H币 · {redemptionLabel(request.status)}
                                        {isAdditionalCoinRedemption(request.amount) && <span className="wallet-redemption-badge">追加申请</span>}
                                    </strong>
                                    <p>{request.review_note || request.requested_note || 'token 兑换申请'}</p>
                                    <small>{formatTime(request.created_at)}</small>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
