import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { isAdminRole } from '@/lib/roles';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import AdminVerificationPanel from '@/components/AdminVerificationPanel';

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
                        <span>Hajimi Trust</span>
                        <h1>认证审核</h1>
                        <p>通过认证后，成员可以发帖并进入 Hall of Fame。</p>
                    </div>
                </div>
                <AdminVerificationPanel />
            </section>
        </Shell>
    );
}
