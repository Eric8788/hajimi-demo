'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { ALL_TAGS, type ProjectTag } from '@/data/projects';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '@/lib/db';

const TAG_COLORS: Record<string, string> = {
    Game: '#6c5ce7',
    Tool: '#00b894',
    AI: '#fd79a8',
    Multiplayer: '#e17055',
    Simulation: '#0984e3',
    Visual: '#a29bfe',
    Finance: '#00cec9',
    Narrative: '#fdcb6e',
    Sailing: '#0984e3',
    Classroom: '#b2bec3',
};

const TAG_EMOJIS: Record<string, string> = {
    Game: '🎮', Tool: '🛠️', AI: '🤖', Multiplayer: '👥', 
    Simulation: '🌍', Visual: '👁️', Finance: '💰', 
    Narrative: '📖', Sailing: '⛵', Classroom: '🏫'
};

const HUB_LEADERBOARD_TABS = [
    { id: 'today', label: '今日' },
    { id: 'week', label: '本周' },
    { id: 'month', label: '本月' },
] as const;

const HUB_RANKING_MODES = [
    { id: 'heat', label: '热度榜' },
    { id: 'rating', label: '星级榜' },
] as const;

type HubLeaderboardWindow = (typeof HUB_LEADERBOARD_TABS)[number]['id'];
type HubRankingMode = (typeof HUB_RANKING_MODES)[number]['id'];

type HubLeaderboardStats = {
    uniquePlayers: number;
    effectiveOpens: number;
};

type ProjectGridProps = {
    user: User | null;
    canSubmitProjects?: boolean;
};

function recordProjectOpen(projectId: number | string) {
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

export default function ProjectGrid({ user, canSubmitProjects = false }: ProjectGridProps) {
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedTag, setSelectedTag] = useState<ProjectTag | 'all'>('all');
    const [selectedCreator, setSelectedCreator] = useState<string | 'all'>('all');
    const [sortType, setSortType] = useState<'rating' | 'name'>('rating');
    const [showLiveOnly, setShowLiveOnly] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showSubmissionForm, setShowSubmissionForm] = useState(false);
    const [submissionType, setSubmissionType] = useState<'new_project' | 'new_version'>('new_project');
    const [submissionProjectId, setSubmissionProjectId] = useState('');
    const [submissionTitle, setSubmissionTitle] = useState('');
    const [submissionDescription, setSubmissionDescription] = useState('');
    const [submissionEmoji, setSubmissionEmoji] = useState('🚀');
    const [submissionUrl, setSubmissionUrl] = useState('');
    const [submissionTags, setSubmissionTags] = useState<ProjectTag[]>(['Game']);
    const [submissionVersionNotes, setSubmissionVersionNotes] = useState('');
    const [submissionCoverUrl, setSubmissionCoverUrl] = useState('');
    const [submissionMessage, setSubmissionMessage] = useState('');
    const [submissionLoading, setSubmissionLoading] = useState(false);
    const [projectLoadError, setProjectLoadError] = useState('');
    const [hubLeaderboardWindow, setHubLeaderboardWindow] = useState<HubLeaderboardWindow>('today');
    const [hubRankingMode, setHubRankingMode] = useState<HubRankingMode>('heat');

    useEffect(() => {
        const controller = new AbortController();
        let active = true;

        setProjectLoadError('');
        fetch('/api/projects', { signal: controller.signal })
            .then(res => {
                if (!res.ok) throw new Error('Projects request failed');
                return res.json();
            })
            .then(data => {
                if (!active) return;
                setProjects(Array.isArray(data) ? data : []);
            })
            .catch(error => {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                if (!active) return;
                console.error('Failed to load projects:', error);
                setProjects([]);
                setProjectLoadError('Hub 项目暂时加载失败，刷新后可以重试。');
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, []);

    if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>Loading functions...</div>;

    const getDisplayName = (name: string) => {
        if (!name) return 'Unknown';
        return name.toLowerCase() === 'eric' ? 'AI Club' : name;
    };

    const uniqueCreators = Array.from(new Set(projects.map(p => getDisplayName(p.author_name || p.author)))).sort();

    const getHubStats = (project: any): HubLeaderboardStats => {
        if (hubLeaderboardWindow === 'month') {
            return {
                uniquePlayers: Number(project.unique_open_count_month || 0),
                effectiveOpens: Number(project.effective_open_count_month ?? project.open_count_month ?? 0),
            };
        }

        if (hubLeaderboardWindow === 'week') {
            return {
                uniquePlayers: Number(project.unique_open_count_week || 0),
                effectiveOpens: Number(project.effective_open_count_week ?? project.open_count_week ?? 0),
            };
        }

        return {
            uniquePlayers: Number(project.unique_open_count_today || 0),
            effectiveOpens: Number(project.effective_open_count_today ?? project.open_count_today ?? 0),
        };
    };

    const compareTitles = (a: any, b: any) => String(a.title).localeCompare(String(b.title));

    const compareByHeat = (a: any, b: any) => {
        const statsA = getHubStats(a);
        const statsB = getHubStats(b);

        return statsB.effectiveOpens - statsA.effectiveOpens
            || statsB.uniquePlayers - statsA.uniquePlayers
            || Number(b.rating || 0) - Number(a.rating || 0)
            || Number(b.rating_count || 0) - Number(a.rating_count || 0)
            || compareTitles(a, b);
    };

    const compareByRatingBoard = (a: any, b: any) => {
        const statsA = getHubStats(a);
        const statsB = getHubStats(b);

        return Number(b.rating || 0) - Number(a.rating || 0)
            || Number(b.rating_count || 0) - Number(a.rating_count || 0)
            || statsB.uniquePlayers - statsA.uniquePlayers
            || statsB.effectiveOpens - statsA.effectiveOpens
            || compareTitles(a, b);
    };

    const hubLeaderboard = [...projects]
        .filter(project => project.status === 'live')
        .sort(hubRankingMode === 'rating' ? compareByRatingBoard : compareByHeat)
        .slice(0, 5);

    const hubRankingCopy = hubRankingMode === 'rating'
        ? {
            title: '⭐ 星级榜',
            intro: '按累计星级和评分人数排序，同时展示当前窗口体验数据。',
            tooltipTitle: '星级榜规则',
            tooltip: '按项目累计星级排序；同等星级下评分人数多的排前，再相同才用当前时间窗的体验人数和有效进入补充排序。今日 / 本周 / 本月不重算星级。',
        }
        : {
            title: '🔥 项目热度榜',
            intro: '按有效进入、体验人数和星级排序。',
            tooltipTitle: '热度榜规则',
            tooltip: '按当前时间窗的有效进入排序；同等有效进入下体验人数多的排前，再相同才看星级和评分人数。体验人数只统计已认证用户，同一项目同一人同一天算 1 人；有效进入按 30 分钟 session 去重，每人每天最多计 3 次。',
        };

    const filtered = projects.filter(p => {
        const tagMatch = selectedTag === 'all' || p.tags.includes(selectedTag);
        const creatorMatch = selectedCreator === 'all' || getDisplayName(p.author_name || p.author) === selectedCreator;
        const liveMatch = !showLiveOnly || p.status === 'live';
        return tagMatch && creatorMatch && liveMatch;
    }).sort((a, b) => {
        if (sortType === 'rating') {
            return (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title);
        } else {
            return a.title.localeCompare(b.title);
        }
    });

    const handleRatingUpdate = (projectId: number | string, newRating: number, newCount: number) => {
        setProjects(prev => prev.map(p => 
            String(p.id) === String(projectId) ? { ...p, rating: newRating, rating_count: newCount } : p
        ));
    };

    const toggleSubmissionTag = (tag: ProjectTag) => {
        setSubmissionTags(current => {
            if (current.includes(tag)) {
                const next = current.filter(item => item !== tag);
                return next.length > 0 ? next : ['Game'];
            }

            return [...current, tag].slice(0, 5);
        });
    };

    const handleFilterDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || event.pointerType === 'touch') return;

        const scroller = event.currentTarget;
        const startX = event.clientX;
        const startScrollLeft = scroller.scrollLeft;
        let didDrag = false;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaX = moveEvent.clientX - startX;
            if (Math.abs(deltaX) < 4) return;

            didDrag = true;
            scroller.dataset.draggingFilter = 'true';
            scroller.classList.add('is-dragging');
            scroller.scrollLeft = startScrollLeft - deltaX;
        };

        const finishDrag = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointercancel', finishDrag);
            scroller.classList.remove('is-dragging');

            if (didDrag) {
                window.setTimeout(() => {
                    delete scroller.dataset.draggingFilter;
                }, 0);
            }
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', finishDrag, { once: true });
        window.addEventListener('pointercancel', finishDrag, { once: true });
    };

    const blockFilterClickAfterDrag = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.currentTarget.dataset.draggingFilter !== 'true') return;
        event.preventDefault();
        event.stopPropagation();
    };

    const openSubmissionForm = () => {
        setSubmissionMessage('');
        if (!user) {
            setSubmissionMessage('登录并完成 Hajimi 认证后可以提交项目或新版本申请。');
            return;
        }

        if (!canSubmitProjects) {
            setSubmissionMessage('完成 Hajimi 认证后可以提交项目或新版本申请。');
            return;
        }

        setShowSubmissionForm(value => !value);
    };

    const submitProjectApplication = async (event: React.FormEvent) => {
        event.preventDefault();
        setSubmissionLoading(true);
        setSubmissionMessage('');

        try {
            const res = await fetch('/api/project-submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    submissionType,
                    projectId: submissionProjectId,
                    title: submissionTitle,
                    description: submissionDescription,
                    emoji: submissionEmoji,
                    url: submissionUrl,
                    tags: submissionTags,
                    versionNotes: submissionVersionNotes,
                    coverUrl: submissionCoverUrl,
                    accentColor: 'rgba(162, 155, 254, 0.22)',
                }),
            });
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                setSubmissionMessage(data?.error || '提交失败，请稍后再试。');
                return;
            }

            setSubmissionMessage('已提交申请，管理员审核通过后会发布到 Hub。');
            setShowSubmissionForm(false);
            setSubmissionType('new_project');
            setSubmissionProjectId('');
            setSubmissionTitle('');
            setSubmissionDescription('');
            setSubmissionEmoji('🚀');
            setSubmissionUrl('');
            setSubmissionTags(['Game']);
            setSubmissionVersionNotes('');
            setSubmissionCoverUrl('');
        } finally {
            setSubmissionLoading(false);
        }
    };

    return (
        <div>
            <section className="project-submit-panel">
                <div className="project-submit-copy">
                    <span>Creator Pipeline</span>
                    <h3>提交项目 / 新版本申请</h3>
                    <p>Hub 项目全部开放体验；发布和版本更新先提交申请，管理员审核后上线。</p>
                </div>
                <div className="project-submit-actions">
                    <button type="button" className="btn btn-primary project-submit-open" onClick={openSubmissionForm}>
                        {showSubmissionForm ? '收起申请' : '提交申请'}
                    </button>
                    {user?.role === 'admin' && (
                        <a className="btn project-submit-review" href="/admin/project-submissions">
                            审核申请
                        </a>
                    )}
                </div>
            </section>
            {submissionMessage && (
                <div className="forum-verification-callout project-submit-message">
                    <span>{submissionMessage}</span>
                    {!canSubmitProjects && <button type="button" onClick={() => window.location.assign(user ? '/profile' : '/login')}>{user ? '去认证' : '登录'}</button>}
                </div>
            )}
            {projectLoadError && (
                <div className="forum-verification-callout project-submit-message">
                    <span>{projectLoadError}</span>
                    <button type="button" onClick={() => window.location.reload()}>刷新</button>
                </div>
            )}
            <AnimatePresence>
                {showSubmissionForm && (
                    <motion.form
                        className="project-submission-form"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        onSubmit={submitProjectApplication}
                    >
                        <div className="auth-verification-tabs">
                            <button type="button" className={submissionType === 'new_project' ? 'is-active' : ''} onClick={() => setSubmissionType('new_project')}>新项目</button>
                            <button type="button" className={submissionType === 'new_version' ? 'is-active' : ''} onClick={() => setSubmissionType('new_version')}>新版本</button>
                        </div>
                        {submissionType === 'new_version' && (
                            <label>
                                要更新的项目
                                <select value={submissionProjectId} onChange={event => setSubmissionProjectId(event.target.value)} className="glass-input" required>
                                    <option value="">选择项目</option>
                                    {projects.map(project => (
                                        <option key={project.id} value={project.id}>{project.title}</option>
                                    ))}
                                </select>
                            </label>
                        )}
                        <label>
                            项目名
                            <input value={submissionTitle} onChange={event => setSubmissionTitle(event.target.value)} className="glass-input" maxLength={80} required />
                        </label>
                        <label>
                            简介
                            <textarea value={submissionDescription} onChange={event => setSubmissionDescription(event.target.value)} className="glass-input" rows={4} maxLength={520} required />
                        </label>
                        <div className="project-submission-row">
                            <label>
                                Emoji
                                <input value={submissionEmoji} onChange={event => setSubmissionEmoji(event.target.value)} className="glass-input" maxLength={8} />
                            </label>
                            <label>
                                项目链接
                                <input value={submissionUrl} onChange={event => setSubmissionUrl(event.target.value)} className="glass-input" placeholder="https://..." />
                            </label>
                        </div>
                        <label>
                            版本说明 / 更新说明
                            <textarea value={submissionVersionNotes} onChange={event => setSubmissionVersionNotes(event.target.value)} className="glass-input" rows={3} maxLength={800} />
                        </label>
                        <label>
                            截图/封面 URL（可选）
                            <input value={submissionCoverUrl} onChange={event => setSubmissionCoverUrl(event.target.value)} className="glass-input" placeholder="https://..." />
                        </label>
                        <div className="project-submission-tags">
                            {ALL_TAGS.map(tag => (
                                <button key={tag} type="button" className={submissionTags.includes(tag) ? 'is-active' : ''} onClick={() => toggleSubmissionTag(tag)}>
                                    {TAG_EMOJIS[tag] ? `${TAG_EMOJIS[tag]} ${tag}` : tag}
                                </button>
                            ))}
                        </div>
                        <div className="project-submission-actions">
                            <button type="button" className="btn" onClick={() => setShowSubmissionForm(false)}>取消</button>
                            <button type="submit" className="btn btn-primary" disabled={submissionLoading}>
                                {submissionLoading ? '提交中...' : '提交审核'}
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            <section className="hub-leaderboard-panel">
                <div className="hub-leaderboard-head">
                    <div>
                        <span>Hub Rankings</span>
                        <div className="hub-leaderboard-titleline">
                            <h3>{hubRankingCopy.title}</h3>
                            <button type="button" className="hub-leaderboard-info" aria-label={`查看${hubRankingMode === 'rating' ? '星级榜' : '热度榜'}规则`}>
                                i
                                <span className="hub-leaderboard-tooltip" role="tooltip">
                                    <strong>{hubRankingCopy.tooltipTitle}</strong>
                                    {hubRankingCopy.tooltip}
                                </span>
                            </button>
                        </div>
                        <p>{hubRankingCopy.intro}</p>
                        <div className="hub-leaderboard-mode-tabs" aria-label="Hub ranking mode">
                            {HUB_RANKING_MODES.map(mode => (
                                <button
                                    key={mode.id}
                                    type="button"
                                    className={hubRankingMode === mode.id ? 'is-active' : ''}
                                    onClick={() => setHubRankingMode(mode.id)}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="hub-leaderboard-tabs">
                        {HUB_LEADERBOARD_TABS.map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                className={hubLeaderboardWindow === tab.id ? 'is-active' : ''}
                                onClick={() => setHubLeaderboardWindow(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="hub-leaderboard-list">
                    {hubLeaderboard.map((project, index) => {
                        const stats = getHubStats(project);
                        return (
                            <a
                                key={project.id}
                                className="hub-leaderboard-row"
                                href={project.url || '#'}
                                target={project.url ? '_blank' : undefined}
                                rel={project.url ? 'noopener noreferrer' : undefined}
                                onClick={() => recordProjectOpen(project.id)}
                            >
                                <strong>{index + 1}</strong>
                                <span className="hub-leaderboard-emoji">{project.emoji}</span>
                                <span className="hub-leaderboard-title">
                                    {project.title}
                                    <small>by {getDisplayName(project.author_name || project.author)}</small>
                                </span>
                                <span className="hub-leaderboard-meta">
                                    {stats.uniquePlayers} 人体验 · {stats.effectiveOpens} 次有效进入 · ⭐ {Number(project.rating || 0).toFixed(1)}
                                </span>
                            </a>
                        );
                    })}
                </div>
            </section>

            {/* Filter Bar */}
            <div className="project-filter-bar">
                {/* Tag Filters */}
                <div className="project-filter-row">
                    <span>Category</span>
                    <div
                        className="project-filter-panel"
                        aria-label="Project categories"
                        onPointerDown={handleFilterDragStart}
                        onClickCapture={blockFilterClickAfterDrag}
                    >
                        <button
                            onClick={() => setSelectedTag('all')}
                            className={`project-filter-chip ${selectedTag === 'all' ? 'is-active' : ''}`}
                            style={{ '--tag-color': '#6c5ce7' } as CSSProperties}
                        >All</button>
                        {ALL_TAGS.map(tag => (
                            <button
                                key={tag}
                                onClick={() => setSelectedTag(tag)}
                                className={`project-filter-chip ${selectedTag === tag ? 'is-active' : ''}`}
                                style={{ '--tag-color': TAG_COLORS[tag] } as CSSProperties}
                            >{TAG_EMOJIS[tag] ? `${TAG_EMOJIS[tag]} ${tag}` : tag}</button>
                        ))}
                    </div>
                </div>

                {/* Creator Filters */}
                <div className="project-filter-row">
                    <span>Creator</span>
                    <div
                        className="project-filter-panel project-creator-filter-panel"
                        aria-label="Project creators"
                        onPointerDown={handleFilterDragStart}
                        onClickCapture={blockFilterClickAfterDrag}
                    >
                        <button
                            onClick={() => setSelectedCreator('all')}
                            className={`project-filter-chip ${selectedCreator === 'all' ? 'is-active' : ''}`}
                            style={{ '--tag-color': '#e17055' } as CSSProperties}
                        >All</button>
                        {uniqueCreators.map(creator => (
                            <button
                                key={creator}
                                onClick={() => setSelectedCreator(creator)}
                                className={`project-filter-chip ${selectedCreator === creator ? 'is-active' : ''}`}
                                style={{ '--tag-color': '#e17055' } as CSSProperties}
                            >{creator}</button>
                        ))}
                    </div>
                </div>

                <div className="project-filter-actions">
                    {/* Sort Options */}
                    <div className="project-sort-control" aria-label="Project sorting">
                        <button
                            onClick={() => setSortType('rating')}
                            className={sortType === 'rating' ? 'is-active' : ''}
                        >
                            ⭐ Top Rated
                        </button>
                        <button
                            onClick={() => setSortType('name')}
                            className={sortType === 'name' ? 'is-active' : ''}
                        >
                            🔤 A-Z
                        </button>
                    </div>

                    {/* Live Toggle */}
                    <button
                        onClick={() => setShowLiveOnly(!showLiveOnly)}
                        className={`project-live-toggle ${showLiveOnly ? 'is-active' : ''}`}
                        style={{
                            background: showLiveOnly ? 'rgba(46, 213, 115, 0.25)' : 'rgba(255,255,255,0.6)',
                            color: showLiveOnly ? '#27ae60' : '#636e72',
                            margin: 0
                        }}
                    >
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ed573', display: 'inline-block', boxShadow: showLiveOnly ? '0 0 6px #2ed573' : 'none' }} />
                        Live Only
                    </button>
                </div>
            </div>

            {/* Project Grid */}
            <motion.div
                layout
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}
            >
                <AnimatePresence>
                    {filtered.map(project => (
                        <motion.div
                            key={project.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                        >
                            <ProjectCard project={project} user={user} canInteract={canSubmitProjects} onRatingUpdate={handleRatingUpdate} />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </motion.div>

            {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px', color: '#b2bec3' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🔍</div>
                    <p>No projects match this filter yet.</p>
                </div>
            )}
        </div>
    );
}

function ProjectCard({ project, user, canInteract, onRatingUpdate }: { project: any, user: User | null, canInteract: boolean, onRatingUpdate?: (projectId: number | string, rating: number, count: number) => void }) {
    const isLive = project.status === 'live';
    const [rating, setRating] = useState(Number(project.rating || project.likes || 0));
    const [ratingCount, setRatingCount] = useState(Number(project.rating_count || project.likes || 0));
    const [hoverScore, setHoverScore] = useState(0);
    const [selectedScore, setSelectedScore] = useState(0);
    
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [xpBurst, setXpBurst] = useState('');
    const [interactionMessage, setInteractionMessage] = useState('');

    const requireProjectInteraction = () => {
        if (!user) {
            setInteractionMessage('登录并完成 Hajimi 认证后可以评分和评论项目。');
            return true;
        }

        if (!canInteract) {
            setInteractionMessage('完成 Hajimi 认证后可以评分和评论项目。');
            return true;
        }

        return false;
    };

    const handleStarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const percentage = Math.max(0, Math.min(1, x / width));
        const score = Math.ceil(percentage * 10) / 2; // 0.5 increments
        setHoverScore(score);
    };

    const fetchComments = async () => {
        setInteractionMessage('');
        try {
            const res = await fetch(`/api/projects/comments?projectId=${project.id}`);
            if (!res.ok) throw new Error('Comments request failed');
            const data = await res.json();
            const nextComments = Array.isArray(data) ? data : [];
            setComments(nextComments);

            const myComment = nextComments.find((c: any) => c.is_own_comment);
            if (myComment) {
                setNewComment(myComment.content);
                setSelectedScore(myComment.author_score || 0);
            }
        } catch (error) {
            console.error('Failed to load project comments:', error);
            setComments([]);
            setInteractionMessage('项目评论暂时加载失败，稍后再试。');
        }
    };

    const handleComment = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (requireProjectInteraction()) return;
        
        const tempContent = newComment.trim();
        if (selectedScore === 0 || !tempContent) {
            return;
        }
        
        const isUpdate = !!comments.find(c => c.is_own_comment);
        const oldScore = comments.find(c => c.is_own_comment)?.author_score || 0;
        
        // Optimistic UI for rating
        let newCount = ratingCount;
        let newRating = rating;

        if (isUpdate) {
            newRating = ratingCount > 0 ? (rating * ratingCount - oldScore + selectedScore) / ratingCount : selectedScore;
        } else {
            newCount = ratingCount + 1;
            newRating = (rating * ratingCount + selectedScore) / newCount;
        }
        
        setRating(newRating);
        setRatingCount(newCount);
        if (onRatingUpdate) onRatingUpdate(project.id, newRating, newCount);
        
        const ratingRes = await fetch('/api/projects/like', {
            method: 'POST',
            body: JSON.stringify({ projectId: project.id, score: selectedScore })
        });
        if (!ratingRes.ok) {
            const data = await ratingRes.json().catch(() => null);
            setInteractionMessage(data?.error || '提交评分失败。');
            setRating(rating);
            setRatingCount(ratingCount);
            if (onRatingUpdate) onRatingUpdate(project.id, rating, ratingCount);
            return;
        }
        
        // Submit comment
        const submittedScore = selectedScore;
        setNewComment('');
        setSelectedScore(0);
        
        const res = await fetch('/api/projects/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: project.id, content: tempContent })
        });
        if (res.ok) {
            if (!isUpdate) {
                setXpBurst('+2 XP');
                window.setTimeout(() => setXpBurst(''), 900);
            }
            fetchComments();
        } else {
            const data = await res.json().catch(() => null);
            setInteractionMessage(data?.error || '提交评论失败。');
            setNewComment(tempContent);
            setSelectedScore(submittedScore);
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        const deletedComment = comments.find(c => c.id === commentId);
        const previousComments = comments;
        setComments(previousComments.filter(c => c.id !== commentId));
        const res = await fetch(`/api/projects/comments?commentId=${commentId}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json().catch(() => null);
            setComments(previousComments);
            setInteractionMessage(data?.error || '删除评论失败，请稍后再试。');
            return;
        }
        
        // Reset inputs if we deleted our own comment
        setNewComment('');
        setSelectedScore(0);

        if (deletedComment && deletedComment.author_score > 0) {
            const newCount = Math.max(0, ratingCount - 1);
            const newRating = newCount > 0 ? (rating * ratingCount - deletedComment.author_score) / newCount : 0;
            setRating(newRating);
            setRatingCount(newCount);
            if (onRatingUpdate) onRatingUpdate(project.id, newRating, newCount);
        }
    };

    return (
        <div
            className="glass-panel"
            style={{
                padding: '28px', height: '100%', display: 'flex', flexDirection: 'column',
                gap: '12px', cursor: isLive ? 'pointer' : 'default',
                transition: 'transform 0.2s, box-shadow 0.2s',
                background: project.accent_color || project.accentColor,
                opacity: isLive ? 1 : 0.75,
                position: 'relative', overflow: 'hidden'
            }}
            onMouseEnter={e => { if (isLive) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-5px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 40px rgba(0,0,0,0.12)'; }}}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
        >
            {/* Emoji */}
            <div style={{ fontSize: '2.8rem', lineHeight: 1 }}>{project.emoji}</div>

            {/* Title + Author */}
            <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2d3436', marginBottom: '2px' }}>{project.title}</h3>
                <span style={{ fontSize: '0.8rem', color: '#636e72', fontWeight: 500 }}>
                    by {project.author_name ? (project.author_name.toLowerCase() === 'eric' ? 'AI Club' : project.author_name) : (project.author?.toLowerCase() === 'eric' ? 'AI Club' : project.author)}
                </span>
            </div>

            {/* Description */}
            <p style={{ fontSize: '0.88rem', color: '#4a4a4a', lineHeight: 1.6, flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{project.description}</p>

            {/* Interaction Bar */}
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', margin: '8px 0', minHeight: '24px' }}>
                <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowComments(!showComments); if (!showComments) fetchComments(); }}
                    style={{ 
                        background: 'rgba(243, 156, 18, 0.1)', border: 'none', cursor: 'pointer', 
                        display: 'flex', alignItems: 'center', gap: '8px',
                        color: '#636e72', fontSize: '0.9rem', fontWeight: 600,
                        padding: '6px 12px', borderRadius: '16px', transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(243, 156, 18, 0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(243, 156, 18, 0.1)'}
                >
                    <AnimatePresence>
                        {xpBurst && (
                            <motion.span
                                key={xpBurst}
                                className="project-xp-burst"
                                initial={{ opacity: 0, y: 8, scale: 0.72 }}
                                animate={{ opacity: 1, y: -12, scale: 1 }}
                                exit={{ opacity: 0, y: -24, scale: 0.66 }}
                                transition={{ duration: 0.45 }}
                            >
                                {xpBurst}
                            </motion.span>
                        )}
                    </AnimatePresence>
                    <span style={{ color: '#f39c12', fontSize: '1.05rem', transform: 'translateY(-1px)' }}>⭐</span>
                    {rating.toFixed(1)}
                    <span style={{ marginLeft: '4px' }}>💬 {project.commentCount || comments.length || 0}</span>
                </button>
            </div>

            {/* Comments & Review Section */}
            <AnimatePresence>
                {showComments && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden', fontSize: '0.85rem' }}
                        onClick={e => { e.preventDefault(); e.stopPropagation(); }}
                    >
                        <div style={{ padding: '10px 0', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                            {comments.map(c => (
                                <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontWeight: 700 }}>
                                            {c.author_name} 
                                            {c.author_score > 0 && <span style={{ color: '#f39c12', fontSize: '0.8rem', marginLeft: '4px' }}>⭐ {c.author_score}</span>}
                                            : 
                                        </span>
                                        <span style={{ marginLeft: '4px' }}>{c.content}</span>
                                    </div>
                                    {c.is_own_comment && (
                                        <button 
                                            onClick={() => handleDeleteComment(c.id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#b2bec3', padding: '0 4px' }}
                                            title="Delete comment"
                                        >🗑️</button>
                                    )}
                                </div>
	                            ))}
                                {interactionMessage && (
                                    <div className="forum-verification-callout project-interaction-callout">
                                        <span>{interactionMessage}</span>
                                        <button type="button" onClick={() => window.location.assign(user ? '/profile' : '/login')}>{user ? '去认证' : '登录'}</button>
                                    </div>
                                )}
	                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', background: 'rgba(255,255,255,0.4)', padding: '12px', borderRadius: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 600, color: '#2d3436' }}>Your Rating:</span>
                                    <div 
                                        onMouseMove={handleStarMouseMove}
                                        onMouseLeave={() => setHoverScore(0)}
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedScore(hoverScore); }}
                                        style={{ position: 'relative', cursor: 'pointer', fontSize: '1.2rem', display: 'inline-block', lineHeight: 1, letterSpacing: '2px', paddingBottom: '2px' }}
                                        title={hoverScore > 0 ? `Rate ${hoverScore} stars` : "Select a rating"}
                                    >
                                        <div style={{ color: '#dfe6e9' }}>★★★★★</div>
                                        <div style={{ 
                                            color: '#f39c12', position: 'absolute', top: 0, left: 0, 
                                            overflow: 'hidden', width: `${((hoverScore > 0 ? hoverScore : selectedScore) / 5) * 100}%`,
                                            whiteSpace: 'nowrap'
                                        }}>
                                            ★★★★★
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '0.85rem', color: '#f39c12', fontWeight: 700 }}>
                                        {hoverScore > 0 ? hoverScore : selectedScore > 0 ? selectedScore : ''}
                                    </span>
                                </div>
                                <form onSubmit={handleComment} style={{ display: 'flex', gap: '6px' }}>
                                    <input 
                                        value={newComment}
                                        onChange={e => setNewComment(e.target.value)}
                                        maxLength={500}
                                        placeholder={selectedScore > 0 ? "Leave a comment for your rating..." : "Add a comment..."}
                                        style={{ flex: 1, padding: '6px 12px', borderRadius: '8px', border: '1px solid #dfe6e9', fontSize: '0.8rem', outline: 'none' }}
                                        onClick={e => { e.preventDefault(); e.stopPropagation(); }}
                                    />
                                    <button 
                                        type="submit" 
                                        className="btn btn-primary" 
                                        style={{ padding: '6px 14px', height: 'auto', fontSize: '0.8rem', opacity: (selectedScore === 0 || !newComment.trim()) ? 0.5 : 1, cursor: (selectedScore === 0 || !newComment.trim()) ? 'not-allowed' : 'pointer' }} 
                                        onClick={e => e.stopPropagation()}
                                        disabled={selectedScore === 0 || !newComment.trim()}
                                    >Post</button>
                                </form>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tags */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {project.tags.map((tag: string) => (
                    <span key={tag} style={{
                        padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                        background: `${TAG_COLORS[tag] || '#dfe6e9'}33`, color: TAG_COLORS[tag] || '#636e72'
                    }}>{TAG_EMOJIS[tag] ? `${TAG_EMOJIS[tag]} ${tag}` : tag}</span>
                ))}
            </div>

            {/* Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                {isLive ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#27ae60' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ed573', display: 'inline-block', boxShadow: '0 0 6px #2ed573' }} />
                        Live
                    </div>
                ) : (
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#b2bec3' }}>🔧 Coming Soon</div>
                )}
                {isLive && project.url ? (
                    <a href={project.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6c5ce7', textDecoration: 'none', background: 'rgba(108, 92, 231, 0.1)', padding: '6px 14px', borderRadius: '16px', cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => recordProjectOpen(project.id)} onMouseEnter={e => e.currentTarget.style.background = 'rgba(108, 92, 231, 0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(108, 92, 231, 0.1)'}>Open →</a>
                ) : isLive && (
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#636e72' }}>Open →</div>
                )}
            </div>

            {/* Decoration emoji in background */}
            <div style={{ position: 'absolute', right: '-10px', bottom: '-15px', fontSize: '5rem', opacity: 0.07, pointerEvents: 'none' }}>
                {project.emoji}
            </div>
        </div>
    );
}
