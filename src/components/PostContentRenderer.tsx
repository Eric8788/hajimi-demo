import type { ReactNode } from 'react';
import { normalizePostContentFormat, type PostContentFormat } from '@/lib/forumContent';
import { getImageDisplayUrl } from '@/lib/imageProxy';

const INLINE_PATTERN = /(!\[([^\]\n]{0,120})\]\((https?:\/\/[^\s)]+)\)|`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+))/g;

type ListBlock = {
    type: 'list';
    ordered: boolean;
    items: string[];
};

type MarkdownBlock =
    | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
    | { type: 'paragraph'; lines: string[] }
    | { type: 'quote'; lines: string[] }
    | { type: 'code'; text: string }
    | ListBlock
    | { type: 'image'; src: string; alt: string }
    | { type: 'rule' };

type PostContentRendererProps = {
    content: string;
    format?: PostContentFormat | string | null;
    className?: string;
    disableLinks?: boolean;
};

type RenderInlineOptions = {
    disableLinks?: boolean;
};

function safeExternalUrl(url: string) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
    } catch {
        return '';
    }
}

function renderInline(text: string, keyPrefix: string, options: RenderInlineOptions = {}): ReactNode[] {
    const parts: ReactNode[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(INLINE_PATTERN)) {
        const matchIndex = match.index ?? 0;
        if (matchIndex > lastIndex) {
            parts.push(text.slice(lastIndex, matchIndex));
        }

        const rawText = match[0];
        const imageAlt = match[2] || '';
        const imageSrc = match[3] || '';
        const markdownHref = match[5] || '';
        const autoHref = match[6] || '';
        const href = safeExternalUrl(markdownHref || autoHref);

        if (rawText.startsWith('![') && safeExternalUrl(imageSrc)) {
            parts.push(
                <span key={`${keyPrefix}-${matchIndex}`} className="post-inline-image-block">
                    <img src={getImageDisplayUrl(imageSrc)} alt={imageAlt || 'Post image'} loading="lazy" decoding="async" />
                </span>
            );
        } else if (href) {
            const label = match[4] || autoHref || href;
            parts.push(options.disableLinks ? label : (
                <a key={`${keyPrefix}-${matchIndex}`} href={href} target="_blank" rel="noopener noreferrer" className="post-rich-link">
                    {label}
                </a>
            ));
        } else if (rawText.startsWith('`') && rawText.endsWith('`')) {
            parts.push(<code key={`${keyPrefix}-${matchIndex}`}>{rawText.slice(1, -1)}</code>);
        } else if (rawText.startsWith('**') && rawText.endsWith('**')) {
            parts.push(<strong key={`${keyPrefix}-${matchIndex}`}>{rawText.slice(2, -2)}</strong>);
        } else if (rawText.startsWith('*') && rawText.endsWith('*')) {
            parts.push(<em key={`${keyPrefix}-${matchIndex}`}>{rawText.slice(1, -1)}</em>);
        } else {
            parts.push(rawText);
        }

        lastIndex = matchIndex + rawText.length;
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return parts;
}

function renderPlainText(text: string, options: RenderInlineOptions = {}) {
    const lines = text.split('\n');

    return lines.map((line, lineIndex) => (
        <span key={lineIndex}>
            {renderInline(line, `plain-${lineIndex}`, options)}
            {lineIndex < lines.length - 1 && <br />}
        </span>
    ));
}

function flushParagraph(blocks: MarkdownBlock[], paragraphLines: string[]) {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: 'paragraph', lines: [...paragraphLines] });
    paragraphLines.length = 0;
}

function parseMarkdown(text: string): MarkdownBlock[] {
    const blocks: MarkdownBlock[] = [];
    const paragraphLines: string[] = [];
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    let listBlock: ListBlock | null = null;
    let quoteLines: string[] = [];
    let codeLines: string[] = [];
    let codeFenceOpen = false;

    const flushList = () => {
        if (!listBlock) return;
        blocks.push(listBlock);
        listBlock = null;
    };

    const flushQuote = () => {
        if (quoteLines.length === 0) return;
        blocks.push({ type: 'quote', lines: [...quoteLines] });
        quoteLines = [];
    };

    for (const line of lines) {
        if (line.trim().startsWith('```')) {
            if (codeFenceOpen) {
                blocks.push({ type: 'code', text: codeLines.join('\n') });
                codeLines = [];
                codeFenceOpen = false;
            } else {
                flushParagraph(blocks, paragraphLines);
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
            flushParagraph(blocks, paragraphLines);
            flushList();
            flushQuote();
            continue;
        }

        const imageBlock = /^!\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)$/.exec(trimmed);
        if (imageBlock) {
            flushParagraph(blocks, paragraphLines);
            flushList();
            flushQuote();
            blocks.push({ type: 'image', src: imageBlock[2], alt: imageBlock[1] || 'Post image' });
            continue;
        }

        const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
        if (heading) {
            flushParagraph(blocks, paragraphLines);
            flushList();
            flushQuote();
            blocks.push({
                type: 'heading',
                level: Math.min(Math.max(heading[1].length, 1), 4) as 1 | 2 | 3 | 4,
                text: heading[2].trim(),
            });
            continue;
        }

        if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
            flushParagraph(blocks, paragraphLines);
            flushList();
            flushQuote();
            blocks.push({ type: 'rule' });
            continue;
        }

        const quote = /^>\s?(.*)$/.exec(line);
        if (quote) {
            flushParagraph(blocks, paragraphLines);
            flushList();
            quoteLines.push(quote[1]);
            continue;
        }

        const unorderedItem = /^\s*[-*]\s+(.+)$/.exec(line);
        const orderedItem = /^\s*\d+[.)]\s+(.+)$/.exec(line);
        const listMatch = unorderedItem || orderedItem;
        if (listMatch) {
            flushParagraph(blocks, paragraphLines);
            flushQuote();
            const ordered = !!orderedItem;
            if (!listBlock || listBlock.ordered !== ordered) {
                flushList();
                listBlock = { type: 'list', ordered, items: [] };
            }
            listBlock.items.push(listMatch[1]);
            continue;
        }

        flushList();
        flushQuote();
        paragraphLines.push(trimmed);
    }

    if (codeFenceOpen) {
        blocks.push({ type: 'code', text: codeLines.join('\n') });
    }
    flushParagraph(blocks, paragraphLines);
    flushList();
    flushQuote();

    return blocks;
}

function renderMarkdown(text: string, options: RenderInlineOptions = {}) {
    return parseMarkdown(text).map((block, index) => {
        if (block.type === 'heading') {
            const HeadingTag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4';
            return <HeadingTag key={index}>{renderInline(block.text, `heading-${index}`, options)}</HeadingTag>;
        }

        if (block.type === 'paragraph') {
            return (
                <p key={index}>
                    {block.lines.map((line, lineIndex) => (
                        <span key={lineIndex}>
                            {renderInline(line, `paragraph-${index}-${lineIndex}`, options)}
                            {lineIndex < block.lines.length - 1 && <br />}
                        </span>
                    ))}
                </p>
            );
        }

        if (block.type === 'quote') {
            return (
                <blockquote key={index}>
                    {block.lines.map((line, lineIndex) => (
                        <span key={lineIndex}>
                            {renderInline(line, `quote-${index}-${lineIndex}`, options)}
                            {lineIndex < block.lines.length - 1 && <br />}
                        </span>
                    ))}
                </blockquote>
            );
        }

        if (block.type === 'code') {
            return (
                <pre key={index}>
                    <code>{block.text}</code>
                </pre>
            );
        }

        if (block.type === 'list') {
            const ListTag = block.ordered ? 'ol' : 'ul';
            return (
                <ListTag key={index}>
                    {block.items.map((item, itemIndex) => (
                        <li key={itemIndex}>{renderInline(item, `list-${index}-${itemIndex}`, options)}</li>
                    ))}
                </ListTag>
            );
        }

        if (block.type === 'image') {
            return (
                <figure key={index} className="post-inline-image-block">
                    <img src={getImageDisplayUrl(block.src)} alt={block.alt} loading="lazy" decoding="async" />
                </figure>
            );
        }

        return <hr key={index} />;
    });
}

export default function PostContentRenderer({ content, format, className = '', disableLinks = false }: PostContentRendererProps) {
    const normalizedFormat = normalizePostContentFormat(format);
    const rendererClassName = `post-content-renderer is-${normalizedFormat}${className ? ` ${className}` : ''}`;

    return (
        <div className={rendererClassName}>
            {normalizedFormat === 'markdown'
                ? renderMarkdown(content, { disableLinks })
                : renderPlainText(content, { disableLinks })}
        </div>
    );
}
