import Link from 'next/link';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import { getSession } from '@/lib/auth';
import { getAdminAuditHistory, getAdminReviewSummary, getUserById } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
    const session = await getSession();
    if (!session) redirect('/login');

    const user = await getUserById(Number(session.userId));
    if (!user) redirect('/login');
    if (!isAdminRole(user.role)) redirect('/dashboard');

    const [summary, history] = await Promise.all([
        getAdminReviewSummary(),
        getAdminAuditHistory('all', 6),
    ]);

    return (
        <Shell user={user}>
            <section className="main-view admin-console-page">
                <div className="leaderboard-page-hero admin-console-hero">
                    <div>
                        <span>Hajimi Admin</span>
                        <h1>管理员中心</h1>
                        <p>集中处理认证、Hub 项目申请、成员账号维护和审核历史。实名信息只在管理员入口按需查看，不进入公开页面。</p>
                    </div>
                    <div className="admin-console-stats">
                        <div>
                            <strong>{summary.totalCount}</strong>
                            <span>待审核</span>
                        </div>
                        <div>
                            <strong>{summary.verificationCount}</strong>
                            <span>认证</span>
                        </div>
                        <div>
                            <strong>{summary.projectSubmissionCount}</strong>
                            <span>项目</span>
                        </div>
                    </div>
                </div>

                <div className="admin-console-grid">
                    <Link href="/admin/verifications" className="admin-console-card">
                        <span>✅</span>
                        <h2>认证审核</h2>
                        <p>查看待处理的学生/老师认证申请，确认 Name、年级/科目和学号后四位。</p>
                        <strong>{summary.verificationCount} 个待处理</strong>
                    </Link>
                    <Link href="/admin/project-submissions" className="admin-console-card">
                        <span>🚀</span>
                        <h2>项目申请</h2>
                        <p>审核 Function Hall 新项目和新版本申请，通过后写入 live Hub 数据。</p>
                        <strong>{summary.projectSubmissionCount} 个待处理</strong>
                    </Link>
                    <Link href="/admin/users" className="admin-console-card is-featured">
                        <span>🛡️</span>
                        <h2>成员管理</h2>
                        <p>按需查看实名资料，维护认证信息，停用或恢复账号。</p>
                        <strong>进入管理台</strong>
                    </Link>
                </div>

                <section className="admin-verification-panel admin-console-history">
                    <div className="admin-verification-head">
                        <div>
                            <span>Review Timeline</span>
                            <h3>最近审核记录</h3>
                        </div>
                    </div>
                    {history.length === 0 ? (
                        <p className="admin-verification-empty">暂无审核历史。之后通过/拒绝认证和项目申请会出现在这里。</p>
                    ) : (
                        <div className="admin-audit-list">
                            {history.map(event => (
                                <article key={`${event.id}-${event.event_type}`} className="admin-audit-row">
                                    <span className="admin-audit-dot" />
                                    <div>
                                        <strong>{event.summary}</strong>
                                        <p>
                                            {event.actor_name ? `by ${event.actor_name}` : 'legacy record'}
                                            {event.target_username ? ` · ${event.target_username}` : ''}
                                            {' · '}
                                            {new Date(event.created_at).toLocaleString('zh-CN')}
                                        </p>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </section>
        </Shell>
    );
}
