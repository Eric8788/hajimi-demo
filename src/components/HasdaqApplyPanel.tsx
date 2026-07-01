'use client';

import { useEffect, useState } from 'react';
import type { Project, User } from '@/lib/db';
import { canUseMemberInteractions, getInteractionBlockedMessage } from '@/lib/access';

type MemberDraft = {
    username: string;
    allocationPercent: number;
};

const HASDAQ_FOUNDER_SHARE_POOL = 700;

export default function HasdaqApplyPanel({ user }: { user: User | null }) {
    const canApply = canUseMemberInteractions(user);
    const [projects, setProjects] = useState<Project[]>([]);
    const [name, setName] = useState('');
    const [ticker, setTicker] = useState('');
    const [description, setDescription] = useState('');
    const [members, setMembers] = useState<MemberDraft[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [manualTitle, setManualTitle] = useState('');
    const [manualDescription, setManualDescription] = useState('');
    const [proofNote, setProofNote] = useState('');
    const [proofImageName, setProofImageName] = useState('');
    const [proofImageDataUrl, setProofImageDataUrl] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetch('/api/projects', { cache: 'no-store' })
            .then(res => res.ok ? res.json() : [])
            .then(data => setProjects(Array.isArray(data) ? data : []))
            .catch(error => {
                console.warn('Hasdaq project options unavailable:', error);
                setProjects([]);
            });
    }, []);

    const addMember = () => {
        setMembers(current => [...current, { username: '', allocationPercent: 0 }]);
    };

    const updateMember = (index: number, patch: Partial<MemberDraft>) => {
        setMembers(current => current.map((member, itemIndex) => itemIndex === index ? { ...member, ...patch } : member));
    };

    const removeMember = (index: number) => {
        setMembers(current => current.filter((_, itemIndex) => itemIndex !== index));
    };

    const memberAllocationPreview = members.map((member, index) => {
        const percent = Math.max(0, Math.min(100, Math.round(Number(member.allocationPercent || 0))));
        return {
            key: `${index}-${member.username || 'member'}`,
            name: member.username.trim() || `成员 ${index + 1}`,
            percent,
        };
    });
    const memberAllocationTotal = memberAllocationPreview.reduce((sum, member) => sum + member.percent, 0);
    const allocationDenominator = Math.max(100, memberAllocationTotal);
    const previewMembers = memberAllocationPreview.map(member => ({
        ...member,
        shares: Math.floor(HASDAQ_FOUNDER_SHARE_POOL * member.percent / allocationDenominator),
    }));
    const previewFounderPercent = Math.max(0, 100 - memberAllocationTotal);
    const previewFounderShares = memberAllocationTotal > 100
        ? 0
        : HASDAQ_FOUNDER_SHARE_POOL - previewMembers.reduce((sum, member) => sum + member.shares, 0);

    const updateProofImage = (file: File | undefined) => {
        setProofImageName(file?.name || '');
        setProofImageDataUrl('');
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setProofImageDataUrl(typeof reader.result === 'string' ? reader.result : '');
        };
        reader.readAsDataURL(file);
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setMessage('');

        if (!canApply) {
            setMessage(user ? getInteractionBlockedMessage(user, '申请 Hasdaq 上市') : '登录并完成 Hajimi 认证后可以申请 Hasdaq 上市。');
            return;
        }

        const normalizedTicker = ticker.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        if (name.trim().length < 2) {
            setMessage('公司名称至少 2 个字符。');
            return;
        }
        if (normalizedTicker.length < 3) {
            setMessage('股票代码需要 3-6 个大写字母或数字。');
            return;
        }
        const companyNarrative = description.trim();
        if (companyNarrative.length < 12) {
            setMessage('公司说明至少需要 12 个字，请写清作品、计划和风险。');
            return;
        }
        if (!selectedProjectId && manualTitle.trim().length < 2) {
            setMessage('请绑定一个 Function Hall 项目，或填写手动成熟项目证明。');
            return;
        }

        setSubmitting(true);
        try {
            const selectedProject = selectedProjectId ? projects.find(project => Number(project.id) === Number(selectedProjectId)) : null;
            const proofDescription = [
                manualDescription || selectedProject?.description || '',
                proofImageName ? `证明图片：${proofImageName}` : '',
            ].filter(Boolean).join('\n');
            const companyRes = await fetch('/api/hasdaq/company', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    ticker: normalizedTicker,
                    description: companyNarrative,
                    summary: companyNarrative,
                    futurePlan: companyNarrative,
                    riskNote: companyNarrative,
                    riskStatement: companyNarrative,
                    members: members
                        .map(member => ({
                            username: member.username.trim(),
                            allocationBps: Math.max(0, Math.min(100, Math.round(Number(member.allocationPercent || 0)))) * 100,
                            equityPercent: Math.max(0, Math.min(100, Math.round(Number(member.allocationPercent || 0)))),
                        }))
                        .filter(member => member.username),
                    products: [{
                        projectId: selectedProjectId ? Number(selectedProjectId) : null,
                        title: manualTitle || selectedProject?.title || '',
                        description: proofDescription,
                        proofUrl: proofImageDataUrl,
                        proofNote: proofNote || proofDescription || selectedProject?.description || '',
                    }],
                }),
            });
            const companyData = await companyRes.json().catch(() => null);
            if (!companyRes.ok) {
                setMessage(companyData?.error || '公司资料保存失败。');
                return;
            }

            const applicationRes = await fetch('/api/hasdaq/applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: companyData?.company?.company?.id || companyData?.company?.id || companyData?.companyId,
                    listingReason: companyNarrative,
                    riskStatement: companyNarrative,
                }),
            });
            const applicationData = await applicationRes.json().catch(() => null);
            if (!applicationRes.ok) {
                setMessage(applicationData?.error || '上市申请提交失败。公司草稿已保存，可以补充后再提交。');
                return;
            }

            setMessage('Hasdaq 上市申请已提交，等待管理员审核。');
        } catch (error) {
            console.error('Hasdaq application failed:', error);
            setMessage('上市申请提交失败，请稍后再试。');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form className="hasdaq-apply glass-panel" onSubmit={submit}>
            <div className="hasdaq-section-head">
                <div>
                    <span>Listing Application</span>
                    <h2>Hasdaq 上市申请</h2>
                </div>
                <strong>至少 1 个成熟项目</strong>
            </div>

            <div className="hasdaq-form-grid">
                <label>
                    <span>公司 / Studio 名称</span>
                    <input className="glass-input" value={name} maxLength={80} onChange={event => setName(event.target.value)} placeholder="Nova Learning Studio" />
                </label>
                <label>
                    <span>股票代码</span>
                    <input className="glass-input" value={ticker} maxLength={6} onChange={event => setTicker(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="NOVA" />
                </label>
            </div>

            <label>
                <span>公司说明</span>
                <textarea className="glass-input" value={description} maxLength={900} onChange={event => setDescription(event.target.value)} placeholder="写清：这家公司做什么、已有作品、接下来 1-2 个月计划、可能遇到的风险。" />
            </label>

            <section className="hasdaq-apply-block">
                <div className="hasdaq-section-head">
                    <div>
                        <span>Team</span>
                        <h2>成员与创始股比例</h2>
                    </div>
                    <button type="button" onClick={addMember}>添加成员</button>
                </div>
                <p className="hasdaq-note">主理人默认拥有未分配的创始比例。成员需要接受邀请后才能提交完整 IPO。</p>
                {members.map((member, index) => (
                    <div className="hasdaq-member-row" key={`${index}-${member.username}`}>
                        <label>
                            <span>成员 username</span>
                            <input className="glass-input" value={member.username} onChange={event => updateMember(index, { username: event.target.value })} placeholder="例如 ivy" />
                        </label>
                        <label>
                            <span>创始股比例</span>
                            <input className="glass-input" inputMode="numeric" value={member.allocationPercent ? String(member.allocationPercent) : ''} onChange={event => updateMember(index, { allocationPercent: Number(event.target.value.replace(/[^\d]/g, '').slice(0, 3)) })} placeholder="30 = 30%" />
                        </label>
                        <button type="button" onClick={() => removeMember(index)}>移除</button>
                    </div>
                ))}
                <div className="hasdaq-founder-preview">
                    <div className="hasdaq-founder-preview-head">
                        <span>创始股分配预览</span>
                        <strong>{HASDAQ_FOUNDER_SHARE_POOL} 股</strong>
                    </div>
                    <div className="hasdaq-founder-preview-row">
                        <span>主理人（你）</span>
                        <strong>{previewFounderShares} 股</strong>
                        <em>{previewFounderPercent}%</em>
                    </div>
                    {previewMembers.map(member => (
                        <div className="hasdaq-founder-preview-row" key={member.key}>
                            <span>{member.name}</span>
                            <strong>{member.shares} 股</strong>
                            <em>{member.percent}%</em>
                        </div>
                    ))}
                    {memberAllocationTotal > 100 && (
                        <p className="hasdaq-founder-preview-warning">成员比例超过 100%，系统会按填写比例重新折算；建议提交前调到 100% 以内。</p>
                    )}
                </div>
            </section>

            <section className="hasdaq-apply-block">
                <div className="hasdaq-section-head">
                    <div>
                        <span>Mature Product</span>
                        <h2>成熟项目证明</h2>
                    </div>
                </div>
                <label>
                    <span>绑定 Function Hall 项目</span>
                    <select className="glass-input" value={selectedProjectId} onChange={event => setSelectedProjectId(event.target.value)}>
                        <option value="">不绑定，使用手动证明</option>
                        {projects.map(project => (
                            <option key={project.id} value={project.id}>{project.title}</option>
                        ))}
                    </select>
                </label>
                <div className="hasdaq-form-grid">
                    <label>
                        <span>手动证明标题</span>
                        <input className="glass-input" value={manualTitle} maxLength={120} onChange={event => setManualTitle(event.target.value)} placeholder="本地工具 / 离线 Demo 名称" />
                    </label>
                    <div className="hasdaq-file-field">
                        <span>上传截图 / 证明图</span>
                        <input id="hasdaq-proof-image" className="hasdaq-file-input" type="file" accept="image/*" onChange={event => updateProofImage(event.target.files?.[0])} />
                        <label htmlFor="hasdaq-proof-image" className="hasdaq-file-picker">
                            <strong>{proofImageName ? '更换图片' : '上传证明图'}</strong>
                            <small>{proofImageName || '项目截图、演示照片或本地运行画面'}</small>
                        </label>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {proofImageDataUrl && <img src={proofImageDataUrl} alt="成熟项目证明预览" className="hasdaq-proof-preview" />}
                    </div>
                </div>
                <label>
                    <span>证明说明</span>
                    <textarea className="glass-input" value={manualDescription || proofNote} maxLength={500} onChange={event => {
                        setManualDescription(event.target.value);
                        setProofNote(event.target.value);
                    }} placeholder="说明这个项目为什么已经完整可用。" />
                </label>
            </section>

            <button className="hasdaq-primary-button" type="submit" disabled={submitting || !canApply}>
                {submitting ? '提交中...' : '提交 Hasdaq IPO 申请'}
            </button>
            {message && <p className="hasdaq-message">{message}</p>}
        </form>
    );
}
