import type { Project } from '@/lib/db';

export const HUB_LEADERBOARD_TABS = [
    { id: 'today', label: '今日' },
    { id: 'week', label: '本周' },
    { id: 'month', label: '本月' },
] as const;

export const HUB_RANKING_MODES = [
    { id: 'heat', label: '热度榜' },
    { id: 'rating', label: '星级榜' },
] as const;

export type HubLeaderboardWindow = (typeof HUB_LEADERBOARD_TABS)[number]['id'];
export type HubRankingMode = (typeof HUB_RANKING_MODES)[number]['id'];

export type HubLeaderboardStats = {
    uniquePlayers: number;
    effectiveOpens: number;
};

type HubRankableProject = Partial<Project> & {
    id: number | string;
    title?: string | null;
    status?: string | null;
    author?: string | null;
    author_name?: string | null;
};

function toFiniteNumber(value: unknown) {
    const numberValue = Number(value || 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
}

export function getHubDisplayName(name: unknown) {
    const displayName = String(name || '').trim();
    if (!displayName) return 'Unknown';
    return displayName.toLowerCase() === 'eric' ? 'AI Club' : displayName;
}

export function getProjectCommentCount(project: Partial<Project>) {
    return toFiniteNumber(project.commentCount ?? project.comment_count);
}

export function getHubStats(project: Partial<Project>, windowType: HubLeaderboardWindow): HubLeaderboardStats {
    if (windowType === 'month') {
        return {
            uniquePlayers: toFiniteNumber(project.unique_open_count_month),
            effectiveOpens: toFiniteNumber(project.effective_open_count_month ?? project.open_count_month),
        };
    }

    if (windowType === 'week') {
        return {
            uniquePlayers: toFiniteNumber(project.unique_open_count_week),
            effectiveOpens: toFiniteNumber(project.effective_open_count_week ?? project.open_count_week),
        };
    }

    return {
        uniquePlayers: toFiniteNumber(project.unique_open_count_today),
        effectiveOpens: toFiniteNumber(project.effective_open_count_today ?? project.open_count_today),
    };
}

export function getHubRankingCopy(mode: HubRankingMode) {
    if (mode === 'rating') {
        return {
            title: '⭐ 星级榜',
            intro: '按累计星级和评分人数排序，同时展示当前窗口体验数据。',
            tooltipTitle: '星级榜规则',
            tooltip: '先看星级，同星级看评论数，再看评分人数；日/周/月只切换体验数据。',
        };
    }

    return {
        title: '🔥 项目热度榜',
        intro: '按体验人数、星级和有效进入排序。',
        tooltipTitle: '热度榜规则',
        tooltip: '先看体验人数，同人数看星级和评论数，再看有效进入。每人每天最多 3 次有效进入。',
    };
}

function compareTitles(a: HubRankableProject, b: HubRankableProject) {
    return String(a.title || '').localeCompare(String(b.title || ''));
}

function compareByHeat(windowType: HubLeaderboardWindow) {
    return (a: HubRankableProject, b: HubRankableProject) => {
        const statsA = getHubStats(a, windowType);
        const statsB = getHubStats(b, windowType);

        return statsB.uniquePlayers - statsA.uniquePlayers
            || toFiniteNumber(b.rating) - toFiniteNumber(a.rating)
            || getProjectCommentCount(b) - getProjectCommentCount(a)
            || statsB.effectiveOpens - statsA.effectiveOpens
            || toFiniteNumber(b.rating_count) - toFiniteNumber(a.rating_count)
            || compareTitles(a, b);
    };
}

function compareByRatingBoard(windowType: HubLeaderboardWindow) {
    return (a: HubRankableProject, b: HubRankableProject) => {
        const statsA = getHubStats(a, windowType);
        const statsB = getHubStats(b, windowType);

        return toFiniteNumber(b.rating) - toFiniteNumber(a.rating)
            || getProjectCommentCount(b) - getProjectCommentCount(a)
            || toFiniteNumber(b.rating_count) - toFiniteNumber(a.rating_count)
            || statsB.uniquePlayers - statsA.uniquePlayers
            || statsB.effectiveOpens - statsA.effectiveOpens
            || compareTitles(a, b);
    };
}

export function rankHubProjects<T extends HubRankableProject>(
    projects: T[],
    mode: HubRankingMode,
    windowType: HubLeaderboardWindow,
    limit?: number,
) {
    const rankedProjects = [...projects]
        .filter(project => project.status === 'live')
        .sort(mode === 'rating' ? compareByRatingBoard(windowType) : compareByHeat(windowType));

    return typeof limit === 'number' ? rankedProjects.slice(0, Math.max(0, limit)) : rankedProjects;
}

export function recordProjectOpen(projectId: number | string) {
    const payload = JSON.stringify({ projectId });

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon('/api/projects/open', blob)) return;
    }

    void fetch('/api/projects/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
    }).catch(() => {});
}
