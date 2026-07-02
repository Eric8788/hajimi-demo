'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { User } from '@/lib/db';
import { canUseMemberInteractions, getInteractionBlockedMessage } from '@/lib/access';
import HasdaqInfoTooltip from './HasdaqInfoTooltip';
import HasdaqMarketChart from './HasdaqMarketChart';
import { HasdaqRollingNumber, HasdaqShareStepper } from './HasdaqNumberControls';

type HasdaqCompanyView = {
    id?: number;
    name?: string;
    ticker?: string;
    status?: string;
    company_type?: 'student' | 'official_demo' | string | null;
    description?: string | null;
    summary?: string | null;
    current_price_milli?: number | null;
    ipo_price_milli?: number | null;
    day_open_price_milli?: number | null;
    previous_close_price_milli?: number | null;
    paused_reason?: string | null;
    trading_paused_reason?: string | null;
    total_shares?: number | null;
    public_shares_total?: number | null;
    public_shares_remaining?: number | null;
    pool_shares?: number | null;
    pool_coin_balance?: number | null;
    h_coin_pool?: number | null;
    holder_count?: number | null;
    trade_volume_today?: number | null;
    volume_today?: number | null;
    ipo_subscription_count?: number | null;
    ipo_subscribed_shares?: number | null;
};

type HasdaqProductView = {
    id?: number | string;
    project_id?: number | null;
    title?: string | null;
    name?: string | null;
    project_title?: string | null;
    project_description?: string | null;
    project_url?: string | null;
    project_status?: string | null;
    project_tags?: string[] | string | null;
    project_rating?: number | null;
    project_rating_count?: number | null;
    project_cover_url?: string | null;
    project_accent_color?: string | null;
    description?: string | null;
    proof_note?: string | null;
    url?: string | null;
    proof_url?: string | null;
    status?: string | null;
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
const HASDAQ_MAX_PUBLIC_SHARES_PER_USER = 50;
const HASDAQ_MIN_BELL_SUBSCRIBERS = 5;
const HASDAQ_MIN_BELL_SUBSCRIBED_SHARES = 50;

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

function normalizeProductTags(tags?: string[] | string | null) {
    if (Array.isArray(tags)) return tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 4);
    if (!tags) return [];
    try {
        const parsed = JSON.parse(tags);
        if (Array.isArray(parsed)) return parsed.map(tag => String(tag).trim()).filter(Boolean).slice(0, 4);
    } catch {
        // Some legacy rows may store a comma-delimited string.
    }
    return String(tags).split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 4);
}

function getTradeValidationMessage(
    side: 'buy' | 'sell',
    inputValue: string,
    shares: number,
    poolShares: number,
    holdingLimitRemaining: number,
    positionShares: number,
    officialDemo: boolean,
    publicShares: number,
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
    if (officialDemo && shares > publicShares) return '本次卖出超过你的公开股数量，会触碰永久锁仓的创始股。';
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

function isOfficialDemo(company?: HasdaqCompanyView) {
    return company?.company_type === 'official_demo';
}

function getIpoStats(company?: HasdaqCompanyView) {
    const total = Math.max(1, Number(company?.public_shares_total ?? 300));
    const poolRemaining = Math.max(0, Math.min(total, Number(company?.public_shares_remaining ?? company?.pool_shares ?? total)));
    const reportedSubscribed = Math.max(0, Number(company?.ipo_subscribed_shares || 0));
    const subscribed = isOfficialDemo(company)
        ? Math.min(total, reportedSubscribed)
        : Math.max(0, reportedSubscribed, total - poolRemaining);
    const remaining = isOfficialDemo(company) ? Math.max(0, total - subscribed) : poolRemaining;
    const bellThresholdShares = Math.min(total, HASDAQ_MIN_BELL_SUBSCRIBED_SHARES);
    return {
        total,
        remaining,
        subscribed,
        subscribers: Math.max(0, Number(company?.ipo_subscription_count || 0)),
        percent: Math.min(100, Math.round((subscribed / total) * 100)),
        bellThresholdShares,
        bellThresholdPercent: Math.min(100, Math.max(0, (bellThresholdShares / total) * 100)),
        price: Number(company?.ipo_price_milli || company?.current_price_milli || 1000) / 1000,
    };
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
    const officialDemo = isOfficialDemo(company);
    const holdingLimitRemaining = Math.max(0, HASDAQ_MAX_PUBLIC_SHARES_PER_USER - publicShares);
    const poolSellShares = getPoolSellShares(currentPriceMilli, poolCoins);
    const maxBuyShares = Math.min(poolShares, HASDAQ_MAX_BUY_SHARES, holdingLimitRemaining);
    const maxSellShares = Math.min(officialDemo ? publicShares : positionShares, HASDAQ_MAX_SELL_SHARES, poolSellShares);
    const activeTradeLimit = tradeSide === 'buy' ? maxBuyShares : maxSellShares;
    const tradeStepperMax = Math.max(0, activeTradeLimit);
    const rawTradeShares = tradeAmount ? Math.floor(Number(tradeAmount)) : 0;
    const tradeShares = tradeStepperMax > 0 && rawTradeShares > 0 ? Math.min(rawTradeShares, tradeStepperMax) : rawTradeShares;
    const estimatedTradeCoins = estimateTradeCoins(currentPriceMilli, tradeShares, tradeSide);
    const tradeValidationMessage = getTradeValidationMessage(
        tradeSide,
        tradeAmount,
        tradeShares,
        poolShares,
        holdingLimitRemaining,
        positionShares,
        officialDemo,
        publicShares,
        poolCoins,
        poolSellShares,
        estimatedTradeCoins,
        company?.status,
    );
    const totalShares = Number(company?.total_shares || 1000);
    const currentPrice = Number(company?.current_price_milli || 0) / 1000;
    const marketCap = Math.round(currentPrice * totalShares);
    const marketCapTooltip = `市值 = 当前股价 × 总股本。Hasdaq V1 默认总股本 ${totalShares.toLocaleString('zh-CN')} 股，当前约为 ${currentPrice.toFixed(2)} × ${totalShares.toLocaleString('zh-CN')} = ${marketCap.toLocaleString('zh-CN')} H币。`;
    const ipoStats = getIpoStats(company);
    const walletBalance = Number(detail.wallet?.balance || 0);
    const ipoMaxShares = Math.max(0, Math.min(20, ipoStats.remaining || 0));
    const afterTradeShares = tradeShares > 0
        ? (tradeSide === 'buy' ? positionShares + tradeShares : Math.max(0, positionShares - tradeShares))
        : positionShares;
    const afterWalletBalance = detail.wallet && tradeShares > 0
        ? (tradeSide === 'buy' ? Math.max(0, walletBalance - estimatedTradeCoins) : walletBalance + estimatedTradeCoins)
        : walletBalance;

    const setIpoSharesValue = (nextValue: string) => {
        const digits = nextValue.replace(/[^\d]/g, '').slice(0, 2);
        if (!digits) {
            setIpoShares('');
            return;
        }
        const parsed = Math.max(1, Math.floor(Number(digits)));
        setIpoShares(String(ipoMaxShares > 0 ? Math.min(parsed, ipoMaxShares) : parsed));
    };

    const setTradeSharesValue = (nextValue: string) => {
        const digits = nextValue.replace(/[^\d]/g, '').slice(0, 3);
        if (!digits) {
            setTradeAmount('');
            return;
        }
        const parsed = Math.max(1, Math.floor(Number(digits)));
        setTradeAmount(String(tradeStepperMax > 0 ? Math.min(parsed, tradeStepperMax) : parsed));
    };

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
        const requestedShares = Math.floor(Number(ipoShares));
        const shares = ipoMaxShares > 0 ? Math.min(requestedShares, ipoMaxShares) : requestedShares;
        if (!Number.isInteger(shares) || shares < 1 || shares > 20) {
            setMessage('IPO 每次认购需要 1-20 股，单人累计上限 20 股。');
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
        const shares = tradeShares;
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
                    <span>{officialDemo ? 'Official Demo' : company.status === 'ipo' ? 'IPO Board' : 'Listed Company'}</span>
                    {officialDemo && <strong className="hasdaq-official-badge">官方示范股</strong>}
                    <h1>{company.name}</h1>
                    <p>{companyDescription}</p>
                    {pausedReason && <em>暂停交易：{pausedReason}</em>}
                </div>
                <div className="hasdaq-price-board">
                    <span>{company.ticker}</span>
                    <strong className="hasdaq-price-figure">
                        <HasdaqRollingNumber value={currentPrice} decimals={2} fontSize={34} />
                        <small>H币</small>
                    </strong>
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
            {officialDemo && (
                <section className="hasdaq-official-rules glass-panel">
                    <div>
                        <span>官方示范股规则</span>
                        <h2>HJM 只用于演示 Hasdaq 机制</h2>
                    </div>
                    <ul>
                        <li>创始股永久锁仓，管理员 / 创始人不能卖出创始股。</li>
                        <li>不参与学生公司榜单、市值榜、成交榜、涨幅榜或月度奖励。</li>
                        <li>普通用户仍可认购 IPO，并在上市后交易公开股。</li>
                        <li>股价仍由公开股买卖决定，不代表个人收益承诺。</li>
                    </ul>
                </section>
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
                                    const productUrl = product.project_url || product.url || product.proof_url || '';
                                    const tags = normalizeProductTags(product.project_tags);
                                    const rating = Number(product.project_rating || 0);
                                    const ratingCount = Number(product.project_rating_count || 0);
                                    const hasProjectSignals = Boolean(product.project_id || product.project_status || ratingCount || tags.length || product.project_cover_url);
                                    return (
                                        <article
                                            key={product.id || product.project_id || product.title || product.name}
                                            className={`hasdaq-product-row${product.project_cover_url ? ' has-cover' : ''}`}
                                            style={product.project_accent_color ? { borderLeftColor: product.project_accent_color } : undefined}
                                        >
                                            {product.project_cover_url && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={product.project_cover_url} alt="" className="hasdaq-product-cover" />
                                            )}
                                            <div className="hasdaq-product-copy">
                                                <strong>{product.project_title || product.title || product.name}</strong>
                                                {hasProjectSignals && (
                                                    <div className="hasdaq-product-signals" aria-label="Function Hall product signals">
                                                        {product.project_status && <span>{product.project_status}</span>}
                                                        {ratingCount > 0 && <span>{rating.toFixed(1)} rating / {ratingCount} reviews</span>}
                                                        {tags.map(tag => <span key={tag}>{tag}</span>)}
                                                        {product.project_id && <span>Function Hall linked</span>}
                                                    </div>
                                                )}
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
                        <p className="hasdaq-note">Product signals are review context only. They do not automatically move Hasdaq stock price or trading limits.</p>
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
                        <strong className="hasdaq-position-figure">
                            <HasdaqRollingNumber value={positionShares} fontSize={38} />
                            <small>股</small>
                        </strong>
                        <p>公开股 <b><HasdaqRollingNumber value={publicShares} fontSize={14} /></b> · 创始股 <b><HasdaqRollingNumber value={founderShares} fontSize={14} /></b></p>
                        {detail.wallet && (
                            <p>钱包余额 <b><HasdaqRollingNumber value={walletBalance} fontSize={14} /></b> H币</p>
                        )}
                    </div>

                    {company.status === 'ipo' ? (
                        <form className="hasdaq-trade-form" onSubmit={submitIpo}>
                            <div className="hasdaq-ipo-progress">
                                <div className="hasdaq-ipo-progress-head">
                                    <span>发行价 {ipoStats.price.toFixed(0)} H币/股</span>
                                    <strong>{ipoStats.subscribed}/{ipoStats.total} 已认购</strong>
                                </div>
                                <div className="hasdaq-progress-track" aria-hidden="true">
                                    <span className="hasdaq-progress-fill" style={{ width: `${ipoStats.percent}%` }} />
                                    <i className="hasdaq-progress-threshold" style={{ left: `${ipoStats.bellThresholdPercent}%` }}>
                                        <em>{ipoStats.bellThresholdShares} 股可敲钟</em>
                                    </i>
                                </div>
                                <div className="hasdaq-ipo-progress-foot">
                                    <span>公开发行 {ipoStats.total} 股</span>
                                    <span>剩余 {ipoStats.remaining} 股</span>
                                    <span>敲钟门槛 {ipoStats.subscribers}/{HASDAQ_MIN_BELL_SUBSCRIBERS} 人 · {ipoStats.subscribed}/{HASDAQ_MIN_BELL_SUBSCRIBED_SHARES} 股</span>
                                    <span>单人上限 20 股</span>
                                </div>
                            </div>
                            <HasdaqShareStepper
                                value={ipoShares}
                                label="认购股数"
                                max={ipoMaxShares}
                                disabled={pending || !canAct || ipoMaxShares < 1}
                                helper={`剩余 ${formatShares(ipoStats.remaining)} 股 · 单人最多 20 股`}
                                onChange={setIpoSharesValue}
                            />
                            <button type="submit" disabled={pending || !canAct || ipoMaxShares < 1}>认购 IPO</button>
                            <p>IPO 价格固定 1 H币 / 股，单人最多认购 20 股。</p>
                        </form>
                    ) : (
                        <form className="hasdaq-trade-form" onSubmit={submitTrade}>
                            <div className="hasdaq-position-card hasdaq-trade-pool-card">
                                <span>交易池</span>
                                <strong className="hasdaq-current-price-line">
                                    当前价 <HasdaqRollingNumber value={currentPrice} decimals={2} fontSize={24} />
                                    <small>H币/股</small>
                                </strong>
                                <p>可买 <b><HasdaqRollingNumber value={maxBuyShares} fontSize={14} /></b> 股 · 可卖约 <b><HasdaqRollingNumber value={maxSellShares} fontSize={14} /></b> 股</p>
                                <p className="hasdaq-liquidity-note">当前流动性：{poolShares > 0 ? '仍有股票可买' : '暂时无股可买'} · {poolCoins > 0 ? '可承接卖出' : '暂缺 H币承接'}</p>
                                <div className="hasdaq-pool-status-grid">
                                    <span><b>{formatShares(poolShares)}</b> pool shares</span>
                                    <span><b>{formatShares(poolCoins)}</b> H coin pool</span>
                                    <span><b>{formatShares(maxBuyShares)}</b> buy availability</span>
                                    <span><b>{formatShares(poolSellShares)}</b> estimated sell support</span>
                                </div>
                                <p className="hasdaq-liquidity-note">Display-only learning signal: pool status explains current simulated liquidity and does not add rewards, fees, or price rules.</p>
                            </div>
                            <div className="hasdaq-segmented">
                                <button type="button" className={tradeSide === 'buy' ? 'is-active' : ''} onClick={() => setTradeSide('buy')}>买入</button>
                                <button type="button" className={tradeSide === 'sell' ? 'is-active' : ''} onClick={() => setTradeSide('sell')}>卖出</button>
                            </div>
                            <HasdaqShareStepper
                                value={tradeAmount}
                                label={tradeSide === 'buy' ? '买入股数' : '卖出股数'}
                                max={tradeStepperMax}
                                disabled={pending || !canAct || company.status === 'paused' || tradeStepperMax < 1}
                                helper={tradeSide === 'buy' ? `本次最多 ${formatShares(maxBuyShares)} 股` : `本次最多 ${formatShares(maxSellShares)} 股`}
                                onChange={setTradeSharesValue}
                            />
                            <button type="submit" disabled={pending || !canAct || tradeStepperMax < 1 || Boolean(tradeValidationMessage)}>{tradeSide === 'buy' ? '买入' : '卖出'}</button>
                            <div className="hasdaq-trade-preview" aria-live="polite">
                                <span>预计{tradeSide === 'buy' ? '花费' : '收入'}</span>
                                <strong>
                                    <HasdaqRollingNumber value={estimatedTradeCoins} fontSize={30} />
                                    <small>H币</small>
                                </strong>
                                <p>交易后持仓 <b><HasdaqRollingNumber value={afterTradeShares} fontSize={14} /></b> 股{detail.wallet ? <> · 余额约 <b><HasdaqRollingNumber value={afterWalletBalance} fontSize={14} /></b> H币</> : null}</p>
                            </div>
                            {tradeValidationMessage && <p className="hasdaq-note">{tradeValidationMessage}</p>}
                            <p>{tradeSide === 'buy' ? `单次最多买入 ${HASDAQ_MAX_BUY_SHARES} 股，单人单股最多持有 ${HASDAQ_MAX_PUBLIC_SHARES_PER_USER} 股。` : officialDemo ? '官方示范股只能卖出公开股，创始股永久锁仓。' : `单次最多卖出 ${HASDAQ_MAX_SELL_SHARES} 股，创始股受锁仓限制。`}</p>
                        </form>
                    )}

                    {!canAct && <p className="hasdaq-note">完成 Hajimi 认证后可以交易。</p>}
                </aside>
            </section>
        </div>
    );
}
