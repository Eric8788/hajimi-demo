import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import AdminUsersPanel from '@/components/AdminUsersPanel';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
    const session = await getSession();
    if (!session) redirect('/login');

    const user = await getUserById(Number(session.userId));
    if (!user) redirect('/login');
    if (!isAdminRole(user.role)) redirect('/dashboard');

    return (
        <Shell user={user}>
            <section className="main-view admin-users-page">
                <div className="leaderboard-page-hero">
                    <div>
                        <span>Member Registry</span>
                        <h1>成员管理</h1>
                        <p>维护账号状态和认证资料。实名信息默认折叠，只在管理员详情面板内按需显示。</p>
                    </div>
                </div>
                <AdminUsersPanel />
            </section>
        </Shell>
    );
}
