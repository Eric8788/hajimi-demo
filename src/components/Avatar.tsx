/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from 'react';
import { getAvatarTheme, isAvatarThemeId } from '@/lib/avatarThemes';

type AvatarProps = {
    value?: string | null;
    fallback?: string;
    size?: number;
    className?: string;
    style?: CSSProperties;
    emoji?: string | null;
    theme?: string | null;
    seed?: string | number | null;
};

function isImageAvatar(value?: string | null) {
    if (!value) return false;
    return value.startsWith('data:image/') || value.startsWith('http://') || value.startsWith('https://');
}

export default function Avatar({ value, fallback = '👤', size = 40, className, style, emoji, theme, seed }: AvatarProps) {
    const displayValue = value || emoji || fallback;
    const themeInfo = getAvatarTheme(isAvatarThemeId(theme) ? theme : null, seed ?? displayValue);
    const baseStyle: CSSProperties = {
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        maxWidth: size,
        maxHeight: size,
        aspectRatio: '1 / 1',
        borderRadius: '50%',
        flexShrink: 0,
        overflow: 'hidden',
        background: style?.background || themeInfo.background,
        color: style?.color || themeInfo.color,
        ...style,
    };

    if (isImageAvatar(displayValue)) {
        return (
            <img
                src={displayValue}
                alt="User avatar"
                className={className}
                style={{
                    ...baseStyle,
                    objectFit: 'cover',
                    display: 'block',
                }}
            />
        );
    }

    return (
        <span
            className={className}
            style={{
                ...baseStyle,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {displayValue}
        </span>
    );
}
