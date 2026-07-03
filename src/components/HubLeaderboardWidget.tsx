'use client';

import { useEffect, useState } from 'react';
import type { Project } from '@/lib/db';
import { cachedJson } from '@/lib/clientJsonCache';
import { getImageDisplayUrl } from '@/lib/imageProxy';
import AnimatedNumber from '@/components/reactbits/AnimatedNumber';
import SpotlightCard from '@/components/reactbits/SpotlightCard';
import {
    getHubDisplayName,
    getHubRankingCopy,
    getHubStats,
    getProjectCommentCount,
    HUB_LEADERBOARD_TABS,
    HUB_RANKING_MODES,
    rankHubProjects,
    recordProjectOpen,
    type HubLeaderboardWindow,
    type HubRankingMode,
} from '@/lib/hubRankings';

type HubLeaderboardProject = Project & {
    author?: string | null;
    coverUrl?: string | null;
};

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';

function isValidCoverUrl(url: unknown) {
    if (typeof url !== 'string') return false;
    return /^https?:\/\//i.test(url.trim());
}

function formatShanghaiDate(date: Date) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: SHANGHAI_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function getDefaultCustomRange() {
    const today = formatShanghaiDate(new Date());
    return {
        startDate: `${today.slice(0, 8)}01`,
        endDate: today,
    };
}

function isValidRange(startDate: string, endDate: string) {
    return Boolean(startDate && endDate && startDate <= endDate);
}

export default function HubLeaderboardWidget({
    limit = 30,
    defaultWindow = 'month',
    defaultMode = 'heat',
    defaultRangeStart,
    defaultRangeEnd,
}: {
    limit?: number;
    defaultWindow?: HubLeaderboardWindow;
    defaultMode?: HubRankingMode;
    defaultRangeStart?: string;
    defaultRangeEnd?: string;
}) {
    const [projects, setProjects] = useState<HubLeaderboardProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [windowType, setWindowType] = useState<HubLeaderboardWindow>(defaultWindow);
    const [rankingMode, setRankingMode] = useState<HubRankingMode>(defaultMode);
    const [customStartDate, setCustomStartDate] = useState(() => defaultRangeStart || getDefaultCustomRange().startDate);
    const [customEndDate, setCustomEndDate] = useState(() => defaultRangeEnd || getDefaultCustomRange().endDate);
    const hasValidCustomRange = isValidRange(customStartDate, customEndDate);
    const statsWindowType: HubLeaderboardWindow = windowType === 'custom' && hasValidCustomRange ? 'custom' : windowType === 'custom' ? 'month' : windowType;

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        const shouldLoadCustomStats = windowType === 'custom' && hasValidCustomRange;
        const statsQuery = shouldLoadCustomStats
            ? `?start=${encodeURIComponent(customStartDate)}&end=${encodeURIComponent(customEndDate)}`
            : '';
        const statsCacheKey = shouldLoadCustomStats
            ? `projects:stats:${customStartDate}:${customEndDate}`
            : 'projects:stats';

        setLoading(true);
        setError('');

        Promise.all([
            cachedJson<HubLeaderboardProject[]>('projects:list', '/api/projects', 60_000, { signal: controller.signal }),
            cachedJson<Partial<HubLeaderboardProject>[]>(statsCacheKey, `/api/projects/stats${statsQuery}`, 60_000, { signal: controller.signal }),
        ])
            .then(([projectRows, statRows]) => {
                if (!active) return;
                const liveProjects = Array.isArray(projectRows) ? projectRows : [];
                const statsById = new Map<number, Partial<HubLeaderboardProject>>(
                    Array.isArray(statRows) ? statRows.map(item => [Number(item.id), item]) : [],
                );

                setProjects(liveProjects.map(project => ({
                    ...project,
                    ...(statsById.get(Number(project.id)) || {}),
                })));
            })
            .catch(error => {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                if (!active) return;
                console.error('Hub leaderboard failed to load:', error);
                setProjects([]);
                setError('Hub 项目榜暂时加载失败，稍后再试。');
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, [customEndDate, customStartDate, hasValidCustomRange, windowType]);

    const rankingCopy = getHubRankingCopy(rankingMode);
    const rankedProjects = rankHubProjects(projects, rankingMode, statsWindowType, limit);

    if (loading) {
        return (
            <SpotlightCard className="glass-card full-width leaderboard-card leaderboard-card-loading" spotlightColor="rgba(55, 198, 208, 0.14)">
                <p>Loading Hub Rankings...</p>
            </SpotlightCard>
        );
    }

    return (
        <SpotlightCard className="glass-card full-width leaderboard-card hub-rank-card" spotlightColor="rgba(55, 198, 208, 0.18)">
            <div className="leaderboard-head hub-rank-head">
                <div className="leaderboard-title-button hub-rank-title">
                    <h3>{rankingCopy.title}</h3>
                    <span>{rankingCopy.intro}</span>
                </div>
                <div className="hub-rank-rule">
                    <strong>{rankingCopy.tooltipTitle}</strong>
                    <span>{rankingCopy.tooltip}</span>
                </div>
            </div>

            <div className="leaderboard-controls hub-rank-controls">
                <div>
                    {HUB_RANKING_MODES.map(mode => (
                        <button
                            key={mode.id}
                            type="button"
                            className={rankingMode === mode.id ? 'is-active' : ''}
                            onClick={() => setRankingMode(mode.id)}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>
                <div>
                    {HUB_LEADERBOARD_TABS.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            className={windowType === tab.id ? 'is-active' : ''}
                            onClick={() => setWindowType(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        className={windowType === 'custom' ? 'is-active' : ''}
                        onClick={() => setWindowType('custom')}
                    >
                        自定义
                    </button>
                </div>
            </div>

            <div className="hub-rank-date-range" aria-label="Hub ranking custom date range">
                <label>
                    <span>开始</span>
                    <input
                        type="date"
                        value={customStartDate}
                        max={customEndDate}
                        onChange={event => {
                            const nextStartDate = event.target.value;
                            setCustomStartDate(nextStartDate);
                            if (nextStartDate && customEndDate && nextStartDate > customEndDate) {
                                setCustomEndDate(nextStartDate);
                            }
                            setWindowType('custom');
                        }}
                    />
                </label>
                <label>
                    <span>结束</span>
                    <input
                        type="date"
                        value={customEndDate}
                        min={customStartDate}
                        onChange={event => {
                            const nextEndDate = event.target.value;
                            setCustomEndDate(nextEndDate);
                            if (customStartDate && nextEndDate && nextEndDate < customStartDate) {
                                setCustomStartDate(nextEndDate);
                            }
                            setWindowType('custom');
                        }}
                    />
                </label>
            </div>

            <div className="hub-rank-list">
                {rankedProjects.map((project, index) => {
                    const stats = getHubStats(project, statsWindowType);
                    const commentCount = getProjectCommentCount(project);
                    const coverUrl = isValidCoverUrl(project.cover_url || project.coverUrl)
                        ? getImageDisplayUrl(String(project.cover_url || project.coverUrl))
                        : '';

                    return (
                        <a
                            key={project.id}
                            className={`hub-rank-row${index < 3 ? ` is-top-${index + 1}` : ''}`}
                            href={project.url || '#'}
                            target={project.url ? '_blank' : undefined}
                            rel={project.url ? 'noopener noreferrer' : undefined}
                            onClick={() => recordProjectOpen(project.id)}
                        >
                            <div className="hub-rank-number">{index + 1}</div>
                            <div className="hub-rank-cover">
                                {coverUrl ? (
                                    <img src={coverUrl} alt="" loading="lazy" decoding="async" />
                                ) : (
                                    <span>{project.emoji || '🚀'}</span>
                                )}
                            </div>
                            <div className="hub-rank-main">
                                <div className="hub-rank-titleline">
                                    <strong>{project.title}</strong>
                                    <span>by {getHubDisplayName(project.author_name || project.author)}</span>
                                </div>
                            </div>
                            <div className="hub-rank-metrics">
                                {rankingMode === 'heat' ? (
                                    <>
                                        <span><b><AnimatedNumber value={stats.uniquePlayers} /></b> 人体验</span>
                                        <span><b><AnimatedNumber value={stats.effectiveOpens} /></b> 次有效进入</span>
                                    </>
                                ) : (
                                    <>
                                        <span><b>⭐ {Number(project.rating || 0).toFixed(1)}</b> <AnimatedNumber value={project.rating_count} /> 评分</span>
                                        <span><b>💬 <AnimatedNumber value={commentCount} /></b> 评论</span>
                                    </>
                                )}
                            </div>
                        </a>
                    );
                })}

                {rankedProjects.length === 0 && (
                    <p className="leaderboard-empty">{error || 'Hub 项目榜暂时还没有可展示项目。'}</p>
                )}
            </div>
        </SpotlightCard>
    );
}
