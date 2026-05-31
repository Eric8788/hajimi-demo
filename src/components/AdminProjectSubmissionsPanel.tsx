'use client';

import { useEffect, useState } from 'react';
import type { ProjectSubmission, ProjectSubmissionStatus } from '@/lib/db';
import { formatHajimiId } from '@/lib/hajimiId';

type SubmissionFilter = ProjectSubmissionStatus | 'all';

export default function AdminProjectSubmissionsPanel() {
    const [submissions, setSubmissions] = useState<ProjectSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [reviewingId, setReviewingId] = useState<number | null>(null);
    const [statusFilter, setStatusFilter] = useState<SubmissionFilter>('pending');

    const loadSubmissions = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/project-submissions?status=${statusFilter}`, { cache: 'no-store' });
            if (!res.ok) throw new Error('Project submissions request failed');
            const data = await res.json();
            setSubmissions(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to load project submissions:', error);
            setSubmissions([]);
            setMessage('项目申请列表暂时加载失败，请稍后刷新。');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSubmissions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]);

    const review = async (submissionId: number, action: 'approve' | 'reject') => {
        const note = action === 'reject' ? window.prompt('拒绝原因（只给管理员看，可留空）') || '' : '';
        setMessage('');
        setReviewingId(submissionId);
        try {
            const res = await fetch('/api/project-submissions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId, action, note }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setMessage(data?.error || '审核失败，请稍后再试。');
                return;
            }

            setMessage(action === 'approve' ? '项目申请已通过。' : '项目申请已拒绝。');
            await loadSubmissions();
        } catch (error) {
            console.error('Failed to review project submission:', error);
            setMessage('审核请求失败，请稍后再试。');
        } finally {
            setReviewingId(null);
        }
    };

    return (
        <div className="admin-verification-panel">
            <div className="admin-verification-head">
                <div>
                    <span>Admin Review</span>
                    <h3>Hub 项目/版本申请</h3>
                </div>
                <button type="button" onClick={loadSubmissions}>刷新</button>
            </div>
            <div className="admin-review-filter-tabs">
                {[
                    ['pending', '待审核'],
                    ['approved', '已通过'],
                    ['rejected', '已拒绝'],
                    ['all', '全部'],
                ].map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        className={statusFilter === value ? 'is-active' : ''}
                        onClick={() => setStatusFilter(value as SubmissionFilter)}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {message && <div className="admin-verification-message">{message}</div>}
            {loading ? (
                <p className="admin-verification-empty">Loading project submissions...</p>
            ) : submissions.length === 0 ? (
                <p className="admin-verification-empty">{statusFilter === 'pending' ? '暂无待审核项目申请。' : '暂无匹配的项目申请记录。'}</p>
            ) : (
                <div className="admin-verification-list">
                    {submissions.map(submission => (
                        <article key={submission.id} className="admin-verification-card project-review-card">
                            <div>
                                <div className="admin-verification-user">
                                    <strong>{submission.author_name}</strong>
                                    <span>{formatHajimiId(submission.author_id)}</span>
                                    <span>{submission.submission_type === 'new_version' ? '新版本' : '新项目'}</span>
                                </div>
                                <p>
                                    {submission.emoji} {submission.title}
                                    {submission.project_title ? ` · 更新 ${submission.project_title}` : ''}
                                    {submission.url ? ` · ${submission.url}` : ''}
                                </p>
                                <div className="project-review-summary">{submission.description}</div>
                                {submission.version_notes && <div className="project-review-notes">版本说明：{submission.version_notes}</div>}
                                {submission.cover_url && (
                                    <a className="project-review-cover-link" href={submission.cover_url} target="_blank" rel="noopener noreferrer">
                                        <img src={submission.cover_url} alt="" loading="lazy" />
                                        <span>查看提交的封面截图</span>
                                    </a>
                                )}
                                <div className="project-review-tags">
                                    {submission.tags.map(tag => <span key={tag}>{tag}</span>)}
                                </div>
                            </div>
                            {submission.status === 'pending' ? (
                                <div className="admin-verification-actions">
                                    <button type="button" className="is-approve" onClick={() => review(submission.id, 'approve')} disabled={reviewingId === submission.id}>
                                        {reviewingId === submission.id ? '处理中' : '通过'}
                                    </button>
                                    <button type="button" className="is-reject" onClick={() => review(submission.id, 'reject')} disabled={reviewingId === submission.id}>
                                        拒绝
                                    </button>
                                </div>
                            ) : (
                                <div className="admin-review-status">
                                    <strong>{submission.status === 'approved' ? '已通过' : '已拒绝'}</strong>
                                    <span>{submission.reviewed_at ? new Date(submission.reviewed_at).toLocaleString('zh-CN') : '已处理'}</span>
                                    {submission.review_note && <span>备注：{submission.review_note}</span>}
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
