import type { AgentIntent, AgentScreenContext } from './types';

const CONTINUATION_PATTERN = /(?:刚才|刚刚|上面|上一条|继续|那个|它呢|前面|刚才说的|as before|that one|the above|continue|earlier|it\b)/i;
const PLATFORM_PATTERN = /(?:在线|上线|来过|成员|用户|帖子|文章|Hallway|hallway|Function\s*Hall|项目|project|作者|社区|网站|系统|数据库|实时数据|页面数据|公告|通知|排行榜|leaderboard|XP|H币|coin|在线人数|校友地图|alumni|map|AI\s*(?:项目|project|Table|tabletop))/i;
const PAGE_PATTERN = /(?:这个页面|当前页面|本页|这里的页面|页面上|网页上|按钮|链接|表格|卡片|标题|这个界面|what(?:'s| is) on (?:this|the) page|this page|on this page|button|link|table|card|screen)/i;
const VISION_PATTERN = /(?:截图|截屏|画面|图片|图中|图里|看图|视觉上|颜色|位置关系|长什么样|screenshot|screen(?:shot)?|image|picture|visual(?:ly)?|color|where is|what do you see)/i;
const SENSITIVE_PATH_PATTERN = /^\/(?:admin(?:\/|$)|settings(?:\/|$)|wallet(?:\/|$)|hasdaq\/apply(?:\/|$))/i;

export function isSensitiveAgentPath(pathname?: string | null) {
    return SENSITIVE_PATH_PATTERN.test(String(pathname || '').trim());
}

export function isMostlyChinese(text: string) {
    const han = (text.match(/[\u3400-\u9fff]/g) || []).length;
    const latin = (text.match(/[A-Za-z]/g) || []).length;
    return han >= 2 && han >= latin;
}

export function detectAgentIntent(message: string, currentPath = ''): AgentIntent {
    const text = String(message || '').trim();
    if (isSensitiveAgentPath(currentPath)) {
        return 'sensitive';
    }
    if (VISION_PATTERN.test(text)) {
        return 'vision';
    }
    if (CONTINUATION_PATTERN.test(text)) {
        return 'continuation';
    }
    if (PLATFORM_PATTERN.test(text)) {
        return 'platform';
    }
    if (PAGE_PATTERN.test(text)) {
        return 'page';
    }
    return 'casual';
}

export function shouldCapturePage(intent: AgentIntent) {
    return intent === 'page' || intent === 'vision';
}

export function getHistoryLimit(intent: AgentIntent, message: string) {
    const text = String(message || '').trim();
    if (intent === 'casual' && text.length <= 12 && !CONTINUATION_PATTERN.test(text)) return 0;
    if (intent === 'continuation') return 20;
    if (intent === 'casual') return 4;
    return 8;
}

export function getAgentToolNames(intent: AgentIntent, message: string) {
    if (intent !== 'platform') return [] as string[];

    const text = String(message || '');
    const tools: string[] = [];
    if (/(?:在线|上线|online|online members|来过|presence)/i.test(text)) tools.push('presence');
    if (/(?:帖子|文章|hallway|post|thread|公告|通知)/i.test(text)) tools.push('hallway');
    if (/(?:项目|project|function hall|ai table|tabletop)/i.test(text)) tools.push('projects');
    if (/(?:我自己|我的资料|我的个人|my profile|about me|my stats|my account)/i.test(text)) tools.push('self');
    if (/(?:校友地图|alumni map|校友|alumni)/i.test(text)) tools.push('alumni');

    if (tools.length === 0) tools.push('platform');
    return Array.from(new Set(tools));
}

export function getRequestedScreenMode(intent: AgentIntent, screenContext?: AgentScreenContext | null): AgentScreenContext['mode'] | 'none' {
    if (!shouldCapturePage(intent)) return 'none';
    return screenContext?.mode || (intent === 'vision' ? 'vision' : 'structured');
}
