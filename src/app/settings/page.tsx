import { redirect } from 'next/navigation';
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
                        <p>这里仅保留头像、昵称和个性签名；个人主页的背景图与 badge 请在 Profile 页点击 Edit 调整。</p>
                    </div>
                </div>
                <div className="account-settings-sections">
                    <PublicProfileSettingsPanel user={user} />
                </div>
            </section>
        </Shell>
    );
}
