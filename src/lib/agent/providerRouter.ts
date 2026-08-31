import type { AgentScreenContext } from './types';

type WireApi = 'responses' | 'chat_completions';

type AgentProviderConfig = {
    name: string;
    apiKey: string;
    apiUrl: string;
    model: string;
    wireApi: WireApi;
};

type StreamInput = {
    instructions: string;
    prompt: string;
    image?: AgentScreenContext['image'];
    reasoningEffort?: 'low' | 'medium' | 'high';
    onDelta: (text: string) => void;
    onReplace?: () => void;
};

const PROVIDER_TIMEOUT_MS = 45000;
const AGENT_DEFAULT_MODEL = 'gpt-5.5';
const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const ZENMUX_URL = 'https://zenmux.ai/api/v1/chat/completions';
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const SILICONFLOW_URL = 'https://api.siliconflow.cn/v1/chat/completions';

function env(name: string) {
    return process.env[name]?.trim() || '';
}

function getWireApi(value: string, fallback: WireApi = 'chat_completions'): WireApi {
    return value.toLowerCase() === 'responses' ? 'responses' : value ? 'chat_completions' : fallback;
}

function normalizeUrl(value: string, wireApi: WireApi) {
    const trimmed = value.replace(/\/+$/, '');
    if (/\/(?:responses|chat\/completions)$/.test(trimmed)) return trimmed;
    return `${trimmed}/${wireApi === 'responses' ? 'responses' : 'chat/completions'}`;
}

function splitList(value: string) {
    return value.split(/[\n,]+/).map(item => item.trim()).filter(Boolean);
}

function getAgentKeys() {
    const keys = [
        ...splitList(env('HAJIMI_AGENT_API_KEYS')),
        env('HAJIMI_AGENT_API_KEY'),
    ];
    for (let index = 1; index <= 8; index += 1) {
        keys.push(env(`HAJIMI_AGENT_API_KEY_${index}`));
    }
    return Array.from(new Set(keys.filter(Boolean)));
}

function getFallbackModels() {
    const configured = splitList(env('HAJIMI_AGENT_FALLBACK_MODELS'));
    return Array.from(new Set([env('HAJIMI_AGENT_MODEL') || AGENT_DEFAULT_MODEL, ...configured, 'gpt-5.4', 'gpt-5.2']));
}

export function getAgentReasoningEffort(fallback: 'low' | 'medium' | 'high') {
    const configured = env('HAJIMI_AGENT_REASONING_EFFORT').toLowerCase();
    return configured === 'low' || configured === 'medium' || configured === 'high' ? configured : fallback;
}

function buildProviderConfigs() {
    const configs: AgentProviderConfig[] = [];
    const seen = new Set<string>();
    const add = (config: AgentProviderConfig) => {
        const key = `${config.apiUrl}|${config.apiKey}|${config.model}|${config.wireApi}`;
        if (!config.apiKey || !config.apiUrl || !config.model || seen.has(key)) return;
        seen.add(key);
        configs.push(config);
    };

    const agentUrl = env('HAJIMI_AGENT_API_URL');
    const agentKeys = getAgentKeys();
    const agentModels = getFallbackModels();
    if (agentUrl && agentKeys.length > 0) {
        const wireApi = getWireApi(env('HAJIMI_AGENT_WIRE_API'), 'responses');
        for (const key of agentKeys) {
            for (const model of agentModels) {
                add({ name: 'agent', apiKey: key, apiUrl: normalizeUrl(agentUrl, wireApi), model, wireApi });
            }
        }
    }

    const openAiKey = env('OPENAI_API_KEY');
    if (openAiKey) {
        const wireApi = getWireApi(env('OPENAI_WIRE_API'), 'responses');
        add({
            name: 'openai',
            apiKey: openAiKey,
            apiUrl: normalizeUrl(env('OPENAI_BASE_URL') || env('OPENAI_API_BASE') || OPENAI_DEFAULT_BASE_URL, wireApi),
            model: env('OPENAI_MODEL') || AGENT_DEFAULT_MODEL,
            wireApi,
        });
    }

    const oracleKey = env('HAJIMI_ORACLE_API_KEY');
    const oracleUrl = env('HAJIMI_ORACLE_API_URL');
    if (oracleKey && oracleUrl) {
        const wireApi = getWireApi(env('HAJIMI_ORACLE_WIRE_API'), 'chat_completions');
        add({
            name: 'oracle-custom',
            apiKey: oracleKey,
            apiUrl: normalizeUrl(oracleUrl, wireApi),
            model: env('HAJIMI_ORACLE_MODEL') || AGENT_DEFAULT_MODEL,
            wireApi,
        });
    }

    const zenmuxKey = env('ZENMUX_API_KEY');
    if (zenmuxKey) {
        add({ name: 'zenmux', apiKey: zenmuxKey, apiUrl: ZENMUX_URL, model: env('HAJIMI_ORACLE_ZENMUX_MODEL') || 'deepseek/deepseek-v3.2', wireApi: 'chat_completions' });
    }

    const dashscopeKey = env('DASHSCOPE_API_KEY');
    if (dashscopeKey) {
        add({ name: 'dashscope', apiKey: dashscopeKey, apiUrl: DASHSCOPE_URL, model: env('HAJIMI_ORACLE_DASHSCOPE_MODEL') || 'qwen-max', wireApi: 'chat_completions' });
    }

    const siliconflowKey = env('SILICONFLOW_API_KEY');
    if (siliconflowKey) {
        add({ name: 'siliconflow', apiKey: siliconflowKey, apiUrl: SILICONFLOW_URL, model: env('HAJIMI_ORACLE_SILICONFLOW_MODEL') || 'deepseek-ai/DeepSeek-V3', wireApi: 'chat_completions' });
    }

    const tokendanceKey = env('TOKENDANCE_API_KEY');
    const tokendanceBaseUrl = env('TOKENDANCE_BASE_URL');
    if (tokendanceKey && tokendanceBaseUrl) {
        add({ name: 'tokendance', apiKey: tokendanceKey, apiUrl: normalizeUrl(tokendanceBaseUrl, 'chat_completions'), model: env('HAJIMI_ORACLE_TOKENDANCE_MODEL') || 'deepseek-v3.2', wireApi: 'chat_completions' });
    }

    return configs;
}

function extractResponsesText(data: unknown) {
    if (!data || typeof data !== 'object') return '';
    const payload = data as Record<string, unknown>;
    if (typeof payload.output_text === 'string') return payload.output_text.trim();
    if (!Array.isArray(payload.output)) return '';
    return payload.output.flatMap(item => {
        if (!item || typeof item !== 'object') return [];
        const output = item as Record<string, unknown>;
        if (!Array.isArray(output.content)) return [];
        return output.content.flatMap(part => {
            if (!part || typeof part !== 'object') return [];
            const content = part as Record<string, unknown>;
            return typeof content.text === 'string' ? [content.text] : [];
        });
    }).join('').trim();
}

function extractChatText(data: unknown) {
    if (!data || typeof data !== 'object') return '';
    const choice = (data as Record<string, unknown>).choices;
    if (!Array.isArray(choice) || !choice[0] || typeof choice[0] !== 'object') return '';
    const message = (choice[0] as Record<string, unknown>).message;
    if (!message || typeof message !== 'object') return '';
    const content = (message as Record<string, unknown>).content;
    if (typeof content === 'string') return content.trim();
    if (!Array.isArray(content)) return '';
    return content.flatMap(part => {
        if (!part || typeof part !== 'object') return [];
        const item = part as Record<string, unknown>;
        return typeof item.text === 'string' ? [item.text] : [];
    }).join('').trim();
}

function extractDelta(payload: Record<string, unknown>) {
    const type = String(payload.type || '');
    if (type === 'response.output_text.delta' && typeof payload.delta === 'string') return payload.delta;
    if (type === 'response.refusal.delta' && typeof payload.delta === 'string') return payload.delta;

    const choices = payload.choices;
    if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
        const delta = (choices[0] as Record<string, unknown>).delta;
        if (delta && typeof delta === 'object') {
            const content = (delta as Record<string, unknown>).content;
            if (typeof content === 'string') return content;
            if (Array.isArray(content)) {
                return content.flatMap(part => {
                    if (!part || typeof part !== 'object') return [];
                    const item = part as Record<string, unknown>;
                    return typeof item.text === 'string' ? [item.text] : [];
                }).join('');
            }
        }
    }

    return '';
}

async function consumeEventStream(response: Response, onDelta: (text: string) => void) {
    if (!response.body) throw new Error('empty provider stream');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result = '';
    let finished = false;

    const consumeFrame = (frame: string) => {
        const data = frame.split(/\r?\n/)
            .filter(line => line.startsWith('data:'))
            .map(line => line.slice(5).trimStart())
            .join('\n')
            .trim();
        if (!data || data === '[DONE]') {
            if (data === '[DONE]') finished = true;
            return;
        }
        let payload: unknown;
        try {
            payload = JSON.parse(data);
        } catch {
            return;
        }
        if (!payload || typeof payload !== 'object') return;
        const record = payload as Record<string, unknown>;
        if (record.error) throw new Error('provider stream error');
        const delta = extractDelta(record);
        if (delta) {
            result += delta;
            onDelta(delta);
        }
        if (String(record.type || '') === 'response.completed') finished = true;
    };

    while (!finished) {
        const next = await reader.read();
        buffer += decoder.decode(next.value || new Uint8Array(), { stream: !next.done });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() || '';
        for (const frame of frames) consumeFrame(frame);
        if (next.done) break;
    }
    buffer += decoder.decode();
    if (buffer.trim()) consumeFrame(buffer);
    if (!result.trim()) throw new Error('provider returned no text');
    return result.trim();
}

function buildRequestBody(config: AgentProviderConfig, input: StreamInput, stream: boolean) {
    const image = input.image;
    if (config.wireApi === 'responses') {
        const content = image
            ? [
                { type: 'input_text', text: input.prompt },
                { type: 'input_image', image_url: image.dataUrl },
            ]
            : input.prompt;
        return {
            model: config.model,
            instructions: input.instructions,
            input: [{ role: 'user', content }],
            stream,
            max_output_tokens: 1400,
            ...(input.reasoningEffort ? { reasoning: { effort: input.reasoningEffort } } : {}),
            ...(env('OPENAI_DISABLE_RESPONSE_STORAGE') === '1' ? { store: false } : {}),
        };
    }

    const content = image
        ? [
            { type: 'text', text: input.prompt },
            { type: 'image_url', image_url: { url: image.dataUrl } },
        ]
        : input.prompt;
    return {
        model: config.model,
        messages: [
            { role: 'system', content: input.instructions },
            { role: 'user', content },
        ],
        stream,
        max_tokens: 1400,
        temperature: 0.72,
    };
}

async function requestProvider(config: AgentProviderConfig, input: StreamInput, stream: boolean) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
                Accept: stream ? 'text/event-stream, application/json' : 'application/json, text/plain',
            },
            body: JSON.stringify(buildRequestBody(config, input, stream)),
            signal: controller.signal,
        });
        if (!response.ok) throw new Error(`provider returned ${response.status}`);

        const contentType = response.headers.get('content-type') || '';
        if (!stream) {
            const raw = await response.text();
            if (!raw.trim()) throw new Error('provider returned no text');
            let data: unknown = raw;
            try {
                data = JSON.parse(raw);
            } catch {
                // Some OpenAI-compatible gateways return plain text for a non-streaming response.
            }
            const text = typeof data === 'string'
                ? data.trim()
                : config.wireApi === 'responses' ? extractResponsesText(data) : extractChatText(data);
            if (!text) throw new Error('provider returned no text');
            return text;
        }

        if (contentType.includes('application/json')) {
            const data = await response.json();
            const text = config.wireApi === 'responses' ? extractResponsesText(data) : extractChatText(data);
            if (!text) throw new Error('provider returned no text');
            input.onDelta(text);
            return text;
        }

        return await consumeEventStream(response, input.onDelta);
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function streamAgentReply(input: StreamInput) {
    const configs = buildProviderConfigs();
    if (configs.length === 0) throw new Error('AGENT_PROVIDER_MISSING');

    let lastError: unknown = null;
    for (const [index, config] of configs.entries()) {
        let streamEmitted = false;
        try {
            const reply = await requestProvider(config, {
                ...input,
                onDelta: text => {
                    streamEmitted = true;
                    input.onDelta(text);
                },
            }, true);
            return { reply, providerUsed: config.name };
        } catch (streamError) {
            lastError = streamError;

            // A gateway may accept the request but not support SSE, or may
            // close the stream early. Retry the same provider in complete
            // response mode before moving to the next key/model.
            if (streamEmitted) input.onReplace?.();
            try {
                const reply = await requestProvider(config, { ...input, onDelta: () => undefined }, false);
                input.onDelta(reply);
                return { reply, providerUsed: config.name };
            } catch (fullResponseError) {
                lastError = fullResponseError;
                if (index < configs.length - 1) {
                    if (streamEmitted) input.onReplace?.();
                    console.warn(`[agent] provider ${config.name} failed in stream and complete modes; trying fallback`);
                    continue;
                }
                throw fullResponseError;
            }
        }
    }

    throw lastError instanceof Error ? lastError : new Error('AGENT_PROVIDER_FAILED');
}

export function hasAgentProvider() {
    return buildProviderConfigs().length > 0;
}
