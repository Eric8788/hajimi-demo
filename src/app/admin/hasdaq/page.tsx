import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import AdminHasdaqPanel from '@/components/AdminHasdaqPanel';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export default async function AdminHasdaqPage() {
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
                        <span>Hasdaq Admin</span>
                        <h1>上市审核</h1>
                        <p>审核学生模拟公司 / 官方示范股 IPO 流程、敲钟上市，并处理异常暂停或恢复交易。</p>
                    </div>
                </div>
                <AdminHasdaqPanel />
            </section>
        </Shell>
    );
}
