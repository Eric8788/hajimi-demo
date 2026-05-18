import type { BadgeDefinition } from '@/lib/badges';

export default function BadgePill({ badge, compact = false, iconOnly = false }: { badge: BadgeDefinition; compact?: boolean; iconOnly?: boolean }) {
    return (
        <span
            title={badge.title}
            className={`user-badge-pill${iconOnly ? ' is-icon-only' : ''}${compact ? ' is-compact' : ''}`}
            style={{
                border: badge.tone.border,
                background: badge.tone.bg,
                color: badge.tone.color,
                boxShadow: badge.tone.shadow,
            }}
        >
            <span aria-hidden="true">{badge.emoji}</span>
            {!iconOnly && <span>{badge.label}</span>}
        </span>
    );
}
