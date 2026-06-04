'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { ALL_TAGS, type ProjectTag } from '@/data/projects';
import { motion, AnimatePresence } from 'framer-motion';
import type { Project, User } from '@/lib/db';
import ProjectCoverStudio from './ProjectCoverStudio';
import { cachedJson, clearCachedJson } from '@/lib/clientJsonCache';
import { getImageDisplayUrl } from '@/lib/imageProxy';

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

type SpotlightKind = 'submit' | 'rewards' | 'galgame' | 'vocab' | 'cpaper' | 'ocean';

type HubSpotlightCopy = {
    kind: SpotlightKind;
    label: string;
    status: string;
    titleBefore: string;
    titleAccent: string;
    titleAfter: string;
    text: string;
    meta: string[];
    ctaLabel: string;
    ctaTarget?: 'submit' | 'projects';
};

type ProjectGridProps = {
    user: User | null;
    canSubmitProjects?: boolean;
};

type HubProject = Project & {
    author?: string;
    accentColor?: string;
    coverUrl?: string | null;
    summary?: string;
    tagline?: string;
};

type SubmissionDraft = {
    type: 'new_project' | 'new_version';
    project?: HubProject;
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

function getSpotlightKind(project: any): SpotlightKind | null {
    const fingerprint = `${project.title || ''} ${project.url || ''}`.toLowerCase();

    if (fingerprint.includes('galgame') || fingerprint.includes('cagg.top')) {
        return 'galgame';
    }

    if (fingerprint.includes('vocab runner') || fingerprint.includes('vocab-runner-game')) {
        return 'vocab';
    }

    if (fingerprint.includes('c-paper') || fingerprint.includes('cpaper') || fingerprint.includes('yiming.us/c-paper')) {
        return 'cpaper';
    }

    if (fingerprint.includes('the ocean explorer') || fingerprint.includes('regatta-info.top')) {
        return 'ocean';
    }

    return null;
}

function getSpotlightOrder(project: any) {
    const kind = getSpotlightKind(project);
    if (kind === 'galgame') return 0;
    if (kind === 'vocab') return 1;
    if (kind === 'cpaper') return 2;
    if (kind === 'ocean') return 3;
    return 99;
}

function getProjectTagline(project: any) {
    const explicitTagline = String(project.tagline || project.summary || '').trim();
    if (explicitTagline) return explicitTagline.slice(0, 96);

    const description = String(project.description || '').replace(/\s+/g, ' ').trim();
    if (!description) return '打开体验项目，然后把真实反馈留给创作者。';

    const firstSentence = description.split(/(?<=[。！？.!?])\s*/)[0]?.trim();
    const tagline = firstSentence && firstSentence.length <= 88 ? firstSentence : description.slice(0, 88);
    return tagline.replace(/[，,；;：:]\s*$/, '');
}

function getPrimaryProjectTag(project: any) {
    return Array.isArray(project.tags) && project.tags.length > 0 ? project.tags[0] : 'Project';
}

function isValidCoverUrl(url: unknown) {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
    return /^https?:\/\//i.test(trimmed);
}

export default function ProjectGrid({ user, canSubmitProjects = false }: ProjectGridProps) {
    const [projects, setProjects] = useState<HubProject[]>([]);
    const [selectedTag, setSelectedTag] = useState<ProjectTag | 'all'>('all');
    const [selectedCreator, setSelectedCreator] = useState<string | 'all'>('all');
    const [sortType, setSortType] = useState<'rating' | 'name'>('rating');
    const [showLiveOnly, setShowLiveOnly] = useState(false);
    const [showSavedOnly, setShowSavedOnly] = useState(false);
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
    const [hubLeaderboardWindow, setHubLeaderboardWindow] = useState<HubLeaderboardWindow>('week');
    const [hubRankingMode, setHubRankingMode] = useState<HubRankingMode>('heat');
    const [spotlightIndex, setSpotlightIndex] = useState(0);
    const [spotlightPaused, setSpotlightPaused] = useState(false);
    const [projectStatsLoaded, setProjectStatsLoaded] = useState(false);
    const [bookmarkedProjectIds, setBookmarkedProjectIds] = useState<Set<number>>(() => new Set());
    const [bookmarksLoaded, setBookmarksLoaded] = useState(false);
    const [localUserPoints, setLocalUserPoints] = useState(user ? Number(user.points || 0) : 0);
    const currentUserId = user ? Number(user.id) : null;
    const savedCount = bookmarkedProjectIds.size;

    useEffect(() => {
        const controller = new AbortController();
        let active = true;

        setProjectLoadError('');
        cachedJson<HubProject[]>('projects:list', '/api/projects', 60_000, { signal: controller.signal })
            .then(data => {
                if (!active) return;
                setProjects(Array.isArray(data) ? data : []);
                setProjectStatsLoaded(false);
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

    useEffect(() => {
        if (loading || projectStatsLoaded || projects.length === 0) return;

        const controller = new AbortController();
        let active = true;

        cachedJson<Partial<HubProject>[]>('projects:stats', '/api/projects/stats', 60_000, { signal: controller.signal })
            .then(data => {
                if (!active || !Array.isArray(data)) return;
                const statsById = new Map<number, Partial<HubProject>>(data.map(item => [Number(item.id), item]));
                setProjects(current => current.map(project => ({
                    ...project,
                    ...(statsById.get(Number(project.id)) || {}),
                })));
            })
            .catch(error => {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                console.warn('Hub stats unavailable:', error);
            })
            .finally(() => {
                if (active) setProjectStatsLoaded(true);
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, [loading, projectStatsLoaded, projects.length]);

    useEffect(() => {
        setLocalUserPoints(user ? Number(user.points || 0) : 0);
    }, [user?.id, user?.points]);

    useEffect(() => {
        if (!user || !canSubmitProjects) {
            setBookmarkedProjectIds(new Set());
            setBookmarksLoaded(true);
            return;
        }

        const controller = new AbortController();
        let active = true;

        fetch('/api/projects/bookmarks', {
            signal: controller.signal,
            cache: 'no-store',
        })
            .then(res => {
                if (!res.ok) throw new Error('Project bookmarks request failed');
                return res.json();
            })
            .then(data => {
                if (!active) return;
                const projectIds = Array.isArray(data?.projectIds) ? data.projectIds : [];
                setBookmarkedProjectIds(new Set(projectIds.map(Number).filter((id: number) => Number.isFinite(id) && id > 0)));
            })
            .catch(error => {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                console.warn('Project bookmarks unavailable:', error);
            })
            .finally(() => {
                if (active) setBookmarksLoaded(true);
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, [user?.id, canSubmitProjects]);

    useEffect(() => {
        const spotlightCount = projects.filter(project => project.status === 'live' && getSpotlightKind(project)).length + 2;
        if (spotlightCount > 0 && spotlightIndex >= spotlightCount) {
            setSpotlightIndex(0);
        }
    }, [projects, spotlightIndex]);

    useEffect(() => {
        const spotlightCount = projects.filter(project => project.status === 'live' && getSpotlightKind(project)).length + 2;
        if (spotlightPaused || spotlightCount <= 1) return;

        const timer = window.setInterval(() => {
            setSpotlightIndex(current => (current + 1) % spotlightCount);
        }, 6500);

        return () => window.clearInterval(timer);
    }, [projects, spotlightPaused]);

    if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>Loading functions...</div>;

    const getDisplayName = (name: string) => {
        if (!name) return 'Unknown';
        return name.toLowerCase() === 'eric' ? 'AI Club' : name;
    };

    const getSpotlightCopy = (project: any): HubSpotlightCopy | null => {
        const kind = getSpotlightKind(project);
        const authorName = getDisplayName(project.author_name || project.author || '');

        if (kind === 'galgame') {
            return {
                kind,
                label: 'New Project',
                status: `${project.title} · by ${authorName} · 视觉小说体验`,
                titleBefore: 'LUNA 新作：',
                titleAccent: project.title || '~galgame~',
                titleAfter: '',
                text: '用视觉小说的节奏体验剧情、选择和角色互动。适合直接打开试玩，然后把文本节奏、分支选择和画面反馈留给创作者。',
                meta: ['Game', 'Visual Novel', `⭐ ${Number(project.rating || 0).toFixed(1)} · ${Number(project.rating_count || 0)} 条反馈`],
                ctaLabel: '立即体验',
            };
        }

        if (kind === 'vocab') {
            return {
                kind,
                label: 'New Project',
                status: `${project.title} · by ${authorName} · 英语词汇冲刺`,
                titleBefore: 'Vocab Runner：',
                titleAccent: '边跑边背单词',
                titleAfter: '',
                text: '把课堂词汇练习做成 sprint runner：关卡、反馈和任务节奏结合，适合用真实班级词表测试难度和记忆效率。',
                meta: ['Tool', 'Classroom', `⭐ ${Number(project.rating || 0).toFixed(1)} · ${Number(project.rating_count || 0)} 条反馈`],
                ctaLabel: '立即体验',
            };
        }

        if (kind === 'cpaper') {
            return {
                kind,
                label: 'Playtest',
                status: `${project.title} · by ${authorName} · CIE 试卷下载器`,
                titleBefore: 'C-Paper：从',
                titleAccent: '科目代码',
                titleAfter: '到批量下载',
                text: '建议用真实 CIE 复习任务测试：是否能快速找到年份、季节和 Paper 类型；Question Paper 与 Mark Scheme 是否容易配对；下载历史和收藏是否真的省时间。',
                meta: ['科目代码', '考试季节', 'Paper 类型', '批量下载'],
                ctaLabel: '立即体验',
            };
        }

        if (kind === 'ocean') {
            return {
                kind,
                label: 'New Project',
                status: `${project.title} · by ${authorName} · 远航帆船社区`,
                titleBefore: '',
                titleAccent: project.title || 'THE OCEAN EXPLORER',
                titleAfter: ' 远航帆船社区',
                text: '面向帆船赛事和训练的信息社区，用来查看赛事排名、赛事轨迹、个人水手排名和龙骨船队排名，把分散的赛事资料收束到同一个入口。',
                meta: ['Sailing', '赛事排名', '轨迹 / 排名', `⭐ ${Number(project.rating || 0).toFixed(1)} · ${Number(project.rating_count || 0)} 条反馈`],
                ctaLabel: '立即体验',
            };
        }

        return null;
    };

    const uniqueCreators = Array.from(new Set(projects.map(p => getDisplayName(p.author_name || p.author || '')))).sort();

    const spotlightProjects = [...projects]
        .filter(project => project.status === 'live' && getSpotlightKind(project))
        .sort((a, b) => getSpotlightOrder(a) - getSpotlightOrder(b) || String(a.title).localeCompare(String(b.title)));
    const spotlightSlides = [
        {
            key: 'creator-pipeline',
            project: null,
            copy: {
                kind: 'submit' as const,
                label: 'Creator Pipeline',
                status: '项目 / 新版本申请',
                titleBefore: '提交',
                titleAccent: '项目申请',
                titleAfter: '，审核后上线',
                text: 'Hub 项目开放体验；新项目和新版本先提交申请，管理员审核后发布。',
                meta: ['新项目', '新版本', '审核上线'],
                ctaLabel: showSubmissionForm ? '收起申请' : '提交申请',
                ctaTarget: 'submit' as const,
            },
        },
        {
            key: 'hub-rewards',
            project: null,
            copy: {
                kind: 'rewards' as const,
                label: 'Hub Notice',
                status: '评论 / 评分奖励',
                titleBefore: '给项目',
                titleAccent: '评论和评分',
                titleAfter: '，一起赚 XP',
                text: '真实反馈会直接帮创作者改进项目：留下评论可获得 +2 XP，项目作者获得 +3 XP；首次评分会给项目作者 +5 XP。',
                meta: ['评论者 +2 XP', '作者评论奖励 +3 XP', '评分作者 +5 XP'],
                ctaLabel: '去看项目',
                ctaTarget: 'projects' as const,
            },
        },
        ...spotlightProjects
            .map(project => ({
                key: String(project.id),
                project,
                copy: getSpotlightCopy(project),
            }))
            .filter((item): item is { key: string; project: HubProject; copy: HubSpotlightCopy } => Boolean(item.copy)),
    ];
    const activeSpotlightIndex = Math.min(spotlightIndex, spotlightSlides.length - 1);
    const scrollToProjectGrid = () => {
        document.getElementById('hub-project-showcase')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

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
    const getProjectCommentCount = (project: HubProject) => Number(project.commentCount ?? project.comment_count ?? 0);

    const compareByHeat = (a: any, b: any) => {
        const statsA = getHubStats(a);
        const statsB = getHubStats(b);

        return statsB.uniquePlayers - statsA.uniquePlayers
            || Number(b.rating || 0) - Number(a.rating || 0)
            || getProjectCommentCount(b) - getProjectCommentCount(a)
            || statsB.effectiveOpens - statsA.effectiveOpens
            || Number(b.rating_count || 0) - Number(a.rating_count || 0)
            || compareTitles(a, b);
    };

    const compareByRatingBoard = (a: any, b: any) => {
        const statsA = getHubStats(a);
        const statsB = getHubStats(b);

        return Number(b.rating || 0) - Number(a.rating || 0)
            || getProjectCommentCount(b) - getProjectCommentCount(a)
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
            tooltip: '先看星级，同星级看评论数，再看评分人数；日/周/月只切换体验数据。',
        }
        : {
            title: '🔥 项目热度榜',
            intro: '按体验人数、星级和有效进入排序。',
            tooltipTitle: '热度榜规则',
            tooltip: '先看体验人数，同人数看星级和评论数，再看有效进入。每人每天最多 3 次有效进入。',
        };

    const filtered = projects.filter(p => {
        const tagMatch = selectedTag === 'all' || p.tags.includes(selectedTag);
        const creatorMatch = selectedCreator === 'all' || getDisplayName(p.author_name || p.author || '') === selectedCreator;
        const savedMatch = !showSavedOnly || bookmarkedProjectIds.has(Number(p.id));
        const liveMatch = !showLiveOnly || p.status === 'live';
        return tagMatch && creatorMatch && savedMatch && liveMatch;
    }).sort((a, b) => {
        if (sortType === 'rating') {
            return Number(b.rating || 0) - Number(a.rating || 0)
                || getProjectCommentCount(b) - getProjectCommentCount(a)
                || Number(b.rating_count || 0) - Number(a.rating_count || 0)
                || a.title.localeCompare(b.title);
        } else {
            return a.title.localeCompare(b.title);
        }
    });

    const handleRatingUpdate = (projectId: number | string, newRating: number, newCount: number) => {
        setProjects(prev => prev.map(p => 
            String(p.id) === String(projectId) ? { ...p, rating: newRating, rating_count: newCount } : p
        ));
    };

    const handleBookmarkUpdate = (projectId: number | string, bookmarked: boolean) => {
        const normalizedProjectId = Number(projectId);
        if (!Number.isFinite(normalizedProjectId) || normalizedProjectId <= 0) return;

        setBookmarkedProjectIds(current => {
            const next = new Set(current);
            if (bookmarked) {
                next.add(normalizedProjectId);
            } else {
                next.delete(normalizedProjectId);
            }
            return next;
        });
    };

    const handleTipSuccess = (points: number) => {
        setLocalUserPoints(Math.max(0, Math.round(Number(points || 0))));
    };

    const toggleSavedFilter = () => {
        if (!user) {
            setSubmissionMessage('登录并完成 Hajimi 认证后可以收藏项目。');
            return;
        }

        if (!canSubmitProjects) {
            setSubmissionMessage('完成 Hajimi 认证后可以收藏项目。');
            return;
        }

        setShowSavedOnly(value => !value);
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

    const resetSubmissionDraft = (type: 'new_project' | 'new_version' = 'new_project') => {
        setSubmissionType(type);
        setSubmissionProjectId('');
        setSubmissionTitle('');
        setSubmissionDescription('');
        setSubmissionEmoji('🚀');
        setSubmissionUrl('');
        setSubmissionTags(['Game']);
        setSubmissionVersionNotes('');
        setSubmissionCoverUrl('');
    };

    const openSubmissionDraft = (draft: SubmissionDraft = { type: 'new_project' }) => {
        setSubmissionMessage('');
        if (!user) {
            setSubmissionMessage('登录并完成 Hajimi 认证后可以提交项目或新版本申请。');
            return;
        }

        if (!canSubmitProjects) {
            setSubmissionMessage('完成 Hajimi 认证后可以提交项目或新版本申请。');
            return;
        }

        if (draft.type === 'new_version' && draft.project) {
            const projectTags = Array.isArray(draft.project.tags)
                ? draft.project.tags.filter((tag: string) => ALL_TAGS.includes(tag as ProjectTag)).slice(0, 5)
                : [];

            setSubmissionType('new_version');
            setSubmissionProjectId(String(draft.project.id));
            setSubmissionTitle(String(draft.project.title || ''));
            setSubmissionDescription(String(draft.project.description || ''));
            setSubmissionEmoji(String(draft.project.emoji || '🚀'));
            setSubmissionUrl(String(draft.project.url || ''));
            setSubmissionTags(projectTags.length > 0 ? projectTags as ProjectTag[] : ['Game']);
            setSubmissionVersionNotes('更新项目介绍、链接或封面截图。');
            setSubmissionCoverUrl(String(draft.project.cover_url || draft.project.coverUrl || ''));
            setSubmissionMessage('已载入当前项目信息，修改后会作为新版本提交给管理员审核。');
        } else {
            resetSubmissionDraft('new_project');
        }

        setShowSubmissionForm(true);
        window.requestAnimationFrame(() => {
            document.querySelector('.project-submission-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        if (showSubmissionForm) {
            setShowSubmissionForm(false);
            return;
        }

        openSubmissionDraft({ type: 'new_project' });
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
            resetSubmissionDraft('new_project');
        } finally {
            setSubmissionLoading(false);
        }
    };

    return (
        <div>
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
                            <button type="button" className={submissionType === 'new_project' ? 'is-active' : ''} onClick={() => resetSubmissionDraft('new_project')}>新项目</button>
                            <button type="button" className={submissionType === 'new_version' ? 'is-active' : ''} onClick={() => setSubmissionType('new_version')}>新版本</button>
                        </div>
                        {submissionType === 'new_version' && (
                            <label>
                                要更新的项目
                                <select value={submissionProjectId} onChange={event => setSubmissionProjectId(event.target.value)} className="glass-input" required>
                                    <option value="">选择项目</option>
                                    {projects.filter(project => currentUserId !== null && Number(project.author_id) === currentUserId).map(project => (
                                        <option key={project.id} value={project.id}>{project.title}</option>
                                    ))}
                                </select>
                                <span className="project-submission-help">只能为自己已经发布的项目提交新版本，审核通过后才会更新线上卡片。</span>
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
                        <ProjectCoverStudio value={submissionCoverUrl} onChange={setSubmissionCoverUrl} />
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

            <div className="hub-updates-stack">
                {spotlightSlides.length > 0 && (
                    <section
                        className="hub-spotlight-panel"
                        aria-label="Hub 新项目宣传栏"
                        onMouseEnter={() => setSpotlightPaused(true)}
                        onMouseLeave={() => setSpotlightPaused(false)}
                        onFocusCapture={() => setSpotlightPaused(true)}
                        onBlurCapture={() => setSpotlightPaused(false)}
                    >
                        <article className="hub-spotlight-frame" aria-live="polite">
                            {spotlightSlides.map((item, index) => {
                                const { copy, project } = item;
                                const isActive = index === activeSpotlightIndex;

                                return (
                                    <section
                                        key={item.key}
                                        className={`hub-spotlight-slide ${isActive ? 'is-active' : ''}`}
                                        aria-hidden={!isActive}
                                    >
                                        <div className="hub-spotlight-copy">
                                            <div className="hub-spotlight-topline">
                                                <div className="hub-spotlight-label-row">
                                                    <span className="hub-spotlight-label">{copy.label}</span>
                                                    <span className="hub-spotlight-status">{copy.status}</span>
                                                </div>
                                                <div className="hub-spotlight-actions">
                                                    {copy.ctaTarget === 'submit' ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="hub-spotlight-cta"
                                                                tabIndex={isActive ? undefined : -1}
                                                                onClick={openSubmissionForm}
                                                            >
                                                                {copy.ctaLabel}
                                                            </button>
                                                            {user?.role === 'admin' && (
                                                                <a
                                                                    className="hub-spotlight-secondary"
                                                                    href="/admin/project-submissions"
                                                                    tabIndex={isActive ? undefined : -1}
                                                                >
                                                                    审核
                                                                </a>
                                                            )}
                                                        </>
                                                    ) : copy.ctaTarget === 'projects' ? (
                                                        <button
                                                            type="button"
                                                            className="hub-spotlight-cta"
                                                            tabIndex={isActive ? undefined : -1}
                                                            onClick={scrollToProjectGrid}
                                                        >
                                                            {copy.ctaLabel}
                                                        </button>
                                                    ) : project?.url && (
                                                        <a
                                                            className="hub-spotlight-cta"
                                                            href={project.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            tabIndex={isActive ? undefined : -1}
                                                            onClick={() => recordProjectOpen(project.id)}
                                                        >
                                                            {copy.ctaLabel}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                            <h2 className="hub-spotlight-title">
                                                {copy.titleBefore}<span>{copy.titleAccent}</span>{copy.titleAfter}
                                            </h2>
                                            <p className="hub-spotlight-text">{copy.text}</p>
                                            <div className="hub-spotlight-meta">
                                                {copy.meta.slice(0, 3).map(item => (
                                                    <span key={item}>{item}</span>
                                                ))}
                                            </div>
                                        </div>

                                        <HubSpotlightVisual kind={copy.kind} project={project} />
                                    </section>
                                );
                            })}

                            {spotlightSlides.length > 1 && (
                                <div className="hub-spotlight-controls" aria-label="项目宣传切换">
                                    <button
                                        type="button"
                                        className="hub-spotlight-arrow"
                                        aria-label="上一条项目宣传"
                                        onClick={() => setSpotlightIndex(current => (current - 1 + spotlightSlides.length) % spotlightSlides.length)}
                                    >
                                        ‹
                                    </button>
                                    <div className="hub-spotlight-dots" role="tablist" aria-label="Hub spotlight slides">
                                        {spotlightSlides.map((item, index) => {
                                            const { copy } = item;
                                            return (
                                                <button
                                                    key={item.key}
                                                    type="button"
                                                    className={`hub-spotlight-dot ${index === activeSpotlightIndex ? 'is-active' : ''}`}
                                                    aria-label={`查看 ${copy.ctaLabel} 宣传`}
                                                    aria-selected={index === activeSpotlightIndex}
                                                    role="tab"
                                                    onMouseEnter={() => setSpotlightIndex(index)}
                                                    onFocus={() => setSpotlightIndex(index)}
                                                    onClick={() => setSpotlightIndex(index)}
                                                />
                                            );
                                        })}
                                    </div>
                                    <button
                                        type="button"
                                        className="hub-spotlight-arrow"
                                        aria-label="下一条项目宣传"
                                        onClick={() => setSpotlightIndex(current => (current + 1) % spotlightSlides.length)}
                                    >
                                        ›
                                    </button>
                                </div>
                            )}
                        </article>
                    </section>
                )}

                <section className="hub-leaderboard-panel">
                    <div className="hub-leaderboard-head">
                        <div className="hub-leaderboard-heading">
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
                        </div>
                        <div className="hub-leaderboard-controls">
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
                                        <small>by {getDisplayName(project.author_name || project.author || '')}</small>
                                    </span>
                                    <span className="hub-leaderboard-meta">
                                        {stats.uniquePlayers} 人体验 · {stats.effectiveOpens} 次有效进入 · ⭐ {Number(project.rating || 0).toFixed(1)} · 💬 {getProjectCommentCount(project)}
                                    </span>
                                </a>
                            );
                        })}
                    </div>
                </section>
            </div>

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
                        onClick={toggleSavedFilter}
                        className={`project-live-toggle project-saved-toggle ${showSavedOnly ? 'is-active' : ''}`}
                        disabled={!!user && canSubmitProjects && !bookmarksLoaded}
                        style={{
                            background: showSavedOnly ? 'rgba(108, 92, 231, 0.18)' : 'rgba(255,255,255,0.6)',
                            color: showSavedOnly ? '#5b4fe6' : '#636e72',
                            margin: 0
                        }}
                    >
                        <span aria-hidden="true">{showSavedOnly ? '★' : '☆'}</span>
                        Saved {savedCount > 0 ? savedCount : ''}
                    </button>
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
                id="hub-project-showcase"
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
                            <ProjectCard
                                project={project}
                                user={user}
                                canInteract={canSubmitProjects}
                                canEdit={currentUserId !== null && Number(project.author_id) === currentUserId}
                                isBookmarked={bookmarkedProjectIds.has(Number(project.id))}
                                userPoints={localUserPoints}
                                onEditProject={() => openSubmissionDraft({ type: 'new_version', project })}
                                onRatingUpdate={handleRatingUpdate}
                                onBookmarkUpdate={handleBookmarkUpdate}
                                onTipSuccess={handleTipSuccess}
                            />
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

function HubSpotlightVisual({ kind, project }: { kind: SpotlightKind, project: any }) {
    if (kind === 'submit') {
        return (
            <div className="hub-spotlight-visual hub-submit-visual" aria-hidden="true">
                <div className="hub-submit-step">
                    <strong>01</strong>
                    <span>填写信息</span>
                </div>
                <div className="hub-submit-step">
                    <strong>02</strong>
                    <span>提交审核</span>
                </div>
                <div className="hub-submit-step">
                    <strong>03</strong>
                    <span>上线展示</span>
                </div>
            </div>
        );
    }

    if (kind === 'rewards') {
        return (
            <div className="hub-spotlight-visual hub-rewards-visual" aria-hidden="true">
                <div className="hub-rewards-orbit">
                    <span>+2</span>
                    <span>+3</span>
                    <span>+5</span>
                </div>
                <div className="hub-rewards-card">
                    <strong>XP Feedback</strong>
                    <p>评论 · 评分 · 支持创作者</p>
                    <div>
                        <span>💬</span>
                        <span>⭐</span>
                        <span>🎁</span>
                    </div>
                </div>
            </div>
        );
    }

    const coverUrl = getImageDisplayUrl(project?.cover_url || project?.coverUrl);
    if (coverUrl) {
        return (
            <div className="hub-spotlight-visual hub-spotlight-cover-visual" aria-hidden="true">
                <img src={coverUrl} alt="" loading="lazy" decoding="async" />
            </div>
        );
    }

    if (kind === 'ocean') {
        return (
            <div className="hub-spotlight-visual" aria-hidden="true">
                <div className="hub-ocean-poster">
                    <span className="hub-ocean-bridge" />
                    <span className="hub-ocean-sail">⛵</span>
                    <span className="hub-ocean-sail">⛵</span>
                    <span className="hub-ocean-sail">⛵</span>
                    <div className="hub-ocean-poster-content">
                        <div className="hub-ocean-brand">{project.emoji || '⛵'} THE OCEAN EXPLORER</div>
                        <div className="hub-ocean-title">
                            <strong>远航帆船社区</strong>
                            <span>赛事 · 排名 · 训练资料</span>
                        </div>
                        <div className="hub-ocean-stats">
                            <div>
                                <strong>Race</strong>
                                <span>赛事排名</span>
                            </div>
                            <div>
                                <strong>Track</strong>
                                <span>赛事轨迹</span>
                            </div>
                            <div>
                                <strong>Rank</strong>
                                <span>水手榜单</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="hub-spotlight-visual" aria-hidden="true">
            <div className="hub-paper-workspace">
                <div className="hub-paper-stack">
                    <div className="hub-paper-page" />
                    <div className="hub-paper-page" />
                    <div className="hub-paper-page">
                        <h3>May Jun</h3>
                        <span />
                        <span />
                        <span />
                        <p>2024 paper set</p>
                    </div>
                </div>
                <div className="hub-paper-panel">
                    <div className="hub-paper-toolbar">
                        <span />
                        <span />
                        <span />
                        <strong>playtest queue</strong>
                    </div>
                    <div className="hub-paper-insight">
                        <strong>测试任务</strong>
                        <div>
                            <span><b>QP</b><small>paper</small></span>
                            <span><b>MS</b><small>scheme</small></span>
                            <span><b>ZIP</b><small>batch</small></span>
                        </div>
                    </div>
                    <div className="hub-paper-feedback">
                        <strong>反馈重点</strong>
                        <p>搜索、配对预览、下载路径、收藏科目是否符合真实复习习惯。</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ProjectCard({
    project,
    user,
    canInteract,
    canEdit,
    isBookmarked,
    userPoints,
    onEditProject,
    onRatingUpdate,
    onBookmarkUpdate,
    onTipSuccess,
}: {
    project: any,
    user: User | null,
    canInteract: boolean,
    canEdit: boolean,
    isBookmarked: boolean,
    userPoints: number,
    onEditProject: () => void,
    onRatingUpdate?: (projectId: number | string, rating: number, count: number) => void,
    onBookmarkUpdate?: (projectId: number | string, bookmarked: boolean) => void,
    onTipSuccess?: (points: number) => void,
}) {
    const isLive = project.status === 'live';
    const [rating, setRating] = useState(Number(project.rating || project.likes || 0));
    const [ratingCount, setRatingCount] = useState(Number(project.rating_count || project.likes || 0));
    const [hoverScore, setHoverScore] = useState(0);
    const [selectedScore, setSelectedScore] = useState(0);
    const [ownRatingScore, setOwnRatingScore] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [hasLoadedComments, setHasLoadedComments] = useState(false);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [xpBurst, setXpBurst] = useState('');
    const [interactionMessage, setInteractionMessage] = useState('');
    const [coverFailed, setCoverFailed] = useState(false);
    const [bookmarkPending, setBookmarkPending] = useState(false);
    const [tipAmount, setTipAmount] = useState(5);
    const [customTipAmount, setCustomTipAmount] = useState('');
    const [tipPending, setTipPending] = useState(false);
    const [tipMessage, setTipMessage] = useState('');
    const displayAuthor = project.author_name
        ? (project.author_name.toLowerCase() === 'eric' ? 'AI Club' : project.author_name)
        : (project.author?.toLowerCase() === 'eric' ? 'AI Club' : project.author);
    const commentCount = project.commentCount || comments.length || 0;
    const tagline = getProjectTagline(project);
    const primaryTag = getPrimaryProjectTag(project);
    const coverUrl = isValidCoverUrl(project.cover_url || project.coverUrl) ? String(project.cover_url || project.coverUrl).trim() : '';
    const coverImageSrc = getImageDisplayUrl(coverUrl);
    const coverAccent = TAG_COLORS[primaryTag] || project.accent_color || project.accentColor || '#6c5ce7';
    const canTipProject = isLive && user && Number(user.id) !== Number(project.author_id);

    useEffect(() => {
        setCoverFailed(false);
    }, [coverUrl]);

    const openBack = () => {
        setIsFlipped(true);
        if (!hasLoadedComments) {
            fetchComments();
        }
    };

    const closeBack = () => {
        setIsFlipped(false);
        setInteractionMessage('');
        setHoverScore(0);
    };

    const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (isFlipped) {
            closeBack();
        } else {
            openBack();
        }
    };

    const requireProjectInteraction = (action = '评分和评论项目') => {
        if (!user) {
            setInteractionMessage(`登录并完成 Hajimi 认证后可以${action}。`);
            setIsFlipped(true);
            return true;
        }

        if (!canInteract) {
            setInteractionMessage(`完成 Hajimi 认证后可以${action}。`);
            setIsFlipped(true);
            return true;
        }

        return false;
    };

    const handleBookmarkToggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (requireProjectInteraction('收藏项目')) return;
        if (bookmarkPending) return;

        const previous = isBookmarked;
        setBookmarkPending(true);
        onBookmarkUpdate?.(project.id, !previous);
        setInteractionMessage('');

        try {
            const res = await fetch('/api/projects/bookmark', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.id }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                onBookmarkUpdate?.(project.id, previous);
                setInteractionMessage(data?.error || '收藏项目失败，请稍后再试。');
                setIsFlipped(true);
                return;
            }
            onBookmarkUpdate?.(project.id, !!data?.bookmarked);
            setTipMessage(data?.bookmarked ? '已收藏到 Saved。' : '已取消收藏。');
        } catch (error) {
            console.warn('Project bookmark failed:', error);
            onBookmarkUpdate?.(project.id, previous);
            setInteractionMessage('收藏项目失败，请稍后再试。');
            setIsFlipped(true);
        } finally {
            setBookmarkPending(false);
        }
    };

    const handleTipAmountSelect = (amount: number) => {
        setTipAmount(amount);
        setCustomTipAmount('');
        setTipMessage('');
    };

    const handleCustomTipChange = (value: string) => {
        const normalized = value.replace(/[^\d]/g, '').slice(0, 3);
        setCustomTipAmount(normalized);
        setTipAmount(Number(normalized || 0));
        setTipMessage('');
    };

    const handleTipProject = async (event: React.FormEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (requireProjectInteraction('打赏项目')) return;
        if (!canTipProject) {
            setTipMessage(canEdit ? '不能给自己的项目打赏。' : '项目上线后才可以打赏。');
            return;
        }

        const amount = Math.floor(Number(tipAmount || customTipAmount || 0));
        if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
            setTipMessage('打赏金额需要是 1-100 的整数。');
            return;
        }
        if (amount > Math.max(0, Number(userPoints || 0))) {
            setTipMessage('积分余额不足，先去签到、评论或发布内容赚 XP。');
            return;
        }
        if (tipPending) return;

        setTipPending(true);
        setTipMessage('');

        try {
            const res = await fetch('/api/projects/tip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.id, amount }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setTipMessage(data?.error || '打赏失败，请稍后再试。');
                return;
            }

            onTipSuccess?.(Number(data?.senderPoints ?? Math.max(0, Number(userPoints || 0) - amount)));
            setTipMessage(`已打赏 ${amount} XP，创作者会收到你的支持。`);
            setXpBurst(`-${amount} XP`);
            window.setTimeout(() => setXpBurst(''), 900);
        } catch (error) {
            console.warn('Project tip failed:', error);
            setTipMessage('打赏失败，请稍后再试。');
        } finally {
            setTipPending(false);
        }
    };

    const getScoreFromPointer = (element: HTMLDivElement, clientX: number) => {
        const rect = element.getBoundingClientRect();
        const x = clientX - rect.left;
        const width = rect.width;
        const percentage = Math.max(0, Math.min(1, x / width));
        return Math.ceil(percentage * 10) / 2; // 0.5 increments
    };

    const handleStarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        setHoverScore(getScoreFromPointer(e.currentTarget, e.clientX));
    };

    const handleStarClick = (event: React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (requireProjectInteraction()) return;
        const score = getScoreFromPointer(event.currentTarget, event.clientX);
        setSelectedScore(score);
        setHoverScore(score);
    };

    const fetchComments = async () => {
        setInteractionMessage('');
        try {
            const res = await fetch(`/api/projects/comments?projectId=${project.id}`);
            if (!res.ok) throw new Error('Comments request failed');
            const data = await res.json();
            const nextComments = Array.isArray(data)
                ? data
                : Array.isArray(data?.comments) ? data.comments : [];
            const myFeedback = !Array.isArray(data) && data?.myFeedback ? data.myFeedback : null;
            setComments(nextComments);
            setHasLoadedComments(true);

            const myComment = nextComments.find((c: any) => c.is_own_comment);
            const nextCommentContent = myFeedback?.content ?? myComment?.content ?? '';
            const nextScore = Number(myFeedback?.score ?? myComment?.author_score ?? 0);
            if (nextCommentContent) {
                setNewComment(nextCommentContent);
            }
            if (Number.isFinite(nextScore) && nextScore > 0) {
                setSelectedScore(nextScore);
                setOwnRatingScore(nextScore);
                setHoverScore(0);
            }
        } catch (error) {
            console.error('Failed to load project comments:', error);
            setComments([]);
            setHasLoadedComments(false);
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
        
        const ownComment = comments.find(c => c.is_own_comment);
        const isCommentUpdate = !!ownComment;
        const isRatingUpdate = ownRatingScore > 0;
        const oldScore = Number(ownRatingScore || ownComment?.author_score || 0);
        
        // Optimistic UI for rating
        let newCount = ratingCount;
        let newRating = rating;

        if (isRatingUpdate) {
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
        clearCachedJson('projects:');
        
        // Submit comment
        const submittedScore = selectedScore;
        setNewComment('');
        setSelectedScore(0);
        setOwnRatingScore(submittedScore);
        
        const res = await fetch('/api/projects/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: project.id, content: tempContent })
        });
        if (res.ok) {
            clearCachedJson('projects:');
            if (!isCommentUpdate) {
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
        clearCachedJson('projects:');
        
        // Reset inputs if we deleted our own comment
        setNewComment('');
        setSelectedScore(0);
        setOwnRatingScore(0);

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
            className={`project-card-shell ${isFlipped ? 'is-flipped' : ''} ${isLive ? 'is-live' : 'is-soon'}`}
            role="button"
            tabIndex={0}
            aria-label={`${project.title} 项目详情与评分`}
            aria-pressed={isFlipped}
            onClick={openBack}
            onKeyDown={handleCardKeyDown}
            style={{ '--project-accent-bg': project.accent_color || project.accentColor || 'rgba(255,255,255,0.58)' } as CSSProperties}
        >
            <div className="project-card-inner">
                <article className="project-card-face project-card-front glass-panel" aria-hidden={isFlipped} inert={isFlipped ? true : undefined}>
                    <div className="project-card-cover" style={{ '--project-cover-accent': coverAccent } as CSSProperties}>
                        {coverImageSrc && !coverFailed ? (
                            <img
                                className="project-card-cover-image"
                                src={coverImageSrc}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                onError={() => setCoverFailed(true)}
                            />
                        ) : (
                            <div className="project-card-cover-fallback" aria-hidden="true">
                                <span className="project-card-cover-emoji">{project.emoji}</span>
                                <span className="project-card-cover-kicker">{TAG_EMOJIS[primaryTag] ? `${TAG_EMOJIS[primaryTag]} ${primaryTag}` : primaryTag}</span>
                                <strong>{project.title}</strong>
                            </div>
                        )}
                        <div className="project-card-cover-shine" aria-hidden="true" />
                    </div>
                    <div className="project-card-title-row">
                        <div className="project-card-title-block">
                            <h3>{project.title}</h3>
                            <span>by {displayAuthor}</span>
                        </div>
                        <button
                            type="button"
                            className={`project-card-bookmark ${isBookmarked ? 'is-active' : ''}`}
                            aria-label={isBookmarked ? '取消收藏项目' : '收藏项目'}
                            aria-pressed={isBookmarked}
                            disabled={bookmarkPending}
                            tabIndex={isFlipped ? -1 : undefined}
                            onClick={handleBookmarkToggle}
                            title={isBookmarked ? '取消收藏' : '收藏项目'}
                        >
                            {isBookmarked ? '★' : '☆'}
                        </button>
                    </div>
                    <p className="project-card-tagline">{tagline}</p>
                    <button
                        type="button"
                        className="project-card-rating-pill"
                        tabIndex={isFlipped ? -1 : undefined}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openBack();
                        }}
                        title="查看评分和评论"
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
                        <span>⭐</span>
                        {rating.toFixed(1)}
                        <span>💬 {commentCount}</span>
                    </button>
                    <div className="project-card-tags">
                        {project.tags.map((tag: string) => (
                            <span key={tag} style={{
                                background: `${TAG_COLORS[tag] || '#dfe6e9'}33`,
                                color: TAG_COLORS[tag] || '#636e72'
                            } as CSSProperties}>{TAG_EMOJIS[tag] ? `${TAG_EMOJIS[tag]} ${tag}` : tag}</span>
                        ))}
                    </div>
                    <div className="project-card-footer">
                        {isLive ? (
                            <div className="project-card-live">
                                <span />
                                Live
                            </div>
                        ) : (
                            <div className="project-card-soon">🔧 Coming Soon</div>
                        )}
                        {isLive && project.url ? (
                            <div className="project-card-footer-actions">
                                {canEdit && (
                                    <button
                                        type="button"
                                        className="project-card-edit"
                                        tabIndex={isFlipped ? -1 : undefined}
                                        onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            onEditProject();
                                        }}
                                    >
                                        编辑
                                    </button>
                                )}
                                <a
                                    href={project.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="project-card-open"
                                    tabIndex={isFlipped ? -1 : undefined}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        recordProjectOpen(project.id);
                                    }}
                                >
                                    Open →
                                </a>
                            </div>
                        ) : isLive && (
                            <div className="project-card-footer-actions">
                                {canEdit && (
                                    <button
                                        type="button"
                                        className="project-card-edit"
                                        tabIndex={isFlipped ? -1 : undefined}
                                        onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            onEditProject();
                                        }}
                                    >
                                        编辑
                                    </button>
                                )}
                                <div className="project-card-open is-disabled">Open →</div>
                            </div>
                        )}
                    </div>
                    <div className="project-card-decoration">{project.emoji}</div>
                </article>

                <article className="project-card-face project-card-back glass-panel" aria-hidden={!isFlipped} inert={!isFlipped ? true : undefined} onClick={event => event.stopPropagation()}>
                    <div className="project-card-back-head">
                        <div>
                            <span>{project.emoji} Project Review</span>
                            <h3>{project.title}</h3>
                            <small>by {displayAuthor}</small>
                        </div>
                        <button type="button" className="project-card-back-button" tabIndex={isFlipped ? undefined : -1} onClick={closeBack}>Back</button>
                    </div>

                    <div className="project-card-back-scroll">
                        <p className="project-card-back-description">{project.description}</p>
                        <div className="project-card-back-meta">
                            <span>⭐ {rating.toFixed(1)}</span>
                            <span>{ratingCount} ratings</span>
                            <span>{commentCount} comments</span>
                            {user && <span>余额 {Math.max(0, Math.round(Number(userPoints || 0)))} XP</span>}
                        </div>
                        {canEdit && (
                            <button
                                type="button"
                                className="project-card-owner-edit"
                                tabIndex={isFlipped ? undefined : -1}
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onEditProject();
                                }}
                            >
                                修改项目信息 / 提交新版本审核
                            </button>
                        )}
                        <div className="project-card-tags">
                            {project.tags.map((tag: string) => (
                                <span key={tag} style={{
                                    background: `${TAG_COLORS[tag] || '#dfe6e9'}33`,
                                    color: TAG_COLORS[tag] || '#636e72'
                                } as CSSProperties}>{TAG_EMOJIS[tag] ? `${TAG_EMOJIS[tag]} ${tag}` : tag}</span>
                            ))}
                        </div>
                        <form className="project-card-tip-box" onSubmit={handleTipProject}>
                            <div className="project-card-tip-head">
                                <div>
                                    <strong>打赏积分</strong>
                                    <span>支持创作者，积分会从你的余额转给作者。</span>
                                </div>
                                <button
                                    type="button"
                                    className={`project-card-bookmark is-back ${isBookmarked ? 'is-active' : ''}`}
                                    aria-label={isBookmarked ? '取消收藏项目' : '收藏项目'}
                                    aria-pressed={isBookmarked}
                                    disabled={bookmarkPending}
                                    tabIndex={isFlipped ? undefined : -1}
                                    onClick={handleBookmarkToggle}
                                >
                                    {isBookmarked ? '★' : '☆'}
                                </button>
                            </div>
                            <div className="project-card-tip-options">
                                {[5, 10, 20].map(amount => (
                                    <button
                                        key={amount}
                                        type="button"
                                        className={!customTipAmount && tipAmount === amount ? 'is-active' : ''}
                                        tabIndex={isFlipped ? undefined : -1}
                                        onClick={() => handleTipAmountSelect(amount)}
                                    >
                                        {amount}
                                    </button>
                                ))}
                                <input
                                    value={customTipAmount}
                                    onChange={event => handleCustomTipChange(event.target.value)}
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="自定义"
                                    aria-label="自定义打赏积分"
                                    tabIndex={isFlipped ? undefined : -1}
                                />
                                <button
                                    type="submit"
                                    className="project-card-tip-submit"
                                    disabled={tipPending || !canTipProject || tipAmount < 1}
                                    tabIndex={isFlipped ? undefined : -1}
                                >
                                    {tipPending ? '打赏中' : '打赏'}
                                </button>
                            </div>
                            {tipMessage && <p className="project-card-tip-message">{tipMessage}</p>}
                        </form>
                        <div className="project-card-comments">
                            {comments.length > 0 ? comments.map(c => (
                                <div key={c.id} className="project-card-comment">
                                    <div>
                                        <strong>
                                            {c.author_name}
                                            {c.author_score > 0 && <span>⭐ {c.author_score}</span>}
                                        </strong>
                                        <p>{c.content}</p>
                                    </div>
                                    {c.is_own_comment && (
                                        <button
                                            type="button"
                                            tabIndex={isFlipped ? undefined : -1}
                                            onClick={() => handleDeleteComment(c.id)}
                                            title="Delete comment"
                                        >🗑️</button>
                                    )}
                                </div>
                            )) : (
                                <div className="project-card-empty-comments">还没有评论，翻到这里的你可以当第一个。</div>
                            )}
                        </div>
                        {interactionMessage && (
                            <div className="forum-verification-callout project-interaction-callout">
                                <span>{interactionMessage}</span>
                                <button
                                    type="button"
                                    tabIndex={isFlipped ? undefined : -1}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        window.location.assign(user ? '/profile' : '/login');
                                    }}
                                >
                                    {user ? '去认证' : '登录'}
                                </button>
                            </div>
                        )}
                    </div>

                    <form className="project-card-rating-form" onSubmit={handleComment}>
                        <div className="project-card-star-row">
                            <span>Your Rating</span>
                            <div
                                className="project-card-stars"
                                tabIndex={isFlipped ? 0 : -1}
                                onMouseMove={handleStarMouseMove}
                                onMouseLeave={() => setHoverScore(0)}
                                onClick={handleStarClick}
                                title={hoverScore > 0 ? `Rate ${hoverScore} stars` : 'Select a rating'}
                            >
                                <div>★★★★★</div>
                                <div style={{ width: `${((hoverScore > 0 ? hoverScore : selectedScore) / 5) * 100}%` }}>
                                    ★★★★★
                                </div>
                            </div>
                            <strong>{hoverScore > 0 ? hoverScore : selectedScore > 0 ? selectedScore : ''}</strong>
                        </div>
                        <div className="project-card-comment-form">
                            <input
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                maxLength={500}
                                tabIndex={isFlipped ? undefined : -1}
                                placeholder={selectedScore > 0 ? 'Leave a comment...' : 'Pick stars first...'}
                                onClick={event => event.stopPropagation()}
                            />
                            <button
                                type="submit"
                                className="btn btn-primary"
                                tabIndex={isFlipped ? undefined : -1}
                                disabled={selectedScore === 0 || !newComment.trim()}
                            >
                                Post
                            </button>
                        </div>
                    </form>
                </article>
            </div>
        </div>
    );
}
