import { db, sql } from '@vercel/postgres';
import type { AgentConversation, AgentMessage, AgentMessageRole } from './agent/types';

export const DAILY_AGENT_MESSAGE_LIMIT = 30;
const SHORT_TERM_MESSAGE_LIMIT = 20;
const SUMMARY_MAX_LENGTH = 1800;

export class AgentDailyLimitError extends Error {
    constructor() {
        super('AGENT_DAILY_LIMIT');
        this.name = 'AgentDailyLimitError';
    }
}

type AgentConversationRow = {
    id: number;
    title: string;
    summary: string | null;
    summary_updated_at: Date | string | null;
};

type AgentMessageRow = {
    id: number;
    role: AgentMessageRole;
    content: string;
    created_at: Date | string;
};

type AgentMemoryRow = {
    id: number;
    kind: string;
    content: string;
    created_at: Date | string;
    updated_at: Date | string;
};

let agentTablesReady: Promise<void> | null = null;

function toIso(value: Date | string | null | undefined) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeMessage(row: AgentMessageRow): AgentMessage {
    return {
        id: Number(row.id),
        role: row.role === 'assistant' ? 'assistant' : 'user',
        content: String(row.content || ''),
        createdAt: toIso(row.created_at) || new Date().toISOString(),
    };
}

function normalizeConversation(row: AgentConversationRow): AgentConversation {
    return {
        id: Number(row.id),
        title: String(row.title || 'Domi'),
        summary: String(row.summary || '').trim(),
        summaryUpdatedAt: toIso(row.summary_updated_at),
    };
}

export async function ensureAgentTables() {
    if (!agentTablesReady) {
        agentTablesReady = (async () => {
            await sql`
              CREATE TABLE IF NOT EXISTS agent_conversations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL DEFAULT 'Domi',
                summary TEXT NOT NULL DEFAULT '',
                summary_updated_at TIMESTAMP WITH TIME ZONE,
                summary_message_id INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`
              CREATE INDEX IF NOT EXISTS agent_conversations_user_updated_idx
              ON agent_conversations(user_id, updated_at DESC, id DESC);
            `;
            await sql`
              CREATE TABLE IF NOT EXISTS agent_messages (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                intent TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`
              CREATE INDEX IF NOT EXISTS agent_messages_conversation_created_idx
              ON agent_messages(conversation_id, created_at DESC, id DESC);
            `;
            await sql`
              CREATE INDEX IF NOT EXISTS agent_messages_user_created_idx
              ON agent_messages(user_id, created_at DESC, id DESC);
            `;
            await sql`
              CREATE TABLE IF NOT EXISTS agent_memories (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                conversation_id INTEGER REFERENCES agent_conversations(id) ON DELETE CASCADE,
                kind TEXT NOT NULL,
                content TEXT NOT NULL,
                source_message_id INTEGER REFERENCES agent_messages(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `;
            await sql`
              CREATE INDEX IF NOT EXISTS agent_memories_user_updated_idx
              ON agent_memories(user_id, updated_at DESC, id DESC);
            `;
            await sql`
              DO $$
              BEGIN
                IF EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_schema = current_schema()
                    AND table_name = 'agent_memories'
                    AND column_name = 'fact'
                ) AND NOT EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_schema = current_schema()
                    AND table_name = 'agent_memories'
                    AND column_name = 'content'
                ) THEN
                  ALTER TABLE agent_memories RENAME COLUMN fact TO content;
                ELSIF NOT EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_schema = current_schema()
                    AND table_name = 'agent_memories'
                    AND column_name = 'content'
                ) THEN
                  ALTER TABLE agent_memories ADD COLUMN content TEXT NOT NULL DEFAULT '';
                END IF;
              END $$;
            `;
            await sql`ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES agent_conversations(id) ON DELETE CASCADE`;
            await sql`ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS source_message_id INTEGER REFERENCES agent_messages(id) ON DELETE SET NULL`;
            // Older experiments created the same unique key under a different
            // index name. Reuse it instead of adding a duplicate index.
            await sql`
              DO $$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1
                  FROM pg_indexes
                  WHERE schemaname = current_schema()
                    AND tablename = 'agent_memories'
                    AND indexdef LIKE '%(user_id, kind, content)%'
                    AND indexdef LIKE 'CREATE UNIQUE%'
                ) THEN
                  CREATE UNIQUE INDEX agent_memories_user_kind_content_idx
                  ON agent_memories(user_id, kind, content);
                END IF;
              END $$;
            `;
            await sql`ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS summary_message_id INTEGER`;
            await sql`ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS intent TEXT`;
        })().catch(error => {
            agentTablesReady = null;
            throw error;
        });
    }

    return agentTablesReady;
}

export async function getPrimaryAgentConversation(userId: number) {
    await ensureAgentTables();

    const { rows } = await sql<AgentConversationRow>`
      SELECT id, title, summary, summary_updated_at
      FROM agent_conversations
      WHERE user_id = ${userId}
        AND EXISTS (
          SELECT 1
          FROM agent_messages
          WHERE agent_messages.conversation_id = agent_conversations.id
        )
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `;
    if (rows[0]) return normalizeConversation(rows[0]);

    const { rows: anyConversationRows } = await sql<AgentConversationRow>`
      SELECT id, title, summary, summary_updated_at
      FROM agent_conversations
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `;
    if (anyConversationRows[0]) return normalizeConversation(anyConversationRows[0]);

    const { rows: createdRows } = await sql<AgentConversationRow>`
      INSERT INTO agent_conversations (user_id, title)
      VALUES (${userId}, 'Domi')
      RETURNING id, title, summary, summary_updated_at
    `;
    return createdRows[0] ? normalizeConversation(createdRows[0]) : null;
}

export async function getAgentContext(userId: number, messageLimit: number) {
    const conversation = await getPrimaryAgentConversation(userId);
    if (!conversation) return { conversation: null, messages: [], memories: [] as AgentMemoryRow[] };

    const safeLimit = Math.max(0, Math.min(SHORT_TERM_MESSAGE_LIMIT, Math.floor(messageLimit)));
    const messages = safeLimit > 0
        ? (await sql<AgentMessageRow>`
            SELECT id, role, content, created_at
            FROM agent_messages
            WHERE conversation_id = ${conversation.id}
            ORDER BY created_at DESC, id DESC
            LIMIT ${safeLimit}
          `).rows.map(normalizeMessage).reverse()
        : [];
    const memories = (await sql<AgentMemoryRow>`
      SELECT id, kind, content, created_at, updated_at
      FROM agent_memories
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC, id DESC
      LIMIT 5
    `).rows;

    return { conversation, messages, memories };
}

export async function getAgentHistory(userId: number) {
    const context = await getAgentContext(userId, SHORT_TERM_MESSAGE_LIMIT);
    return context;
}

async function getTodayAgentMessageCount(userId: number) {
    const { rows } = await sql<{ count: number }>`
      SELECT COUNT(*)::int AS count
      FROM agent_messages
      WHERE user_id = ${userId}
        AND role = 'user'
        AND (created_at AT TIME ZONE 'Asia/Shanghai')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai')::date
    `;
    return Number(rows[0]?.count || 0);
}

export async function getRemainingAgentMessages(userId: number) {
    await ensureAgentTables();
    return Math.max(0, DAILY_AGENT_MESSAGE_LIMIT - await getTodayAgentMessageCount(userId));
}

export async function saveAgentTurn(input: {
    userId: number;
    message: string;
    reply: string;
    intent: string;
}) {
    await ensureAgentTables();
    const client = await db.connect();

    try {
        await client.sql`BEGIN`;
        // Serialize successful saves per user so two concurrent requests
        // cannot both pass the daily limit check before inserting a turn.
        await client.sql`SELECT pg_advisory_xact_lock(2147483000, ${input.userId})`;
        const { rows: countRows } = await client.sql<{ count: number }>`
          SELECT COUNT(*)::int AS count
          FROM agent_messages
          WHERE user_id = ${input.userId}
            AND role = 'user'
            AND (created_at AT TIME ZONE 'Asia/Shanghai')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai')::date
        `;
        if (Number(countRows[0]?.count || 0) >= DAILY_AGENT_MESSAGE_LIMIT) {
            throw new AgentDailyLimitError();
        }
        const { rows: conversationRows } = await client.sql<AgentConversationRow>`
          SELECT id, title, summary, summary_updated_at
          FROM agent_conversations
          WHERE user_id = ${input.userId}
          ORDER BY updated_at DESC, id DESC
          LIMIT 1
          FOR UPDATE
        `;

        let conversationId = Number(conversationRows[0]?.id || 0);
        if (!conversationId) {
            const { rows } = await client.sql<{ id: number }>`
              INSERT INTO agent_conversations (user_id, title)
              VALUES (${input.userId}, 'Domi')
              RETURNING id
            `;
            conversationId = Number(rows[0]?.id || 0);
        }
        if (!conversationId) throw new Error('Agent conversation could not be created');

        const { rows: userRows } = await client.sql<AgentMessageRow>`
          INSERT INTO agent_messages (conversation_id, user_id, role, content, intent)
          VALUES (${conversationId}, ${input.userId}, 'user', ${input.message}, ${input.intent})
          RETURNING id, role, content, created_at
        `;
        const { rows: assistantRows } = await client.sql<AgentMessageRow>`
          INSERT INTO agent_messages (conversation_id, user_id, role, content, intent)
          VALUES (${conversationId}, ${input.userId}, 'assistant', ${input.reply}, ${input.intent})
          RETURNING id, role, content, created_at
        `;
        await client.sql`
          UPDATE agent_conversations
          SET updated_at = CURRENT_TIMESTAMP
          WHERE id = ${conversationId}
        `;
        await client.sql`COMMIT`;

        return {
            conversationId,
            user: normalizeMessage(userRows[0]),
            assistant: normalizeMessage(assistantRows[0]),
            remainingMessages: await getRemainingAgentMessages(input.userId),
        };
    } catch (error) {
        await client.sql`ROLLBACK`;
        throw error;
    } finally {
        client.release();
    }
}

const SENSITIVE_MEMORY_PATTERN = /(?:api[_ -]?key|password|passcode|session|student\s*id|学号|身份证|银行卡|银行|健康|病史|医疗|health|medical|financial|finance|address|住址|电话|phone|邮箱|email|秘密|secret|token|sk-[a-z0-9]{16,}|eyj[a-z0-9_-]{12,}|https?:\/\/|BEGIN\s+(?:RSA|OPENSSH|PRIVATE)|\b\d[\d\s-]{7,}\d)/i;

function redactMemoryCandidate(value: string) {
    if (SENSITIVE_MEMORY_PATTERN.test(value)) return '';
    return value
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180);
}

function extractMemoryCandidate(content: string) {
    const text = content.replace(/\s+/g, ' ').trim();
    if (!text || SENSITIVE_MEMORY_PATTERN.test(text)) {
        return null;
    }

    const match = text.match(/(?:我喜欢|我偏好|我最喜欢|我正在做|我在做|我的目标是|我计划|i like|i love|i prefer|my favorite is|i am working on|my goal is|i plan to)\s*[^。.!?]{2,120}/i);
    if (!match) return null;
    const candidate = redactMemoryCandidate(match[0]);
    return candidate.length >= 4 ? candidate : null;
}

export async function refreshAgentLongTermState(userId: number, conversationId: number) {
    await ensureAgentTables();

    try {
        const { rows: messageRows } = await sql<AgentMessageRow & { id: number }>`
          SELECT id, role, content, created_at
          FROM agent_messages
          WHERE conversation_id = ${conversationId}
          ORDER BY id ASC
          LIMIT 1000
        `;
        const userMessages = messageRows.filter(row => row.role === 'user');
        const latestUserCount = userMessages.length;

        if (latestUserCount > 0 && latestUserCount % 6 === 0) {
            const candidates = userMessages.slice(-6)
                .map(row => ({ id: Number(row.id), content: extractMemoryCandidate(String(row.content || '')) }))
                .filter((row): row is { id: number; content: string } => Boolean(row.content))
                .slice(0, 3);

            for (const candidate of candidates) {
                await sql`
                  INSERT INTO agent_memories (user_id, conversation_id, kind, content, source_message_id)
                  VALUES (${userId}, ${conversationId}, 'preference_or_goal', ${candidate.content}, ${candidate.id})
                  ON CONFLICT (user_id, kind, content)
                  DO UPDATE SET updated_at = CURRENT_TIMESTAMP, source_message_id = EXCLUDED.source_message_id
                `;
            }
        }

        if (messageRows.length > SHORT_TERM_MESSAGE_LIMIT) {
            const { rows: conversationRows } = await sql<AgentConversationRow & { summary_message_id: number | null }>`
              SELECT id, title, summary, summary_updated_at, summary_message_id
              FROM agent_conversations
              WHERE id = ${conversationId} AND user_id = ${userId}
              LIMIT 1
            `;
            const conversation = conversationRows[0];
            if (conversation) {
                const summaryMessageId = Number(conversation.summary_message_id || 0);
                const summarizable = messageRows
                    .slice(0, -SHORT_TERM_MESSAGE_LIMIT)
                    .filter(row => Number(row.id) > summaryMessageId)
                    .map(row => {
                        const content = redactMemoryCandidate(String(row.content || '')).slice(0, 220);
                        return content ? `${row.role === 'user' ? 'User' : 'Domi'}: ${content}` : '';
                    })
                    .filter(Boolean);
                if (summarizable.length > 0) {
                    const combined = [String(conversation.summary || '').trim(), ...summarizable]
                        .filter(Boolean)
                        .join('\n')
                        .slice(-SUMMARY_MAX_LENGTH);
                    const lastSummarized = messageRows
                        .slice(0, -SHORT_TERM_MESSAGE_LIMIT)
                        .filter(row => Number(row.id) > summaryMessageId)
                        .at(-1);
                    await sql`
                      UPDATE agent_conversations
                      SET summary = ${combined},
                          summary_message_id = ${Number(lastSummarized?.id || summaryMessageId)},
                          summary_updated_at = CURRENT_TIMESTAMP
                      WHERE id = ${conversationId} AND user_id = ${userId}
                    `;
                }
            }
        }

        await sql`
          DELETE FROM agent_messages
          WHERE user_id = ${userId}
            AND created_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
        `;
    } catch (error) {
        console.warn('[agent] background memory update failed:', error instanceof Error ? error.message : 'unknown error');
    }
}
