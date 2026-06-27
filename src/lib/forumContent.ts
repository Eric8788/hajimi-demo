export type PostContentFormat = 'plain' | 'markdown';

export function normalizePostContentFormat(value: unknown): PostContentFormat {
    return value === 'markdown' ? 'markdown' : 'plain';
}
