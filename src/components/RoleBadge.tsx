import { BADGE_DEFINITIONS, type BadgeId } from '@/lib/badges';
import { isStaffRole } from '@/lib/roles';
import { isReadOnlyRole, normalizeUserRole } from '@/lib/access';
import BadgePill from './BadgePill';

export default function RoleBadge({ role, showStudent = false, compact = false, iconOnly = false }: { role?: string | null; showStudent?: boolean; compact?: boolean; iconOnly?: boolean }) {
    const normalizedRole = normalizeUserRole(role);
    const isStaff = isStaffRole(normalizedRole);

    if (!isStaff && !isReadOnlyRole(normalizedRole) && !showStudent) {
        return null;
    }

    const badge = BADGE_DEFINITIONS[(normalizedRole as BadgeId) in BADGE_DEFINITIONS ? normalizedRole as BadgeId : 'student'];

    return (
        <BadgePill badge={badge} compact={compact} iconOnly={iconOnly} />
    );
}
