'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import DomiBloubAvatar from './DomiBloubAvatar';
import MarkdownMessage from './MarkdownMessage';
import { collectAgentScreenContext } from '@/lib/agentScreen';
import { detectAgentIntent } from '@/lib/agent/intent';
import type { AgentChatEvent, AgentMessage } from '@/lib/agent/types';
import type { DomiPetVisualState } from '@/lib/agent/visualTypes';

type UiMessage = AgentMessage & {
    pending?: boolean;
    failed?: boolean;
};

const DRAFT_KEY = 'hajimi-domi-draft';

function isHiddenRoute(pathname: string) {
    return pathname === '/' || pathname === '/login' || pathname === '/403' || pathname === '/404';
}

function statusVisualState(label: string): DomiPetVisualState {
    if (/read|look|check|查看|读取|查找/i.test(label)) return 'viewing';
    if (/organ|整理|回答/i.test(label)) return 'organizing';
    if (/error|trouble|失败|错误/i.test(label)) return 'error';
    return 'thinking';
}

function displayDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
}

export default function DomiAgentHost({ enabled }: { enabled: boolean }) {
    const pathname = usePathname() || '/dashboard';
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'composer' | 'canvas'>('composer');
    const [draft, setDraft] = useState('');
    const [messages, setMessages] = useState<UiMessage[]>([]);
    const [status, setStatus] = useState('');
    const [streamingReply, setStreamingReply] = useState('');
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);
    const [visualState, setVisualState] = useState<DomiPetVisualState>('idle');
    const [loaded, setLoaded] = useState(false);
    const messagesRef = useRef<HTMLDivElement | null>(null);
    const historyPromiseRef = useRef<Promise<void> | null>(null);
    const sequenceRef = useRef(0);

    useEffect(() => {
        try {
            setDraft(window.sessionStorage.getItem(DRAFT_KEY) || '');
        } catch {
            // Storage is optional.
        }
    }, []);

    useEffect(() => {
        try {
            if (draft) window.sessionStorage.setItem(DRAFT_KEY, draft);
            else window.sessionStorage.removeItem(DRAFT_KEY);
        } catch {
            // Keep the in-memory draft when storage is unavailable.
        }
    }, [draft]);

    useEffect(() => {
        const container = messagesRef.current;
        if (!container) return;
        container.scrollTop = container.scrollHeight;
    }, [messages, streamingReply, status]);

    const loadHistory = useCallback(() => {
        if (loaded) return Promise.resolve();
        if (historyPromiseRef.current) return historyPromiseRef.current;
        const promise = fetch('/api/agent/chat', { cache: 'no-store' })
            .then(async response => {
                if (!response.ok) throw new Error('history unavailable');
                const data = await response.json() as { messages?: AgentMessage[] };
                const history = Array.isArray(data.messages) ? data.messages : [];
                setMessages(current => {
                    const historyIds = new Set(history.map(message => message.id));
                    const localMessages = current.filter(message => message.id < 0 || !historyIds.has(message.id));
                    return [...history, ...localMessages];
                });
                if (history.length > 0) setView('canvas');
                setLoaded(true);
            })
            .catch(() => {
                setLoaded(true);
                setError('Domi could not open the conversation right now.');
            });
        historyPromiseRef.current = promise;
        return promise;
    }, [loaded]);

    const openAgent = () => {
        setIsOpen(true);
        void loadHistory();
    };

    const closeAgent = () => {
        setIsOpen(false);
    };

    const sendMessage = useCallback(async (rawMessage: string, retryId?: number) => {
        const message = rawMessage.trim();
        if (!message || sending) return;
        setIsOpen(true);
        setView('canvas');
        setError('');
        setStatus('…');
        setVisualState('thinking');
        setStreamingReply('');
        setSending(true);
        setDraft('');

        const tempId = retryId ?? -(Date.now() + sequenceRef.current++);
        const optimisticMessage: UiMessage = {
            id: tempId,
            role: 'user',
            content: message,
            createdAt: new Date().toISOString(),
            pending: !retryId,
        };
        setMessages(current => retryId
            ? current.map(item => item.id === retryId ? { ...item, pending: true, failed: false } : item)
            : [...current, optimisticMessage]);

        try {
            const intent = detectAgentIntent(message, pathname);
            // History is loaded once when the Pet opens, but it must never
            // delay intent routing or the first request for the new message.
            void loadHistory();
            const screenContext = intent === 'page' || intent === 'vision'
                ? await collectAgentScreenContext(pathname, intent === 'vision' ? 'vision' : 'structured')
                : undefined;
            const response = await fetch('/api/agent/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
                body: JSON.stringify({ message, currentPath: pathname, screenContext }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => null) as { error?: string } | null;
                throw new Error(data?.error || 'Domi could not reply.');
            }
            if (!response.body) throw new Error('Domi returned an empty response.');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let completed = false;
            while (true) {
                const next = await reader.read();
                buffer += decoder.decode(next.value || new Uint8Array(), { stream: !next.done });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const event = JSON.parse(line) as AgentChatEvent;
                    if (event.type === 'status') {
                        setStatus(event.label);
                        if (/retry|重新生成|改用页面文字/i.test(event.label)) setStreamingReply('');
                        setVisualState(statusVisualState(event.label));
                    } else if (event.type === 'delta') {
                        setStreamingReply(current => current + event.text);
                        setStatus('');
                        setVisualState('thinking');
                    } else if (event.type === 'result') {
                        completed = true;
                        setMessages(current => [
                            ...current.filter(item => item.id !== tempId),
                            event.response.turn.user,
                            event.response.turn.assistant,
                        ]);
                        setStreamingReply('');
                        setStatus('');
                        setVisualState('success');
                    } else if (event.type === 'error') {
                        throw new Error(event.error);
                    }
                }
                if (next.done) break;
            }
            if (buffer.trim()) {
                const event = JSON.parse(buffer) as AgentChatEvent;
                if (event.type === 'result') {
                    completed = true;
                    setMessages(current => [
                        ...current.filter(item => item.id !== tempId),
                        event.response.turn.user,
                        event.response.turn.assistant,
                    ]);
                    setStreamingReply('');
                } else if (event.type === 'error') {
                    throw new Error(event.error);
                }
            }
            if (!completed) throw new Error('Domi response was interrupted.');
            window.setTimeout(() => setVisualState('idle'), 900);
        } catch (sendError) {
            setMessages(current => current.map(item => item.id === tempId ? { ...item, pending: false, failed: true } : item));
            setStreamingReply('');
            setStatus('');
            setVisualState('error');
            setError(sendError instanceof Error ? sendError.message : 'Domi could not reply.');
        } finally {
            setSending(false);
        }
    }, [loadHistory, pathname, sending]);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void sendMessage(draft);
    };

    if (!enabled || isHiddenRoute(pathname)) return null;

    const hasConversation = messages.length > 0 || Boolean(streamingReply) || sending;

    return (
        <div className={`domi-agent-host ${isOpen ? 'is-open' : ''} ${view === 'canvas' ? 'is-canvas' : 'is-composer'}`}>
            {isOpen && (
                <section className="domi-agent-surface" aria-label="Domi conversation">
                    {view === 'composer' && !hasConversation ? (
                        <form className="domi-composer-bubble" onSubmit={handleSubmit}>
                            <span className="domi-composer-prompt">What&apos;s on your mind?</span>
                            <input
                                value={draft}
                                onChange={event => setDraft(event.target.value)}
                                onKeyDown={event => {
                                    if (event.key === 'Escape') closeAgent();
                                }}
                                maxLength={1000}
                                autoFocus
                                aria-label="Message Domi"
                            />
                            <button type="submit" className="domi-send-button" disabled={!draft.trim() || sending} aria-label="Send message">↑</button>
                            <button type="button" className="domi-close-button domi-composer-close" onClick={closeAgent} aria-label="Close Domi">×</button>
                        </form>
                    ) : (
                        <div className="domi-conversation-canvas">
                            <header className="domi-canvas-header">
                                <div>
                                    <strong>Domi</strong>
                                    <span className="domi-status-dot" aria-hidden="true" />
                                </div>
                                <button type="button" className="domi-close-button" onClick={closeAgent} aria-label="Close Domi">×</button>
                            </header>
                            <div className="domi-message-scroll" ref={messagesRef} aria-live="polite">
                                {messages.map(message => (
                                    <article key={message.id} className={`domi-message ${message.role === 'user' ? 'is-user' : 'is-assistant'} ${message.failed ? 'is-failed' : ''}`}>
                                        <div className="domi-message-body">
                                            {message.role === 'assistant' ? <MarkdownMessage content={message.content} /> : <p>{message.content}</p>}
                                        </div>
                                        <div className="domi-message-meta">
                                            {message.failed ? (
                                                <button type="button" onClick={() => void sendMessage(message.content, message.id)}>Retry</button>
                                            ) : (
                                                <time dateTime={message.createdAt}>{displayDate(message.createdAt)}</time>
                                            )}
                                        </div>
                                    </article>
                                ))}
                                {streamingReply && (
                                    <article className="domi-message is-assistant is-streaming">
                                        <div className="domi-message-body"><MarkdownMessage content={streamingReply} /></div>
                                    </article>
                                )}
                                {sending && !streamingReply && (
                                    <div className="domi-status-line" role="status">
                                        <span className="domi-status-dots" aria-hidden="true"><i /><i /><i /></span>
                                        <span>{status || '…'}</span>
                                    </div>
                                )}
                                {error && <div className="domi-error-line" role="alert">{error}</div>}
                            </div>
                            <form className="domi-canvas-composer" onSubmit={handleSubmit}>
                                <textarea
                                    value={draft}
                                    onChange={event => setDraft(event.target.value)}
                                    onKeyDown={event => {
                                        if (event.key === 'Enter' && !event.shiftKey) {
                                            event.preventDefault();
                                            void sendMessage(draft);
                                        }
                                    }}
                                    placeholder="Say something…"
                                    maxLength={1000}
                                    rows={1}
                                    aria-label="Message Domi"
                                />
                                <button type="submit" className="domi-send-button" disabled={!draft.trim() || sending} aria-label="Send message">↑</button>
                            </form>
                        </div>
                    )}
                </section>
            )}
            <button
                type="button"
                className="domi-pet-button"
                onClick={() => isOpen ? closeAgent() : openAgent()}
                aria-label={isOpen ? 'Close Domi' : 'Open Domi'}
                title={isOpen ? 'Close Domi' : 'Open Domi'}
            >
                <DomiBloubAvatar visualState={visualState} size={86} ariaLabel="Domi" className="domi-bloub-avatar" />
            </button>
        </div>
    );
}
