export const NOTIFICATION_TARGET_EVENT = 'hajimi-notification-target';

export type NotificationTargetDetail = {
    hash: string;
};

export function navigateToNotificationTarget(hash: string) {
    if (typeof window === 'undefined' || !hash) return;

    window.history.pushState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}${hash}`,
    );
    window.dispatchEvent(new CustomEvent<NotificationTargetDetail>(NOTIFICATION_TARGET_EVENT, {
        detail: { hash },
    }));
}
