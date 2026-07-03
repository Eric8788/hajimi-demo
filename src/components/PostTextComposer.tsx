'use client';

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ClipboardEvent,
    type FormEvent,
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
    placement?: 'above' | 'below';
};

type LinkPopoverMode = 'insert' | 'edit';

type RichCommand = 'bold'
    | 'italic'
    | 'underline'
    | 'strikeThrough'
    | 'insertUnorderedList'
    | 'h2'
    | 'h3'
    | 'p'
    | 'blockquote'
    | 'pre'
    | 'code'
    | 'link';

type LinkPreview = FloatingToolbarPosition & {
    href: string;
    text: string;
};

type PostTextComposerProps = {
    value: string;
    onChange: (value: string) => void;
    format?: PostContentFormat;
    onFormatChange?: (format: PostContentFormat) => void;
    editorRef?: (api: PostTextComposerApi | null) => void;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    maxLength?: number;
    allowInlineImagePaste?: boolean;
};

type InlineImageDraft = {
    file: File;
    previewUrl: string;
};

export type PostTextComposerApi = {
    sync: () => string;
    getInlineImages: () => { id: string; file: File }[];
    clearInlineImages: () => void;
};

const INLINE_MARKDOWN_PATTERN = /(!\[([^\]\n]{0,120})\]\(([^)\s]+)\)|`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+))/g;
const BLOCK_TAGS = new Set(['address', 'article', 'aside', 'blockquote', 'div', 'dl', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul']);
const EDITOR_BLOCK_SELECTOR = 'p,h1,h2,h3,h4,li,blockquote,pre,figure[data-editor-image-block]';
const EDITOR_TOP_LEVEL_BLOCK_SELECTOR = 'p,h1,h2,h3,h4,blockquote,pre,ul,ol,hr,figure[data-editor-image-block]';
const INLINE_IMAGE_PLACEHOLDER_PREFIX = 'hajimi-inline-image:';

function isInlineImagePlaceholder(src: string) {
    return src.startsWith(INLINE_IMAGE_PLACEHOLDER_PREFIX);
}

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

function safeImageSource(url: string) {
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (isInlineImagePlaceholder(trimmed)) return trimmed;
    return safeExternalUrl(trimmed);
}

function normalizeImageAlt(value: string) {
    return value
        .replace(/[\[\]\n\r]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
}

function createEditorImageHtml(src: string, alt = 'image') {
    const safeSrc = safeImageSource(src);
    if (!safeSrc) return '';
    const safeAlt = normalizeImageAlt(alt) || 'image';
    const escapedSrc = escapeAttribute(safeSrc);
    const escapedAlt = escapeAttribute(safeAlt);

    return `<figure data-editor-image-block="true" contenteditable="false"><img src="${escapedSrc}" alt="${escapedAlt}" draggable="false"></figure>`;
}

function looksLikeMarkdownSource(value: string) {
    return value.replace(/\r\n?/g, '\n').split('\n').some(line => (
        /^#{1,6}\s+\S/.test(line)
        || /^\s*[-*]\s+\S/.test(line)
        || /^\s*\d+[.)]\s+\S/.test(line)
        || /^>\s?\S/.test(line)
        || /^```/.test(line.trim())
        || /^(-{3,}|\*{3,})$/.test(line.trim())
        || /^!\[[^\]\n]*\]\([^)]+\)$/.test(line.trim())
    ));
}

function textToPlainPasteHtml(value: string) {
    const normalized = value.replace(/\r\n?/g, '\n');
    return normalized.includes('\n')
        ? markdownToEditorHtml(normalized)
        : escapeHtml(normalized);
}

function getClosestAnchor(target: EventTarget | null) {
    if (!(target instanceof Element)) return null;
    const anchor = target.closest('a');
    return anchor instanceof HTMLAnchorElement ? anchor : null;
}

function getClosestRichBlock(node: Node | null, editor: HTMLElement) {
    const element = node instanceof Element
        ? node
        : node?.parentElement;
    const block = element?.closest(EDITOR_BLOCK_SELECTOR);
    return block instanceof HTMLElement && editor.contains(block) ? block : null;
}

function getTopLevelEditorBlock(node: Node | null, editor: HTMLElement) {
    const block = getClosestRichBlock(node, editor);
    if (!block) return null;

    if (block.tagName.toLowerCase() === 'li') {
        const list = block.parentElement;
        return list instanceof HTMLElement && list.parentElement === editor ? list : block;
    }

    let current: HTMLElement = block;
    while (current.parentElement && current.parentElement !== editor) {
        current = current.parentElement;
    }

    return current.parentElement === editor ? current : block;
}

function getAdjacentEditorBlock(block: HTMLElement, direction: 'previous' | 'next') {
    const sibling = direction === 'previous' ? block.previousElementSibling : block.nextElementSibling;
    return sibling instanceof HTMLElement && sibling.matches(EDITOR_TOP_LEVEL_BLOCK_SELECTOR) ? sibling : null;
}

function isEditorImageBlock(node: Node | null) {
    return node instanceof HTMLElement && node.matches('figure[data-editor-image-block]');
}

function getClosestEditorImageBlock(target: EventTarget | null, editor: HTMLElement) {
    if (!(target instanceof Element)) return null;
    const block = target.closest('figure[data-editor-image-block]');
    return block instanceof HTMLElement && editor.contains(block) ? block : null;
}

function isBlockEffectivelyEmpty(block: HTMLElement) {
    const tagName = block.tagName.toLowerCase();
    if (tagName === 'hr' || block.matches('figure[data-editor-image-block]')) return false;
    return !normalizeEditorText(block.textContent || '').trim()
        && block.querySelectorAll('img, hr').length === 0;
}

function isCaretAtBlockEdge(range: Range, block: HTMLElement, edge: 'start' | 'end') {
    const probe = block.ownerDocument.createRange();
    probe.selectNodeContents(block);

    if (edge === 'start') {
        probe.setEnd(range.startContainer, range.startOffset);
    } else {
        probe.setStart(range.startContainer, range.startOffset);
    }

    const isAtEdge = !normalizeEditorText(probe.toString()).trim();
    probe.detach();
    return isAtEdge;
}

function getRangeFromPoint(document: Document, x: number, y: number) {
    const documentWithCaret = document as Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };

    if (documentWithCaret.caretRangeFromPoint) {
        return documentWithCaret.caretRangeFromPoint(x, y);
    }

    const position = documentWithCaret.caretPositionFromPoint?.(x, y);
    if (!position) return null;

    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
}

function parseCssPixels(value: string, fallback: number) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getEditorGridLineRect(editor: HTMLElement, y: number) {
    const editorRect = editor.getBoundingClientRect();
    if (y < editorRect.top || y > editorRect.bottom) return null;

    const styles = window.getComputedStyle(editor);
    const paddingTop = parseCssPixels(styles.paddingTop, 0);
    const paddingBottom = parseCssPixels(styles.paddingBottom, 0);
    const fontSize = parseCssPixels(styles.fontSize, 16);
    const lineHeight = parseCssPixels(styles.lineHeight, fontSize * 1.72);
    const contentTop = editorRect.top + paddingTop;
    const contentBottom = Math.max(contentTop, editorRect.bottom - paddingBottom);
    if (y < contentTop - lineHeight / 2 || y > contentBottom + lineHeight / 2) return null;

    const maxLineIndex = Math.max(0, Math.ceil((contentBottom - contentTop) / lineHeight) - 1);
    const lineIndex = Math.max(0, Math.min(
        Math.floor((y - contentTop) / lineHeight),
        maxLineIndex
    ));
    const top = contentTop + lineIndex * lineHeight;

    return {
        top,
        height: lineHeight,
    };
}

function getLineRectFromPoint(editor: HTMLElement, x: number, y: number) {
    const gridLineRect = getEditorGridLineRect(editor, y);
    if (gridLineRect) return gridLineRect;

    const range = getRangeFromPoint(editor.ownerDocument, x, y);
    if (!range) return null;

    const block = getClosestRichBlock(range.startContainer, editor);
    if (!block) return null;

    if (range.startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = range.startContainer;
        const length = textNode.textContent?.length ?? 0;
        if (length > 0) {
            const offset = Math.min(range.startOffset, length - 1);
            const probe = editor.ownerDocument.createRange();
            probe.setStart(textNode, offset);
            probe.setEnd(textNode, Math.min(length, offset + 1));
            const rects = Array.from(probe.getClientRects()).filter(rect => rect.height > 0);
            probe.detach();
            if (rects.length > 0) {
                const lineRect = rects.reduce((closest, rect) => (
                    Math.abs(rect.top - y) < Math.abs(closest.top - y) ? rect : closest
                ), rects[0]);
                return y >= lineRect.top - 2 && y <= lineRect.bottom + 2 ? lineRect : null;
            }
        }
    }

    const blockRect = block.getBoundingClientRect();
    return blockRect.height > 0 && y >= blockRect.top - 2 && y <= blockRect.bottom + 2
        ? blockRect
        : null;
}

function updateAnchorTarget(anchor: HTMLAnchorElement, href: string) {
    anchor.setAttribute('href', href);
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
}

function nodeHasBlockChild(node: Node) {
    return Array.from(node.childNodes).some(child => (
        child instanceof HTMLElement && BLOCK_TAGS.has(child.tagName.toLowerCase())
    ));
}

function renderClipboardInlineNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
        return escapeHtml(node.textContent || '');
    }

    if (!(node instanceof HTMLElement)) return '';

    const tagName = node.tagName.toLowerCase();
    const children = Array.from(node.childNodes).map(renderClipboardInlineNode).join('');

    if (tagName === 'br') return '<br>';
    if (tagName === 'strong' || tagName === 'b') return `<strong>${children}</strong>`;
    if (tagName === 'em' || tagName === 'i') return `<em>${children}</em>`;
    if (tagName === 'code' && node.closest('pre') === null) return `<code>${children}</code>`;
    if (tagName === 'img') {
        return createEditorImageHtml(node.getAttribute('src') || '', node.getAttribute('alt') || 'image');
    }
    if (tagName === 'a') {
        const href = safeExternalUrl(node.getAttribute('href') || '');
        return href
            ? `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">${children || escapeHtml(href)}</a>`
            : children;
    }

    return children;
}

function renderClipboardListItem(item: Element) {
    const html = Array.from(item.childNodes)
        .filter(child => !(child instanceof HTMLElement && (child.tagName.toLowerCase() === 'ul' || child.tagName.toLowerCase() === 'ol')))
        .map(renderClipboardInlineNode)
        .join('')
        .trim();
    return `<li>${html || escapeHtml(item.textContent || '')}</li>`;
}

function renderClipboardQuote(node: HTMLElement) {
    const lines = Array.from(node.childNodes)
        .map(child => {
            if (child instanceof HTMLElement && BLOCK_TAGS.has(child.tagName.toLowerCase())) {
                return renderClipboardInlineNode(child).trim();
            }
            return renderClipboardInlineNode(child).trim();
        })
        .filter(Boolean);

    return `<blockquote>${lines.join('<br>') || renderClipboardInlineNode(node)}</blockquote>`;
}

function renderClipboardBlockNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.replace(/\s+/g, ' ').trim() || '';
        return text ? `<p>${escapeHtml(text)}</p>` : '';
    }

    if (!(node instanceof HTMLElement)) return '';

    const tagName = node.tagName.toLowerCase();

    if (tagName === 'script' || tagName === 'style' || tagName === 'meta' || tagName === 'link') return '';
    if (tagName === 'img') {
        return createEditorImageHtml(node.getAttribute('src') || '', node.getAttribute('alt') || 'image');
    }
    if (tagName === 'figure' && node.querySelector('img')) {
        const image = node.querySelector('img');
        return image ? createEditorImageHtml(image.getAttribute('src') || '', image.getAttribute('alt') || 'image') : '';
    }

    if (/^h[1-6]$/.test(tagName)) {
        const level = Math.min(Math.max(Number(tagName.slice(1)), 1), 4);
        return `<h${level}>${renderClipboardInlineNode(node)}</h${level}>`;
    }

    if (tagName === 'p') {
        const content = renderClipboardInlineNode(node).trim();
        return content ? `<p>${content}</p>` : '';
    }

    if (tagName === 'blockquote') {
        return renderClipboardQuote(node);
    }

    if (tagName === 'pre') {
        return `<pre><code>${escapeHtml((node.textContent || '').replace(/\n+$/g, ''))}</code></pre>`;
    }

    if (tagName === 'ul' || tagName === 'ol') {
        const items = Array.from(node.children)
            .filter(child => child.tagName.toLowerCase() === 'li')
            .map(renderClipboardListItem)
            .join('');
        return items ? `<${tagName}>${items}</${tagName}>` : '';
    }

    if (tagName === 'hr') return '<hr>';

    if (tagName === 'br') return '';

    if (nodeHasBlockChild(node)) {
        return Array.from(node.childNodes).map(renderClipboardBlockNode).join('');
    }

    const inline = renderClipboardInlineNode(node).trim();
    return inline ? `<p>${inline}</p>` : '';
}

function clipboardHtmlToEditorHtml(html: string) {
    if (!html.trim()) return '';
    const document = new DOMParser().parseFromString(html, 'text/html');
    return Array.from(document.body.childNodes).map(renderClipboardBlockNode).join('');
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
        const imageAlt = match[2] || '';
        const imageSrc = match[3] || '';
        const markdownHref = match[5] || '';
        const autoHref = match[6] || '';
        const href = safeExternalUrl(markdownHref || autoHref);

        if (rawText.startsWith('![')) {
            html += createEditorImageHtml(imageSrc, imageAlt);
        } else if (href) {
            const label = match[4] || autoHref || href;
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
    let codeLines: string[] = [];
    let codeFenceOpen = false;

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
            if (codeFenceOpen) {
                htmlBlocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
                codeLines = [];
                codeFenceOpen = false;
            } else {
                flushParagraph();
                flushList();
                flushQuote();
                codeLines = [];
                codeFenceOpen = true;
            }
            continue;
        }

        if (codeFenceOpen) {
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

        const imageBlock = /^!\[([^\]\n]*)\]\(([^)\s]+)\)$/.exec(trimmed);
        if (imageBlock) {
            flushParagraph();
            flushList();
            flushQuote();
            htmlBlocks.push(createEditorImageHtml(imageBlock[2], imageBlock[1]));
            continue;
        }

        const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
        if (heading) {
            flushParagraph();
            flushList();
            flushQuote();
            const level = Math.min(Math.max(heading[1].length, 1), 4);
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

    if (codeFenceOpen) {
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

function nodeBlockChildrenToMarkdown(node: Node): string {
    return Array.from(node.childNodes)
        .map(blockToMarkdown)
        .map(block => block.trim())
        .filter(Boolean)
        .join('\n\n');
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
    if (tagName === 'img') {
        const inlineImageId = node.getAttribute('data-inline-image-id') || '';
        const src = inlineImageId
            ? `${INLINE_IMAGE_PLACEHOLDER_PREFIX}${inlineImageId}`
            : safeImageSource(node.getAttribute('src') || '');
        const alt = normalizeImageAlt(node.getAttribute('alt') || 'image') || 'image';
        return src ? `![${alt}](${src})` : '';
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
    if (isEditorImageBlock(node)) {
        const image = node.querySelector('img');
        if (!image) return '';
        const inlineImageId = image.getAttribute('data-inline-image-id') || '';
        const src = inlineImageId
            ? `${INLINE_IMAGE_PLACEHOLDER_PREFIX}${inlineImageId}`
            : safeImageSource(image.getAttribute('src') || '');
        const alt = normalizeImageAlt(image.getAttribute('alt') || 'image') || 'image';
        return src ? `![${alt}](${src})` : '';
    }

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

    if (nodeHasBlockChild(node)) {
        return nodeBlockChildrenToMarkdown(node);
    }

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

function selectionIsInsideEditor(selection: Selection | null, editor: HTMLElement) {
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    return editor.contains(range.startContainer) && editor.contains(range.endContainer);
}

function rangeCoversEditor(range: Range, editor: HTMLElement) {
    const editorText = normalizeEditorText(editor.textContent || '').trim();
    const selectedText = normalizeEditorText(range.toString()).trim();
    if (editorText && selectedText === editorText) return true;

    const probe = editor.ownerDocument.createRange();
    probe.selectNodeContents(editor);
    const covers = range.compareBoundaryPoints(Range.START_TO_START, probe) <= 0
        && range.compareBoundaryPoints(Range.END_TO_END, probe) >= 0;
    probe.detach();
    return covers;
}

function htmlHasTopLevelEditorBlock(document: Document, html: string) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return Array.from(template.content.childNodes).some(node => (
        node instanceof HTMLElement && node.matches(EDITOR_TOP_LEVEL_BLOCK_SELECTOR)
    ));
}

function singleParagraphInnerHtml(document: Document, html: string) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const meaningfulNodes = Array.from(template.content.childNodes).filter(node => (
        node.nodeType !== Node.TEXT_NODE || !!normalizeEditorText(node.textContent || '').trim()
    ));

    if (meaningfulNodes.length !== 1) return null;
    const onlyNode = meaningfulNodes[0];
    return onlyNode instanceof HTMLElement && onlyNode.tagName.toLowerCase() === 'p'
        ? onlyNode.innerHTML
        : null;
}

function ensureEditorBlockHtml(document: Document, html: string) {
    return htmlHasTopLevelEditorBlock(document, html) ? html : `<p>${html}</p>`;
}

function htmlToNodes(document: Document, html: string) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return Array.from(template.content.childNodes);
}

function createEmptyParagraph(document: Document) {
    const paragraph = document.createElement('p');
    paragraph.appendChild(document.createElement('br'));
    return paragraph;
}

function isEditableTextBlock(node: Node | null) {
    if (!(node instanceof HTMLElement)) return false;
    return node.matches('p,h1,h2,h3,h4,blockquote,pre,ul,ol');
}

function isImageBlockSequence(nodes: Node[]) {
    return nodes.length > 0 && nodes.every(node => isEditorImageBlock(node));
}

function ensureEditableImageBoundaries(editor: HTMLElement, insertedNodes: Node[] = []) {
    if (insertedNodes.length === 0 && !editor.querySelector('figure[data-editor-image-block]')) return;

    const firstChild = editor.firstElementChild;
    if (isEditorImageBlock(firstChild)) {
        editor.insertBefore(createEmptyParagraph(editor.ownerDocument), firstChild);
    }

    const lastChild = editor.lastElementChild;
    if (isEditorImageBlock(lastChild)) {
        editor.appendChild(createEmptyParagraph(editor.ownerDocument));
    }

    for (const node of insertedNodes) {
        const imageBlock = node instanceof HTMLElement && isEditorImageBlock(node) ? node : null;
        if (!imageBlock || imageBlock.parentElement !== editor) continue;

        const previous = imageBlock.previousElementSibling;
        const next = imageBlock.nextElementSibling;
        if (!isEditableTextBlock(previous)) {
            imageBlock.before(createEmptyParagraph(editor.ownerDocument));
        }
        if (!isEditableTextBlock(next)) {
            imageBlock.after(createEmptyParagraph(editor.ownerDocument));
        }
    }
}

function nodeHasVisibleEditorContent(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return !!normalizeEditorText(node.textContent || '').trim();
    }

    if (!(node instanceof HTMLElement)) return false;
    if (node.tagName.toLowerCase() === 'br') return false;
    return !!normalizeEditorText(node.textContent || '').trim()
        || node.querySelectorAll('img, hr').length > 0;
}

function placeCaretInNode(node: Node, edge: 'start' | 'end') {
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    if (node instanceof HTMLElement && (node.tagName.toLowerCase() === 'hr' || isEditorImageBlock(node))) {
        if (edge === 'start') {
            range.setStartBefore(node);
        } else {
            range.setStartAfter(node);
        }
        range.collapse(true);
    } else {
        range.selectNodeContents(node);
        range.collapse(edge === 'start');
    }
    selection.removeAllRanges();
    selection.addRange(range);
}

function placeCaretAfterInsertedNodes(nodes: Node[], editor: HTMLElement) {
    if (isImageBlockSequence(nodes)) {
        const lastImage = [...nodes].reverse().find(node => node.parentNode && isEditorImageBlock(node));
        const next = lastImage instanceof HTMLElement ? lastImage.nextElementSibling : null;
        if (next instanceof HTMLElement && isEditableTextBlock(next)) {
            placeCaretInNode(next, 'start');
            return;
        }
    }

    const target = [...nodes].reverse().find(node => node.parentNode && nodeHasVisibleEditorContent(node));
    if (target) {
        placeCaretInNode(target, 'end');
        return;
    }

    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}

function createSplitBlockShell(block: HTMLElement) {
    const tagName = block.tagName.toLowerCase();
    if (!['p', 'h1', 'h2', 'h3', 'h4', 'blockquote'].includes(tagName)) return null;
    return block.ownerDocument.createElement(tagName);
}

function appendFragmentIfVisible(block: HTMLElement, fragment: DocumentFragment) {
    if (!Array.from(fragment.childNodes).some(nodeHasVisibleEditorContent)) return false;
    block.appendChild(fragment);
    return true;
}

function splitBlockAroundRange(block: HTMLElement, range: Range, insertedNodes: Node[]) {
    const shellBefore = createSplitBlockShell(block);
    const shellAfter = createSplitBlockShell(block);
    if (!shellBefore || !shellAfter) return false;

    const beforeRange = block.ownerDocument.createRange();
    beforeRange.selectNodeContents(block);
    beforeRange.setEnd(range.startContainer, range.startOffset);

    const afterRange = block.ownerDocument.createRange();
    afterRange.selectNodeContents(block);
    afterRange.setStart(range.endContainer, range.endOffset);

    const replacements: Node[] = [];
    if (appendFragmentIfVisible(shellBefore, beforeRange.cloneContents())) {
        replacements.push(shellBefore);
    }
    replacements.push(...insertedNodes);
    if (appendFragmentIfVisible(shellAfter, afterRange.cloneContents())) {
        replacements.push(shellAfter);
    }

    beforeRange.detach();
    afterRange.detach();

    if (replacements.length === 0) return false;
    block.replaceWith(...replacements);
    return true;
}

function getSingleFullySelectedBlock(range: Range, editor: HTMLElement) {
    const selectedText = normalizeEditorText(range.toString()).trim();

    const startBlock = getTopLevelEditorBlock(range.startContainer, editor);
    const endBlock = getTopLevelEditorBlock(range.endContainer, editor);
    if (!startBlock || (endBlock && endBlock !== startBlock)) return null;

    if (isEditorImageBlock(startBlock)) {
        const probe = editor.ownerDocument.createRange();
        probe.selectNode(startBlock);
        const coversImageBlock = range.compareBoundaryPoints(Range.START_TO_START, probe) <= 0
            && range.compareBoundaryPoints(Range.END_TO_END, probe) >= 0;
        probe.detach();
        return coversImageBlock ? startBlock : null;
    }

    if (!selectedText) return null;

    const blockText = normalizeEditorText(startBlock.textContent || '').trim();
    return blockText && selectedText === blockText ? startBlock : null;
}

function removeBlockWithoutMerging(block: HTMLElement) {
    const next = block.nextElementSibling instanceof HTMLElement ? block.nextElementSibling : null;
    const previous = block.previousElementSibling instanceof HTMLElement ? block.previousElementSibling : null;
    const editor = block.parentElement;

    block.remove();

    if (next) {
        placeCaretInNode(next, 'start');
    } else if (previous) {
        placeCaretInNode(previous, 'end');
    } else if (editor) {
        const emptyParagraph = createEmptyParagraph(editor.ownerDocument);
        editor.appendChild(emptyParagraph);
        placeCaretInNode(emptyParagraph, 'start');
    }
}

function selectEditorBlock(block: HTMLElement) {
    const selection = window.getSelection();
    if (!selection) return;

    const range = block.ownerDocument.createRange();
    range.selectNode(block);
    selection.removeAllRanges();
    selection.addRange(range);
}

function removeEmptyActiveBlockAfterDelete(editor: HTMLElement) {
    const selection = window.getSelection();
    const range = selectionIsInsideEditor(selection, editor) && selection?.rangeCount
        ? selection.getRangeAt(0)
        : null;
    const activeBlock = range ? getTopLevelEditorBlock(range.startContainer, editor) : null;

    if (activeBlock && activeBlock.parentElement === editor && isBlockEffectivelyEmpty(activeBlock)) {
        removeBlockWithoutMerging(activeBlock);
        return true;
    }

    const emptyTopLevelBlock = Array.from(editor.children).find(child => (
        child instanceof HTMLElement
        && child.matches(EDITOR_TOP_LEVEL_BLOCK_SELECTOR)
        && isBlockEffectivelyEmpty(child)
    ));

    if (emptyTopLevelBlock instanceof HTMLElement) {
        removeBlockWithoutMerging(emptyTopLevelBlock);
        return true;
    }

    return false;
}

function insertInlineHtml(editor: HTMLElement, range: Range, html: string) {
    const insertedNodes = htmlToNodes(editor.ownerDocument, html);
    range.deleteContents();

    const fragment = editor.ownerDocument.createDocumentFragment();
    insertedNodes.forEach(node => fragment.appendChild(node));
    range.insertNode(fragment);
    placeCaretAfterInsertedNodes(insertedNodes, editor);
}

function insertBlockHtml(editor: HTMLElement, range: Range, html: string) {
    const blockHtml = ensureEditorBlockHtml(editor.ownerDocument, html);
    const insertedNodes = htmlToNodes(editor.ownerDocument, blockHtml);
    const selectedBlock = getSingleFullySelectedBlock(range, editor);
    const activeBlock = getTopLevelEditorBlock(range.startContainer, editor);

    if (rangeCoversEditor(range, editor)) {
        editor.innerHTML = blockHtml;
        const editorNodes = Array.from(editor.childNodes);
        ensureEditableImageBoundaries(editor, editorNodes);
        placeCaretAfterInsertedNodes(editorNodes, editor);
        return;
    }

    if (selectedBlock) {
        selectedBlock.replaceWith(...insertedNodes);
        ensureEditableImageBoundaries(editor, insertedNodes);
        placeCaretAfterInsertedNodes(insertedNodes, editor);
        return;
    }

    if (activeBlock && isBlockEffectivelyEmpty(activeBlock)) {
        activeBlock.replaceWith(...insertedNodes);
        ensureEditableImageBoundaries(editor, insertedNodes);
        placeCaretAfterInsertedNodes(insertedNodes, editor);
        return;
    }

    if (activeBlock && activeBlock.parentElement === editor) {
        if (isCaretAtBlockEdge(range, activeBlock, 'start')) {
            activeBlock.before(...insertedNodes);
            ensureEditableImageBoundaries(editor, insertedNodes);
            placeCaretAfterInsertedNodes(insertedNodes, editor);
            return;
        }

        if (isCaretAtBlockEdge(range, activeBlock, 'end')) {
            activeBlock.after(...insertedNodes);
            ensureEditableImageBoundaries(editor, insertedNodes);
            placeCaretAfterInsertedNodes(insertedNodes, editor);
            return;
        }

        if (splitBlockAroundRange(activeBlock, range, insertedNodes)) {
            ensureEditableImageBoundaries(editor, insertedNodes);
            placeCaretAfterInsertedNodes(insertedNodes, editor);
            return;
        }
    }

    insertInlineHtml(editor, range, blockHtml);
}

function insertPasteHtml(editor: HTMLElement, html: string, preferBlockInsertion: boolean) {
    const selection = window.getSelection();
    if (!selectionIsInsideEditor(selection, editor)) {
        editor.focus();
    }

    const activeSelection = window.getSelection();
    if (!selectionIsInsideEditor(activeSelection, editor) || !activeSelection?.rangeCount) {
        const nodes = htmlToNodes(editor.ownerDocument, ensureEditorBlockHtml(editor.ownerDocument, html));
        editor.append(...nodes);
        placeCaretAfterInsertedNodes(nodes, editor);
        return;
    }

    const range = activeSelection.getRangeAt(0);
    const isWholeBlockSelection = !!getSingleFullySelectedBlock(range, editor);
    const shouldInsertAsBlocks = preferBlockInsertion
        || rangeCoversEditor(range, editor)
        || isWholeBlockSelection
        || !!(getTopLevelEditorBlock(range.startContainer, editor) && isBlockEffectivelyEmpty(getTopLevelEditorBlock(range.startContainer, editor) as HTMLElement));

    if (shouldInsertAsBlocks) {
        insertBlockHtml(editor, range, html);
        return;
    }

    insertInlineHtml(editor, range, html);
}

function getSelectedInlineCode(range: Range, editor: HTMLElement) {
    const codes = Array.from(editor.querySelectorAll('code'))
        .filter(code => !code.closest('pre') && range.intersectsNode(code));

    return codes.length === 1 ? codes[0] : null;
}

function isRangeInsideNode(range: Range, node: Node) {
    return node.contains(range.startContainer) && node.contains(range.endContainer);
}

function getSelectionBlock(editor: HTMLElement, selection: Selection | null) {
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    return getClosestRichBlock(range.startContainer, editor);
}

function isRangeInsidePre(range: Range, editor: HTMLElement) {
    const startBlock = getClosestRichBlock(range.startContainer, editor);
    const endBlock = getClosestRichBlock(range.endContainer, editor);
    return startBlock?.tagName.toLowerCase() === 'pre'
        || endBlock?.tagName.toLowerCase() === 'pre';
}

function unwrapInlineCodeElement(code: HTMLElement) {
    const parent = code.parentNode;
    if (!parent) return false;

    const unwrappedNodes = Array.from(code.childNodes);
    if (unwrappedNodes.length === 0) {
        code.remove();
        return false;
    }

    for (const child of unwrappedNodes) {
        parent.insertBefore(child, code);
    }
    code.remove();

    const selection = window.getSelection();
    if (!selection) return true;

    const range = document.createRange();
    range.setStartBefore(unwrappedNodes[0]);
    range.setEndAfter(unwrappedNodes[unwrappedNodes.length - 1]);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
}

export default function PostTextComposer({
    value,
    onChange,
    format = 'markdown',
    editorRef,
    placeholder = 'Share an update, question, or resource...',
    rows = 5,
    disabled = false,
    maxLength,
    allowInlineImagePaste = true,
}: PostTextComposerProps) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const richEditorRef = useRef<HTMLDivElement | null>(null);
    const savedRichRangeRef = useRef<Range | null>(null);
    const activeRichAnchorRef = useRef<HTMLAnchorElement | null>(null);
    const editingRichAnchorRef = useRef<HTMLAnchorElement | null>(null);
    const isSelectingWithPointerRef = useRef(false);
    const toolbarFrameRef = useRef<number | null>(null);
    const linkPreviewHideTimerRef = useRef<number | null>(null);
    const inlineImagesRef = useRef(new Map<string, InlineImageDraft>());
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
    const [selectedImageBlock, setSelectedImageBlock] = useState<HTMLElement | null>(null);
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
        if (!editor) return value;

        if (!editor.textContent?.trim() && editor.querySelectorAll('img, hr').length === 0) {
            editor.innerHTML = '';
            onChange('');
            return '';
        }

        const rawValue = editorHtmlToMarkdown(editor);
        const nextValue = clampValue(rawValue);
        const liveInlineImageIds = new Set(
            Array.from(editor.querySelectorAll('img[data-inline-image-id]'))
                .map(image => image.getAttribute('data-inline-image-id') || '')
                .filter(Boolean),
        );
        inlineImagesRef.current.forEach((draft, id) => {
            if (!liveInlineImageIds.has(id)) {
                URL.revokeObjectURL(draft.previewUrl);
                inlineImagesRef.current.delete(id);
            }
        });
        if (nextValue !== rawValue) {
            editor.innerHTML = markdownToEditorHtml(nextValue);
            ensureEditableImageBoundaries(editor, Array.from(editor.childNodes));
        }
        onChange(nextValue);
        return nextValue;
    }, [clampValue, onChange, value]);

    const handleRichInput = (event: FormEvent<HTMLDivElement>) => {
        const editor = richEditorRef.current;
        const nativeEvent = event.nativeEvent as InputEvent;
        if (!editor) return;

        if (nativeEvent.inputType?.startsWith('delete') && removeEmptyActiveBlockAfterDelete(editor)) {
            updateFromRichEditor();
            scheduleFloatingToolbar();
            return;
        }

        updateFromRichEditor();
    };

    useEffect(() => {
        editorRef?.({
            sync: updateFromRichEditor,
            getInlineImages: () => Array.from(inlineImagesRef.current.entries()).map(([id, draft]) => ({ id, file: draft.file })),
            clearInlineImages: () => {
                inlineImagesRef.current.forEach(draft => URL.revokeObjectURL(draft.previewUrl));
                inlineImagesRef.current.clear();
            },
        });
        return () => editorRef?.(null);
    }, [editorRef, updateFromRichEditor]);

    useEffect(() => {
        const inlineImages = inlineImagesRef.current;
        return () => {
            inlineImages.forEach(draft => URL.revokeObjectURL(draft.previewUrl));
            inlineImages.clear();
        };
    }, []);

    useEffect(() => {
        const editor = richEditorRef.current;
        if (!editor) return;

        editor.querySelectorAll('figure[data-editor-image-block].is-selected')
            .forEach(block => {
                if (block !== selectedImageBlock) {
                    block.classList.remove('is-selected');
                }
            });
        selectedImageBlock?.classList.add('is-selected');
    }, [selectedImageBlock]);

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

        const centerLeft = rect.left - wrapperRect.left + rect.width / 2;
        const sidePadding = Math.min(176, Math.max(128, wrapperRect.width / 2));
        const minLeft = Math.min(sidePadding, wrapperRect.width / 2);
        const maxLeft = Math.max(minLeft, wrapperRect.width - minLeft);
        const aboveTop = rect.top - wrapperRect.top - 48;
        const placement = aboveTop < 8 ? 'below' : 'above';

        setFloatingToolbar({
            left: Math.min(maxLeft, Math.max(minLeft, centerLeft)),
            top: placement === 'below'
                ? Math.max(8, rect.bottom - wrapperRect.top + 10)
                : Math.max(8, aboveTop),
            placement,
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
        const editor = richEditorRef.current;
        if (editor && getClosestEditorImageBlock(event.target, editor)) {
            isSelectingWithPointerRef.current = false;
            setFloatingToolbar(null);
            return;
        }

        isSelectingWithPointerRef.current = true;
        if (toolbarFrameRef.current !== null) {
            window.cancelAnimationFrame(toolbarFrameRef.current);
            toolbarFrameRef.current = null;
        }
        setSelectedImageBlock(null);
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
            ensureEditableImageBoundaries(editor, Array.from(editor.childNodes));
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

    const handleRichKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a')) return;

        const editor = richEditorRef.current;
        if (!editor || disabled) return;

        event.preventDefault();
        const range = editor.ownerDocument.createRange();
        range.selectNodeContents(editor);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        savedRichRangeRef.current = range.cloneRange();
        scheduleFloatingToolbar();
    };

    const handleRichBeforeInput = (event: FormEvent<HTMLDivElement>) => {
        const editor = richEditorRef.current;
        const nativeEvent = event.nativeEvent as InputEvent;
        if (!editor || disabled || !nativeEvent.inputType?.startsWith('delete')) return;

        const selection = window.getSelection();
        if (!selectionIsInsideEditor(selection, editor) || !selection?.rangeCount) return;

        const range = selection.getRangeAt(0);
        const isBackwardDelete = nativeEvent.inputType === 'deleteContentBackward';
        const isForwardDelete = nativeEvent.inputType === 'deleteContentForward';
        if (!isBackwardDelete && !isForwardDelete && nativeEvent.inputType !== 'deleteByCut') return;

        if (selectedImageBlock && editor.contains(selectedImageBlock)) {
            event.preventDefault();
            removeBlockWithoutMerging(selectedImageBlock);
            setSelectedImageBlock(null);
            updateFromRichEditor();
            scheduleFloatingToolbar();
            return;
        }

        if (!range.collapsed) {
            const selectedBlock = getSingleFullySelectedBlock(range, editor);
            if (selectedBlock) {
                event.preventDefault();
                removeBlockWithoutMerging(selectedBlock);
                setSelectedImageBlock(null);
                updateFromRichEditor();
                scheduleFloatingToolbar();
            }
            return;
        }

        const activeBlock = getTopLevelEditorBlock(range.startContainer, editor);
        if (!activeBlock) return;

        if (isBlockEffectivelyEmpty(activeBlock)) {
            event.preventDefault();
            removeBlockWithoutMerging(activeBlock);
            updateFromRichEditor();
            scheduleFloatingToolbar();
            return;
        }

        if (isBackwardDelete && isCaretAtBlockEdge(range, activeBlock, 'start')) {
            const previousBlock = getAdjacentEditorBlock(activeBlock, 'previous');
            if (previousBlock && isEditorImageBlock(previousBlock)) {
                event.preventDefault();
                removeBlockWithoutMerging(previousBlock);
                setSelectedImageBlock(null);
                updateFromRichEditor();
                scheduleFloatingToolbar();
                return;
            }
            if (previousBlock && previousBlock.tagName !== activeBlock.tagName) {
                event.preventDefault();
                if (isBlockEffectivelyEmpty(previousBlock)) {
                    previousBlock.remove();
                    placeCaretInNode(activeBlock, 'start');
                    updateFromRichEditor();
                }
                scheduleFloatingToolbar();
            }
            return;
        }

        if (isForwardDelete && isCaretAtBlockEdge(range, activeBlock, 'end')) {
            const nextBlock = getAdjacentEditorBlock(activeBlock, 'next');
            if (nextBlock && isEditorImageBlock(nextBlock)) {
                event.preventDefault();
                removeBlockWithoutMerging(nextBlock);
                setSelectedImageBlock(null);
                updateFromRichEditor();
                scheduleFloatingToolbar();
                return;
            }
            if (nextBlock && nextBlock.tagName !== activeBlock.tagName) {
                event.preventDefault();
                if (isBlockEffectivelyEmpty(nextBlock)) {
                    nextBlock.remove();
                    placeCaretInNode(activeBlock, 'end');
                    updateFromRichEditor();
                }
                scheduleFloatingToolbar();
            }
        }
    };

    const handleRichPaste = (event: ClipboardEvent<HTMLDivElement>) => {
        const editor = richEditorRef.current;
        const pastedText = event.clipboardData.getData('text/plain');
        const pastedHtml = event.clipboardData.getData('text/html');
        const imageFiles = Array.from(event.clipboardData.files || [])
            .filter(file => file.type.startsWith('image/'));
        if (!editor || (!pastedText && !pastedHtml && imageFiles.length === 0)) return;

        event.preventDefault();

        if (imageFiles.length > 0 && !allowInlineImagePaste) {
            return;
        }

        if (imageFiles.length > 0) {
            const imageHtml = imageFiles.map(file => {
                const id = `inline-${Date.now()}-${crypto.randomUUID()}`;
                const previewUrl = URL.createObjectURL(file);
                inlineImagesRef.current.set(id, { file, previewUrl });
                return createEditorImageHtml(`${INLINE_IMAGE_PLACEHOLDER_PREFIX}${id}`, file.name || 'image')
                    .replace(`src="${escapeAttribute(`${INLINE_IMAGE_PLACEHOLDER_PREFIX}${id}`)}"`, `src="${escapeAttribute(previewUrl)}" data-inline-image-id="${escapeAttribute(id)}"`);
            }).join('');

            insertPasteHtml(editor, imageHtml, true);
            updateFromRichEditor();
            scheduleFloatingToolbar();
            return;
        }

        const isMarkdownSource = !!pastedText && looksLikeMarkdownSource(pastedText);
        const richHtml = isMarkdownSource ? '' : clipboardHtmlToEditorHtml(pastedHtml);
        const blockLikePaste = isMarkdownSource
            || pastedText.replace(/\r\n?/g, '\n').includes('\n')
            || (!!richHtml && singleParagraphInnerHtml(editor.ownerDocument, richHtml) === null);
        const nextHtml = isMarkdownSource
            ? markdownToEditorHtml(pastedText)
            : richHtml || textToPlainPasteHtml(pastedText);
        const inlineHtml = blockLikePaste
            ? nextHtml
            : singleParagraphInnerHtml(editor.ownerDocument, nextHtml) ?? nextHtml;

        insertPasteHtml(editor, inlineHtml, blockLikePaste);
        updateFromRichEditor();
        scheduleFloatingToolbar();
    };

    const handleRichMouseOver = (event: MouseEvent<HTMLDivElement>) => {
        if (disabled || isLinkPopoverOpen) return;
        const anchor = getClosestAnchor(event.target);
        if (anchor) showLinkPreview(anchor);
    };

    const handleRichMouseMove = (event: MouseEvent<HTMLDivElement>) => {
        const editor = richEditorRef.current;
        const wrapperRect = editor?.closest('.post-rich-editor-wrap')?.getBoundingClientRect();
        if (!editor || !wrapperRect) return;

        const lineRect = getLineRectFromPoint(editor, event.clientX, event.clientY);
        if (!lineRect) return;

        const rawTop = lineRect.top - wrapperRect.top + Math.max(0, (lineRect.height - 34) / 2);
        const nextTop = Math.max(10, Math.min(rawTop, wrapperRect.height - 42));
        setBlockToolbarTop(nextTop);
    };

    const handleRichMouseLeave = (event: MouseEvent<HTMLDivElement>) => {
        if (getClosestAnchor(event.target)) {
            scheduleLinkPreviewHide();
        }
    };

    const handleRichClick = (event: MouseEvent<HTMLDivElement>) => {
        const editor = richEditorRef.current;
        if (editor) {
            const imageBlock = getClosestEditorImageBlock(event.target, editor);
            if (imageBlock) {
                event.preventDefault();
                event.stopPropagation();
                editor.focus();
                selectEditorBlock(imageBlock);
                setSelectedImageBlock(imageBlock);
                setFloatingToolbar(null);
                setLinkPreview(null);
                return;
            }
            setSelectedImageBlock(null);
        }

        const anchor = getClosestAnchor(event.target);
        if (!anchor) return;

        event.preventDefault();
        if (!disabled) showLinkPreview(anchor);
    };

    const applyRichCommand = (command: RichCommand) => {
        const editor = richEditorRef.current;
        if (!editor || disabled) return;

        editor.focus();
        restoreRange(savedRichRangeRef.current);

        if (command === 'link') {
            openLinkPopover();
            return;
        }

        if (command === 'h2' || command === 'h3' || command === 'p' || command === 'blockquote' || command === 'pre') {
            const selection = window.getSelection();
            const activeBlock = getSelectionBlock(editor, selection);
            const activeTag = activeBlock?.tagName.toLowerCase();
            const nextBlock = activeTag === command && (command === 'blockquote' || command === 'pre')
                ? 'p'
                : command;
            document.execCommand('formatBlock', false, nextBlock);
        } else if (command === 'code') {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                if (isRangeInsidePre(range, editor)) {
                    scheduleFloatingToolbar();
                    return;
                }

                const selectedCode = getSelectedInlineCode(range, editor);
                if (selectedCode && (isRangeInsideNode(range, selectedCode) || selectedCode.textContent === selection.toString())) {
                    unwrapInlineCodeElement(selectedCode);
                    updateFromRichEditor();
                    scheduleFloatingToolbar();
                    return;
                }

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
                        className={`post-block-toolbar${blockToolbarTop < 58 ? ' is-near-top' : ''}`}
                        style={{ top: blockToolbarTop }}
                        onMouseDown={handleToolbarMouseDown}
                        role="toolbar"
                        aria-label="Block formatting"
                    >
                        <button
                            type="button"
                            className="post-block-handle"
                            title="Block tools"
                            aria-label="Block tools"
                            aria-haspopup="menu"
                            onClick={() => richEditorRef.current?.focus()}
                            disabled={disabled}
                        >
                            <span className="post-block-handle-type">T</span>
                            <span className="post-block-grip" aria-hidden="true">
                                <span />
                                <span />
                                <span />
                                <span />
                                <span />
                                <span />
                            </span>
                        </button>
                        <div className="post-block-menu" role="menu" aria-label="Block options">
                            <button type="button" className="post-block-menu-button" role="menuitem" onClick={() => applyRichCommand('p')} title="Paragraph" disabled={disabled}>T</button>
                            <button type="button" className="post-block-menu-button" role="menuitem" onClick={() => applyRichCommand('h2')} title="Heading 2" disabled={disabled}>H2</button>
                            <button type="button" className="post-block-menu-button" role="menuitem" onClick={() => applyRichCommand('h3')} title="Heading 3" disabled={disabled}>H3</button>
                            <button type="button" className="post-block-menu-button" role="menuitem" onClick={() => applyRichCommand('insertUnorderedList')} title="List" disabled={disabled}>-</button>
                            <button type="button" className="post-block-menu-button" role="menuitem" onClick={() => applyRichCommand('blockquote')} title="Quote" disabled={disabled}>&gt;</button>
                            <button type="button" className="post-block-menu-button" role="menuitem" onClick={() => applyRichCommand('pre')} title="Code block" disabled={disabled}>{'{}'}</button>
                        </div>
                    </div>
                    {floatingToolbar && (
                        <div
                            className={`post-selection-toolbar${floatingToolbar.placement === 'below' ? ' is-below' : ''}`}
                            style={{ left: floatingToolbar.left, top: floatingToolbar.top }}
                            onMouseDown={handleToolbarMouseDown}
                            role="toolbar"
                            aria-label="Selected text formatting"
                        >
                            <button type="button" onClick={() => applyRichCommand('bold')} title="Bold" disabled={disabled}>B</button>
                            <button type="button" onClick={() => applyRichCommand('italic')} title="Italic" disabled={disabled}>I</button>
                            <button type="button" onClick={() => applyRichCommand('underline')} title="Underline" disabled={disabled}>U</button>
                            <span className="post-selection-divider" />
                            <button type="button" onClick={() => applyRichCommand('code')} title="Inline code" disabled={disabled}>{'{}'}</button>
                            <button type="button" onClick={() => applyRichCommand('link')} title="Link" disabled={disabled}>Link</button>
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
                        onBeforeInput={handleRichBeforeInput}
                        onInput={handleRichInput}
                        onKeyDown={handleRichKeyDown}
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
                                ensureEditableImageBoundaries(editor, Array.from(editor.childNodes));
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
