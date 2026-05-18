import type { BadgeUser } from '@/lib/badges';
import { getVisibleBadges } from '@/lib/badges';
import BadgePill from './BadgePill';

export default function UserBadges({ user, compact = false, iconOnly = false, max = 3 }: { user: BadgeUser; compact?: boolean; iconOnly?: boolean; max?: number }) {
    const badges = getVisibleBadges(user, max);

    if (!badges.length) return null;

    return (
        <span className="user-badge-list">
            {badges.map(badge => (
                <BadgePill key={badge.id} badge={badge} compact={compact} iconOnly={iconOnly} />
            ))}
        </span>
    );
}
