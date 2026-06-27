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

function isValidCoverUrl(url: unknown) {
    if (typeof url !== 'string') return false;
    return /^https?:\/\//i.test(url.trim());
}

export default function HubLeaderboardWidget({
    limit = 30,
    defaultWindow = 'month',
    defaultMode = 'heat',
}: {
    limit?: number;
    defaultWindow?: HubLeaderboardWindow;
    defaultMode?: HubRankingMode;
}) {
    const [projects, setProjects] = useState<HubLeaderboardProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [windowType, setWindowType] = useState<HubLeaderboardWindow>(defaultWindow);
    const [rankingMode, setRankingMode] = useState<HubRankingMode>(defaultMode);

    useEffect(() => {
        const controller = new AbortController();
        let active = true;

        setLoading(true);
        setError('');

        Promise.all([
            cachedJson<HubLeaderboardProject[]>('projects:list', '/api/projects', 60_000, { signal: controller.signal }),
            cachedJson<Partial<HubLeaderboardProject>[]>('projects:stats', '/api/projects/stats', 60_000, { signal: controller.signal }),
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
    }, []);

    const rankingCopy = getHubRankingCopy(rankingMode);
    const rankedProjects = rankHubProjects(projects, rankingMode, windowType, limit);

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
                </div>
            </div>

            <div className="hub-rank-list">
                {rankedProjects.map((project, index) => {
                    const stats = getHubStats(project, windowType);
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
