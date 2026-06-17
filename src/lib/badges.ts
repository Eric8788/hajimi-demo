import type { User } from './db';

import { normalizeUserRole } from './access';

export type BadgeId = 'admin' | 'teacher' | 'student' | 'parent' | 'visitor' | 'verified' | 'creator' | 'ai_club';

export type BadgeUser = Pick<User, 'role' | 'username' | 'is_creator' | 'badge_preferences' | 'verification_status'>;

export interface BadgeDefinition {
    id: BadgeId;
    emoji: string;
    label: string;
    title: string;
    tone: {
        bg: string;
        border: string;
        color: string;
        shadow?: string;
    };
}

export const BADGE_DEFINITIONS: Record<BadgeId, BadgeDefinition> = {
    admin: {
        id: 'admin',
        emoji: '👨‍🔧',
        label: '管理员',
        title: '管理员',
        tone: { bg: 'rgba(253, 203, 110, 0.22)', border: '1px solid rgba(253, 203, 110, 0.62)', color: '#9a6716' },
    },
    teacher: {
        id: 'teacher',
        emoji: '🧑‍🏫',
        label: '老师',
        title: '老师',
        tone: { bg: 'rgba(9, 132, 227, 0.15)', border: '1px solid rgba(9, 132, 227, 0.4)', color: '#0984e3' },
    },
    student: {
        id: 'student',
        emoji: '🧑‍🎓',
        label: '学生',
        title: '学生',
        tone: { bg: 'rgba(0, 184, 148, 0.15)', border: '1px solid rgba(0, 184, 148, 0.4)', color: '#00b894' },
    },
    parent: {
        id: 'parent',
        emoji: '👪',
        label: '家长',
        title: '家长参观账号',
        tone: { bg: 'rgba(253, 121, 168, 0.14)', border: '1px solid rgba(253, 121, 168, 0.36)', color: '#b83b6c' },
    },
    visitor: {
        id: 'visitor',
        emoji: '🎟️',
        label: '访客',
        title: '访客参观账号',
        tone: { bg: 'rgba(99, 110, 114, 0.12)', border: '1px solid rgba(99, 110, 114, 0.28)', color: '#636e72' },
    },
    verified: {
        id: 'verified',
        emoji: '✅',
        label: '认证',
        title: 'Hajimi 已认证',
        tone: { bg: 'rgba(108, 92, 231, 0.14)', border: '1px solid rgba(108, 92, 231, 0.34)', color: '#6c5ce7' },
    },
    creator: {
        id: 'creator',
        emoji: '🛠️',
        label: 'Creator',
        title: '项目创作者',
        tone: {
            bg: 'linear-gradient(135deg, rgba(162, 155, 254, 0.25), rgba(108, 92, 231, 0.25))',
            border: '1px solid rgba(108, 92, 231, 0.4)',
            color: '#6c5ce7',
            shadow: '0 4px 10px rgba(108, 92, 231, 0.1)',
        },
    },
    ai_club: {
        id: 'ai_club',
        emoji: '👾',
        label: 'AI Club',
        title: 'AI Club 成员',
        tone: {
            bg: 'rgba(45, 52, 54, 0.08)',
            border: '1px solid rgba(45, 52, 54, 0.18)',
            color: '#2d3436',
            shadow: '0 4px 10px rgba(45, 52, 54, 0.08)',
        },
    },
};

const AI_CLUB_USERNAMES = new Set(['eric', 'alberty', 'p1tter', '1ming', '🥚1ming', 'cooka', 'jackz', 'luna1919810']);
const VALID_BADGE_IDS = new Set<BadgeId>(Object.keys(BADGE_DEFINITIONS) as BadgeId[]);
const DEFAULT_BADGE_ORDER: BadgeId[] = ['admin', 'teacher', 'student', 'parent', 'visitor', 'verified', 'ai_club', 'creator'];

function normalizeUsername(username?: string | null) {
    return (username || '').trim().toLowerCase();
}

export function isAiClubMember(username?: string | null) {
    const normalized = normalizeUsername(username);
    return AI_CLUB_USERNAMES.has(normalized);
}

export function normalizeBadgePreferences(value?: string[] | null): BadgeId[] {
    if (!Array.isArray(value)) return [];

    const seen = new Set<BadgeId>();
    return value
        .filter((item): item is BadgeId => VALID_BADGE_IDS.has(item as BadgeId))
        .filter(item => {
            if (seen.has(item)) return false;
            seen.add(item);
            return true;
        })
        .slice(0, 3);
}

export function getAvailableBadges(user: BadgeUser): BadgeDefinition[] {
    const role = normalizeUserRole(user.role) as BadgeId;
    const ids = new Set<BadgeId>();

    if (role === 'admin' || role === 'teacher' || role === 'parent' || role === 'visitor') {
        ids.add(role);
    } else {
        ids.add('student');
    }

    if (user.verification_status === 'verified') ids.add('verified');
    if (isAiClubMember(user.username)) ids.add('ai_club');
    if (user.is_creator) ids.add('creator');

    return DEFAULT_BADGE_ORDER
        .filter(id => ids.has(id))
        .map(id => BADGE_DEFINITIONS[id]);
}

export function getVisibleBadges(user: BadgeUser, max = 3): BadgeDefinition[] {
    const available = getAvailableBadges(user);
    const availableIds = new Set(available.map(badge => badge.id));
    const selected = normalizeBadgePreferences(user.badge_preferences).filter(id => availableIds.has(id));
    const orderedIds = [...selected, ...available.map(badge => badge.id).filter(id => !selected.includes(id))].slice(0, max);

    return orderedIds.map(id => BADGE_DEFINITIONS[id]);
}
