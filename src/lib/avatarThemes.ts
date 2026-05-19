export type AvatarThemeId =
    | 'lavender'
    | 'peach'
    | 'rose'
    | 'sunny'
    | 'mint'
    | 'sky'
    | 'ocean'
    | 'sand'
    | 'berry'
    | 'charcoal';

export type AvatarTheme = {
    background: string;
    color: string;
};

export const AVATAR_THEMES: Record<AvatarThemeId, AvatarTheme> = {
    lavender: {
        background: 'linear-gradient(135deg, #e3d7ff 0%, #bda7ff 100%)',
        color: '#4a2f8a',
    },
    peach: {
        background: 'linear-gradient(135deg, #ffd8b8 0%, #ffb06b 100%)',
        color: '#7d4315',
    },
    rose: {
        background: 'linear-gradient(135deg, #ffd6e7 0%, #ff9fc0 100%)',
        color: '#8f2356',
    },
    sunny: {
        background: 'linear-gradient(135deg, #fff1b8 0%, #ffd76a 100%)',
        color: '#8a5a00',
    },
    mint: {
        background: 'linear-gradient(135deg, #d7f9df 0%, #8ee6b6 100%)',
        color: '#1d5a3a',
    },
    sky: {
        background: 'linear-gradient(135deg, #d6efff 0%, #82c6ff 100%)',
        color: '#16436c',
    },
    ocean: {
        background: 'linear-gradient(135deg, #c8f3ff 0%, #76d9f2 100%)',
        color: '#155569',
    },
    sand: {
        background: 'linear-gradient(135deg, #f8e7c1 0%, #e9c991 100%)',
        color: '#78591d',
    },
    berry: {
        background: 'linear-gradient(135deg, #ffd1dc 0%, #ff8ab4 100%)',
        color: '#7f204b',
    },
    charcoal: {
        background: 'linear-gradient(135deg, #dce1ea 0%, #9aa7bb 100%)',
        color: '#233042',
    },
};

export const AVATAR_THEME_IDS = Object.keys(AVATAR_THEMES) as AvatarThemeId[];

export const AVATAR_EMOJIS = [
    '😊',
    '😎',
    '🤓',
    '🧠',
    '✨',
    '🚀',
    '🌟',
    '🎯',
    '🫶',
    '🎨',
    '📚',
    '🍀',
    '🔥',
    '💡',
    '🪄',
    '🫧',
    '⚡',
    '🌈',
    '💫',
    '🧩',
] as const;

function hashString(value: string) {
    let hash = 0;

    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }

    return Math.abs(hash);
}

export function isAvatarThemeId(value: unknown): value is AvatarThemeId {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(AVATAR_THEMES, value);
}

export function pickRandomAvatarThemeId(): AvatarThemeId {
    return AVATAR_THEME_IDS[Math.floor(Math.random() * AVATAR_THEME_IDS.length)];
}

export function pickRandomAvatarEmoji() {
    return AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
}

export function normalizeAvatarEmoji(value?: unknown) {
    const text = String(value ?? '').trim();
    if (!text) return pickRandomAvatarEmoji();
    return Array.from(text).slice(0, 4).join('');
}

export function normalizeAvatarThemeId(value?: unknown) {
    if (isAvatarThemeId(value)) return value;
    return pickRandomAvatarThemeId();
}

export function resolveAvatarThemeId(themeId?: string | null, seed?: string | number | null): AvatarThemeId {
    if (isAvatarThemeId(themeId)) {
        return themeId;
    }

    const seedText = seed == null ? '' : String(seed).trim();
    if (!seedText) {
        return 'lavender';
    }

    return AVATAR_THEME_IDS[hashString(seedText) % AVATAR_THEME_IDS.length];
}

export function getAvatarTheme(themeId?: string | null, seed?: string | number | null) {
    const resolvedThemeId = resolveAvatarThemeId(themeId, seed);
    return {
        id: resolvedThemeId,
        ...AVATAR_THEMES[resolvedThemeId],
    };
}

export function createRandomAvatarSelection(seed?: string | number | null) {
    return {
        emoji: pickRandomAvatarEmoji(),
        theme: pickRandomAvatarThemeId(),
    };
}
