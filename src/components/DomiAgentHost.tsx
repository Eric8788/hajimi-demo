'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
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
const POSITION_KEY = 'hajimi-domi-position';
const DRAG_THRESHOLD = 6;

type DockPosition = {
    right: number;
    bottom: number;
};

type DragState = DockPosition & {
    pointerId: number;
    startX: number;
    startY: number;
    startRight: number;
    startBottom: number;
    moved: boolean;
};

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

function parseDockPosition(value: string | null): DockPosition | null {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value) as Partial<DockPosition>;
        if (typeof parsed.right !== 'number' || typeof parsed.bottom !== 'number') return null;
        if (!Number.isFinite(parsed.right) || !Number.isFinite(parsed.bottom)) return null;
        return { right: parsed.right, bottom: parsed.bottom };
    } catch {
        return null;
    }
}

function clampDockPosition(position: DockPosition, rect: DOMRect, includeConversation = false): DockPosition {
    const isMobile = window.matchMedia('(max-width: 760px)').matches;
    const minRight = 8;
    const conversationWidth = isMobile
        ? Math.min(420, Math.max(0, window.innerWidth - 20))
        : Math.min(380, Math.max(0, window.innerWidth - 30));
    const anchorWidth = includeConversation ? Math.max(rect.width, conversationWidth) : rect.width;
    const maxRight = Math.max(minRight, window.innerWidth - anchorWidth - (isMobile ? 10 : 8));
    const availableBottom = Math.max(8, window.innerHeight - rect.height - 8);
    const requestedMinBottom = isMobile ? 84 : 8;
    const minBottom = Math.min(requestedMinBottom, availableBottom);
    const maxBottom = Math.max(minBottom, availableBottom);
    return {
        right: Math.round(Math.min(maxRight, Math.max(minRight, position.right))),
        bottom: Math.round(Math.min(maxBottom, Math.max(minBottom, position.bottom))),
    };
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
    const [dockPosition, setDockPosition] = useState<DockPosition | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [interactionToken, setInteractionToken] = useState(0);
    const messagesRef = useRef<HTMLDivElement | null>(null);
    const petButtonRef = useRef<HTMLButtonElement | null>(null);
    const historyPromiseRef = useRef<Promise<void> | null>(null);
    const sequenceRef = useRef(0);
    const dragRef = useRef<DragState | null>(null);
    const suppressClickRef = useRef(false);
    const suppressClickTimerRef = useRef<number | null>(null);

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
        if (!enabled || isHiddenRoute(pathname)) return;

        let storedPosition: DockPosition | null = null;
        try {
            storedPosition = parseDockPosition(window.sessionStorage.getItem(POSITION_KEY));
        } catch {
            // Storage is optional.
        }

        const applyStoredPosition = () => {
            const button = petButtonRef.current;
            if (!button || !storedPosition) return;
            setDockPosition(clampDockPosition(storedPosition, button.getBoundingClientRect(), isOpen));
        };
        const clampCurrentPosition = () => {
            const button = petButtonRef.current;
            if (!button) return;
            setDockPosition(current => current
                ? clampDockPosition(current, button.getBoundingClientRect(), isOpen)
                : current);
        };

        applyStoredPosition();
        window.addEventListener('resize', clampCurrentPosition);
        return () => window.removeEventListener('resize', clampCurrentPosition);
    }, [enabled, isOpen, pathname]);

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
        const button = petButtonRef.current;
        if (button) {
            setDockPosition(current => current
                ? clampDockPosition(current, button.getBoundingClientRect(), true)
                : current);
        }
        void loadHistory();
    };

    const closeAgent = () => {
        setIsOpen(false);
    };

    const handlePetPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (suppressClickTimerRef.current) window.clearTimeout(suppressClickTimerRef.current);
        suppressClickRef.current = false;
        const rect = event.currentTarget.getBoundingClientRect();
        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startRight: window.innerWidth - rect.right,
            startBottom: window.innerHeight - rect.bottom,
            right: window.innerWidth - rect.right,
            bottom: window.innerHeight - rect.bottom,
            moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePetPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
        drag.moved = true;
        setIsDragging(true);
        const rect = (petButtonRef.current || event.currentTarget).getBoundingClientRect();
        const next = clampDockPosition({
            right: drag.startRight - deltaX,
            bottom: drag.startBottom - deltaY,
        }, rect);
        drag.right = next.right;
        drag.bottom = next.bottom;
        setDockPosition(next);
        event.preventDefault();
    };

    const finishPetDrag = useCallback((pointerId: number, target?: HTMLButtonElement) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== pointerId) return;
        // Clear first: releasing capture can synchronously emit
        // lostpointercapture, which must not finish the same drag twice.
        dragRef.current = null;
        if (target?.hasPointerCapture(pointerId)) {
            target.releasePointerCapture(pointerId);
        }
        setIsDragging(false);
        if (!drag.moved) return;
        suppressClickRef.current = true;
        suppressClickTimerRef.current = window.setTimeout(() => {
            suppressClickRef.current = false;
            suppressClickTimerRef.current = null;
        }, 450);
        try {
            window.sessionStorage.setItem(POSITION_KEY, JSON.stringify({ right: drag.right, bottom: drag.bottom }));
        } catch {
            // Keep the position in memory when storage is unavailable.
        }
    }, []);

    const handlePetPointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
        finishPetDrag(event.pointerId, event.currentTarget);
    };

    useEffect(() => {
        const finishFromWindow = (event: PointerEvent) => finishPetDrag(event.pointerId);
        window.addEventListener('pointerup', finishFromWindow);
        window.addEventListener('pointercancel', finishFromWindow);
        return () => {
            window.removeEventListener('pointerup', finishFromWindow);
            window.removeEventListener('pointercancel', finishFromWindow);
        };
    }, [finishPetDrag]);

    const handlePetClick = () => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            if (suppressClickTimerRef.current) window.clearTimeout(suppressClickTimerRef.current);
            suppressClickTimerRef.current = null;
            return;
        }
        setInteractionToken(current => current + 1);
        if (isOpen) closeAgent();
        else openAgent();
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
        <div
            className={`domi-agent-host ${isOpen ? 'is-open' : ''} ${view === 'canvas' ? 'is-canvas' : 'is-composer'} ${isDragging ? 'is-dragging' : ''}`}
            style={dockPosition ? { right: `${dockPosition.right}px`, bottom: `${dockPosition.bottom}px` } : undefined}
        >
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
                ref={petButtonRef}
                className="domi-pet-button"
                onPointerDown={handlePetPointerDown}
                onPointerMove={handlePetPointerMove}
                onPointerUp={handlePetPointerEnd}
                onPointerCancel={handlePetPointerEnd}
                onLostPointerCapture={handlePetPointerEnd}
                onClick={handlePetClick}
                aria-label={isOpen ? 'Close Domi' : 'Open Domi'}
                title={isDragging ? 'Move Domi' : (isOpen ? 'Close Domi' : 'Open Domi')}
            >
                <DomiBloubAvatar
                    visualState={visualState}
                    interactionToken={interactionToken}
                    size={86}
                    ariaLabel="Domi"
                    className="domi-bloub-avatar"
                />
            </button>
        </div>
    );
}
