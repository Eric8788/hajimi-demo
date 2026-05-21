import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import AdminProjectSubmissionsPanel from '@/components/AdminProjectSubmissionsPanel';

export const dynamic = 'force-dynamic';

export default async function Page() {
    const session = await getSession();
    if (!session) redirect('/login');

    const user = await getUserById(Number(session.userId));
    if (!user) redirect('/login');
    if (!isAdminRole(user.role)) redirect('/dashboard');

    return (
        <Shell user={user}>
            <section className="main-view admin-verification-page">
                <div className="leaderboard-page-hero">
                    <div>
                        <span>Hub Review</span>
                        <h1>项目申请审核</h1>
                        <p>项目和新版本需要通过申请流发布，避免学生误操作覆盖 Hub 内容。</p>
                    </div>
                </div>
                <AdminProjectSubmissionsPanel />
            </section>
        </Shell>
    );
}
