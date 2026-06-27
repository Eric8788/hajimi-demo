'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type AnimatedNumberProps = {
    value: number | string | null | undefined;
    className?: string;
    duration?: number;
    format?: (value: number) => string;
};

const inertiaEase = (t: number) => {
    if (t >= 1) return 1;
    return 1 - Math.pow(1 - t, 4.4);
};

const getNumericValue = (value: AnimatedNumberProps['value']) => {
    const numericValue = Number(value || 0);
    return Number.isFinite(numericValue) ? numericValue : 0;
};

const prefersReducedMotion = () => (
    typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
);

export default function AnimatedNumber({
    value,
    className = '',
    duration = 2500,
    format,
}: AnimatedNumberProps) {
    const targetValue = getNumericValue(value);
    const [displayValue, setDisplayValue] = useState(0);
    const currentValueRef = useRef(0);

    const numberFormatter = useMemo(
        () => new Intl.NumberFormat('zh-CN'),
        [],
    );

    useEffect(() => {
        if (prefersReducedMotion() || duration <= 0) {
            currentValueRef.current = targetValue;
            setDisplayValue(targetValue);
            return;
        }

        const startValue = currentValueRef.current;
        const startedAt = performance.now();
        let animationFrame = 0;

        const tick = (now: number) => {
            const progress = Math.min((now - startedAt) / duration, 1);
            const easedProgress = inertiaEase(progress);
            const nextValue = startValue + ((targetValue - startValue) * easedProgress);

            currentValueRef.current = nextValue;
            setDisplayValue(nextValue);

            if (progress < 1) {
                animationFrame = window.requestAnimationFrame(tick);
                return;
            }

            currentValueRef.current = targetValue;
            setDisplayValue(targetValue);
        };

        animationFrame = window.requestAnimationFrame(tick);

        return () => {
            window.cancelAnimationFrame(animationFrame);
        };
    }, [duration, targetValue]);

    const formattedValue = format
        ? format(displayValue)
        : numberFormatter.format(Math.round(displayValue));
    const formattedTarget = format
        ? format(targetValue)
        : numberFormatter.format(Math.round(targetValue));

    return (
        <span className={`animated-number${className ? ` ${className}` : ''}`} aria-label={formattedTarget}>
            {formattedValue}
        </span>
    );
}
