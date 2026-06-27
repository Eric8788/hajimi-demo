'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { normalizePostContentFormat, type PostContentFormat } from '@/lib/forumContent';
import PostContentRenderer from './PostContentRenderer';

type TextSelection = {
    start: number;
    end: number;
};

type PostTextComposerProps = {
    value: string;
    onChange: (value: string) => void;
    format?: PostContentFormat;
    onFormatChange?: (format: PostContentFormat) => void;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
};

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

function getFallbackText(kind: 'bold' | 'italic' | 'heading' | 'quote' | 'list' | 'code') {
    switch (kind) {
        case 'heading':
            return 'Heading';
        case 'quote':
            return 'Quoted thought';
        case 'list':
            return 'List item';
        case 'code':
            return 'code';
        default:
            return 'text';
    }
}

export default function PostTextComposer({
    value,
    onChange,
    format = 'plain',
    onFormatChange,
    placeholder = 'Share an update, question, or resource...',
    rows = 5,
    disabled = false,
}: PostTextComposerProps) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const activeFormat = normalizePostContentFormat(format);
    const canSwitchFormat = !!onFormatChange;
    const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
    const [linkValue, setLinkValue] = useState('');
    const [linkError, setLinkError] = useState('');
    const [savedSelection, setSavedSelection] = useState<TextSelection>({ start: 0, end: 0 });
    const [isPreviewingMarkdown, setIsPreviewingMarkdown] = useState(false);

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

    const openLinkPopover = () => {
        rememberSelection();
        setLinkError('');
        setLinkValue('');
        setIsLinkPopoverOpen(true);
    };

    const closeLinkPopover = () => {
        setIsLinkPopoverOpen(false);
        setLinkError('');
        setLinkValue('');
        textareaRef.current?.focus();
    };

    const applySelectionEdit = (
        makeInsertion: (selectedText: string) => { text: string; selectOffset?: number; selectLength?: number }
    ) => {
        const selection = rememberSelection();
        const selectedText = value.slice(selection.start, selection.end);
        const insertion = makeInsertion(selectedText);
        const nextValue = `${value.slice(0, selection.start)}${insertion.text}${value.slice(selection.end)}`;

        onChange(nextValue);

        window.requestAnimationFrame(() => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const selectionStart = selection.start + (insertion.selectOffset ?? insertion.text.length);
            const selectionEnd = insertion.selectLength == null
                ? selectionStart
                : selectionStart + insertion.selectLength;

            textarea.focus();
            textarea.setSelectionRange(selectionStart, selectionEnd);
        });
    };

    const wrapSelection = (prefix: string, suffix = prefix, fallback = 'text') => {
        applySelectionEdit(selectedText => {
            const body = selectedText || fallback;
            return {
                text: `${prefix}${body}${suffix}`,
                selectOffset: prefix.length,
                selectLength: body.length,
            };
        });
    };

    const prefixSelectionLines = (prefix: string, fallback: string) => {
        applySelectionEdit(selectedText => {
            const sourceText = selectedText || fallback;
            const insertion = sourceText
                .split('\n')
                .map(line => line.trim() ? `${prefix}${line}` : line)
                .join('\n');

            return {
                text: insertion,
                selectOffset: prefix.length,
                selectLength: sourceText.length,
            };
        });
    };

    const applyMarkdownTool = (kind: 'bold' | 'italic' | 'heading' | 'quote' | 'list' | 'code') => {
        if (disabled) return;

        if (activeFormat !== 'markdown' && onFormatChange) {
            onFormatChange('markdown');
        }

        if (kind === 'bold') {
            wrapSelection('**', '**', getFallbackText(kind));
            return;
        }

        if (kind === 'italic') {
            wrapSelection('*', '*', getFallbackText(kind));
            return;
        }

        if (kind === 'code') {
            wrapSelection('`', '`', getFallbackText(kind));
            return;
        }

        if (kind === 'heading') {
            prefixSelectionLines('## ', getFallbackText(kind));
            return;
        }

        if (kind === 'quote') {
            prefixSelectionLines('> ', getFallbackText(kind));
            return;
        }

        prefixSelectionLines('- ', getFallbackText(kind));
    };

    const insertLink = () => {
        const href = normalizeLinkInput(linkValue);
        if (!href) {
            setLinkError('Enter a domain or http(s) link.');
            return;
        }

        const selection = savedSelection;
        const selectedText = value.slice(selection.start, selection.end);
        const label = normalizeLinkLabel(selectedText);
        const insertion = `[${label}](${href})`;
        const nextValue = `${value.slice(0, selection.start)}${insertion}${value.slice(selection.end)}`;

        onChange(nextValue);
        setIsLinkPopoverOpen(false);
        setLinkValue('');
        setLinkError('');

        window.requestAnimationFrame(() => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const caret = selection.start + insertion.length;
            textarea.focus();
            textarea.setSelectionRange(caret, caret);
        });
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            openLinkPopover();
        }
    };

    return (
        <div className="post-text-composer">
            <div className="post-text-toolbar" aria-label="Post formatting tools">
                {canSwitchFormat && (
                    <div className="post-format-toggle" aria-label="Post content mode">
                        <button
                            type="button"
                            className={activeFormat === 'plain' ? 'is-active' : ''}
                            onClick={() => {
                                onFormatChange?.('plain');
                                setIsPreviewingMarkdown(false);
                            }}
                            disabled={disabled}
                        >
                            Plain
                        </button>
                        <button
                            type="button"
                            className={activeFormat === 'markdown' ? 'is-active' : ''}
                            onClick={() => onFormatChange?.('markdown')}
                            disabled={disabled}
                        >
                            Markdown
                        </button>
                    </div>
                )}
                <button
                    type="button"
                    className="post-text-tool"
                    onMouseDown={event => event.preventDefault()}
                    onClick={openLinkPopover}
                    disabled={disabled}
                    title="Insert link"
                    aria-label="Insert link"
                >
                    Link
                </button>
                {activeFormat === 'markdown' && (
                    <>
                        <button type="button" className="post-text-tool" onMouseDown={event => event.preventDefault()} onClick={() => applyMarkdownTool('heading')} disabled={disabled} title="Heading" aria-label="Heading">H</button>
                        <button type="button" className="post-text-tool" onMouseDown={event => event.preventDefault()} onClick={() => applyMarkdownTool('bold')} disabled={disabled} title="Bold" aria-label="Bold">B</button>
                        <button type="button" className="post-text-tool" onMouseDown={event => event.preventDefault()} onClick={() => applyMarkdownTool('italic')} disabled={disabled} title="Italic" aria-label="Italic">I</button>
                        <button type="button" className="post-text-tool" onMouseDown={event => event.preventDefault()} onClick={() => applyMarkdownTool('list')} disabled={disabled} title="List" aria-label="List">-</button>
                        <button type="button" className="post-text-tool" onMouseDown={event => event.preventDefault()} onClick={() => applyMarkdownTool('quote')} disabled={disabled} title="Quote" aria-label="Quote">&gt;</button>
                        <button type="button" className="post-text-tool" onMouseDown={event => event.preventDefault()} onClick={() => applyMarkdownTool('code')} disabled={disabled} title="Inline code" aria-label="Inline code">{'{}'}</button>
                    </>
                )}
                <span>{activeFormat === 'markdown' ? 'Markdown supports headings, lists, quotes, code, bold, and links.' : 'Select text, insert a link, and a domain is enough.'}</span>
                {activeFormat === 'markdown' && (
                    <button
                        type="button"
                        className="post-preview-toggle"
                        onClick={() => setIsPreviewingMarkdown(current => !current)}
                        disabled={disabled}
                    >
                        {isPreviewingMarkdown ? 'Edit' : 'Preview'}
                    </button>
                )}
            </div>
            {activeFormat === 'markdown' && isPreviewingMarkdown ? (
                <div className="post-markdown-preview">
                    {value.trim()
                        ? <PostContentRenderer content={value} format="markdown" />
                        : <span className="post-markdown-preview-empty">Nothing to preview yet.</span>}
                </div>
            ) : (
                <textarea
                    ref={textareaRef}
                    placeholder={placeholder}
                    value={value}
                    onChange={event => onChange(event.target.value)}
                    onSelect={rememberSelection}
                    onKeyDown={handleKeyDown}
                    rows={activeFormat === 'markdown' ? Math.max(rows, 8) : rows}
                    disabled={disabled}
                    className="glass-input post-text-input"
                />
            )}
            {isLinkPopoverOpen && (
                <div className="post-link-popover">
                    <label>
                        Link
                        <input
                            autoFocus
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
                        <button type="button" onClick={closeLinkPopover}>Cancel</button>
                        <button type="button" onClick={insertLink}>Insert</button>
                    </div>
                </div>
            )}
        </div>
    );
}
