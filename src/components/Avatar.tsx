/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from 'react';

type AvatarProps = {
    value?: string | null;
    fallback?: string;
    size?: number;
    className?: string;
    style?: CSSProperties;
};

function isImageAvatar(value?: string | null) {
    if (!value) return false;
    return value.startsWith('data:image/') || value.startsWith('http://') || value.startsWith('https://');
}

export default function Avatar({ value, fallback = '👤', size = 40, className, style }: AvatarProps) {
    const displayValue = value || fallback;
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
