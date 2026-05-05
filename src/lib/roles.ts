export const STAFF_ROLES = new Set(['teacher', 'admin']);

export function isStaffRole(role?: string | null) {
    return STAFF_ROLES.has((role || '').toLowerCase());
}
