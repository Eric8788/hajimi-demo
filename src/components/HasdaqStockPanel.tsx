'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { User } from '@/lib/db';
import { canUseMemberInteractions, getInteractionBlockedMessage } from '@/lib/access';
import HasdaqInfoTooltip from './HasdaqInfoTooltip';
import HasdaqMarketChart from './HasdaqMarketChart';

type HasdaqCompanyView = {
    id?: number;
    name?: string;
    ticker?: string;
    status?: string;
    description?: string | null;
    summary?: string | null;
    current_price_milli?: number | null;
    day_open_price_milli?: number | null;
    previous_close_price_milli?: number | null;
    paused_reason?: string | null;
    trading_paused_reason?: string | null;
    total_shares?: number | null;
    pool_shares?: number | null;
    public_shares_remaining?: number | null;
    pool_coin_balance?: number | null;
    h_coin_pool?: number | null;
    holder_count?: number | null;
    trade_volume_today?: number | null;
    volume_today?: number | null;
};

type HasdaqProductView = {
    id?: number | string;
    project_id?: number | null;
    title?: string | null;
    name?: string | null;
    project_title?: string | null;
    project_description?: string | null;
    description?: string | null;
    proof_note?: string | null;
    project_url?: string | null;
    proof_url?: string | null;
};

type HasdaqMemberView = {
    user_id?: number | string;
    status?: string | null;
};

type HasdaqAnnouncementView = {
    id?: number | string;
    title?: string | null;
    body?: string | null;
    author_name?: string | null;
    created_at?: string | Date | null;
};

type HasdaqTradeView = {
    type?: string | null;
    shares?: number | null;
    gross_amount?: number | null;
    price_after_milli?: number | null;
    price_milli?: number | null;
    price_before_milli?: number | null;
    created_at?: string | Date | null;
};

type HasdaqPositionView = {
    shares?: number | null;
    founder_shares?: number | null;
    public_shares?: number | null;
    locked_shares?: number | null;
};

type HasdaqDetail = {
    company?: HasdaqCompanyView;
    products?: HasdaqProductView[];
    members?: HasdaqMemberView[];
    announcements?: HasdaqAnnouncementView[];
    trades?: HasdaqTradeView[];
    position?: HasdaqPositionView;
    myPosition?: HasdaqPositionView;
    wallet?: { balance?: number };
    canTrade?: boolean;
    canAnnounce?: boolean;
};

const HASDAQ_MAX_BUY_SHARES = 10;
const HASDAQ_MAX_SELL_SHARES = 30;
const HASDAQ_MAX_PUBLIC_SHARES_PER_USER = 60;

function formatPrice(value?: number | null) {
    return `${((Number(value || 0)) / 1000).toFixed(2)} H币`;
}

function formatShares(value: number) {
    return new Intl.NumberFormat('zh-CN').format(Math.max(0, Math.floor(Number(value) || 0)));
}

function formatTime(value?: string | Date | null) {
    if (!value) return '';
    return new Date(value).toLocaleString('zh-CN');
}

function getChange(company?: HasdaqCompanyView) {
    const current = Number(company?.current_price_milli || 0);
    const open = Number(company?.day_open_price_milli || company?.previous_close_price_milli || 1000);
    if (!current || !open) return 0;
    return ((current - open) / open) * 100;
}

function estimateTradeCoins(priceMilli: number | null | undefined, shares: number, side: 'buy' | 'sell') {
    const safePrice = Number(priceMilli || 0);
    const safeShares = Math.max(0, Math.floor(Number(shares) || 0));
    if (!safePrice || !safeShares) return 0;
    const raw = (safePrice * safeShares) / 1000;
    return side === 'buy' ? Math.ceil(raw) : Math.floor(raw);
}

function getPoolShares(company?: HasdaqCompanyView) {
    return Math.max(0, Math.floor(Number(company?.pool_shares ?? company?.public_shares_remaining ?? 0)));
}

function getPoolCoins(company?: HasdaqCompanyView) {
    return Math.max(0, Math.floor(Number(company?.pool_coin_balance ?? company?.h_coin_pool ?? 0)));
}

function getPoolSellShares(priceMilli: number, poolCoins: number) {
    if (!priceMilli || poolCoins < 1) return 0;
    return Math.max(0, Math.floor((((poolCoins + 1) * 1000) - 1) / priceMilli));
}

function getTradeValidationMessage(
    side: 'buy' | 'sell',
    inputValue: string,
    shares: number,
    poolShares: number,
    holdingLimitRemaining: number,
    positionShares: number,
    poolCoins: number,
    poolSellShares: number,
    estimatedCoins: number,
    companyStatus?: string | null,
) {
    if (companyStatus === 'paused') return '该股票已暂停交易。';
    if (!inputValue) return side === 'buy' ? '请输入买入股数。' : '请输入卖出股数。';
    if (!Number.isInteger(shares) || shares < 1) return `${side === 'buy' ? '买入' : '卖出'}股数至少 1 股。`;

    if (side === 'buy') {
        if (shares > poolShares) return `交易池只剩 ${formatShares(poolShares)} 股，无法买入更多。`;
        if (shares > HASDAQ_MAX_BUY_SHARES) return `单次最多买入 ${HASDAQ_MAX_BUY_SHARES} 股。`;
        if (shares > holdingLimitRemaining) return `你最多还能持有 ${formatShares(holdingLimitRemaining)} 股。`;
        return '';
    }

    if (shares > positionShares) return `你当前只有 ${formatShares(positionShares)} 股可卖。`;
    if (shares > HASDAQ_MAX_SELL_SHARES) return `单次最多卖出 ${HASDAQ_MAX_SELL_SHARES} 股。`;
    if (estimatedCoins < 1) return '卖出收入至少需要 1 H币。';
    if (estimatedCoins > poolCoins) return `交易池 H币不足，当前最多可卖约 ${formatShares(poolSellShares)} 股。`;
    return '';
}

function formatPausedReason(reason: string) {
    if (!reason) return '';
    if (reason.includes('Demo pause')) return '模拟停牌：等待维护公告。';
    return reason;
}

export default function HasdaqStockPanel({ ticker, user }: { ticker: string; user: User | null }) {
    const [detail, setDetail] = useState<HasdaqDetail>({});
    const [loading, setLoading] = useState(true);
    const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy');
    const [tradeAmount, setTradeAmount] = useState('5');
    const [ipoShares, setIpoShares] = useState('5');
    const [announcementTitle, setAnnouncementTitle] = useState('');
    const [announcementBody, setAnnouncementBody] = useState('');
    const [message, setMessage] = useState('');
    const [pending, setPending] = useState(false);
    const canAct = canUseMemberInteractions(user);
    const company = detail.company;
    const position = detail.myPosition || detail.position || {};
    const publicShares = Number(position.public_shares ?? Math.max(0, Number(position.shares || 0) - Number(position.founder_shares || 0)));
    const founderShares = Number(position.locked_shares ?? position.founder_shares ?? 0);
    const positionShares = publicShares + founderShares;
    const companyDescription = company?.description || company?.summary || '这家公司还没有填写简介。';
    const pausedReason = formatPausedReason(company?.paused_reason || company?.trading_paused_reason || '');
    const myMembership = detail.members?.find(member => Number(member.user_id) === Number(user?.id));
    const canAnnounce = Boolean(detail.canAnnounce || (canAct && detail.members?.some(member => Number(member.user_id) === Number(user?.id) && member.status === 'accepted')));
    const change = getChange(company);
    const currentPriceMilli = Number(company?.current_price_milli || 1000);
    const poolShares = getPoolShares(company);
    const poolCoins = getPoolCoins(company);
    const holdingLimitRemaining = Math.max(0, HASDAQ_MAX_PUBLIC_SHARES_PER_USER - publicShares);
    const poolSellShares = getPoolSellShares(currentPriceMilli, poolCoins);
    const maxBuyShares = Math.min(poolShares, HASDAQ_MAX_BUY_SHARES, holdingLimitRemaining);
    const maxSellShares = Math.min(positionShares, HASDAQ_MAX_SELL_SHARES, poolSellShares);
    const tradeShares = tradeAmount ? Math.floor(Number(tradeAmount)) : 0;
    const estimatedTradeCoins = estimateTradeCoins(currentPriceMilli, tradeShares, tradeSide);
    const tradeValidationMessage = getTradeValidationMessage(
        tradeSide,
        tradeAmount,
        tradeShares,
        poolShares,
        holdingLimitRemaining,
        positionShares,
        poolCoins,
        poolSellShares,
        estimatedTradeCoins,
        company?.status,
    );
    const totalShares = Number(company?.total_shares || 1000);
    const currentPrice = Number(company?.current_price_milli || 0) / 1000;
    const marketCap = Math.round(currentPrice * totalShares);
    const marketCapTooltip = `市值 = 当前股价 × 总股本。Hasdaq V1 默认总股本 ${totalShares.toLocaleString('zh-CN')} 股，当前约为 ${currentPrice.toFixed(2)} × ${totalShares.toLocaleString('zh-CN')} = ${marketCap.toLocaleString('zh-CN')} H币。`;

    const loadDetail = async () => {
        setLoading(true);
        setMessage('');
        try {
            const res = await fetch(`/api/hasdaq/companies/${encodeURIComponent(ticker)}`, { cache: 'no-store' });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Hasdaq detail request failed');
            setDetail(data || {});
        } catch (error) {
            console.error('Hasdaq detail failed:', error);
            setMessage('股票详情暂时加载失败，请稍后刷新。');
            setDetail({});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadDetail();
        }, 0);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticker]);

    const submitIpo = async (event: React.FormEvent) => {
        event.preventDefault();
        setMessage('');
        if (!canAct) {
            setMessage(user ? getInteractionBlockedMessage(user, '认购 IPO') : '登录并完成认证后可以认购 IPO。');
            return;
        }
        const shares = Math.floor(Number(ipoShares));
        if (!Number.isInteger(shares) || shares < 1 || shares > 20) {
            setMessage('IPO 单次认购需要 1-20 股。');
            return;
        }
        setPending(true);
        try {
            const res = await fetch(`/api/hasdaq/ipo/${encodeURIComponent(ticker)}/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId: company?.id, shares }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setMessage(data?.error || 'IPO 认购失败。');
                return;
            }
            if (data?.wallet?.balance !== undefined) {
                window.dispatchEvent(new CustomEvent('hajimi-wallet-balance', { detail: { balance: Number(data.wallet.balance) } }));
            }
            setMessage(`已认购 ${shares} 股 ${ticker}。`);
            await loadDetail();
        } catch (error) {
            console.error('Hasdaq IPO failed:', error);
            setMessage('IPO 认购失败，请稍后再试。');
        } finally {
            setPending(false);
        }
    };

    const submitTrade = async (event: React.FormEvent) => {
        event.preventDefault();
        setMessage('');
        if (!canAct) {
            setMessage(user ? getInteractionBlockedMessage(user, '交易 Hasdaq 股票') : '登录并完成认证后可以交易。');
            return;
        }
        const shares = Math.floor(Number(tradeAmount));
        if (!Number.isInteger(shares) || shares < 1) {
            setMessage(`${tradeSide === 'buy' ? '买入' : '卖出'}股数至少 1 股。`);
            return;
        }
        if (tradeValidationMessage) {
            setMessage(tradeValidationMessage);
            return;
        }
        setPending(true);
        try {
            const res = await fetch('/api/hasdaq/trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: company?.id,
                    ticker,
                    side: tradeSide,
                    shares,
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setMessage(data?.error || '交易失败。');
                return;
            }
            if (data?.wallet?.balance !== undefined) {
                window.dispatchEvent(new CustomEvent('hajimi-wallet-balance', { detail: { balance: Number(data.wallet.balance) } }));
            }
            setMessage(tradeSide === 'buy' ? `买入成功，获得 ${data?.trade?.shares || data?.shares || 0} 股，花费 ${data?.trade?.gross_amount || data?.coinAmount || estimatedTradeCoins} H币。` : `卖出成功，收入 ${data?.trade?.gross_amount || data?.trade?.coin_amount || data?.coinAmount || 0} H币。`);
            await loadDetail();
        } catch (error) {
            console.error('Hasdaq trade failed:', error);
            setMessage('交易失败，请稍后再试。');
        } finally {
            setPending(false);
        }
    };

    const submitAnnouncement = async (event: React.FormEvent) => {
        event.preventDefault();
        setMessage('');
        if (!announcementTitle.trim() || !announcementBody.trim()) {
            setMessage('公告标题和内容都需要填写。');
            return;
        }
        setPending(true);
        try {
            const res = await fetch('/api/hasdaq/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: company?.id,
                    ticker,
                    kind: 'progress',
                    title: announcementTitle,
                    body: announcementBody,
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setMessage(data?.error || '公告发布失败。');
                return;
            }
            setAnnouncementTitle('');
            setAnnouncementBody('');
            setMessage('公告已发布。');
            await loadDetail();
        } catch (error) {
            console.error('Hasdaq announcement failed:', error);
            setMessage('公告发布失败，请稍后再试。');
        } finally {
            setPending(false);
        }
    };

    const respondMembership = async (action: 'accept' | 'decline') => {
        if (!company?.id) return;
        setMessage('');
        setPending(true);
        try {
            const res = await fetch(`/api/hasdaq/memberships/${company.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setMessage(data?.error || '成员邀请处理失败。');
                return;
            }
            setMessage(action === 'accept' ? '已接受公司成员邀请。' : '已拒绝公司成员邀请。');
            await loadDetail();
        } catch (error) {
            console.error('Hasdaq membership response failed:', error);
            setMessage('成员邀请处理失败，请稍后再试。');
        } finally {
            setPending(false);
        }
    };

    if (loading) {
        return <div className="hasdaq-empty glass-panel">Loading {ticker}...</div>;
    }

    if (!company) {
        return (
            <div className="hasdaq-empty glass-panel">
                <h2>没有找到这只股票</h2>
                <Link href="/hasdaq">返回 Hasdaq</Link>
            </div>
        );
    }

    return (
        <div className="hasdaq-stock-shell">
            <section className="hasdaq-stock-hero glass-panel">
                <div>
                    <Link href="/hasdaq" className="hasdaq-back-link" aria-label="返回 Hasdaq 市场">返回</Link>
                    <span>{company.status === 'ipo' ? 'IPO Board' : 'Listed Company'}</span>
                    <h1>{company.name}</h1>
                    <p>{companyDescription}</p>
                    {pausedReason && <em>暂停交易：{pausedReason}</em>}
                </div>
                <div className="hasdaq-price-board">
                    <span>{company.ticker}</span>
                    <strong>{formatPrice(company.current_price_milli || 1000)}</strong>
                    <p className={change >= 0 ? 'is-up' : 'is-down'}>{change >= 0 ? '+' : ''}{change.toFixed(1)}% 今日</p>
                </div>
            </section>

            {message && <div className="hasdaq-message">{message}</div>}
            {myMembership?.status === 'invited' && (
                <div className="hasdaq-message">
                    你被邀请加入这家公司。上市申请前需要先确认成员身份。
                    <button type="button" onClick={() => void respondMembership('accept')} disabled={pending}>接受邀请</button>
                    <button type="button" onClick={() => void respondMembership('decline')} disabled={pending}>拒绝</button>
                </div>
            )}

            <section className="hasdaq-stock-layout">
                <main className="hasdaq-stock-main">
                    <section className="glass-panel hasdaq-chart-panel">
                        <div className="hasdaq-section-head">
                            <div>
                                <span>Market Panel</span>
                                <h2>Hasdaq 行情</h2>
                            </div>
                            <HasdaqInfoTooltip as="strong" tooltip={marketCapTooltip}>市值 {marketCap} H币</HasdaqInfoTooltip>
                        </div>
                        <HasdaqMarketChart company={company} trades={detail.trades} />
                    </section>

                    <section className="glass-panel hasdaq-products-panel">
                        <div className="hasdaq-section-head">
                            <div>
                                <span>Products</span>
                                <h2>旗下产品</h2>
                            </div>
                        </div>
                        {detail.products?.length ? (
                            <div className="hasdaq-product-list">
                                {detail.products.map((product) => {
                                    const productUrl = product.project_url || product.proof_url || '';
                                    return (
                                        <article key={product.id || product.project_id || product.title || product.name} className="hasdaq-product-row">
                                            <div>
                                                <strong>{product.project_title || product.title || product.name}</strong>
                                                <p>{product.project_description || product.description || product.proof_note || '成熟项目证明'}</p>
                                            </div>
                                            {productUrl ? (
                                                <a href={productUrl} target="_blank" rel="noopener noreferrer">Open</a>
                                            ) : <span>Verified</span>}
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="hasdaq-note">暂无产品数据。</p>
                        )}
                    </section>

                    <section className="glass-panel hasdaq-announcements-panel">
                        <div className="hasdaq-section-head">
                            <div>
                                <span>Announcements</span>
                                <h2>公司公告</h2>
                            </div>
                        </div>
                        {canAnnounce && (
                            <form className="hasdaq-announcement-form" onSubmit={submitAnnouncement}>
                                <input className="glass-input" value={announcementTitle} maxLength={120} onChange={event => setAnnouncementTitle(event.target.value)} placeholder="公告标题" />
                                <textarea className="glass-input" value={announcementBody} maxLength={800} onChange={event => setAnnouncementBody(event.target.value)} placeholder="进度、新版本、暂停说明或风险提示。" />
                                <button type="submit" disabled={pending}>发布公告</button>
                            </form>
                        )}
                        {detail.announcements?.length ? (
                            <div className="hasdaq-announcement-list">
                                {detail.announcements.map((item) => (
                                    <article key={item.id} className="hasdaq-announcement-row">
                                        <strong>{item.title}</strong>
                                        <p>{item.body}</p>
                                        <small>{item.author_name || 'Company'} · {formatTime(item.created_at)}</small>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <p className="hasdaq-note">还没有公告。</p>
                        )}
                    </section>
                </main>

                <aside className="hasdaq-trade-panel glass-panel">
                    <div className="hasdaq-section-head">
                        <div>
                            <span>Trade</span>
                            <h2>{company.status === 'ipo' ? 'IPO 认购' : '买入 / 卖出'}</h2>
                        </div>
                    </div>
                    <div className="hasdaq-position-card">
                        <span>我的持仓</span>
                        <strong>{positionShares} 股</strong>
                        <p>公开股 {publicShares} · 创始股 {founderShares}</p>
                        {detail.wallet && <p>钱包余额 {Number(detail.wallet.balance || 0)} H币</p>}
                    </div>

                    {company.status === 'ipo' ? (
                        <form className="hasdaq-trade-form" onSubmit={submitIpo}>
                            <label>
                                <span>认购股数</span>
                                <input className="glass-input" value={ipoShares} inputMode="numeric" onChange={event => setIpoShares(event.target.value.replace(/[^\d]/g, '').slice(0, 2))} />
                            </label>
                            <button type="submit" disabled={pending || !canAct}>认购 IPO</button>
                            <p>IPO 价格固定 1 H币 / 股，单次最多 20 股。</p>
                        </form>
                    ) : (
                        <form className="hasdaq-trade-form" onSubmit={submitTrade}>
                            <div className="hasdaq-position-card">
                                <span>交易池</span>
                                <strong>当前价 {formatPrice(currentPriceMilli)}</strong>
                                <p>可买：{formatShares(maxBuyShares)} 股</p>
                                <p>可卖：约 {formatShares(maxSellShares)} 股</p>
                                <p>池内股份 {formatShares(poolShares)} 股 · 池内 H币 {formatShares(poolCoins)}</p>
                                <p>池内 H币不足时，卖出可能失败。</p>
                            </div>
                            <div className="hasdaq-segmented">
                                <button type="button" className={tradeSide === 'buy' ? 'is-active' : ''} onClick={() => setTradeSide('buy')}>买入</button>
                                <button type="button" className={tradeSide === 'sell' ? 'is-active' : ''} onClick={() => setTradeSide('sell')}>卖出</button>
                            </div>
                            <label>
                                <span>{tradeSide === 'buy' ? '买入股数' : '卖出股数'}</span>
                                <input className="glass-input" value={tradeAmount} inputMode="numeric" onChange={event => setTradeAmount(event.target.value.replace(/[^\d]/g, '').slice(0, 3))} />
                            </label>
                            <button type="submit" disabled={pending || !canAct || Boolean(tradeValidationMessage)}>{tradeSide === 'buy' ? '买入' : '卖出'}</button>
                            <p className="hasdaq-trade-estimate">预计{tradeSide === 'buy' ? '花费' : '收入'} {estimatedTradeCoins} H币。</p>
                            {tradeValidationMessage && <p className="hasdaq-note">{tradeValidationMessage}</p>}
                            <p>{tradeSide === 'buy' ? `单次最多买入 ${HASDAQ_MAX_BUY_SHARES} 股，单人单股最多持有 ${HASDAQ_MAX_PUBLIC_SHARES_PER_USER} 股。` : `单次最多卖出 ${HASDAQ_MAX_SELL_SHARES} 股，创始股受锁仓限制。`}</p>
                        </form>
                    )}

                    {!canAct && <p className="hasdaq-note">完成 Hajimi 认证后可以交易。</p>}
                </aside>
            </section>
        </div>
    );
}
