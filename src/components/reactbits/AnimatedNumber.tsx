'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import Counter, { type CounterPlace } from './Counter';

type AnimatedNumberProps = {
    value: number | string | null | undefined;
    className?: string;
    duration?: number;
    format?: (value: number) => string;
};

const getNumericValue = (value: AnimatedNumberProps['value']) => {
    const numericValue = Number(value || 0);
    return Number.isFinite(numericValue) ? numericValue : 0;
};

function getCounterPlaces(formattedValue: string): CounterPlace[] {
    const digits = formattedValue.replace(/\D/g, '');
    let digitIndex = 0;

    return Array.from(formattedValue).map(character => {
        if (!/\d/.test(character)) {
            return character;
        }

        const place = 10 ** (digits.length - digitIndex - 1);
        digitIndex += 1;
        return place;
    });
}

export default function AnimatedNumber({
    value,
    className = '',
    duration: _duration = 2500,
    format,
}: AnimatedNumberProps) {
    const targetValue = getNumericValue(value);
    const roundedValue = Math.round(targetValue);
    const reducedMotion = useReducedMotion();
    const measureRef = useRef<HTMLSpanElement>(null);
    const [fontSize, setFontSize] = useState(16);

    const numberFormatter = useMemo(
        () => new Intl.NumberFormat('zh-CN'),
        [],
    );

    useEffect(() => {
        const element = measureRef.current;
        if (!element || typeof window === 'undefined') return;

        const updateFontSize = () => {
            const nextFontSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
            if (Number.isFinite(nextFontSize) && nextFontSize > 0) {
                setFontSize(nextFontSize);
            }
        };

        updateFontSize();

        if (typeof ResizeObserver === 'undefined') return;
        const resizeObserver = new ResizeObserver(updateFontSize);
        resizeObserver.observe(element);

        return () => resizeObserver.disconnect();
    }, []);

    const formattedTarget = format
        ? format(targetValue)
        : numberFormatter.format(roundedValue);
    const places = useMemo(() => getCounterPlaces(formattedTarget), [formattedTarget]);

    return (
        <span
            ref={measureRef}
            className={`animated-number${className ? ` ${className}` : ''}`}
            aria-label={formattedTarget}
        >
            {format || reducedMotion ? (
                formattedTarget
            ) : (
                <Counter
                    value={roundedValue}
                    places={places}
                    fontSize={fontSize}
                    padding={Math.max(2, Math.round(fontSize * 0.08))}
                    gap={Math.max(1, Math.round(fontSize * 0.02))}
                    horizontalPadding={0}
                    textColor="inherit"
                    fontWeight="inherit"
                    gradientHeight={0}
                    counterStyle={{ lineHeight: 1 }}
                    digitStyle={{ lineHeight: 1 }}
                />
            )}
        </span>
    );
}
