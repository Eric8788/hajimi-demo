export type TopicCard = {
    rank: number;
    title: string;
    meta: string;
    score: number;
};

export type NoticeCard = {
    tone?: 'blue';
    title: string;
    meta: string;
};

export type BountyCard = {
    title: string;
    meta: string;
    reward: string;
};

export type BoardPreview = {
    label: string;
    title: string;
    meta: string;
};

export type ForumV1Thread = {
    title: string;
    tag: string;
    author: string;
    participants: string;
    lastReply: string;
    replies: number;
    heat: number;
};

export type ForumV1Highlight = {
    label: string;
    title: string;
    meta: string;
};

export type ForumV1Board = {
    slug: string;
    tone: string;
    badge: string;
    heat: string;
    title: string;
    description: string;
    previews: BoardPreview[];
    stats: string[];
    topics: string[];
    highlights: ForumV1Highlight[];
    threads: ForumV1Thread[];
};

export const boardFilters = ['全部', 'AI Club', 'Forum', '各科互助', 'Memes', '解忧杂货社'] as const;
export const topicFilters = ['全部', '闲聊', '提问', '资源', '活动', '招募', '反馈', '图文'] as const;

export const hotTopics: TopicCard[] = [
    { rank: 1, title: 'Claude Code 周卡怎么配比较省', meta: 'AI Club · 16 人参与 · 最后回复 4 分钟前', score: 42 },
    { rank: 2, title: '数学 IA 选题求拍砖楼', meta: '各科互助 · 9 人参与 · 最后回复 11 分钟前', score: 28 },
    { rank: 3, title: '今天食堂哪个窗口稳定发挥', meta: 'Forum · 21 人参与 · 最后回复 19 分钟前', score: 24 },
];

export const notices: NoticeCard[] = [
    { title: '解忧杂货社：校园空间问卷', meta: '填写有效反馈可获得少量 H币' },
    { tone: 'blue', title: 'Forum V1 预览开放', meta: '旧 Forum 保留，新版入口先作为内部评估' },
];

export const bounties: BountyCard[] = [
    { title: '视觉小说 AI 助手招募前端和剧情策划', meta: '本周产品迭代会确认立项 · 7 人关注', reward: '50 H币' },
    { title: '地图交互小队招募', meta: '下周开题 · 2 人报名', reward: '项目制' },
];

export const forumV1Boards: ForumV1Board[] = [
    {
        slug: 'ai-club',
        tone: 'var(--forum-v1-tone-aqua)',
        badge: '项目与开发',
        heat: '86 热度',
        title: 'AI Club',
        description: '模型、工具、H币、项目协作、代码求助和每周产品迭代会的延伸讨论。',
        previews: [
            { label: '最火', title: 'Claude Code 周卡怎么配比较省', meta: '16 人参与 · 最后回复 4 分钟前' },
            { label: '最新', title: '今天迭代会谁来 demo 新做的 agent 小工具', meta: '刚刚发布 · 2 条回复' },
        ],
        stats: ['8 新回复', '2 招募', '5 新楼'],
        topics: ['模型工具', '代码求助', '项目协作', 'H币机制', '迭代会'],
        highlights: [
            { label: '置顶楼', title: '本周产品迭代会 demo 报名', meta: '周五前登记 · 3 个项目已报名' },
            { label: '本周热楼', title: 'Claude Code 周卡怎么配比较省', meta: '16 人参与 · 42 热度' },
        ],
        threads: [
            { title: 'Claude Code 周卡怎么配比较省', tag: '模型工具', author: 'Albert', participants: '16 人参与', lastReply: '4 分钟前', replies: 18, heat: 42 },
            { title: '今天迭代会谁来 demo 新做的 agent 小工具', tag: '迭代会', author: 'Eric', participants: '6 人参与', lastReply: '刚刚', replies: 7, heat: 31 },
            { title: 'H币悬赏能不能加一个项目验收清单', tag: 'H币机制', author: 'Rex', participants: '8 人参与', lastReply: '17 分钟前', replies: 9, heat: 26 },
            { title: '前端卡片 hover 抖动怎么查', tag: '代码求助', author: 'Cooka', participants: '5 人参与', lastReply: '35 分钟前', replies: 6, heat: 19 },
        ],
    },
    {
        slug: 'forum',
        tone: 'var(--forum-v1-tone-purple)',
        badge: '原来的 Forum',
        heat: '71 热度',
        title: 'Forum',
        description: '就是原来大家直接进来的主讨论区。杂事、吐槽、日常发现和没有明确主题的内容都放这里。',
        previews: [
            { label: '最火', title: '今天食堂哪个窗口稳定发挥', meta: '21 人参与 · 最后回复 19 分钟前' },
            { label: '最新', title: '晚自习后门口那家饮料店第二杯半价', meta: '3 分钟前 · 4 条回复' },
        ],
        stats: ['12 新回复', '3 新楼', '21 人在线'],
        topics: ['校园日常', '闲聊', '反馈', '活动', '问答'],
        highlights: [
            { label: '置顶楼', title: 'Forum V1 预览意见收集', meta: '旧 Forum 继续保留 · 欢迎试用反馈' },
            { label: '本周热楼', title: '今天食堂哪个窗口稳定发挥', meta: '21 人参与 · 24 热度' },
        ],
        threads: [
            { title: '今天食堂哪个窗口稳定发挥', tag: '校园日常', author: 'Jason', participants: '21 人参与', lastReply: '19 分钟前', replies: 22, heat: 24 },
            { title: '晚自习后门口那家饮料店第二杯半价', tag: '闲聊', author: 'Peter', participants: '9 人参与', lastReply: '3 分钟前', replies: 4, heat: 21 },
            { title: '这周五社团活动时间是不是要调整', tag: '活动', author: 'Eric', participants: '12 人参与', lastReply: '26 分钟前', replies: 13, heat: 20 },
            { title: 'Hajimi 手机端侧边栏图标会不会太密', tag: '反馈', author: 'Lucy', participants: '5 人参与', lastReply: '42 分钟前', replies: 5, heat: 14 },
        ],
    },
    {
        slug: 'study-help',
        tone: 'var(--forum-v1-tone-mint)',
        badge: '课程互助',
        heat: '44 热度',
        title: '各科互助',
        description: '数学、经济、物理、化学、生物等先集中在一个板块里，用不同学科楼承载具体问题，避免首页板块过碎。',
        previews: [
            { label: '数学楼', title: '数学 IA 选题求拍砖楼', meta: '9 人参与 · 最后回复 11 分钟前' },
            { label: '经济楼', title: '经济 IA 数据源互助楼', meta: '6 分钟前 · 1 条回复' },
        ],
        stats: ['6 学科楼', '4 资源楼', '9 新回复'],
        topics: ['数学楼', '经济楼', '物理楼', '化学楼', '生物楼', '资源楼'],
        highlights: [
            { label: '置顶楼', title: '各科互助发帖格式：科目 + 问题 + 已尝试方法', meta: '让回答更快对上上下文' },
            { label: '本周热楼', title: '数学 IA 选题求拍砖楼', meta: '9 人参与 · 28 热度' },
        ],
        threads: [
            { title: '数学 IA 选题求拍砖楼', tag: '数学楼', author: 'Mia', participants: '9 人参与', lastReply: '11 分钟前', replies: 12, heat: 28 },
            { title: '经济 IA 数据源互助楼', tag: '经济楼', author: 'Albert', participants: '6 人参与', lastReply: '6 分钟前', replies: 5, heat: 22 },
            { title: '物理 paper 2 最后一道题有没有简化思路', tag: '物理楼', author: 'Rex', participants: '4 人参与', lastReply: '18 分钟前', replies: 4, heat: 18 },
            { title: '化学 organic mechanism 复习资料互换', tag: '资源楼', author: 'Cooka', participants: '7 人参与', lastReply: '51 分钟前', replies: 8, heat: 16 },
        ],
    },
    {
        slug: 'memes',
        tone: 'var(--forum-v1-tone-violet)',
        badge: '轻内容',
        heat: '31 热度',
        title: 'Memes',
        description: '梗图、校园幽默、画图和轻松内容，不和正式讨论混在一起。',
        previews: [
            { label: '最火', title: '本周最像 AI 生成的老师板书截图', meta: '14 人围观 · 最后回复 23 分钟前' },
            { label: '最新', title: '给 Hajimi 做了三张新的 reaction meme', meta: '刚刚发布 · 0 条回复' },
        ],
        stats: ['9 图文', '31 likes', '4 新楼'],
        topics: ['梗图', 'Reaction', '校园幽默', '画图', 'AI 生成'],
        highlights: [
            { label: '置顶楼', title: 'Memes 规则：轻松可以，别点名攻击真人', meta: '轻内容也保持友善边界' },
            { label: '本周热楼', title: '本周最像 AI 生成的老师板书截图', meta: '14 人围观 · 31 likes' },
        ],
        threads: [
            { title: '本周最像 AI 生成的老师板书截图', tag: '梗图', author: 'Peter', participants: '14 人围观', lastReply: '23 分钟前', replies: 10, heat: 31 },
            { title: '给 Hajimi 做了三张新的 reaction meme', tag: 'Reaction', author: 'Lucy', participants: '5 人围观', lastReply: '刚刚', replies: 0, heat: 18 },
            { title: '当你让 AI 解释数学题但它开始写散文', tag: 'AI 生成', author: 'Cooka', participants: '11 人围观', lastReply: '34 分钟前', replies: 7, heat: 17 },
            { title: '社团 demo 前五分钟的真实状态', tag: '校园幽默', author: 'Jason', participants: '8 人围观', lastReply: '1 小时前', replies: 5, heat: 13 },
        ],
    },
    {
        slug: 'xieyou',
        tone: 'var(--forum-v1-tone-amber)',
        badge: '学生会事务',
        heat: '19 热度',
        title: '解忧杂货社',
        description: '问卷、反馈、校园事务收集和活动协作，让学生会内容有固定入口。',
        previews: [
            { label: '最火', title: '晚自习空间问卷：哪里最适合安静做作业', meta: '11 份反馈 · 持续收集中' },
            { label: '最新', title: '操场边长椅要不要加一个充电口投票', meta: '8 分钟前 · 5 条回复' },
        ],
        stats: ['1 问卷', '5 反馈', '2 活动'],
        topics: ['问卷', '校园反馈', '活动协作', '空间建议', '投票'],
        highlights: [
            { label: '置顶楼', title: '本月校园空间反馈集中楼', meta: '统一收集，方便学生会整理' },
            { label: '进行中', title: '晚自习空间问卷：哪里最适合安静做作业', meta: '11 份反馈 · 持续收集中' },
        ],
        threads: [
            { title: '晚自习空间问卷：哪里最适合安静做作业', tag: '问卷', author: '学生会', participants: '11 份反馈', lastReply: '持续收集中', replies: 11, heat: 19 },
            { title: '操场边长椅要不要加一个充电口投票', tag: '投票', author: 'Rex', participants: '8 人参与', lastReply: '8 分钟前', replies: 5, heat: 17 },
            { title: '图书馆小讨论区预约流程能不能简化', tag: '校园反馈', author: 'Mia', participants: '6 人参与', lastReply: '29 分钟前', replies: 6, heat: 16 },
            { title: '下次 AI Club 展示日需要志愿者引导', tag: '活动协作', author: 'Eric', participants: '5 人参与', lastReply: '1 小时前', replies: 4, heat: 12 },
        ],
    },
];

export function getForumV1Board(slug: string) {
    return forumV1Boards.find(board => board.slug === slug);
}
