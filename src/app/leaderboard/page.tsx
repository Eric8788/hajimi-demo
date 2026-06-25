import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import Shell from '@/components/Shell';
import LeaderboardTabs from '@/components/LeaderboardTabs';
import type { HubLeaderboardWindow, HubRankingMode } from '@/lib/hubRankings';

export const dynamic = 'force-dynamic';

type LeaderboardSearchParams = {
    tab?: string;
    mode?: string;
    window?: string;
};

export default async function Page({ searchParams }: { searchParams?: Promise<LeaderboardSearchParams> }) {
    const session = await getSession();
    const user = session ? await getUserById(Number(session.userId)) : null;
    const params = searchParams ? await searchParams : {};
    const initialTab = params.tab === 'hub' ? 'hub' : 'members';
    const hubMode: HubRankingMode = params.mode === 'rating' ? 'rating' : 'heat';
    const hubWindow: HubLeaderboardWindow = params.window === 'today' || params.window === 'week' || params.window === 'month'
        ? params.window
        : 'month';

    return (
        <Shell user={user}>
            <section className="main-view leaderboard-page">
                <div className="leaderboard-page-hero">
                    <div>
                        <span>AI Club Rankings</span>
                        <h1>🏆 Hall of Fame</h1>
                        <p>这里集中查看成员 XP 和 Hub 项目榜单；Function Hall 只保留前五预览，完整排行在 Rank 里展开。</p>
                    </div>
                </div>

                <LeaderboardTabs initialTab={initialTab} defaultHubMode={hubMode} defaultHubWindow={hubWindow} />
            </section>
        </Shell>
    );
}
