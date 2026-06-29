import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { getInteractionBlockedMessage, isReadOnlyRole } from '@/lib/access';

const SILICONFLOW_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const ZENMUX_URL = 'https://zenmux.ai/api/v1/chat/completions';
const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const PROVIDER_TIMEOUT_MS = 45000;
const ORACLE_TOTAL_TIMEOUT_MS = 55000;
const DAILY_ORACLE_LIMIT = 3;

type OracleCard = {
    position: string;
    name: string;
    meaning: string;
};

type OracleProviderConfig = {
    provider: 'openai' | 'custom' | 'dashscope' | 'siliconflow' | 'zenmux' | 'tokendance';
    apiKey: string;
    apiUrl: string;
    model: string;
    wireApi: 'chat_completions' | 'responses';
};

type OracleReadingRow = {
    id: number;
    cards: unknown;
    initial_reading: string | null;
    follow_up_at: string | null;
};

type OracleCardInfo = {
    zhName: string;
    coreMeaning: string;
};

const CARD_INFO: Record<string, OracleCardInfo> = {
    'The Fool': { zhName: '愚者', coreMeaning: '新的开始、自由、试探未知，也可能带着天真和冒险' },
    'The Magician': { zhName: '魔术师', coreMeaning: '资源整合、主动创造、把想法变成现实' },
    'The High Priestess': { zhName: '女祭司', coreMeaning: '直觉、隐藏的信息、安静观察和内在知识' },
    'The Empress': { zhName: '女皇', coreMeaning: '滋养、创作、照顾关系，也提醒别让温柔变成过度消耗' },
    'The Emperor': { zhName: '皇帝', coreMeaning: '秩序、边界、责任和稳定结构' },
    'The Hierophant': { zhName: '教皇', coreMeaning: '传统、规则、学习体系和被认可的方法' },
    'The Lovers': { zhName: '恋人', coreMeaning: '关系、选择、价值观对齐和真诚连接' },
    'The Chariot': { zhName: '战车', coreMeaning: '意志、控制方向、推进和胜负心' },
    Strength: { zhName: '力量', coreMeaning: '温柔的勇气、自我驯服、耐心和内在韧性' },
    'The Hermit': { zhName: '隐者', coreMeaning: '独处、反省、寻找自己的判断和答案' },
    'Wheel of Fortune': { zhName: '命运之轮', coreMeaning: '周期变化、机会转动、局势不完全由个人控制' },
    Justice: { zhName: '正义', coreMeaning: '公平、因果、清晰判断和承担选择的后果' },
    'The Hanged Man': { zhName: '倒吊人', coreMeaning: '暂停、换角度、放下旧执念和等待时机' },
    Death: { zhName: '死神', coreMeaning: '结束、转化、告别旧阶段，为新状态腾位置' },
    Temperance: { zhName: '节制', coreMeaning: '平衡、调和、耐心和不同需求之间的配比' },
    'The Devil': { zhName: '恶魔', coreMeaning: '束缚、欲望、依赖、逃避和被看见的阴影' },
    'The Tower': { zhName: '高塔', coreMeaning: '突变、崩塌、真相显露，也拆掉不稳的旧结构' },
    'The Star': { zhName: '星星', coreMeaning: '希望、疗愈、信念恢复和长线愿景' },
    'The Moon': { zhName: '月亮', coreMeaning: '不安、想象、模糊信息和潜意识里的担心' },
    'The Sun': { zhName: '太阳', coreMeaning: '明朗、活力、成功感和被看见的快乐' },
    Judgement: { zhName: '审判', coreMeaning: '召唤、复盘、觉醒、重新回应真正重要的事' },
    'The World': { zhName: '世界', coreMeaning: '完成、整合、阶段收束和更大的视野' },
};

function env(name: string) {
    return process.env[name]?.trim() || '';
}

function isTruthy(value: string) {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function getWireApi(value: string): OracleProviderConfig['wireApi'] {
    return value.toLowerCase() === 'responses' ? 'responses' : 'chat_completions';
}

function normalizeProviderUrl(url: string, wireApi: OracleProviderConfig['wireApi']) {
    const trimmed = url.replace(/\/+$/, '');
    if (/\/(chat\/completions|responses)$/.test(trimmed)) return trimmed;
    return `${trimmed}/${wireApi === 'responses' ? 'responses' : 'chat/completions'}`;
}

function getTokendanceUrl() {
    const baseUrl = env('TOKENDANCE_BASE_URL');
    if (!baseUrl) return '';
    return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

function getOracleConfigs(): OracleProviderConfig[] {
    const configs: OracleProviderConfig[] = [];

    const openAIKey = env('OPENAI_API_KEY');
    if (openAIKey) {
        const wireApi = getWireApi(env('OPENAI_WIRE_API') || 'responses');
        configs.push({
            provider: 'openai',
            apiKey: openAIKey,
            apiUrl: normalizeProviderUrl(env('OPENAI_BASE_URL') || env('OPENAI_API_BASE') || OPENAI_DEFAULT_BASE_URL, wireApi),
            model: env('OPENAI_MODEL') || env('HAJIMI_ORACLE_OPENAI_MODEL') || 'gpt-5.5',
            wireApi,
        });
    }

    const customKey = env('HAJIMI_ORACLE_API_KEY');
    const customUrl = env('HAJIMI_ORACLE_API_URL');
    const customModel = env('HAJIMI_ORACLE_MODEL');

    if (customKey && customUrl && customModel) {
        const wireApi = getWireApi(env('HAJIMI_ORACLE_WIRE_API'));
        configs.push({
            provider: 'custom',
            apiKey: customKey,
            apiUrl: normalizeProviderUrl(customUrl, wireApi),
            model: customModel,
            wireApi,
        });
    }

    const zenmuxKey = env('ZENMUX_API_KEY');
    if (zenmuxKey) {
        configs.push({
            provider: 'zenmux',
            apiKey: zenmuxKey,
            apiUrl: ZENMUX_URL,
            model: env('HAJIMI_ORACLE_ZENMUX_MODEL') || 'deepseek/deepseek-v3.2',
            wireApi: 'chat_completions',
        });
    }

    const dashscopeKey = env('DASHSCOPE_API_KEY');
    if (dashscopeKey) {
        configs.push({
            provider: 'dashscope',
            apiKey: dashscopeKey,
            apiUrl: DASHSCOPE_URL,
            model: env('HAJIMI_ORACLE_DASHSCOPE_MODEL') || 'qwen-max',
            wireApi: 'chat_completions',
        });
    }

    const siliconflowKey = env('SILICONFLOW_API_KEY');
    if (siliconflowKey) {
        configs.push({
            provider: 'siliconflow',
            apiKey: siliconflowKey,
            apiUrl: SILICONFLOW_URL,
            model: env('HAJIMI_ORACLE_SILICONFLOW_MODEL') || 'deepseek-ai/DeepSeek-V3',
            wireApi: 'chat_completions',
        });
    }

    const tokendanceKey = env('TOKENDANCE_API_KEY');
    const tokendanceUrl = getTokendanceUrl();
    if (tokendanceKey && tokendanceUrl) {
        configs.push({
            provider: 'tokendance',
            apiKey: tokendanceKey,
            apiUrl: tokendanceUrl,
            model: env('HAJIMI_ORACLE_TOKENDANCE_MODEL') || 'deepseek-v3.2',
            wireApi: 'chat_completions',
        });
    }

    return configs;
}

function isOracleCard(value: unknown): value is OracleCard {
    if (!value || typeof value !== 'object') return false;
    const card = value as Record<string, unknown>;
    return (
        typeof card.position === 'string' &&
        typeof card.name === 'string' &&
        typeof card.meaning === 'string' &&
        card.name.trim().length > 0 &&
        card.meaning.trim().length > 0
    );
}

function getCardInfo(card: OracleCard) {
    return CARD_INFO[card.name] ?? {
        zhName: card.name,
        coreMeaning: card.meaning,
    };
}

function getCardLabel(card: OracleCard) {
    const info = getCardInfo(card);
    return `${info.zhName}（${card.name}）`;
}

function getCardMeaning(card: OracleCard) {
    return getCardInfo(card).coreMeaning;
}

function formatCardForPrompt(card: OracleCard) {
    return `${card.position}: ${getCardLabel(card)}\n核心牌义：${getCardMeaning(card)}\n原始牌义：${card.meaning}`;
}

function sanitizeReading(text: string, maxLength = 620) {
    return text
        .replace(/^["'“”]+|["'“”]+$/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function extractResponsesText(data: unknown) {
    if (!data || typeof data !== 'object') return '';
    const payload = data as Record<string, unknown>;

    if (typeof payload.output_text === 'string') {
        return payload.output_text;
    }

    const output = payload.output;
    if (!Array.isArray(output)) return '';

    return output
        .flatMap(item => {
            if (!item || typeof item !== 'object') return [];
            const outputItem = item as Record<string, unknown>;
            if (typeof outputItem.text === 'string') return [outputItem.text];

            const content = outputItem.content;
            if (!Array.isArray(content)) return [];

            return content.flatMap(part => {
                if (!part || typeof part !== 'object') return [];
                const contentPart = part as Record<string, unknown>;
                return typeof contentPart.text === 'string' ? [contentPart.text] : [];
            });
        })
        .join('\n')
        .trim();
}

function extractChatCompletionText(data: unknown) {
    if (!data || typeof data !== 'object') return '';
    const choices = (data as Record<string, unknown>).choices;
    if (!Array.isArray(choices)) return '';

    const firstChoice = choices[0];
    if (!firstChoice || typeof firstChoice !== 'object') return '';

    const message = (firstChoice as Record<string, unknown>).message;
    if (!message || typeof message !== 'object') return '';

    const content = (message as Record<string, unknown>).content;
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';

    return content
        .flatMap(part => {
            if (!part || typeof part !== 'object') return [];
            const contentPart = part as Record<string, unknown>;
            return typeof contentPart.text === 'string' ? [contentPart.text] : [];
        })
        .join('\n')
        .trim();
}

function buildFallbackReading(cards: OracleCard[]) {
    const [past, present, future] = cards;
    const pastLabel = getCardLabel(past);
    const presentLabel = getCardLabel(present);
    const futureLabel = getCardLabel(future);

    return [
        `这组三张牌不是在催你立刻做决定，而是在讲一个节奏：${pastLabel} 给出过去的底色，${presentLabel} 指出当下的张力，${futureLabel} 像未来传来的回声。`,
        `过去位的 ${pastLabel} 代表${getCardMeaning(past)}。放到你的状态里，它像一个已经熟悉的反应方式：曾经帮你撑住场面，也可能让某些真实感受被放到后面。`,
        `现在位的 ${presentLabel} 代表${getCardMeaning(present)}。它更像把灯打到眼前的问题上：不是责怪你，而是让你看见哪种期待、关系或计划正在牵动你。`,
        `未来位的 ${futureLabel} 代表${getCardMeaning(future)}。它没有要求你变成另一个人，只是在提示：接下来会更适合顺着真正有回应感的方向走，而不是继续应付所有声音。`,
    ].join('\n\n');
}

function buildFallbackFollowUp(cards: OracleCard[], question: string) {
    const [past, present, future] = cards;

    return [
        `把「${question}」放回牌面看，${getCardLabel(past)} 代表${getCardMeaning(past)}：它像是在指出，这个新信息触到了你原本熟悉的反应方式。`,
        `${getCardLabel(present)} 的主题是${getCardMeaning(present)}，而 ${getCardLabel(future)} 代表${getCardMeaning(future)}。两张牌连起来看，重点不是立刻解决，而是重新分辨哪部分最值得认真听。`,
    ].join('\n\n');
}

async function requestOracleText(
    config: OracleProviderConfig,
    system: string,
    prompt: string,
    timeoutMs: number,
    maxOutputTokens = 1100,
    maxCharacters = 900,
) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const disableStorage = isTruthy(env('OPENAI_DISABLE_RESPONSE_STORAGE') || env('HAJIMI_ORACLE_DISABLE_RESPONSE_STORAGE'));
        const reasoningEffort = env('OPENAI_REASONING_EFFORT') || env('MODEL_REASONING_EFFORT');
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(
                config.wireApi === 'responses'
                    ? {
                        model: config.model,
                        instructions: system,
                        input: prompt,
                        max_output_tokens: maxOutputTokens,
                        ...(disableStorage ? { store: false } : {}),
                        ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
                    }
                    : {
                        model: config.model,
                        temperature: 0.86,
                        max_tokens: maxOutputTokens,
                        messages: [
                            { role: 'system', content: system },
                            { role: 'user', content: prompt },
                        ],
                    },
            ),
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`${config.provider} ${response.status}`);
        }

        const data = await response.json();
        const content = config.wireApi === 'responses'
            ? extractResponsesText(data)
            : extractChatCompletionText(data);
        if (typeof content !== 'string' || !content.trim()) {
            throw new Error(`${config.provider} returned an empty oracle reading`);
        }

        return sanitizeReading(content, maxCharacters);
    } finally {
        clearTimeout(timeoutId);
    }
}

async function ensureOracleReadingsTable() {
    await sql`
      CREATE TABLE IF NOT EXISTS oracle_readings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reading_date DATE NOT NULL DEFAULT CURRENT_DATE,
        cards JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`ALTER TABLE oracle_readings ADD COLUMN IF NOT EXISTS initial_reading TEXT`;
    await sql`ALTER TABLE oracle_readings ADD COLUMN IF NOT EXISTS follow_up_question TEXT`;
    await sql`ALTER TABLE oracle_readings ADD COLUMN IF NOT EXISTS follow_up_answer TEXT`;
    await sql`ALTER TABLE oracle_readings ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMP WITH TIME ZONE`;
    await sql`CREATE INDEX IF NOT EXISTS idx_oracle_readings_user_date ON oracle_readings(user_id, reading_date)`;
}

async function getTodayOracleUsage(userId: number) {
    await ensureOracleReadingsTable();

    const { rows } = await sql<{ count: number }>`
      SELECT COUNT(*)::int as count
      FROM oracle_readings
      WHERE user_id = ${userId}
        AND reading_date = CURRENT_DATE
    `;

    return rows[0]?.count ?? 0;
}

async function recordOracleReading(userId: number, cards: OracleCard[], reading: string) {
    await ensureOracleReadingsTable();
    const { rows } = await sql<{ id: number }>`
      INSERT INTO oracle_readings (user_id, reading_date, cards, initial_reading)
      VALUES (${userId}, CURRENT_DATE, ${JSON.stringify(cards)}::jsonb, ${reading})
      RETURNING id
    `;

    return rows[0]?.id ?? null;
}

async function getOracleReadingForFollowUp(userId: number, readingId: number) {
    await ensureOracleReadingsTable();
    const { rows } = await sql<OracleReadingRow>`
      SELECT id, cards, initial_reading, follow_up_at
      FROM oracle_readings
      WHERE id = ${readingId}
        AND user_id = ${userId}
      LIMIT 1
    `;

    return rows[0] ?? null;
}

async function saveOracleFollowUp(userId: number, readingId: number, question: string, answer: string) {
    const { rows } = await sql<{ id: number }>`
      UPDATE oracle_readings
      SET follow_up_question = ${question},
          follow_up_answer = ${answer},
          follow_up_at = CURRENT_TIMESTAMP
      WHERE id = ${readingId}
        AND user_id = ${userId}
        AND follow_up_at IS NULL
      RETURNING id
    `;

    return Boolean(rows[0]);
}

async function createOracleFollowUp(userId: number, body: Record<string, unknown>) {
    const readingId = Number(body.readingId);
    const question = String(body.question ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 420);

    if (!Number.isInteger(readingId) || readingId <= 0) {
        return NextResponse.json({ error: 'Reading id is required' }, { status: 400 });
    }

    if (question.length < 4) {
        return NextResponse.json({ error: '请先补充一点你想追问的背景。' }, { status: 400 });
    }

    const row = await getOracleReadingForFollowUp(userId, readingId);
    if (!row) {
        return NextResponse.json({ error: 'Reading not found' }, { status: 404 });
    }

    if (row.follow_up_at) {
        return NextResponse.json({ error: '这次 Reveal 的追问已经用过啦。', followUpUsed: true }, { status: 409 });
    }

    const cards = Array.isArray(row.cards) ? row.cards.filter(isOracleCard).slice(0, 3) : [];
    if (cards.length !== 3) {
        return NextResponse.json({ error: 'Reading cards are unavailable' }, { status: 400 });
    }

    const initialReading = row.initial_reading?.trim() || buildFallbackReading(cards);
    const fallbackAnswer = buildFallbackFollowUp(cards, question);
    const configs = getOracleConfigs();
    const system = [
        '你是 Hajimi 的水晶球追问助手。学生已经抽过三张塔罗牌，并刚刚提供了新的个人背景。',
        '请结合原始牌面、上一段解读和学生的新信息，给出一次追问回应。',
        '这只是反思和灵感，不要使用宿命论、恐吓、医疗、法律、投资等严肃建议。',
        '输出 2-3 个短段落，每段 45-85 个中文字符，段落之间用空行分隔。',
        '必须至少点名两张相关牌，格式使用“中文名（English Name）”，并说明这张牌此处代表什么。',
        '不要复述完整原文，不要 Markdown 项目符号；不要用“做小实验、完成任务、打卡验证”作为固定收尾。',
        '语气像温柔但清醒的 AI 朋友，可以给观察角度，但不要说教、不要命令学生。',
    ].join('\n');
    const cardPrompt = cards.map(formatCardForPrompt).join('\n\n');
    const prompt = [
        `牌面：\n${cardPrompt}`,
        `上一段解读：\n${initialReading}`,
        `学生补充的新信息：\n${question}`,
        '请给出水晶球追问回应：把新信息放回具体牌面里，解释牌义如何改变判断；结尾可以是温和提醒，但不要变成行动清单。',
    ].join('\n\n');
    const oracleStartedAt = Date.now();
    let answer = fallbackAnswer;

    for (const config of configs) {
        const remainingBudget = ORACLE_TOTAL_TIMEOUT_MS - (Date.now() - oracleStartedAt);
        if (remainingBudget < 2500) break;

        try {
            answer = await requestOracleText(
                config,
                system,
                prompt,
                Math.min(PROVIDER_TIMEOUT_MS, remainingBudget),
                520,
                380,
            );
            break;
        } catch (error) {
            console.error(
                `[oracle] ${config.provider} follow-up failed after ${Date.now() - oracleStartedAt}ms, trying next provider`,
                error,
            );
        }
    }

    const saved = await saveOracleFollowUp(userId, readingId, question, answer);
    if (!saved) {
        return NextResponse.json({ error: '这次 Reveal 的追问已经用过啦。', followUpUsed: true }, { status: 409 });
    }

    return NextResponse.json({
        followUpAnswer: answer,
        followUpUsed: true,
    });
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await getUserById(Number(session.userId));
        if (isReadOnlyRole(user?.role)) {
            return NextResponse.json({ error: getInteractionBlockedMessage(user, '使用 Cyber Oracle') }, { status: 403 });
        }

        const body = await request.json() as Record<string, unknown>;
        if (body.mode === 'followup') {
            return createOracleFollowUp(session.userId, body);
        }

        const rawCards: unknown[] = Array.isArray(body?.cards) ? body.cards : [];
        const cards: OracleCard[] = rawCards.filter(isOracleCard).slice(0, 3);

        if (cards.length !== 3) {
            return NextResponse.json({ error: 'Three cards are required' }, { status: 400 });
        }

        const userId = session.userId;
        const usedToday = await getTodayOracleUsage(userId);
        const remainingBeforeReading = Math.max(0, DAILY_ORACLE_LIMIT - usedToday);
        if (remainingBeforeReading <= 0) {
            return NextResponse.json(
                {
                    error: '今日 Oracle 解读次数已用完，明天再来抽牌吧。',
                    remaining: 0,
                    limit: DAILY_ORACLE_LIMIT,
                },
                { status: 429 },
            );
        }
        const fallbackReading = buildFallbackReading(cards);
        const responsePayloadMeta = {
            remaining: remainingBeforeReading - 1,
            limit: DAILY_ORACLE_LIMIT,
        };
        const configs = getOracleConfigs();
        if (configs.length === 0) {
            const readingId = await recordOracleReading(userId, cards, fallbackReading);
            return NextResponse.json({
                reading: fallbackReading,
                readingId,
                followUpUsed: false,
                ...responsePayloadMeta,
            });
        }

        const system = [
            '你是 Hajimi 的 Cyber Oracle。请用中文为高中 AI Club 学生生成一段有深度、温暖、有创意的塔罗解读。',
            '这只是反思和灵感，不要使用宿命论、恐吓、医疗、法律、投资等严肃建议。',
            '输出 300-430 个中文字符，拆成 4 个短段落，段落之间用空行分隔。',
            '第 1 段是总览：点出三张牌之间的关系，可以同时提到三张牌名。',
            '第 2 段只讲 Past 牌，第 3 段只讲 Present 牌，第 4 段只讲 Future 牌。',
            '每个单牌段落都必须包含：牌的中文名、英文名，说明“这张牌代表什么”，再结合学生常见处境解释。',
            '使用“女皇（The Empress）”这种格式；不要只写英文牌名。',
            '不要把解读写成学习任务清单；少用“应该、必须、立刻”。禁止把“做小实验、打卡验证、完成一个任务”当固定结尾。',
            '可以结合高中学生常见场景：学习、社交、创作、社团项目、焦虑、拖延和自我期待。',
            '语气要像一个懂学习、创作、社交和成长的 AI 朋友，具体、有画面，但不要装神秘、不要说教。',
        ].join('\n');
        const userPrompt = cards
            .map(formatCardForPrompt)
            .join('\n');

        const oracleStartedAt = Date.now();

        for (const config of configs) {
            const remainingBudget = ORACLE_TOTAL_TIMEOUT_MS - (Date.now() - oracleStartedAt);
            if (remainingBudget < 2500) break;

            try {
                const prompt = `抽到的牌如下：\n${userPrompt}\n\n请严格按 4 段输出：总览 / Past / Present / Future。每个单牌段落都要写出这张牌的中文名、英文名、核心代表含义，并结合具体情境解读。`;
                const reading = await requestOracleText(
                    config,
                    system,
                    prompt,
                    Math.min(PROVIDER_TIMEOUT_MS, remainingBudget),
                    900,
                    720,
                );
                const readingId = await recordOracleReading(userId, cards, reading);

                return NextResponse.json({
                    reading,
                    readingId,
                    followUpUsed: false,
                    ...responsePayloadMeta,
                });
            } catch (error) {
                console.error(
                    `[oracle] ${config.provider} request failed after ${Date.now() - oracleStartedAt}ms, trying next provider`,
                    error,
                );
            }
        }

        const readingId = await recordOracleReading(userId, cards, fallbackReading);
        return NextResponse.json({
            reading: fallbackReading,
            readingId,
            followUpUsed: false,
            ...responsePayloadMeta,
        });
    } catch (error) {
        console.error('[oracle] failed to generate reading', error);
        return NextResponse.json({ error: 'Oracle AI request failed' }, { status: 500 });
    }
}

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserById(Number(session.userId));
    if (isReadOnlyRole(user?.role)) {
        return NextResponse.json({
            remaining: 0,
            limit: DAILY_ORACLE_LIMIT,
            readonly: true,
            message: getInteractionBlockedMessage(user, '使用 Cyber Oracle'),
        });
    }

    const usedToday = await getTodayOracleUsage(session.userId);

    return NextResponse.json({
        remaining: Math.max(0, DAILY_ORACLE_LIMIT - usedToday),
        limit: DAILY_ORACLE_LIMIT,
    });
}
