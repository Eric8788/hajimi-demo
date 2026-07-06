import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import Shell from '@/components/Shell';
import LeaderboardTabs from '@/components/LeaderboardTabs';
import type { LeaderboardWindow as MemberLeaderboardWindow } from '@/lib/db';
import type { HubLeaderboardWindow, HubRankingMode } from '@/lib/hubRankings';

export const dynamic = 'force-dynamic';

type LeaderboardSearchParams = {
    tab?: string;
    mode?: string;
    window?: string;
    start?: string;
    end?: string;
};

function parseDateParam(value: string | undefined) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year
        || date.getUTCMonth() !== month - 1
        || date.getUTCDate() !== day
    ) {
        return undefined;
    }

    return value;
}

export default async function Page({ searchParams }: { searchParams?: Promise<LeaderboardSearchParams> }) {
    const session = await getSession();
    const user = session ? await getUserById(Number(session.userId)) : null;
    const params = searchParams ? await searchParams : {};
    const initialTab = params.tab === 'hub' ? 'hub' : 'members';
    const hubMode: HubRankingMode = params.mode === 'rating' ? 'rating' : 'heat';
    const rangeStart = parseDateParam(params.start);
    const rangeEnd = parseDateParam(params.end);
    const hasValidRange = Boolean(rangeStart && rangeEnd && rangeStart <= rangeEnd);
    const memberWindow: MemberLeaderboardWindow = params.window === 'custom' && hasValidRange
        ? 'custom'
        : params.window === 'today' || params.window === 'day'
            ? 'day'
            : params.window === 'week' || params.window === 'month' || params.window === 'all'
                ? params.window
                : 'week';
    const hubWindow: HubLeaderboardWindow = params.window === 'custom' && hasValidRange
        ? 'custom'
        : params.window === 'today' || params.window === 'week' || params.window === 'month'
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

                <LeaderboardTabs
                    initialTab={initialTab}
                    defaultMemberWindow={memberWindow}
                    defaultMemberRangeStart={rangeStart}
                    defaultMemberRangeEnd={rangeEnd}
                    defaultHubMode={hubMode}
                    defaultHubWindow={hubWindow}
                    defaultHubRangeStart={rangeStart}
                    defaultHubRangeEnd={rangeEnd}
                />
            </section>
        </Shell>
    );
}
