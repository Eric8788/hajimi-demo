export type UserRole = 'student' | 'teacher' | 'admin' | 'parent' | 'visitor';

const READ_ONLY_ROLES = new Set(['parent', 'visitor']);

export function normalizeUserRole(role?: string | null): UserRole {
    const normalized = String(role || '').trim().toLowerCase();
    if (normalized === 'admin' || normalized === 'teacher' || normalized === 'parent' || normalized === 'visitor') {
        return normalized;
    }

    return 'student';
}

export function isReadOnlyRole(role?: string | null) {
    return READ_ONLY_ROLES.has(normalizeUserRole(role));
}

export function canUseMemberInteractions(user?: { role?: string | null; verification_status?: string | null } | null) {
    if (!user || isReadOnlyRole(user.role)) return false;
    return user.verification_status === 'verified';
}

export function canViewMemberIdentity(user?: { role?: string | null; verification_status?: string | null; account_status?: string | null } | null) {
    return Boolean(user && user.account_status !== 'disabled' && canUseMemberInteractions(user));
}

export function getReadOnlyRoleLabel(role?: string | null) {
    const normalizedRole = normalizeUserRole(role);
    if (normalizedRole === 'parent') return '家长账号';
    if (normalizedRole === 'visitor') return '访客账号';
    return '只读账号';
}

export function getInteractionBlockedMessage(user?: { role?: string | null; verification_status?: string | null } | null, action = '参与互动') {
    if (user && isReadOnlyRole(user.role)) {
        return `${getReadOnlyRoleLabel(user.role)}可以浏览和体验项目，但不能${action}。`;
    }

    return `完成 Hajimi 认证后可以${action}。`;
}
