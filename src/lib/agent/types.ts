export type AgentIntent =
    | 'casual'
    | 'continuation'
    | 'platform'
    | 'page'
    | 'vision'
    | 'sensitive';

export type AgentMessageRole = 'user' | 'assistant';

export type AgentMessage = {
    id: number;
    role: AgentMessageRole;
    content: string;
    createdAt: string;
};

export type AgentConversation = {
    id: number;
    title: string;
    summary: string;
    summaryUpdatedAt: string | null;
};

export type VisiblePageNode = {
    kind: 'heading' | 'paragraph' | 'link' | 'button' | 'input' | 'card' | 'table' | 'dialog' | 'other';
    text: string;
    role?: string;
    href?: string;
};

export type VisiblePageSnapshot = {
    path: string;
    title: string;
    selectedText?: string;
    dialogText?: string;
    nodes: VisiblePageNode[];
};

export type AgentScreenContext = {
    mode: 'structured' | 'vision' | 'hybrid';
    structured?: VisiblePageSnapshot;
    image?: {
        mimeType: 'image/jpeg';
        dataUrl: string;
        width: number;
        height: number;
    };
    captureMs?: number;
    captureFailed?: boolean;
};

export type AgentDiagnostics = {
    intent: AgentIntent;
    requestedMode: AgentScreenContext['mode'] | 'none';
    effectiveMode: AgentScreenContext['mode'] | 'server_only';
    visionUsed: boolean;
    responseMs: number;
    captureMs?: number;
    fallbackReason?: 'capture_failed' | 'vision_unsupported' | 'sensitive_page';
};

export type AgentChatResponse = {
    conversationId: number;
    reply: string;
    remainingMessages: number;
    turn: {
        user: AgentMessage;
        assistant: AgentMessage;
    };
    diagnostics: AgentDiagnostics;
};

export type AgentChatEvent =
    | { type: 'status'; label: string }
    | { type: 'delta'; text: string }
    | { type: 'result'; response: AgentChatResponse }
    | { type: 'error'; error: string };
