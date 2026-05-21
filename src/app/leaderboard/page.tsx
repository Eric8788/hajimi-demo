import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import Shell from '@/components/Shell';
import LeaderboardWidget from '@/components/LeaderboardWidget';

export const dynamic = 'force-dynamic';

export default async function Page() {
    const session = await getSession();
    const user = session ? await getUserById(Number(session.userId)) : null;

    return (
        <Shell user={user}>
            <section className="main-view leaderboard-page">
                <div className="leaderboard-page-hero">
                    <div>
                        <span>AI Club Rankings</span>
                        <h1>🏆 Hall of Fame</h1>
                        <p>记录大家在 Hajimi 里的活跃贡献。Hub 项目热度榜请前往 Function Hall 查看。</p>
                    </div>
                </div>

                <LeaderboardWidget limit={30} showViewAll={false} />
            </section>
        </Shell>
    );
}
