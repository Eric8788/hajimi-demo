import type { Comment, Post, PublicAvatar, User } from '@/lib/db';
import { cachedJson } from './clientJsonCache';

type AvatarTarget = {
    id: number;
    avatar?: string | null;
    avatar_emoji?: string | null;
    avatar_theme?: string | null;
};

function uniquePositiveIds(ids: Array<number | null | undefined>) {
    return Array.from(new Set(ids.map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0))).sort((a, b) => a - b);
}

export async function loadAvatarPatches(ids: Array<number | null | undefined>, signal?: AbortSignal) {
    const uniqueIds = uniquePositiveIds(ids);
    if (uniqueIds.length === 0) return new Map<number, PublicAvatar>();

    const data = await cachedJson<PublicAvatar[]>(
        `avatars:${uniqueIds.join(',')}`,
        `/api/avatars?ids=${uniqueIds.join(',')}`,
        120_000,
        { signal },
    );

    return new Map(data.map(avatar => [Number(avatar.id), avatar]));
}

export function applyAvatarPatch<T extends AvatarTarget>(item: T, patches: Map<number, PublicAvatar>): T {
    const patch = patches.get(Number(item.id));
    if (!patch) return item;

    return {
        ...item,
        avatar: patch.avatar ?? item.avatar,
        avatar_emoji: patch.avatar_emoji ?? item.avatar_emoji,
        avatar_theme: patch.avatar_theme ?? item.avatar_theme,
    };
}

export function applyAuthorAvatarPatch<T extends Comment>(item: T, patches: Map<number, PublicAvatar>): T {
    const patch = patches.get(Number(item.author_id));
    if (!patch) return item;

    return {
        ...item,
        author_avatar: patch.avatar ?? item.author_avatar,
        author_avatar_emoji: patch.avatar_emoji ?? item.author_avatar_emoji,
        author_avatar_theme: patch.avatar_theme ?? item.author_avatar_theme,
    };
}

export function applyPostAvatarPatch(post: Post, patches: Map<number, PublicAvatar>): Post {
    const authorPatch = patches.get(Number(post.author_id));
    const recentComments = (post.recent_comments || []).map(comment => applyAuthorAvatarPatch(comment, patches));
    const recentLikers = (post.recent_likers || []).map(liker => applyAvatarPatch(liker, patches));

    return {
        ...post,
        author_avatar: authorPatch?.avatar ?? post.author_avatar,
        author_avatar_emoji: authorPatch?.avatar_emoji ?? post.author_avatar_emoji,
        author_avatar_theme: authorPatch?.avatar_theme ?? post.author_avatar_theme,
        recent_comments: recentComments,
        recent_likers: recentLikers,
    };
}

export function collectPostAvatarIds(posts: Post[], viewer?: User | null) {
    return [
        viewer?.id,
        ...posts.map(post => post.author_id),
        ...posts.flatMap(post => (post.recent_comments || []).map(comment => comment.author_id)),
        ...posts.flatMap(post => (post.recent_likers || []).map(liker => liker.id)),
    ];
}
