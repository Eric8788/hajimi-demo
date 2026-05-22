'use client';

import { useRef, useState, type KeyboardEvent } from 'react';

type TextSelection = {
    start: number;
    end: number;
};

type PostTextComposerProps = {
    value: string;
    onChange: (value: string) => void;
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
        .slice(0, 120) || '链接文字';
}

export default function PostTextComposer({
    value,
    onChange,
    placeholder = '分享一下近况、问题或资源...',
    rows = 5,
    disabled = false,
}: PostTextComposerProps) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
    const [linkValue, setLinkValue] = useState('');
    const [linkError, setLinkError] = useState('');
    const [savedSelection, setSavedSelection] = useState<TextSelection>({ start: 0, end: 0 });

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

    const insertLink = () => {
        const href = normalizeLinkInput(linkValue);
        if (!href) {
            setLinkError('请输入域名或 http(s) 链接');
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
                <button
                    type="button"
                    className="post-text-tool"
                    onMouseDown={event => event.preventDefault()}
                    onClick={openLinkPopover}
                    disabled={disabled}
                    title="插入链接"
                    aria-label="插入链接"
                >
                    🔗
                </button>
                <span>选中文字后插入链接，域名即可</span>
            </div>
            <textarea
                ref={textareaRef}
                placeholder={placeholder}
                value={value}
                onChange={event => onChange(event.target.value)}
                onSelect={rememberSelection}
                onKeyDown={handleKeyDown}
                rows={rows}
                disabled={disabled}
                className="glass-input post-text-input"
            />
            {isLinkPopoverOpen && (
                <div className="post-link-popover">
                    <label>
                        链接
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
                            placeholder="www.baidu.com"
                        />
                    </label>
                    {linkError && <div className="post-link-error">{linkError}</div>}
                    <div className="post-link-actions">
                        <button type="button" onClick={closeLinkPopover}>取消</button>
                        <button type="button" onClick={insertLink}>确定</button>
                    </div>
                </div>
            )}
        </div>
    );
}
