import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import AdminCoinsPanel from '@/components/AdminCoinsPanel';
import { getSession } from '@/lib/auth';
import { getAdminCoinOverview, getUserById } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export default async function AdminCoinsPage() {
    const session = await getSession();
    if (!session) redirect('/login');

    const user = await getUserById(Number(session.userId));
    if (!user) redirect('/login');
    if (!isAdminRole(user.role)) redirect('/dashboard');

    const overview = await getAdminCoinOverview({ verification: 'verified', accountStatus: 'active' });

    return (
        <Shell user={user}>
            <section className="main-view admin-coins-page">
                <div className="leaderboard-page-hero">
                    <div>
                        <span>Hajimi Coin Admin</span>
                        <h1>H币管理</h1>
                        <p>筛选已认证成员、批量空投 H币、保留单用户手动发放，并审核创作者 token 兑换申请。H币独立于 XP，不影响等级和排行榜。</p>
                    </div>
                </div>
                <AdminCoinsPanel initialOverview={overview} />
            </section>
        </Shell>
    );
}
