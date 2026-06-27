import { redirect } from 'next/navigation';
import AccountSettingsPanel from '@/components/AccountSettingsPanel';
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
                        <h1>账号设置</h1>
                        <p>管理登录、安全、认证与账号操作。公开主页内容请回到 Profile 使用 Edit 修改。</p>
                    </div>
                </div>
                <AccountSettingsPanel user={user} />
            </section>
        </Shell>
    );
}
