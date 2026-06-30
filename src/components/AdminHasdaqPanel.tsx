'use client';

import { useEffect, useState } from 'react';

type AdminHasdaqCompany = {
    id?: number | string;
    name?: string | null;
    ticker?: string | null;
    founder_name?: string | null;
    status?: string | null;
    company_type?: 'student' | 'official_demo' | string | null;
    description?: string | null;
    summary?: string | null;
    future_plan?: string | null;
    risk_note?: string | null;
    risk_statement?: string | null;
    current_price_milli?: number | null;
    pool_shares?: number | null;
    public_shares_remaining?: number | null;
    pool_coin_balance?: number | null;
    h_coin_pool?: number | null;
    bell_rang_at?: string | Date | null;
    listed_at?: string | Date | null;
    paused_reason?: string | null;
    trading_paused_reason?: string | null;
    product_count?: number | null;
    ipo_subscription_count?: number | null;
    ipo_subscribed_shares?: number | null;
};

type AdminHasdaqApplication = {
    id?: number | string;
    application_id?: number | string;
    applicant_name?: string | null;
    status?: string | null;
    description?: string | null;
    listing_reason?: string | null;
    future_plan?: string | null;
    risk_note?: string | null;
    risk_statement?: string | null;
    company?: AdminHasdaqCompany;
} & AdminHasdaqCompany;

type AdminHasdaqPayload = {
    applications?: AdminHasdaqApplication[];
    companies?: AdminHasdaqCompany[];
};

function formatTime(value?: string | Date | null) {
    if (!value) return '';
    return new Date(value).toLocaleString('zh-CN');
}

function getBellChecklist(company: AdminHasdaqCompany) {
    const hasProfile = Boolean(company.name && company.ticker && (company.summary || company.description));
    const hasProduct = Number(company.product_count || 0) > 0;
    const ipoOpen = company.status === 'ipo';
    const hasSubscriptions = Number(company.ipo_subscription_count || 0) > 0 || Number(company.ipo_subscribed_shares || 0) > 0;
    const ready = hasProfile && hasProduct && ipoOpen && hasSubscriptions;
    return {
        ready,
        items: [
            { label: '公司资料', ok: hasProfile },
            { label: '成熟产品', ok: hasProduct },
            { label: 'IPO 已开启', ok: ipoOpen },
            { label: '已有认购记录', ok: hasSubscriptions },
            { label: '可敲钟', ok: ready },
        ],
    };
}

export default function AdminHasdaqPanel({ initialOverview }: { initialOverview?: AdminHasdaqPayload }) {
    const [overview, setOverview] = useState<AdminHasdaqPayload>(initialOverview || {});
    const [loading, setLoading] = useState(!initialOverview);
    const [message, setMessage] = useState('');
    const [actingId, setActingId] = useState<number | null>(null);

    const loadOverview = async () => {
        setLoading(true);
        setMessage('');
        try {
            const res = await fetch('/api/admin/hasdaq', { cache: 'no-store' });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Admin Hasdaq request failed');
            setOverview(data || {});
        } catch (error) {
            console.error('Admin Hasdaq load failed:', error);
            setMessage('Hasdaq 审核列表暂时加载失败。');
            setOverview({});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!initialOverview) {
            const timer = window.setTimeout(() => {
                void loadOverview();
            }, 0);
            return () => window.clearTimeout(timer);
        }
        return undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const patch = async (payload: Record<string, unknown>, actingKey: number) => {
        setMessage('');
        setActingId(actingKey);
        try {
            const res = await fetch('/api/admin/hasdaq', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setMessage(data?.error || '操作失败。');
                return;
            }
            setMessage('操作已完成。');
            await loadOverview();
        } catch (error) {
            console.error('Admin Hasdaq action failed:', error);
            setMessage('操作失败，请稍后再试。');
        } finally {
            setActingId(null);
        }
    };

    const reviewApplication = (applicationId: number, action: 'approve' | 'reject') => {
        const note = action === 'reject' ? window.prompt('拒绝原因（可留空）') || '' : '';
        void patch({ action, applicationId, note }, applicationId);
    };

    const bell = (companyId: number) => {
        void patch({ action: 'bell', companyId }, companyId);
    };

    const pause = (companyId: number) => {
        const reason = window.prompt('暂停原因') || '';
        if (!reason.trim()) return;
        void patch({ action: 'pause', companyId, note: reason }, companyId);
    };

    const resume = (companyId: number) => {
        void patch({ action: 'resume', companyId }, companyId);
    };

    const applications = overview.applications || [];
    const companies = overview.companies || [];

    return (
        <div className="admin-verification-panel admin-hasdaq-panel">
            <div className="admin-verification-head">
                <div>
                    <span>Hasdaq Admin</span>
                    <h3>上市审核与市场管理</h3>
                </div>
                <button type="button" onClick={loadOverview}>刷新</button>
            </div>

            {message && <div className="admin-verification-message">{message}</div>}

            {loading ? (
                <p className="admin-verification-empty">Loading Hasdaq admin...</p>
            ) : (
                <>
                    <section className="hasdaq-admin-section">
                        <div className="wallet-section-head">
                            <div>
                                <span>Applications</span>
                                <h2>IPO 申请</h2>
                            </div>
                        </div>
                        {applications.length === 0 ? (
                            <p className="admin-verification-empty">暂无待处理 IPO 申请。</p>
                        ) : (
                            <div className="admin-verification-list">
                                {applications.map(application => {
                                    const company = application.company || application;
                                    const applicationId = Number(application.id || application.application_id);
                                    return (
                                        <article key={applicationId} className="admin-verification-card project-review-card">
                                            <div>
                                                <div className="admin-verification-user">
                                                    <strong>{company.name}</strong>
                                                    <span>{company.ticker}</span>
                                                    <span>{company.founder_name || application.applicant_name || 'Founder'}</span>
                                                    <span>{application.status || company.status}</span>
                                                </div>
                                                <p>{company.description || company.summary || application.description || application.listing_reason}</p>
                                                <div className="project-review-summary">
                                                    未来计划：{company.future_plan || application.future_plan || '未填写'}
                                                </div>
                                                <div className="project-review-notes">
                                                    风险说明：{company.risk_note || company.risk_statement || application.risk_note || application.risk_statement || '未填写'}
                                                </div>
                                            </div>
                                            <div className="admin-verification-actions">
                                                <button type="button" className="is-approve" disabled={actingId === applicationId} onClick={() => reviewApplication(applicationId, 'approve')}>
                                                    批准 IPO
                                                </button>
                                                <button type="button" className="is-reject" disabled={actingId === applicationId} onClick={() => reviewApplication(applicationId, 'reject')}>
                                                    拒绝
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section className="hasdaq-admin-section">
                        <div className="wallet-section-head">
                            <div>
                                <span>Market</span>
                                <h2>已批准公司</h2>
                            </div>
                        </div>
                        {companies.length === 0 ? (
                            <p className="admin-verification-empty">暂无 Hasdaq 公司。</p>
                        ) : (
                            <div className="admin-verification-list">
                                {companies.map(company => {
                                    const checklist = getBellChecklist(company);
                                    return (
                                        <article key={company.id} className="admin-verification-card project-review-card">
                                            <div>
                                                <div className="admin-verification-user">
                                                    <strong>{company.name}</strong>
                                                    <span>{company.ticker}</span>
                                                    <span>{company.status}</span>
                                                    {company.company_type === 'official_demo' && <span>官方示范股</span>}
                                                    {(company.bell_rang_at || company.listed_at) && <span>敲钟 {formatTime(company.bell_rang_at || company.listed_at)}</span>}
                                                </div>
                                                <p>当前价 {Number(company.current_price_milli || 1000) / 1000} H币 · 池内 {Number(company.pool_shares ?? company.public_shares_remaining ?? 0)} 股 / {Number(company.pool_coin_balance ?? company.h_coin_pool ?? 0)} H币</p>
                                                {company.status === 'ipo' && (
                                                    <div className="hasdaq-admin-checklist" aria-label={`${company.ticker || 'Hasdaq'} listing checklist`}>
                                                        {checklist.items.map(item => (
                                                            <span key={item.label} className={item.ok ? 'is-done' : ''}>
                                                                {item.ok ? '✓' : '•'} {item.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {(company.paused_reason || company.trading_paused_reason) && <div className="project-review-notes">暂停原因：{company.paused_reason || company.trading_paused_reason}</div>}
                                            </div>
                                            <div className="admin-verification-actions">
                                                {company.status === 'ipo' && (
                                                    <button type="button" className="is-approve" disabled={actingId === company.id || !checklist.ready} onClick={() => bell(Number(company.id))}>
                                                        敲钟上市
                                                    </button>
                                                )}
                                                {company.status === 'paused' ? (
                                                    <button type="button" className="is-approve" disabled={actingId === company.id} onClick={() => resume(Number(company.id))}>
                                                        恢复
                                                    </button>
                                                ) : (
                                                    <button type="button" className="is-reject" disabled={actingId === company.id} onClick={() => pause(Number(company.id))}>
                                                        暂停
                                                    </button>
                                                )}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
