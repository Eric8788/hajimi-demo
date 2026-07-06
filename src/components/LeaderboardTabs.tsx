'use client';

import { useState } from 'react';
import LeaderboardWidget from './LeaderboardWidget';
import HubLeaderboardWidget from './HubLeaderboardWidget';
import type { LeaderboardWindow as MemberLeaderboardWindow } from '@/lib/db';
import type { HubLeaderboardWindow, HubRankingMode } from '@/lib/hubRankings';

type LeaderboardTab = 'members' | 'hub';

export default function LeaderboardTabs({
    initialTab = 'members',
    defaultMemberWindow = 'week',
    defaultMemberRangeStart,
    defaultMemberRangeEnd,
    defaultHubMode = 'heat',
    defaultHubWindow = 'month',
    defaultHubRangeStart,
    defaultHubRangeEnd,
}: {
    initialTab?: LeaderboardTab;
    defaultMemberWindow?: MemberLeaderboardWindow;
    defaultMemberRangeStart?: string;
    defaultMemberRangeEnd?: string;
    defaultHubMode?: HubRankingMode;
    defaultHubWindow?: HubLeaderboardWindow;
    defaultHubRangeStart?: string;
    defaultHubRangeEnd?: string;
}) {
    const [activeTab, setActiveTab] = useState<LeaderboardTab>(initialTab);

    return (
        <div className="leaderboard-tabs-shell">
            <div className="leaderboard-tab-bar" aria-label="Rank sections">
                <button
                    type="button"
                    className={activeTab === 'members' ? 'is-active' : ''}
                    onClick={() => setActiveTab('members')}
                >
                    🏆 成员 XP
                </button>
                <button
                    type="button"
                    className={activeTab === 'hub' ? 'is-active' : ''}
                    onClick={() => setActiveTab('hub')}
                >
                    🚀 Hub 项目
                </button>
            </div>

            {activeTab === 'members' ? (
                <LeaderboardWidget
                    limit={30}
                    showViewAll={false}
                    defaultWindow={defaultMemberWindow}
                    defaultRangeStart={defaultMemberRangeStart}
                    defaultRangeEnd={defaultMemberRangeEnd}
                />
            ) : (
                <HubLeaderboardWidget
                    limit={30}
                    defaultMode={defaultHubMode}
                    defaultWindow={defaultHubWindow}
                    defaultRangeStart={defaultHubRangeStart}
                    defaultRangeEnd={defaultHubRangeEnd}
                />
            )}
        </div>
    );
}
