export type ForumPromoAccent = 'purple' | 'aqua' | 'trust';

export type ForumPromo = {
    kicker: string;
    title: string;
    body: string;
    notes: readonly [string, string, string];
    pin: string;
    accent: ForumPromoAccent;
};

export const FORUM_PROMOS: readonly ForumPromo[] = [
    {
        kicker: 'AI Club Hallway 🎉',
        title: '首次发帖立得 100 积分！',
        body: '发帖、获赞、被收藏都能涨分，快来成为社区大佬吧！',
        notes: ['announcement', 'project drop', 'feedback'],
        pin: '★',
        accent: 'purple',
    },
    {
        kicker: 'AI Club Hub 🚀',
        title: '发布项目进 Hub 领 100 积分！',
        body: '把你的游戏、工具或实验发布到 Hub，让大家打开体验，也让创作者徽章亮起来。',
        notes: ['ship it', 'creator badge', '+100 XP'],
        pin: '✦',
        accent: 'aqua',
    },
];
