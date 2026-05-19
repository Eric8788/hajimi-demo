import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const SILICONFLOW_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const API_TIMEOUT_MS = 24000;

type OracleCard = {
    position: string;
    name: string;
    meaning: string;
};

type OracleProviderConfig = {
    apiKey: string;
    apiUrl: string;
    model: string;
};

function getOracleConfig(): OracleProviderConfig | null {
    const customKey = process.env.HAJIMI_ORACLE_API_KEY?.trim();
    const customUrl = process.env.HAJIMI_ORACLE_API_URL?.trim();
    const customModel = process.env.HAJIMI_ORACLE_MODEL?.trim();

    if (customKey && customUrl && customModel) {
        return { apiKey: customKey, apiUrl: customUrl, model: customModel };
    }

    const dashscopeKey = process.env.DASHSCOPE_API_KEY?.trim();
    if (dashscopeKey) {
        return {
            apiKey: dashscopeKey,
            apiUrl: DASHSCOPE_URL,
            model: customModel || 'qwen-plus',
        };
    }

    const siliconflowKey = process.env.SILICONFLOW_API_KEY?.trim();
    if (siliconflowKey) {
        return {
            apiKey: siliconflowKey,
            apiUrl: SILICONFLOW_URL,
            model: customModel || 'Qwen/Qwen2.5-7B-Instruct',
        };
    }

    return null;
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
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 360);
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = getOracleConfig();
    if (!config) {
        return NextResponse.json({ error: 'Oracle AI is not configured' }, { status: 503 });
    }

    try {
        const body = await request.json();
        const rawCards: unknown[] = Array.isArray(body?.cards) ? body.cards : [];
        const cards: OracleCard[] = rawCards.filter(isOracleCard).slice(0, 3);

        if (cards.length !== 3) {
            return NextResponse.json({ error: 'Three cards are required' }, { status: 400 });
        }

        const system = [
            '你是 Hajimi 的 Cyber Oracle。请用中文为高中 AI Club 学生生成一段轻量、温暖、有创意的塔罗解读。',
            '这只是反思和灵感，不要使用宿命论、恐吓、医疗、法律、投资等严肃建议。',
            '输出 90-140 个中文字符，不要分点，不要 Markdown，不要复述英文卡牌释义。',
            '语气要像一个懂学习、创作、社交和成长的 AI 朋友。',
        ].join('\n');
        const userPrompt = cards
            .map(card => `${card.position}: ${card.name} (${card.meaning})`)
            .join('\n');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        let response: Response;
        try {
            response = await fetch(config.apiUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: config.model,
                    temperature: 0.88,
                    max_tokens: 220,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: `抽到的牌如下：\n${userPrompt}\n请给出本次 Oracle Insight。` },
                    ],
                }),
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            const detail = await response.text();
            console.error('[oracle] provider error', response.status, detail.slice(0, 500));
            return NextResponse.json({ error: 'Oracle AI provider error' }, { status: 502 });
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
            return NextResponse.json({ error: 'Oracle AI returned empty content' }, { status: 502 });
        }

        return NextResponse.json({ reading: sanitizeReading(content) });
    } catch (error) {
        console.error('[oracle] failed to generate reading', error);
        return NextResponse.json({ error: 'Oracle AI request failed' }, { status: 500 });
    }
}
