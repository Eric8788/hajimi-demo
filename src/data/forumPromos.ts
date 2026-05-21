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
        title: '提交项目进 Hub，审核后上线！',
        body: '把你的游戏、工具或实验提交到 Hub，管理员审核后发布；贡献会进入项目激励体系。',
        notes: ['submit', 'review', 'creator badge'],
        pin: '✦',
        accent: 'aqua',
    },
];
