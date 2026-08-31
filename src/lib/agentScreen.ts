import type { AgentScreenContext, VisiblePageNode, VisiblePageSnapshot } from './agent/types';
import { isSensitiveAgentPath } from './agent/intent';

const MAX_NODES = 80;
const MAX_TEXT = 12000;

function visible(element: Element) {
    const htmlElement = element as HTMLElement;
    const style = window.getComputedStyle(htmlElement);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = htmlElement.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
}

function textOf(element: Element) {
    return String(element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 260);
}

function nodeKind(element: Element): VisiblePageNode['kind'] {
    const tag = element.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return 'heading';
    if (tag === 'a') return 'link';
    if (tag === 'button') return 'button';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'input';
    if (tag === 'table') return 'table';
    if (element.getAttribute('role') === 'dialog') return 'dialog';
    if (tag === 'article' || element.classList.contains('glass-card') || element.classList.contains('glass-panel')) return 'card';
    if (tag === 'p' || tag === 'li') return 'paragraph';
    return 'other';
}

export function collectVisiblePageSnapshot(pathname = window.location.pathname): VisiblePageSnapshot | undefined {
    if (isSensitiveAgentPath(pathname)) return undefined;

    const root = document.body;
    if (!root) return undefined;
    const nodes: VisiblePageNode[] = [];
    let totalText = 0;
    const selector = 'h1,h2,h3,h4,h5,h6,p,li,a,button,input,textarea,select,table,[role="dialog"],article,.glass-card,.glass-panel';
    for (const element of Array.from(root.querySelectorAll(selector))) {
        if (nodes.length >= MAX_NODES || !visible(element)) continue;
        if (element.closest('.domi-agent-host,form,[data-agent-private],[data-agent-screen-sensitive]')) continue;
        const text = textOf(element);
        if (!text && !['input', 'textarea', 'select'].includes(element.tagName.toLowerCase())) continue;
        totalText += text.length;
        if (totalText > MAX_TEXT) break;
        const href = element instanceof HTMLAnchorElement ? element.getAttribute('href') || undefined : undefined;
        nodes.push({
            kind: nodeKind(element),
            text: text || (element instanceof HTMLInputElement ? element.getAttribute('placeholder') || '' : ''),
            role: element.getAttribute('role') || undefined,
            href,
        });
    }

    const selection = window.getSelection()?.toString().replace(/\s+/g, ' ').trim().slice(0, 800) || undefined;
    const dialogText = Array.from(root.querySelectorAll('[role="dialog"]')).filter(visible).map(textOf).filter(Boolean).join(' ').slice(0, 1000) || undefined;
    return {
        path: pathname.slice(0, 180),
        title: document.title.slice(0, 240),
        selectedText: selection,
        dialogText,
        nodes,
    };
}

async function captureImage() {
    const startedAt = performance.now();
    const html2canvasModule = await import('html2canvas-pro');
    const render = html2canvasModule.default;
    const canvas = await render(document.body, {
        backgroundColor: '#ffffff',
        useCORS: true,
        scale: Math.min(1.5, window.devicePixelRatio || 1),
        width: window.innerWidth,
        height: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        ignoreElements: element => Boolean(element.closest('.domi-agent-host,form,[data-agent-private],[data-agent-screen-sensitive]')),
        onclone: clonedDocument => {
            clonedDocument.querySelectorAll('.domi-agent-host,form,[data-agent-private],[data-agent-screen-sensitive]').forEach(element => element.remove());
        },
    });
    const maxSide = 1280;
    const ratio = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
    const width = Math.max(1, Math.round(canvas.width * ratio));
    const height = Math.max(1, Math.round(canvas.height * ratio));
    const resized = document.createElement('canvas');
    resized.width = width;
    resized.height = height;
    const context = resized.getContext('2d');
    if (!context) throw new Error('canvas context unavailable');
    context.drawImage(canvas, 0, 0, width, height);
    const dataUrl = resized.toDataURL('image/jpeg', 0.68);
    if (dataUrl.length > 2_100_000) throw new Error('captured image too large');
    return {
        image: { mimeType: 'image/jpeg' as const, dataUrl, width, height },
        captureMs: Math.round(performance.now() - startedAt),
    };
}

export async function collectAgentScreenContext(pathname: string, mode: 'structured' | 'vision' | 'hybrid'): Promise<AgentScreenContext | undefined> {
    if (isSensitiveAgentPath(pathname)) {
        return { mode, captureFailed: true };
    }
    const structured = collectVisiblePageSnapshot(pathname);
    if (mode === 'structured') return { mode, structured };

    try {
        const captured = await captureImage();
        return { mode, structured, image: captured.image, captureMs: captured.captureMs };
    } catch {
        return { mode, structured, captureFailed: true };
    }
}
