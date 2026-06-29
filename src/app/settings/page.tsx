import { redirect } from 'next/navigation';
import AccountSettingsPanel from '@/components/AccountSettingsPanel';
import PublicProfileSettingsPanel from '@/components/PublicProfileSettingsPanel';
import Shell from '@/components/Shell';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
    const session = await getSession();
    if (!session) redirect('/login');

    const user = await getUserById(Number(session.userId));
    if (!user) redirect('/login');

    return (
        <Shell user={user}>
            <section className="main-view account-settings-page">
                <div className="leaderboard-page-hero account-settings-hero">
                    <div>
                        <span>Settings</span>
                        <h1>个人设置</h1>
                        <p>统一管理公开资料、头像、登录安全、Hajimi 认证和退出登录。</p>
                    </div>
                </div>
                <div className="account-settings-sections">
                    <PublicProfileSettingsPanel user={user} />
                    <AccountSettingsPanel user={user} />
                </div>
            </section>
        </Shell>
    );
}
