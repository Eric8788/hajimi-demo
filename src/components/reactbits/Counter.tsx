'use client';

import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect, type CSSProperties } from 'react';

export type CounterPlace = number | string;

type CounterProps = {
    value: number;
    fontSize?: number;
    padding?: number;
    places?: CounterPlace[];
    gap?: number;
    borderRadius?: number;
    horizontalPadding?: number;
    textColor?: string;
    fontWeight?: CSSProperties['fontWeight'];
    containerStyle?: CSSProperties;
    counterStyle?: CSSProperties;
    digitStyle?: CSSProperties;
    gradientHeight?: number;
    gradientFrom?: string;
    gradientTo?: string;
    topGradientStyle?: CSSProperties;
    bottomGradientStyle?: CSSProperties;
    animateOnMount?: boolean;
};

const DEFAULT_PLACES: CounterPlace[] = [100, 10, 1];
const SPRING_CONFIG = {
    stiffness: 30,
    damping: 18,
    mass: 1.35,
    restDelta: 0.001,
};

function NumberColumn({ mv, number, height }: { mv: ReturnType<typeof useSpring>; number: number; height: number }) {
    const y = useTransform(mv, latest => {
        const placeValue = latest % 10;
        let offset = (10 + number - placeValue) % 10;
        let memo = offset * height;

        if (offset > 5) {
            memo -= 10 * height;
        }

        return memo;
    });

    return (
        <motion.span className="counter-number" style={{ y }}>
            {number}
        </motion.span>
    );
}

function normalizeNearInteger(num: number) {
    const nearest = Math.round(num);
    const tolerance = 1e-9 * Math.max(1, Math.abs(num));
    return Math.abs(num - nearest) < tolerance ? nearest : num;
}

function getValueRoundedToPlace(value: number, place: number) {
    const scaled = Math.abs(value) / place;
    return Math.floor(normalizeNearInteger(scaled));
}

function Digit({
    place,
    value,
    height,
    digitStyle,
    animateOnMount,
}: {
    place: CounterPlace;
    value: number;
    height: number;
    digitStyle?: CSSProperties;
    animateOnMount: boolean;
}) {
    const isDigit = typeof place === 'number';
    const valueRoundedToPlace = isDigit ? getValueRoundedToPlace(value, place) : 0;
    const animatedValue = useSpring(animateOnMount && isDigit ? 0 : valueRoundedToPlace, SPRING_CONFIG);

    useEffect(() => {
        if (isDigit) {
            animatedValue.set(valueRoundedToPlace);
        }
    }, [animatedValue, isDigit, valueRoundedToPlace]);

    if (!isDigit) {
        return (
            <span className="counter-digit is-separator" style={{ height, ...digitStyle, width: 'fit-content' }}>
                {place}
            </span>
        );
    }

    return (
        <span className="counter-digit" style={{ height, ...digitStyle }}>
            {Array.from({ length: 10 }, (_, i) => (
                <NumberColumn key={i} mv={animatedValue} number={i} height={height} />
            ))}
        </span>
    );
}

export default function Counter({
    value,
    fontSize = 100,
    padding = 0,
    places = DEFAULT_PLACES,
    gap = 8,
    borderRadius = 4,
    horizontalPadding = 8,
    textColor = 'inherit',
    fontWeight = 'inherit',
    containerStyle,
    counterStyle,
    digitStyle,
    gradientHeight = 16,
    gradientFrom = 'black',
    gradientTo = 'transparent',
    topGradientStyle,
    bottomGradientStyle,
    animateOnMount = true,
}: CounterProps) {
    const height = fontSize + padding;
    const defaultCounterStyle: CSSProperties = {
        fontSize,
        gap,
        borderRadius,
        paddingLeft: horizontalPadding,
        paddingRight: horizontalPadding,
        color: textColor,
        fontWeight,
        direction: 'ltr',
    };
    const defaultTopGradientStyle: CSSProperties = {
        height: gradientHeight,
        background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`,
    };
    const defaultBottomGradientStyle: CSSProperties = {
        height: gradientHeight,
        background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`,
    };

    return (
        <span className="counter-container" style={containerStyle}>
            <span className="counter-counter" style={{ ...defaultCounterStyle, ...counterStyle }}>
                {places.map((place, index) => (
                    <Digit
                        key={`${place}-${index}`}
                        place={place}
                        value={value}
                        height={height}
                        digitStyle={digitStyle}
                        animateOnMount={animateOnMount}
                    />
                ))}
            </span>
            {gradientHeight > 0 && (
                <span className="gradient-container" aria-hidden="true">
                    <span className="top-gradient" style={topGradientStyle || defaultTopGradientStyle} />
                    <span className="bottom-gradient" style={bottomGradientStyle || defaultBottomGradientStyle} />
                </span>
            )}
        </span>
    );
}
