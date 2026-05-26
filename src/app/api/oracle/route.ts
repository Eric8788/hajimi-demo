import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getSession } from '@/lib/auth';

const SILICONFLOW_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const ZENMUX_URL = 'https://zenmux.ai/api/v1/chat/completions';
const PROVIDER_TIMEOUT_MS = 16000;
const ORACLE_TOTAL_TIMEOUT_MS = 26000;
const DAILY_ORACLE_LIMIT = 3;

type OracleCard = {
    position: string;
    name: string;
    meaning: string;
};

type OracleProviderConfig = {
    provider: 'custom' | 'dashscope' | 'siliconflow' | 'zenmux' | 'tokendance';
    apiKey: string;
    apiUrl: string;
    model: string;
};

function env(name: string) {
    return process.env[name]?.trim() || '';
}

function getTokendanceUrl() {
    const baseUrl = env('TOKENDANCE_BASE_URL');
    if (!baseUrl) return '';
    return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

function getOracleConfigs(): OracleProviderConfig[] {
    const configs: OracleProviderConfig[] = [];
    const customKey = env('HAJIMI_ORACLE_API_KEY');
    const customUrl = env('HAJIMI_ORACLE_API_URL');
    const customModel = env('HAJIMI_ORACLE_MODEL');

    if (customKey && customUrl && customModel) {
        configs.push({
            provider: 'custom',
            apiKey: customKey,
            apiUrl: customUrl,
            model: customModel,
        });
    }

    const zenmuxKey = env('ZENMUX_API_KEY');
    if (zenmuxKey) {
        configs.push({
            provider: 'zenmux',
            apiKey: zenmuxKey,
            apiUrl: ZENMUX_URL,
            model: env('HAJIMI_ORACLE_ZENMUX_MODEL') || 'deepseek/deepseek-v3.2',
        });
    }

    const dashscopeKey = env('DASHSCOPE_API_KEY');
    if (dashscopeKey) {
        configs.push({
            provider: 'dashscope',
            apiKey: dashscopeKey,
            apiUrl: DASHSCOPE_URL,
            model: env('HAJIMI_ORACLE_DASHSCOPE_MODEL') || 'qwen-max',
        });
    }

    const siliconflowKey = env('SILICONFLOW_API_KEY');
    if (siliconflowKey) {
        configs.push({
            provider: 'siliconflow',
            apiKey: siliconflowKey,
            apiUrl: SILICONFLOW_URL,
            model: env('HAJIMI_ORACLE_SILICONFLOW_MODEL') || 'deepseek-ai/DeepSeek-V3',
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

function sanitizeReading(text: string) {
    return text
        .replace(/^["'“”]+|["'“”]+$/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
        .slice(0, 900);
}

function buildFallbackReading(cards: OracleCard[]) {
    const [past, present, future] = cards;

    return [
        `过去的 ${past.name} 指向一种已经形成惯性的处理方式：你可能习惯先把情绪压下去，或者用“再等等”来避免面对真正的问题。它不是坏事，只是这套方法已经开始消耗你的注意力。`,
        `现在的 ${present.name} 把焦点拉回当下：先分清楚你是在追求真实目标，还是在回应别人的期待。今天最重要的不是一次性解决全部，而是把一个模糊压力拆成可命名、可行动的小块。`,
        `未来的 ${future.name} 提醒你，能量会从一个很小的动作里回来。选一件 20 分钟内能完成的事，写下结果，或者找一个可信的人讲清楚你的下一步。不要等状态完美，先让自己重新进入流动。`,
    ].join('\n\n');
}

async function requestOracleReading(config: OracleProviderConfig, system: string, userPrompt: string, timeoutMs: number) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: config.model,
                temperature: 0.86,
                max_tokens: 1100,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: `抽到的牌如下：\n${userPrompt}\n请给出本次 Oracle Insight：先读出三张牌之间的张力，再给一个今天可以尝试的小行动。` },
                ],
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`${config.provider} ${response.status}`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
            throw new Error(`${config.provider} returned an empty oracle reading`);
        }

        return sanitizeReading(content);
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

async function recordOracleReading(userId: number, cards: OracleCard[]) {
    await ensureOracleReadingsTable();
    await sql`
      INSERT INTO oracle_readings (user_id, reading_date, cards)
      VALUES (${userId}, CURRENT_DATE, ${JSON.stringify(cards)}::jsonb)
    `;
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
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
            await recordOracleReading(userId, cards);
            return NextResponse.json({
                reading: fallbackReading,
                ...responsePayloadMeta,
            });
        }

        const system = [
            '你是 Hajimi 的 Cyber Oracle。请用中文为高中 AI Club 学生生成一段有深度、温暖、有创意的塔罗解读。',
            '这只是反思和灵感，不要使用宿命论、恐吓、医疗、法律、投资等严肃建议。',
            '输出 420-680 个中文字符，不要 Markdown，不要机械分点，不要复述英文卡牌释义。',
            '必须把三张牌串成一个清晰故事：过去的惯性/卡点，现在的真实课题，未来一两天可执行的微行动。',
            '不要只给安慰和漂亮话；要指出一个真实矛盾、一个容易忽略的心理机制，以及一个可验证的小实验。',
            '可以结合高中学生常见场景：学习、社交、创作、社团项目、焦虑、拖延和自我期待。',
            '语气要像一个懂学习、创作、社交和成长的 AI 朋友，具体、有画面，但不要装神秘。',
        ].join('\n');
        const userPrompt = cards
            .map(card => `${card.position}: ${card.name} (${card.meaning})`)
            .join('\n');

        const oracleStartedAt = Date.now();

        for (const config of configs) {
            const remainingBudget = ORACLE_TOTAL_TIMEOUT_MS - (Date.now() - oracleStartedAt);
            if (remainingBudget < 2500) break;

            try {
                const reading = await requestOracleReading(
                    config,
                    system,
                    userPrompt,
                    Math.min(PROVIDER_TIMEOUT_MS, remainingBudget),
                );
                await recordOracleReading(userId, cards);

                return NextResponse.json({
                    reading,
                    ...responsePayloadMeta,
                });
            } catch (error) {
                console.error(`[oracle] ${config.provider} request failed, trying next provider`, error);
            }
        }

        await recordOracleReading(userId, cards);
        return NextResponse.json({
            reading: fallbackReading,
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

    const usedToday = await getTodayOracleUsage(session.userId);

    return NextResponse.json({
        remaining: Math.max(0, DAILY_ORACLE_LIMIT - usedToday),
        limit: DAILY_ORACLE_LIMIT,
    });
}
