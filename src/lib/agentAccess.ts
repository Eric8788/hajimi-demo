import { canUseMemberInteractions, isReadOnlyRole } from './access';
import type { User } from './db';

export function canUseDomiAgent(user?: Pick<User, 'role' | 'verification_status' | 'account_status'> | null) {
    return Boolean(
        user
        && user.account_status !== 'disabled'
        && !isReadOnlyRole(user.role)
        && canUseMemberInteractions(user),
    );
}
