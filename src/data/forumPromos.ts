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
        kicker: 'Hajimi XP 🏆',
        title: 'Hajimi XP 怎么获得？',
        body: '认证后可通过签到、发帖、评论、点赞收藏和 Hub 项目反馈获得 XP。首帖 +100，项目审核上线 +100。',
        notes: ['签到 +10/+15/+25', '首帖 +100', '项目上线 +100'],
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
