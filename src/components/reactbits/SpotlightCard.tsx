'use client';

import React, { useRef } from 'react';
import type { CSSProperties } from 'react';

type SpotlightStyle = CSSProperties & {
    '--spotlight-color'?: string;
};

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
    spotlightColor?: string;
}

export default function SpotlightCard({
    children,
    className = '',
    spotlightColor = 'rgba(255, 255, 255, 0.28)',
    onMouseMove,
    style,
    ...rest
}: SpotlightCardProps) {
    const divRef = useRef<HTMLDivElement>(null);

    const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = event => {
        if (divRef.current) {
            const rect = divRef.current.getBoundingClientRect();
            divRef.current.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
            divRef.current.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
            divRef.current.style.setProperty('--spotlight-color', spotlightColor);
        }

        onMouseMove?.(event);
    };

    return (
        <div
            ref={divRef}
            className={`card-spotlight ${className}`}
            onMouseMove={handleMouseMove}
            style={{ ...style, '--spotlight-color': spotlightColor } as SpotlightStyle}
            {...rest}
        >
            {children}
        </div>
    );
}
