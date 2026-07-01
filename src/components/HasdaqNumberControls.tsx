'use client';

import { useMemo, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import Counter, { type CounterPlace } from './reactbits/Counter';

type HasdaqRollingNumberProps = {
    value: number | string | null | undefined;
    decimals?: number;
    className?: string;
    fontSize?: number;
};

type HasdaqShareStepperProps = {
    value: string;
    label: string;
    min?: number;
    max?: number;
    disabled?: boolean;
    helper?: ReactNode;
    onChange: (nextValue: string) => void;
};

function getNumericValue(value: HasdaqRollingNumberProps['value']) {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric : 0;
}

function getCounterPlaces(formattedValue: string): CounterPlace[] {
    const digits = formattedValue.replace(/\D/g, '');
    let digitIndex = 0;

    return Array.from(formattedValue).map(character => {
        if (!/\d/.test(character)) return character;
        const place = 10 ** (digits.length - digitIndex - 1);
        digitIndex += 1;
        return place;
    });
}

function formatRollingValue(value: number, decimals = 0) {
    return new Intl.NumberFormat('zh-CN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function HasdaqRollingNumber({
    value,
    decimals = 0,
    className = '',
    fontSize = 16,
}: HasdaqRollingNumberProps) {
    const reducedMotion = useReducedMotion();
    const numericValue = getNumericValue(value);
    const formattedValue = useMemo(() => formatRollingValue(numericValue, decimals), [numericValue, decimals]);
    const digitValue = Number(formattedValue.replace(/\D/g, '') || 0);
    const places = useMemo(() => getCounterPlaces(formattedValue), [formattedValue]);

    return (
        <span className={`hasdaq-rolling-number${className ? ` ${className}` : ''}`} aria-label={formattedValue}>
            {reducedMotion ? formattedValue : (
                <Counter
                    value={digitValue}
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

export function HasdaqShareStepper({
    value,
    label,
    min = 1,
    max = 99,
    disabled = false,
    helper,
    onChange,
}: HasdaqShareStepperProps) {
    const parsedValue = Math.max(0, Math.floor(Number(value || 0)));
    const safeMax = Math.max(0, Math.floor(Number(max || 0)));
    const hasRange = safeMax >= min;
    const displayedValue = hasRange ? clamp(parsedValue || min, min, safeMax) : 0;
    const canAdjust = !disabled && hasRange;

    const setNextValue = (nextValue: number) => {
        if (!hasRange) return;
        onChange(String(clamp(Math.floor(nextValue), min, safeMax)));
    };

    const adjust = (delta: number) => {
        setNextValue((displayedValue || min) + delta);
    };

    return (
        <div className={`hasdaq-share-stepper${disabled ? ' is-disabled' : ''}${!hasRange ? ' is-empty' : ''}`}>
            <div className="hasdaq-share-stepper-value">
                <span>{label}</span>
                <strong>
                    <HasdaqRollingNumber value={displayedValue} fontSize={64} />
                    <small>股</small>
                </strong>
                {helper && <p>{helper}</p>}
            </div>
            <div className="hasdaq-share-stepper-controls" aria-label={`${label}调整`}>
                <button type="button" onClick={() => adjust(1)} disabled={!canAdjust || displayedValue >= safeMax} aria-label="增加 1 股">▲</button>
                <button type="button" onClick={() => adjust(-1)} disabled={!canAdjust || displayedValue <= min} aria-label="减少 1 股">▼</button>
            </div>
            <div className="hasdaq-share-stepper-quick" aria-label={`${label}快捷调整`}>
                {[-5, -1, 1, 5].map(delta => (
                    <button
                        key={delta}
                        type="button"
                        onClick={() => adjust(delta)}
                        disabled={!canAdjust || (delta < 0 && displayedValue <= min) || (delta > 0 && displayedValue >= safeMax)}
                    >
                        {delta > 0 ? `+${delta}` : delta}
                    </button>
                ))}
            </div>
        </div>
    );
}
