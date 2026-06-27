'use client';

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ClipboardEvent,
    type KeyboardEvent,
    type MouseEvent,
    type PointerEvent,
} from 'react';
import { normalizePostContentFormat, type PostContentFormat } from '@/lib/forumContent';

type TextSelection = {
    start: number;
    end: number;
};

type FloatingToolbarPosition = {
    left: number;
    top: number;
};

type LinkPopoverMode = 'insert' | 'edit';

type LinkPreview = FloatingToolbarPosition & {
    href: string;
    text: string;
};

type PostTextComposerProps = {
    value: string;
    onChange: (value: string) => void;
    format?: PostContentFormat;
    onFormatChange?: (format: PostContentFormat) => void;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    maxLength?: number;
};

const INLINE_MARKDOWN_PATTERN = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+))/g;

function normalizeLinkInput(value: string) {
    const trimmed = value.trim();
    if (!trimmed || /\s/.test(trimmed)) return '';

    const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;

    try {
        const parsed = new URL(withProtocol);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
        if (!parsed.hostname) return '';
        return parsed.href;
    } catch {
        return '';
    }
}

function normalizeLinkLabel(value: string) {
    return value
        .replace(/\]/g, '')
        .replace(/\n+/g, ' ')
        .trim()
        .slice(0, 120) || 'link text';
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string) {
    return escapeHtml(value).replace(/`/g, '&#96;');
}

function safeExternalUrl(url: string) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
    } catch {
        return '';
    }
}

function getClosestAnchor(target: EventTarget | null) {
    if (!(target instanceof Element)) return null;
    const anchor = target.closest('a');
    return anchor instanceof HTMLAnchorElement ? anchor : null;
}

function updateAnchorTarget(anchor: HTMLAnchorElement, href: string) {
    anchor.setAttribute('href', href);
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
}

function renderInlineMarkdown(text: string) {
    let html = '';
    let lastIndex = 0;

    for (const match of text.matchAll(INLINE_MARKDOWN_PATTERN)) {
        const matchIndex = match.index ?? 0;
        if (matchIndex > lastIndex) {
            html += escapeHtml(text.slice(lastIndex, matchIndex));
        }

        const rawText = match[0];
        const markdownHref = match[3] || '';
        const autoHref = match[4] || '';
        const href = safeExternalUrl(markdownHref || autoHref);

        if (href) {
            const label = match[2] || autoHref || href;
            html += `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
        } else if (rawText.startsWith('`') && rawText.endsWith('`')) {
            html += `<code>${escapeHtml(rawText.slice(1, -1))}</code>`;
        } else if (rawText.startsWith('**') && rawText.endsWith('**')) {
            html += `<strong>${escapeHtml(rawText.slice(2, -2))}</strong>`;
        } else if (rawText.startsWith('*') && rawText.endsWith('*')) {
            html += `<em>${escapeHtml(rawText.slice(1, -1))}</em>`;
        } else {
            html += escapeHtml(rawText);
        }

        lastIndex = matchIndex + rawText.length;
    }

    if (lastIndex < text.length) {
        html += escapeHtml(text.slice(lastIndex));
    }

    return html;
}

function markdownToEditorHtml(markdown: string) {
    const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
    const htmlBlocks: string[] = [];
    const paragraphLines: string[] = [];
    let listItems: string[] = [];
    let isOrderedList = false;
    let quoteLines: string[] = [];
    let codeLines: string[] | null = null;

    const flushParagraph = () => {
        if (paragraphLines.length === 0) return;
        htmlBlocks.push(`<p>${paragraphLines.map(renderInlineMarkdown).join('<br>')}</p>`);
        paragraphLines.length = 0;
    };

    const flushList = () => {
        if (listItems.length === 0) return;
        const tag = isOrderedList ? 'ol' : 'ul';
        htmlBlocks.push(`<${tag}>${listItems.map(item => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</${tag}>`);
        listItems = [];
    };

    const flushQuote = () => {
        if (quoteLines.length === 0) return;
        htmlBlocks.push(`<blockquote>${quoteLines.map(renderInlineMarkdown).join('<br>')}</blockquote>`);
        quoteLines = [];
    };

    for (const line of lines) {
        if (line.trim().startsWith('```')) {
            if (codeLines) {
                htmlBlocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
                codeLines = null;
            } else {
                flushParagraph();
                flushList();
                flushQuote();
                codeLines = [];
            }
            continue;
        }

        if (codeLines) {
            codeLines.push(line);
            continue;
        }

        const trimmed = line.trim();
        if (!trimmed) {
            flushParagraph();
            flushList();
            flushQuote();
            continue;
        }

        const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
        if (heading) {
            flushParagraph();
            flushList();
            flushQuote();
            const level = Math.min(Math.max(heading[1].length + 1, 2), 4);
            htmlBlocks.push(`<h${level}>${renderInlineMarkdown(heading[2].trim())}</h${level}>`);
            continue;
        }

        if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
            flushParagraph();
            flushList();
            flushQuote();
            htmlBlocks.push('<hr>');
            continue;
        }

        const quote = /^>\s?(.*)$/.exec(line);
        if (quote) {
            flushParagraph();
            flushList();
            quoteLines.push(quote[1]);
            continue;
        }

        const unorderedItem = /^\s*[-*]\s+(.+)$/.exec(line);
        const orderedItem = /^\s*\d+[.)]\s+(.+)$/.exec(line);
        const listMatch = unorderedItem || orderedItem;
        if (listMatch) {
            flushParagraph();
            flushQuote();
            const nextOrdered = !!orderedItem;
            if (listItems.length > 0 && nextOrdered !== isOrderedList) {
                flushList();
            }
            isOrderedList = nextOrdered;
            listItems.push(listMatch[1]);
            continue;
        }

        flushList();
        flushQuote();
        paragraphLines.push(trimmed);
    }

    if (codeLines) {
        htmlBlocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
    }
    flushParagraph();
    flushList();
    flushQuote();

    return htmlBlocks.join('');
}

function nodeChildrenToMarkdown(node: Node): string {
    return Array.from(node.childNodes).map(nodeToMarkdown).join('');
}

function normalizeEditorText(value: string) {
    return value.replace(/\u00a0/g, ' ');
}

function nodeToMarkdown(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
        return normalizeEditorText(node.textContent || '');
    }

    if (!(node instanceof HTMLElement)) return '';

    const tagName = node.tagName.toLowerCase();

    if (tagName === 'br') return '\n';
    if (tagName === 'strong' || tagName === 'b') return `**${nodeChildrenToMarkdown(node)}**`;
    if (tagName === 'em' || tagName === 'i') return `*${nodeChildrenToMarkdown(node)}*`;
    if (tagName === 's' || tagName === 'strike') return nodeChildrenToMarkdown(node);
    if (tagName === 'u') return nodeChildrenToMarkdown(node);
    if (tagName === 'code' && node.parentElement?.tagName.toLowerCase() !== 'pre') {
        return `\`${normalizeEditorText(node.textContent || '')}\``;
    }
    if (tagName === 'a') {
        const href = safeExternalUrl(node.getAttribute('href') || '');
        const label = nodeChildrenToMarkdown(node).trim() || href;
        return href ? `[${label}](${href})` : label;
    }

    return nodeChildrenToMarkdown(node);
}

function blockToMarkdown(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
        return normalizeEditorText(node.textContent || '').trim();
    }

    if (!(node instanceof HTMLElement)) return '';

    const tagName = node.tagName.toLowerCase();
    const content = nodeChildrenToMarkdown(node).trim();

    if (!content && tagName !== 'hr') return '';

    if (tagName === 'h1') return `# ${content}`;
    if (tagName === 'h2') return `## ${content}`;
    if (tagName === 'h3') return `### ${content}`;
    if (tagName === 'h4') return `#### ${content}`;
    if (tagName === 'blockquote') {
        return content.split('\n').map(line => `> ${line}`).join('\n');
    }
    if (tagName === 'pre') {
        return `\`\`\`\n${normalizeEditorText(node.textContent || '').replace(/\n+$/g, '')}\n\`\`\``;
    }
    if (tagName === 'ul') {
        return Array.from(node.children)
            .filter(child => child.tagName.toLowerCase() === 'li')
            .map(child => `- ${nodeChildrenToMarkdown(child).trim()}`)
            .join('\n');
    }
    if (tagName === 'ol') {
        return Array.from(node.children)
            .filter(child => child.tagName.toLowerCase() === 'li')
            .map((child, index) => `${index + 1}. ${nodeChildrenToMarkdown(child).trim()}`)
            .join('\n');
    }
    if (tagName === 'hr') return '---';

    return content;
}

function editorHtmlToMarkdown(editor: HTMLElement) {
    const blocks = Array.from(editor.childNodes)
        .map(blockToMarkdown)
        .map(block => block.trim())
        .filter(Boolean);

    if (blocks.length === 0 && editor.textContent?.trim()) {
        return normalizeEditorText(editor.textContent).trim();
    }

    return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function restoreRange(range: Range | null) {
    if (!range) return false;
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
}

export default function PostTextComposer({
    value,
    onChange,
    format = 'markdown',
    placeholder = 'Share an update, question, or resource...',
    rows = 5,
    disabled = false,
    maxLength,
}: PostTextComposerProps) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const richEditorRef = useRef<HTMLDivElement | null>(null);
    const savedRichRangeRef = useRef<Range | null>(null);
    const activeRichAnchorRef = useRef<HTMLAnchorElement | null>(null);
    const editingRichAnchorRef = useRef<HTMLAnchorElement | null>(null);
    const isSelectingWithPointerRef = useRef(false);
    const toolbarFrameRef = useRef<number | null>(null);
    const linkPreviewHideTimerRef = useRef<number | null>(null);
    const activeFormat = normalizePostContentFormat(format);
    const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
    const [linkPopoverMode, setLinkPopoverMode] = useState<LinkPopoverMode>('insert');
    const [linkTextValue, setLinkTextValue] = useState('');
    const [linkValue, setLinkValue] = useState('');
    const [linkError, setLinkError] = useState('');
    const [savedSelection, setSavedSelection] = useState<TextSelection>({ start: 0, end: 0 });
    const [floatingToolbar, setFloatingToolbar] = useState<FloatingToolbarPosition | null>(null);
    const [blockToolbarTop, setBlockToolbarTop] = useState(10);
    const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
    const [linkPopoverPosition, setLinkPopoverPosition] = useState<FloatingToolbarPosition | null>(null);
    const clampValue = useCallback((nextValue: string) => (
        typeof maxLength === 'number' ? nextValue.slice(0, maxLength) : nextValue
    ), [maxLength]);

    const rememberSelection = () => {
        const textarea = textareaRef.current;
        if (!textarea) return savedSelection;

        const selection = {
            start: textarea.selectionStart,
            end: textarea.selectionEnd,
        };
        setSavedSelection(selection);
        return selection;
    };

    const updateFromRichEditor = useCallback(() => {
        const editor = richEditorRef.current;
        if (!editor) return;

        if (!editor.textContent?.trim() && editor.querySelectorAll('img, hr').length === 0) {
            editor.innerHTML = '';
            onChange('');
            return;
        }

        const rawValue = editorHtmlToMarkdown(editor);
        const nextValue = clampValue(rawValue);
        if (nextValue !== rawValue) {
            editor.innerHTML = markdownToEditorHtml(nextValue);
        }
        onChange(nextValue);
    }, [clampValue, onChange]);

    const updateFloatingToolbar = useCallback(() => {
        const editor = richEditorRef.current;
        if (!editor || activeFormat !== 'markdown') {
            setFloatingToolbar(null);
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            setFloatingToolbar(null);
            return;
        }

        const anchorNode = selection.anchorNode;
        const focusNode = selection.focusNode;
        const anchorElement = anchorNode?.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode;
        const focusElement = focusNode?.nodeType === Node.TEXT_NODE ? focusNode.parentElement : focusNode;

        if (!(anchorElement instanceof Node) || !(focusElement instanceof Node) || !editor.contains(anchorElement) || !editor.contains(focusElement)) {
            setFloatingToolbar(null);
            return;
        }

        const range = selection.getRangeAt(0);
        savedRichRangeRef.current = range.cloneRange();

        const rect = range.getBoundingClientRect();
        const wrapperRect = editor.closest('.post-rich-editor-wrap')?.getBoundingClientRect();
        if (!wrapperRect || rect.width === 0) {
            setFloatingToolbar(null);
            return;
        }

        setFloatingToolbar({
            left: Math.max(12, rect.left - wrapperRect.left + rect.width / 2),
            top: Math.max(8, rect.top - wrapperRect.top - 48),
        });
    }, [activeFormat]);

    const scheduleFloatingToolbar = useCallback(() => {
        if (toolbarFrameRef.current !== null) {
            window.cancelAnimationFrame(toolbarFrameRef.current);
        }

        toolbarFrameRef.current = window.requestAnimationFrame(() => {
            toolbarFrameRef.current = null;
            updateFloatingToolbar();
        });
    }, [updateFloatingToolbar]);

    const clearLinkPreviewTimer = useCallback(() => {
        if (linkPreviewHideTimerRef.current !== null) {
            window.clearTimeout(linkPreviewHideTimerRef.current);
            linkPreviewHideTimerRef.current = null;
        }
    }, []);

    const scheduleLinkPreviewHide = useCallback(() => {
        clearLinkPreviewTimer();
        linkPreviewHideTimerRef.current = window.setTimeout(() => {
            linkPreviewHideTimerRef.current = null;
            if (!isLinkPopoverOpen) {
                setLinkPreview(null);
                activeRichAnchorRef.current = null;
            }
        }, 180);
    }, [clearLinkPreviewTimer, isLinkPopoverOpen]);

    const getComposerPosition = useCallback((rect: DOMRect, placement: 'above' | 'below' = 'above') => {
        const composer = richEditorRef.current?.closest('.post-text-composer');
        const composerRect = composer?.getBoundingClientRect();
        if (!composerRect) return null;

        if (placement === 'below') {
            const popoverWidth = Math.min(460, Math.max(260, composerRect.width - 16));
            return {
                left: Math.max(8, Math.min(rect.left - composerRect.left, composerRect.width - popoverWidth - 8)),
                top: Math.max(8, rect.bottom - composerRect.top + 10),
            };
        }

        return {
            left: Math.max(12, rect.left - composerRect.left + rect.width / 2),
            top: Math.max(8, rect.top - composerRect.top - 42),
        };
    }, []);

    const showLinkPreview = useCallback((anchor: HTMLAnchorElement) => {
        const editor = richEditorRef.current;
        if (!editor || !editor.contains(anchor) || activeFormat !== 'markdown') return;

        const href = safeExternalUrl(anchor.getAttribute('href') || anchor.href);
        if (!href) return;

        const position = getComposerPosition(anchor.getBoundingClientRect(), 'above');
        if (!position) return;

        clearLinkPreviewTimer();
        activeRichAnchorRef.current = anchor;
        setFloatingToolbar(null);
        setLinkPreview({
            ...position,
            href,
            text: normalizeEditorText(anchor.textContent || '').trim(),
        });
    }, [activeFormat, clearLinkPreviewTimer, getComposerPosition]);

    const handleRichPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        isSelectingWithPointerRef.current = true;
        if (toolbarFrameRef.current !== null) {
            window.cancelAnimationFrame(toolbarFrameRef.current);
            toolbarFrameRef.current = null;
        }
        setFloatingToolbar(null);
        if (!getClosestAnchor(event.target) && !isLinkPopoverOpen) {
            setLinkPreview(null);
            activeRichAnchorRef.current = null;
        }
    };

    useEffect(() => {
        if (activeFormat !== 'markdown') return;
        const editor = richEditorRef.current;
        if (!editor || document.activeElement === editor) return;

        const nextHtml = markdownToEditorHtml(value);
        if (editor.innerHTML !== nextHtml) {
            editor.innerHTML = nextHtml;
        }
    }, [activeFormat, value]);

    useEffect(() => {
        if (activeFormat !== 'markdown') return;

        const finishPointerSelection = () => {
            if (!isSelectingWithPointerRef.current) return;
            isSelectingWithPointerRef.current = false;
            scheduleFloatingToolbar();
        };

        document.addEventListener('pointerup', finishPointerSelection);
        document.addEventListener('pointercancel', finishPointerSelection);

        return () => {
            document.removeEventListener('pointerup', finishPointerSelection);
            document.removeEventListener('pointercancel', finishPointerSelection);
            if (toolbarFrameRef.current !== null) {
                window.cancelAnimationFrame(toolbarFrameRef.current);
                toolbarFrameRef.current = null;
            }
        };
    }, [activeFormat, scheduleFloatingToolbar]);

    useEffect(() => {
        return () => clearLinkPreviewTimer();
    }, [clearLinkPreviewTimer]);

    const openLinkPopover = () => {
        clearLinkPreviewTimer();
        setLinkPopoverMode('insert');
        editingRichAnchorRef.current = null;
        setFloatingToolbar(null);
        setLinkPreview(null);

        let nextLinkText = '';
        let nextPosition: FloatingToolbarPosition | null = null;

        if (activeFormat === 'markdown') {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                savedRichRangeRef.current = range.cloneRange();
                nextLinkText = normalizeEditorText(selection.toString()).trim();
                nextPosition = getComposerPosition(range.getBoundingClientRect(), 'below');
            }
        } else {
            const selection = rememberSelection();
            nextLinkText = normalizeEditorText(value.slice(selection.start, selection.end)).trim();
        }

        setLinkError('');
        setLinkTextValue(nextLinkText);
        setLinkValue('');
        setLinkPopoverPosition(nextPosition);
        setIsLinkPopoverOpen(true);
    };

    const openEditLinkPopover = (anchor: HTMLAnchorElement) => {
        const href = safeExternalUrl(anchor.getAttribute('href') || anchor.href);
        if (!href) return;

        clearLinkPreviewTimer();
        const position = getComposerPosition(anchor.getBoundingClientRect(), 'below');
        activeRichAnchorRef.current = anchor;
        editingRichAnchorRef.current = anchor;
        setFloatingToolbar(null);
        setLinkPreview(null);
        setLinkPopoverMode('edit');
        setLinkTextValue(normalizeEditorText(anchor.textContent || '').trim());
        setLinkValue(href);
        setLinkError('');
        setLinkPopoverPosition(position);
        setIsLinkPopoverOpen(true);
    };

    const closeLinkPopover = (restoreFocus = true) => {
        setIsLinkPopoverOpen(false);
        setLinkPopoverMode('insert');
        setLinkError('');
        setLinkValue('');
        setLinkTextValue('');
        setLinkPopoverPosition(null);
        editingRichAnchorRef.current = null;

        if (!restoreFocus) return;

        if (activeFormat === 'markdown') {
            richEditorRef.current?.focus();
        } else {
            textareaRef.current?.focus();
        }
    };

    const insertLink = () => {
        const href = normalizeLinkInput(linkValue);
        if (!href) {
            setLinkError('Enter a domain or http(s) link.');
            return;
        }

        const resolveLabel = (fallback: string) => normalizeLinkLabel(linkTextValue || fallback || href);

        if (activeFormat === 'markdown') {
            if (linkPopoverMode === 'edit' && editingRichAnchorRef.current) {
                const anchor = editingRichAnchorRef.current;
                const label = resolveLabel(anchor.textContent || href);
                updateAnchorTarget(anchor, href);
                anchor.textContent = label;
                updateFromRichEditor();
                closeLinkPopover();
                return;
            }

            richEditorRef.current?.focus();
            if (restoreRange(savedRichRangeRef.current)) {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const anchor = document.createElement('a');
                    updateAnchorTarget(anchor, href);
                    anchor.textContent = resolveLabel(selection.toString());
                    range.deleteContents();
                    range.insertNode(anchor);

                    const nextRange = document.createRange();
                    nextRange.setStartAfter(anchor);
                    nextRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(nextRange);
                }
                updateFromRichEditor();
            }
            closeLinkPopover();
            return;
        }

        const selection = savedSelection;
        const selectedText = value.slice(selection.start, selection.end);
        const label = resolveLabel(selectedText);
        const insertion = `[${label}](${href})`;
        const nextValue = clampValue(`${value.slice(0, selection.start)}${insertion}${value.slice(selection.end)}`);

        onChange(nextValue);
        closeLinkPopover();

        window.requestAnimationFrame(() => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const caret = Math.min(selection.start + insertion.length, nextValue.length);
            textarea.focus();
            textarea.setSelectionRange(caret, caret);
        });
    };

    const handlePlainKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            openLinkPopover();
        }
    };

    const handleRichPaste = (event: ClipboardEvent<HTMLDivElement>) => {
        const pastedText = event.clipboardData.getData('text/plain');
        if (!pastedText) return;

        event.preventDefault();
        const pastedHtml = markdownToEditorHtml(pastedText);
        document.execCommand('insertHTML', false, pastedHtml || escapeHtml(pastedText));
        updateFromRichEditor();
        scheduleFloatingToolbar();
    };

    const handleRichMouseOver = (event: MouseEvent<HTMLDivElement>) => {
        if (disabled || isLinkPopoverOpen) return;
        const anchor = getClosestAnchor(event.target);
        if (anchor) showLinkPreview(anchor);
    };

    const handleRichMouseMove = (event: MouseEvent<HTMLDivElement>) => {
        const wrapperRect = richEditorRef.current?.closest('.post-rich-editor-wrap')?.getBoundingClientRect();
        if (!wrapperRect) return;

        const nextTop = Math.max(10, Math.min(event.clientY - wrapperRect.top - 15, wrapperRect.height - 38));
        setBlockToolbarTop(nextTop);
    };

    const handleRichMouseLeave = (event: MouseEvent<HTMLDivElement>) => {
        if (getClosestAnchor(event.target)) {
            scheduleLinkPreviewHide();
        }
    };

    const handleRichClick = (event: MouseEvent<HTMLDivElement>) => {
        const anchor = getClosestAnchor(event.target);
        if (!anchor) return;

        event.preventDefault();
        if (!disabled) showLinkPreview(anchor);
    };

    const applyRichCommand = (command: 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'insertUnorderedList' | 'h2' | 'p' | 'blockquote' | 'pre' | 'code' | 'link') => {
        const editor = richEditorRef.current;
        if (!editor || disabled) return;

        editor.focus();
        restoreRange(savedRichRangeRef.current);

        if (command === 'link') {
            openLinkPopover();
            return;
        }

        if (command === 'h2' || command === 'p' || command === 'blockquote' || command === 'pre') {
            document.execCommand('formatBlock', false, command);
        } else if (command === 'code') {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                const code = document.createElement('code');
                try {
                    range.surroundContents(code);
                } catch {
                    code.appendChild(range.extractContents());
                    range.insertNode(code);
                }
                selection.removeAllRanges();
                const nextRange = document.createRange();
                nextRange.selectNodeContents(code);
                selection.addRange(nextRange);
            }
        } else {
            document.execCommand(command, false);
        }

        updateFromRichEditor();
        scheduleFloatingToolbar();
    };

    const handleToolbarMouseDown = (event: MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
    };

    return (
        <div className="post-text-composer">
            {activeFormat === 'markdown' && linkPreview && (
                <div
                    className="post-link-preview"
                    style={{ left: linkPreview.left, top: linkPreview.top }}
                    onMouseEnter={clearLinkPreviewTimer}
                    onMouseLeave={scheduleLinkPreviewHide}
                    onMouseDown={event => event.preventDefault()}
                    role="toolbar"
                    aria-label="Link options"
                >
                    <span title={linkPreview.href}>{linkPreview.href}</span>
                    <button
                        type="button"
                        onClick={() => {
                            const anchor = activeRichAnchorRef.current;
                            if (anchor) openEditLinkPopover(anchor);
                        }}
                        disabled={disabled}
                    >
                        Edit
                    </button>
                </div>
            )}

            {activeFormat === 'markdown' ? (
                <div className="post-rich-editor-wrap">
                    <div
                        className="post-block-toolbar"
                        style={{ top: blockToolbarTop }}
                        onMouseDown={handleToolbarMouseDown}
                        role="toolbar"
                        aria-label="Current line formatting"
                    >
                        <button type="button" onClick={() => applyRichCommand('p')} title="Paragraph">T</button>
                        <button type="button" onClick={() => applyRichCommand('h2')} title="Heading">H2</button>
                        <button type="button" onClick={() => applyRichCommand('insertUnorderedList')} title="List">List</button>
                        <button type="button" onClick={() => applyRichCommand('blockquote')} title="Quote">Quote</button>
                        <button type="button" onClick={() => applyRichCommand('pre')} title="Code block">Code</button>
                        <button type="button" onClick={() => applyRichCommand('link')} title="Link">Link</button>
                    </div>
                    {floatingToolbar && (
                        <div
                            className="post-selection-toolbar"
                            style={{ left: floatingToolbar.left, top: floatingToolbar.top }}
                            onMouseDown={handleToolbarMouseDown}
                            role="toolbar"
                            aria-label="Selected text formatting"
                        >
                            <button type="button" onClick={() => applyRichCommand('p')} title="Paragraph">T</button>
                            <button type="button" onClick={() => applyRichCommand('h2')} title="Heading">H2</button>
                            <span className="post-selection-divider" />
                            <button type="button" onClick={() => applyRichCommand('bold')} title="Bold">B</button>
                            <button type="button" onClick={() => applyRichCommand('italic')} title="Italic">I</button>
                            <button type="button" onClick={() => applyRichCommand('underline')} title="Underline">U</button>
                            <button type="button" onClick={() => applyRichCommand('code')} title="Inline code">{'{}'}</button>
                            <button type="button" onClick={() => applyRichCommand('link')} title="Link">Link</button>
                            <span className="post-selection-divider" />
                            <button type="button" onClick={() => applyRichCommand('insertUnorderedList')} title="List">List</button>
                            <button type="button" onClick={() => applyRichCommand('blockquote')} title="Quote">Quote</button>
                            <button type="button" onClick={() => applyRichCommand('pre')} title="Code block">Code</button>
                        </div>
                    )}
                    <div
                        ref={richEditorRef}
                        className="glass-input post-rich-editor"
                        contentEditable={!disabled}
                        suppressContentEditableWarning
                        role="textbox"
                        aria-multiline="true"
                        data-placeholder={placeholder}
                        onInput={updateFromRichEditor}
                        onPaste={handleRichPaste}
                        onPointerDown={handleRichPointerDown}
                        onMouseOver={handleRichMouseOver}
                        onMouseMove={handleRichMouseMove}
                        onMouseOut={handleRichMouseLeave}
                        onClick={handleRichClick}
                        onKeyUp={scheduleFloatingToolbar}
                        onFocus={() => {
                            const editor = richEditorRef.current;
                            if (editor && !editor.innerHTML && value) {
                                editor.innerHTML = markdownToEditorHtml(value);
                            }
                        }}
                        onBlur={() => {
                            window.setTimeout(() => {
                                const activeElement = document.activeElement;
                                const composer = richEditorRef.current?.closest('.post-text-composer');
                                if (!composer || !activeElement || !composer.contains(activeElement)) {
                                    setFloatingToolbar(null);
                                    setLinkPreview(null);
                                }
                            }, 120);
                        }}
                    />
                </div>
            ) : (
                <textarea
                    ref={textareaRef}
                    placeholder={placeholder}
                    value={value}
                    onChange={event => onChange(clampValue(event.target.value))}
                    onSelect={rememberSelection}
                    onKeyDown={handlePlainKeyDown}
                    rows={rows}
                    disabled={disabled}
                    maxLength={maxLength}
                    className="glass-input post-text-input"
                />
            )}

            {isLinkPopoverOpen && (
                <div
                    className={`post-link-popover${linkPopoverPosition ? ' is-floating' : ''}`}
                    style={linkPopoverPosition ? { left: linkPopoverPosition.left, top: linkPopoverPosition.top } : undefined}
                >
                    <label>
                        Text
                        <input
                            autoFocus
                            value={linkTextValue}
                            onChange={event => {
                                setLinkTextValue(event.target.value);
                                setLinkError('');
                            }}
                            onKeyDown={event => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    insertLink();
                                }
                                if (event.key === 'Escape') {
                                    closeLinkPopover();
                                }
                            }}
                            placeholder="Link text"
                        />
                    </label>
                    <label>
                        Link
                        <input
                            value={linkValue}
                            onChange={event => {
                                setLinkValue(event.target.value);
                                setLinkError('');
                            }}
                            onKeyDown={event => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    insertLink();
                                }
                                if (event.key === 'Escape') {
                                    closeLinkPopover();
                                }
                            }}
                            placeholder="www.example.com"
                        />
                    </label>
                    {linkError && <div className="post-link-error">{linkError}</div>}
                    <div className="post-link-actions">
                        <button type="button" onClick={() => closeLinkPopover()}>Cancel</button>
                        <button type="button" onClick={insertLink}>{linkPopoverMode === 'edit' ? 'Save' : 'Insert'}</button>
                    </div>
                </div>
            )}
        </div>
    );
}
