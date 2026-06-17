import { normalizeUserRole } from './access';

export const STAFF_ROLES = new Set(['teacher', 'admin']);
export const ADMIN_ROLES = new Set(['admin']);

function normalizeRole(role?: string | null) {
    return normalizeUserRole(role);
}

export function isStaffRole(role?: string | null) {
    return STAFF_ROLES.has(normalizeRole(role));
}

export function isAdminRole(role?: string | null) {
    return ADMIN_ROLES.has(normalizeRole(role));
}
