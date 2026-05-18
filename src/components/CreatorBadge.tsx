import { BADGE_DEFINITIONS } from '@/lib/badges';
import BadgePill from './BadgePill';

export default function CreatorBadge({ compact = false, iconOnly = false }: { compact?: boolean; iconOnly?: boolean }) {
    return <BadgePill badge={BADGE_DEFINITIONS.creator} compact={compact} iconOnly={iconOnly} />;
}
