'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { User } from '@/lib/db';

type HasdaqCompany = {
    id: number;
    company_id?: number | null;
    name: string;
    ticker: string;
    status: string;
    company_type?: 'student' | 'official_demo' | string | null;
    company_name?: string | null;
    description?: string | null;
    summary?: string | null;
    pitch?: string | null;
    slogan?: string | null;
    value_pitch?: string | null;
    listing_pitch?: string | null;
    investment_thesis?: string | null;
    founder_name?: string | null;
    current_price_milli?: number | null;
    ipo_price_milli?: number | null;
    day_open_price_milli?: number | null;
    previous_close_price_milli?: number | null;
    total_shares?: number | null;
    public_shares_total?: number | null;
    public_shares_remaining?: number | null;
    pool_shares?: number | null;
    pool_coin_balance?: number | null;
    bell_rang_at?: string | null;
    listed_at?: string | null;
    paused_reason?: string | null;
    trading_paused_reason?: string | null;
    holder_count?: number | null;
    trade_volume_today?: number | null;
    trade_volume_total?: number | null;
    volume_today?: number | null;
    volume_total?: number | null;
    user_shares?: number | null;
    user_public_shares?: number | null;
    user_locked_shares?: number | null;
    public_shares?: number | null;
    locked_shares?: number | null;
    ipo_subscription_count?: number | null;
    ipo_subscribed_shares?: number | null;
};

type HasdaqOverview = {
    companies?: HasdaqCompany[];
    officialDemoCompanies?: HasdaqCompany[];
    listed?: HasdaqCompany[];
    ipo?: HasdaqCompany[];
    listedCompanies?: HasdaqCompany[];
    ipoCompanies?: HasdaqCompany[];
    latestBell?: HasdaqCompany | null;
    positions?: HasdaqCompany[];
    myPositions?: HasdaqCompany[];
    latestAnnouncements?: Array<{ ticker?: string | null; company_name?: string | null; title?: string | null; category?: string | null }>;
};

function formatPrice(value?: number | null) {
    return `${((Number(value || 0)) / 1000).toFixed(2)} H币`;
}

function getChange(company: HasdaqCompany) {
    const current = Number(company.current_price_milli || 0);
    const open = Number(company.day_open_price_milli || company.previous_close_price_milli || 1000);
    if (!current || !open) return 0;
    return ((current - open) / open) * 100;
}

function getPositionShares(company: HasdaqCompany) {
    return Number(company.user_shares ?? company.user_public_shares ?? company.public_shares ?? 0)
        + Number(company.user_locked_shares ?? company.locked_shares ?? 0);
}

function isOfficialDemo(company: HasdaqCompany) {
    return company.company_type === 'official_demo';
}

function getIpoStats(company: HasdaqCompany) {
    const total = Math.max(1, Number(company.public_shares_total ?? company.public_shares ?? 300));
    const remaining = Math.max(0, Math.min(total, Number(company.public_shares_remaining ?? company.pool_shares ?? total)));
    const subscribed = Math.max(0, Number(company.ipo_subscribed_shares ?? total - remaining));
    return {
        total,
        remaining,
        subscribed,
        subscribers: Math.max(0, Number(company.ipo_subscription_count || 0)),
        percent: Math.min(100, Math.round((subscribed / total) * 100)),
        price: Number(company.ipo_price_milli || company.current_price_milli || 1000) / 1000,
    };
}

type MiniCandle = {
    x: number;
    openY: number;
    closeY: number;
    highY: number;
    lowY: number;
    isUp: boolean;
};

function getTickerSeed(value?: string | null) {
    return String(value || 'HASDAQ')
        .split('')
        .reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 3), 17);
}

function getCompanyInitials(company: HasdaqCompany) {
    const ticker = String(company.ticker || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (ticker.length >= 2) return ticker.slice(0, 2);
    const nameInitials = String(company.name || company.company_name || 'HS')
        .split(/\s+/)
        .map(part => part.replace(/[^a-z0-9]/gi, '').charAt(0))
        .join('')
        .toUpperCase();
    return (ticker + nameInitials + 'HS').slice(0, 2);
}

function getCompanyTheme(company: HasdaqCompany) {
    return `theme-${(getTickerSeed(company.ticker || company.name) % 5) + 1}`;
}

function buildMiniCandles(company: HasdaqCompany): MiniCandle[] {
    const count = 8;
    const seed = getTickerSeed(company.ticker || company.name);
    const current = Number(company.current_price_milli || 1000) / 1000;
    const start = Number(company.day_open_price_milli || company.previous_close_price_milli || company.current_price_milli || 1000) / 1000;
    const delta = current - start;
    const noiseScale = Math.max(0.025, Math.abs(delta) * 0.16);
    const rows: Array<{ open: number; high: number; low: number; close: number }> = [];
    let previousClose = start;

    for (let index = 0; index < count; index += 1) {
        const progress = count <= 1 ? 1 : index / (count - 1);
        const base = start + delta * progress;
        const wave = Math.sin(seed * 0.07 + index * 0.92) * noiseScale
            + Math.cos(seed * 0.13 + index * 1.71) * noiseScale * 0.52;
        const close = index === count - 1 ? current : Math.max(0.2, base + wave);
        const open = previousClose;
        const wick = noiseScale * (0.72 + ((seed + index * 11) % 5) * 0.12);
        rows.push({
            open,
            close,
            high: Math.max(open, close) + wick,
            low: Math.max(0.2, Math.min(open, close) - wick),
        });
        previousClose = close;
    }

    const high = Math.max(...rows.map(row => row.high));
    const low = Math.min(...rows.map(row => row.low));
    const range = Math.max(0.01, high - low);
    const top = 6;
    const height = 48;
    const toY = (price: number) => top + (1 - (price - low) / range) * height;

    return rows.map((row, index) => ({
        x: 10 + index * (180 / Math.max(1, count - 1)),
        openY: toY(row.open),
        closeY: toY(row.close),
        highY: toY(row.high),
        lowY: toY(row.low),
        isUp: row.close >= row.open,
    }));
}

function getMiniLinePath(candles: MiniCandle[]) {
    return candles
        .map((candle, index) => `${index === 0 ? 'M' : 'L'} ${candle.x.toFixed(2)} ${candle.closeY.toFixed(2)}`)
        .join(' ');
}

function getCompanyPitch(company: HasdaqCompany) {
    return company.pitch
        || company.slogan
        || company.value_pitch
        || company.listing_pitch
        || company.investment_thesis
        || company.description
        || company.summary
        || 'This company has not written a Hasdaq pitch yet.';
}

function getCompanySlogan(company: HasdaqCompany) {
    const slogan = company.slogan || company.pitch || company.value_pitch || company.listing_pitch || company.investment_thesis || '';
    const source = slogan || getCompanyPitch(company);
    return source
        .split(/[。,.，]/)
        .map(part => part.trim())
        .find(Boolean)
        ?.slice(0, 28) || 'Building the next student studio.';
}

function statusLabel(status?: string | null) {
    if (status === 'listed') return '已上市';
    if (status === 'ipo') return 'IPO 中';
    if (status === 'pending_review') return '待审核';
    if (status === 'paused') return '模拟停牌';
    return '筹备中';
}

function formatPausedReason(reason?: string | null) {
    if (!reason) return '';
    if (reason.includes('Demo pause')) return '模拟停牌：等待维护公告。';
    return reason;
}

export default function HasdaqDashboard({ user }: { user: User | null }) {
    const [overview, setOverview] = useState<HasdaqOverview>({});
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    const loadOverview = async () => {
        setLoading(true);
        setMessage('');
        try {
            const res = await fetch('/api/hasdaq/companies', { cache: 'no-store' });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Hasdaq request failed');
            setOverview(data || {});
        } catch (error) {
            console.error('Hasdaq overview failed:', error);
            setMessage('Hasdaq 暂时加载失败，刷新后可以重试。');
            setOverview({});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadOverview();
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    const allCompanies = useMemo(() => {
        const merged = [
            ...(overview.companies || []),
            ...(overview.officialDemoCompanies || []),
            ...(overview.listed || []),
            ...(overview.listedCompanies || []),
            ...(overview.ipo || []),
            ...(overview.ipoCompanies || []),
        ];
        const seen = new Set<string>();
        return merged.filter(company => {
            const key = String(company.ticker || company.id);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [overview]);

    const officialDemoCompanies = allCompanies.filter(isOfficialDemo);
    const studentCompanies = allCompanies.filter(company => !isOfficialDemo(company));
    const listedCompanies = studentCompanies.filter(company => company.status === 'listed' || company.status === 'paused');
    const ipoCompanies = studentCompanies.filter(company => company.status === 'ipo');
    const hasStudentCompanies = ipoCompanies.length > 0 || listedCompanies.length > 0;
    const allListedCompanies = allCompanies.filter(company => company.status === 'listed' || company.status === 'paused');
    const topMovers = [...listedCompanies].sort((a, b) => getChange(b) - getChange(a)).slice(0, 5);
    const rawPositions = overview.positions || overview.myPositions || allCompanies.filter(company => getPositionShares(company) > 0);
    const myPositions = rawPositions.map(position => {
        const matchingCompany = allCompanies.find(company => (
            String(company.ticker || '') === String(position.ticker || '')
            || Number(company.id) === Number(position.company_id || position.id)
        ));
        return matchingCompany ? { ...matchingCompany, ...position } : position;
    });
    const latestBell = overview.latestBell || [...allListedCompanies]
        .sort((a, b) => new Date(String(b.listed_at || 0)).getTime() - new Date(String(a.listed_at || 0)).getTime())[0];

    return (
        <div className="hasdaq-shell">
            <section className="hasdaq-hero glass-panel">
                <div>
                    <span>Student Simulation Exchange</span>
                    <h1>Hasdaq</h1>
                    <p>学生模拟公司 / 官方示范股，一敲钟就开盘。</p>
                    <div className="hasdaq-hero-actions">
                        <Link href="/hasdaq/apply">申请上市</Link>
                        <button type="button" onClick={loadOverview}>刷新市场</button>
                    </div>
                    <p className="hasdaq-note">备注：Hasdaq 仅用于校内学习与模拟交易；H币交易只代表平台内模拟市场行为，不涉及真实证券、股权或现金收益。</p>
                </div>
                <div className="hasdaq-bell-card">
                    <div className="hasdaq-bell-icon" aria-hidden="true">🔔</div>
                    <span>Opening Bell</span>
                    {latestBell ? (
                        <>
                            <strong>{latestBell.ticker}</strong>
                            <p>{latestBell.name || latestBell.company_name} 最近敲钟上市</p>
                        </>
                    ) : (
                        <>
                            <strong>Hasdaq</strong>
                            <p>下一家公司敲钟后会在这里亮起。</p>
                        </>
                    )}
                </div>
            </section>

            {message && <div className="hasdaq-message">{message}</div>}

            {loading ? (
                <div className="hasdaq-empty glass-panel">Loading Hasdaq market...</div>
            ) : (
                <>
                    <section className="hasdaq-section">
                        <div className="hasdaq-section-head">
                            <div>
                                <span>Official Demo</span>
                                <h2>Hajimi Platform / HJM</h2>
                            </div>
                        </div>
                        {officialDemoCompanies.length === 0 ? (
                            <div className="hasdaq-empty glass-panel">官方示范股正在准备中。</div>
                        ) : (
                            <div className="hasdaq-grid">
                                {officialDemoCompanies.map(company => (
                                    <CompanyCard
                                        key={company.ticker}
                                        company={company}
                                        variant={company.status === 'ipo' ? 'ipo' : 'market'}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="hasdaq-market-layout">
                        <div className="hasdaq-section">
                            <div className="hasdaq-section-head">
                                <div>
                                    <span>Student Market</span>
                                    <h2>学生模拟公司</h2>
                                </div>
                            </div>
                            {!hasStudentCompanies ? (
                                <div className="hasdaq-empty glass-panel">等待第一批学生模拟公司上市。</div>
                            ) : (
                                <div className="hasdaq-student-board">
                                    {ipoCompanies.length > 0 && (
                                        <div>
                                            <div className="hasdaq-subsection-label">IPO 认购中</div>
                                            <div className="hasdaq-grid">
                                                {ipoCompanies.map(company => <CompanyCard key={company.ticker} company={company} variant="ipo" />)}
                                            </div>
                                        </div>
                                    )}
                                    {listedCompanies.length > 0 && (
                                        <div>
                                            <div className="hasdaq-subsection-label">已上市交易</div>
                                            <div className="hasdaq-grid">
                                                {listedCompanies.map(company => <CompanyCard key={company.ticker} company={company} variant="market" />)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <aside className="hasdaq-side-stack">
                            <section className="glass-panel hasdaq-rank-panel">
                                <span>Top Movers</span>
                                <h3>学生涨幅榜</h3>
                                {topMovers.length === 0 ? (
                                    <p>等待第一批学生模拟公司上市。</p>
                                ) : topMovers.map(company => (
                                    <Link key={company.ticker} href={`/hasdaq/${company.ticker}`} className="hasdaq-rank-row">
                                        <strong>{company.ticker}</strong>
                                        <span className={getChange(company) >= 0 ? 'is-up' : 'is-down'}>
                                            {getChange(company) >= 0 ? '+' : ''}{getChange(company).toFixed(1)}%
                                        </span>
                                    </Link>
                                ))}
                            </section>

                            <section className="glass-panel hasdaq-rank-panel">
                                <span>Portfolio</span>
                                <h3>我的持仓</h3>
                                {myPositions.length === 0 ? (
                                    <p>{user ? '还没有持仓。' : '登录后可以查看持仓。'}</p>
                                ) : myPositions.map(company => (
                                    <Link key={company.ticker} href={`/hasdaq/${company.ticker}`} className="hasdaq-rank-row">
                                        <strong>{company.ticker}</strong>
                                        <span className="hasdaq-portfolio-values">
                                            <span>{getPositionShares(company)} 股</span>
                                            <b className={getChange(company) >= 0 ? 'is-up' : 'is-down'}>
                                                {getChange(company) >= 0 ? '+' : ''}{getChange(company).toFixed(1)}%
                                            </b>
                                        </span>
                                    </Link>
                                ))}
                            </section>
                        </aside>
                    </section>
                </>
            )}
        </div>
    );
}

function CompanyCard({ company, variant = 'market' }: { company: HasdaqCompany; variant?: 'ipo' | 'market' }) {
    const change = getChange(company);
    const marketCap = Math.round((Number(company.current_price_milli || 0) / 1000) * Number(company.total_shares || 1000));
    const description = getCompanyPitch(company);
    const volumeToday = Number(company.trade_volume_today ?? company.volume_today ?? 0);
    const pausedReason = formatPausedReason(company.paused_reason || company.trading_paused_reason);
    const officialDemo = isOfficialDemo(company);

    return (
        <Link href={`/hasdaq/${company.ticker}`} className={`hasdaq-card glass-panel is-${company.status} is-${variant}${officialDemo ? ' is-official-demo' : ''}`}>
            <div className="hasdaq-card-head">
                <div className={`hasdaq-company-mark ${getCompanyTheme(company)}`} aria-hidden="true">
                    {getCompanyInitials(company)}
                </div>
                <div className="hasdaq-card-title">
                    <div className="hasdaq-card-meta">
                        <span>{statusLabel(company.status)}</span>
                        {officialDemo && <span className="hasdaq-official-badge">官方示范股</span>}
                        <strong className="hasdaq-ticker-badge">代码：{company.ticker}</strong>
                    </div>
                    <h3>{company.name}</h3>
                </div>
            </div>
            <p className="hasdaq-card-pitch">{description}</p>
            <div className={`hasdaq-card-media is-${variant}`}>
                {variant === 'ipo' && <CompanyPoster company={company} />}
                <MiniTrend company={company} variant={variant} />
            </div>
            {variant === 'ipo' && <IpoProgress company={company} compact />}
            <div className="hasdaq-metrics">
                <span><b>{formatPrice(company.current_price_milli || 1000)}</b> 当前价</span>
                <span className={change >= 0 ? 'is-up' : 'is-down'}><b>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</b> 今日</span>
                <span><b>{marketCap}</b> 市值</span>
                <span><b>{volumeToday}</b> 今日量</span>
            </div>
            {pausedReason && <em>暂停：{pausedReason}</em>}
        </Link>
    );
}

function IpoProgress({ company, compact = false }: { company: HasdaqCompany; compact?: boolean }) {
    const stats = getIpoStats(company);
    return (
        <div className={`hasdaq-ipo-progress${compact ? ' is-compact' : ''}`}>
            <div className="hasdaq-ipo-progress-head">
                <span>发行价 {stats.price.toFixed(0)} H币/股</span>
                <strong>{stats.subscribed}/{stats.total} 已认购</strong>
            </div>
            <div className="hasdaq-progress-track" aria-hidden="true">
                <span style={{ width: `${stats.percent}%` }} />
            </div>
            <div className="hasdaq-ipo-progress-foot">
                <span>剩余 {stats.remaining} 股</span>
                <span>敲钟门槛 {stats.subscribers}/5 人 · {stats.subscribed}/50 股</span>
                <span>单人上限 20 股</span>
            </div>
        </div>
    );
}

function CompanyPoster({ company }: { company: HasdaqCompany }) {
    const initials = getCompanyInitials(company);
    const slogan = getCompanySlogan(company);
    return (
        <div className={`hasdaq-company-poster ${getCompanyTheme(company)}`} aria-hidden="true">
            <div className="hasdaq-poster-grid" />
            <div className="hasdaq-poster-mark">{initials}</div>
            <div className="hasdaq-poster-copy">
                <span>SLOGAN</span>
                <strong>{slogan}</strong>
            </div>
        </div>
    );
}

function MiniTrend({ company, variant = 'market' }: { company: HasdaqCompany; variant?: 'ipo' | 'market' }) {
    const candles = buildMiniCandles(company);
    const change = getChange(company);
    const linePath = getMiniLinePath(candles);
    const first = candles[0];
    const last = candles[candles.length - 1];
    const areaPath = first && last ? `${linePath} L ${last.x.toFixed(2)} 62 L ${first.x.toFixed(2)} 62 Z` : '';

    return (
        <div className={`hasdaq-mini-chart is-${variant}-chart ${change >= 0 ? 'is-up' : 'is-down'}`} aria-hidden="true">
            <svg viewBox="0 0 200 68" focusable="false">
                <path className="hasdaq-mini-grid" d="M8 16 H192 M8 34 H192 M8 52 H192" />
                {areaPath && <path className="hasdaq-mini-area" d={areaPath} />}
                <path className="hasdaq-mini-line" d={linePath} />
                {candles.map((candle, index) => (
                    <circle
                        key={`${company.ticker}-${index}`}
                        className="hasdaq-mini-point"
                        cx={candle.x}
                        cy={candle.closeY}
                        r={index === candles.length - 1 ? 3.2 : 2.2}
                    />
                ))}
            </svg>
            <span>WEEK</span>
        </div>
    );
}
