'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownMessage({ content }: { content: string }) {
    return (
        <div className="domi-markdown">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ node, ...props }) => { void node; return <a {...props} target="_blank" rel="noreferrer" />; },
                    table: ({ node, ...props }) => { void node; return <div className="domi-markdown-table"><table {...props} /></div>; },
                    pre: ({ node, ...props }) => { void node; return <pre className="domi-markdown-code" {...props} />; },
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
