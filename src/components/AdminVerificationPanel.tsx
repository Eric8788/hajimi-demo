'use client';

import { useEffect, useState } from 'react';
import type { VerificationRequest } from '@/lib/db';
import { formatHajimiId } from '@/lib/hajimiId';

export default function AdminVerificationPanel() {
    const [requests, setRequests] = useState<VerificationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    const loadRequests = async () => {
        setLoading(true);
        const res = await fetch('/api/admin/verifications', { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            setRequests(Array.isArray(data) ? data : []);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadRequests();
    }, []);

    const review = async (userId: number, action: 'approve' | 'reject') => {
        const note = action === 'reject' ? window.prompt('拒绝原因（只给管理员看，可留空）') || '' : '';
        setMessage('');
        const res = await fetch('/api/admin/verifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, action, note }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => null);
            setMessage(data?.error || '审核失败，请稍后再试。');
            return;
        }

        setMessage(action === 'approve' ? '已通过认证。' : '已拒绝认证。');
        await loadRequests();
    };

    return (
        <div className="admin-verification-panel">
            <div className="admin-verification-head">
                <div>
                    <span>Admin Review</span>
                    <h3>Hajimi 认证审核</h3>
                </div>
                <button type="button" onClick={loadRequests}>刷新</button>
            </div>
            {message && <div className="admin-verification-message">{message}</div>}
            {loading ? (
                <p className="admin-verification-empty">Loading verification requests...</p>
            ) : requests.length === 0 ? (
                <p className="admin-verification-empty">暂无待审核认证。</p>
            ) : (
                <div className="admin-verification-list">
                    {requests.map(request => (
                        <article key={request.id} className={`admin-verification-card${request.has_verified_student_id_conflict ? ' has-conflict' : ''}${request.has_name_identity_conflict ? ' has-soft-conflict' : ''}`}>
                            <div>
                                <div className="admin-verification-user">
                                    <strong>{request.username}</strong>
                                    <span>{formatHajimiId(request.id)}</span>
                                    <span>{request.role}</span>
                                </div>
                                <p>
                                    {request.verification_type === 'teacher' ? '老师认证' : '学生认证'} · Name: {request.verified_name}
                                    {request.verified_grade ? ` · ${request.verified_grade}` : ''}
                                    {request.verified_subject ? ` · ${request.verified_subject}` : ''}
                                    {request.student_id_last4 ? ` · 学号后四位 ${request.student_id_last4}` : ''}
                                    {request.verification_submitted_at ? ` · ${new Date(request.verification_submitted_at).toLocaleString('zh-CN')}` : ''}
                                </p>
                                {request.has_verified_student_id_conflict && (
                                    <div className="admin-verification-conflict is-strong">强冲突：已有认证账号使用相同学号，请确认主号。</div>
                                )}
                                {request.has_name_identity_conflict && (
                                    <div className="admin-verification-conflict is-soft">可能重名/可能小号：同 Name + {request.verification_type === 'teacher' ? '科目' : '年级'} 已有申请或认证。</div>
                                )}
                            </div>
                            <div className="admin-verification-actions">
                                <button type="button" className="is-approve" onClick={() => review(request.id, 'approve')}>通过</button>
                                <button type="button" className="is-reject" onClick={() => review(request.id, 'reject')}>拒绝</button>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
