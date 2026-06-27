'use client';

import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';

function cn(...classes: Array<string | undefined | null | false>) {
    return classes.filter(Boolean).join(' ');
}

type MotionSpanProps = React.ComponentPropsWithoutRef<typeof motion.span>;

type SegmenterConstructor = new (
    locale: string,
    options: { granularity: 'grapheme' }
) => {
    segment(input: string): Iterable<{ segment: string }>;
};

type IntlWithSegmenter = typeof Intl & {
    Segmenter?: SegmenterConstructor;
};

export interface RotatingTextRef {
    next: () => void;
    previous: () => void;
    jumpTo: (index: number) => void;
    reset: () => void;
}

export interface RotatingTextProps
    extends Omit<MotionSpanProps, 'children' | 'transition' | 'initial' | 'animate' | 'exit'> {
    texts: string[];
    transition?: MotionSpanProps['transition'];
    initial?: MotionSpanProps['initial'];
    animate?: MotionSpanProps['animate'];
    exit?: MotionSpanProps['exit'];
    animatePresenceMode?: 'sync' | 'wait' | 'popLayout';
    animatePresenceInitial?: boolean;
    rotationInterval?: number;
    staggerDuration?: number;
    staggerFrom?: 'first' | 'last' | 'center' | 'random' | number;
    loop?: boolean;
    auto?: boolean;
    splitBy?: string;
    onNext?: (index: number) => void;
    mainClassName?: string;
    splitLevelClassName?: string;
    elementLevelClassName?: string;
}

const splitIntoCharacters = (text: string): string[] => {
    const Segmenter = (Intl as IntlWithSegmenter).Segmenter;

    if (Segmenter) {
        const segmenter = new Segmenter('en', { granularity: 'grapheme' });
        return Array.from(segmenter.segment(text), segment => segment.segment);
    }

    return Array.from(text);
};

const RotatingText = forwardRef<RotatingTextRef, RotatingTextProps>((props, ref) => {
    const {
        texts,
        transition = { type: 'spring', damping: 26, stiffness: 360 },
        initial = { y: '105%', opacity: 0 },
        animate = { y: 0, opacity: 1 },
        exit = { y: '-120%', opacity: 0 },
        animatePresenceMode = 'wait',
        animatePresenceInitial = false,
        rotationInterval = 2200,
        staggerDuration = 0,
        staggerFrom = 'first',
        loop = true,
        auto = true,
        splitBy = 'characters',
        onNext,
        mainClassName,
        splitLevelClassName,
        elementLevelClassName,
        ...rest
    } = props;

    const safeTexts = texts.length > 0 ? texts : [''];
    const [currentTextIndex, setCurrentTextIndex] = useState(0);

    const elements = useMemo(() => {
        const currentText = safeTexts[currentTextIndex] ?? safeTexts[0] ?? '';

        if (splitBy === 'characters') {
            const words = currentText.split(' ');
            return words.map((word, index) => ({
                characters: splitIntoCharacters(word),
                needsSpace: index !== words.length - 1,
            }));
        }

        if (splitBy === 'words') {
            return currentText.split(' ').map((word, index, array) => ({
                characters: [word],
                needsSpace: index !== array.length - 1,
            }));
        }

        if (splitBy === 'lines') {
            return currentText.split('\n').map((line, index, array) => ({
                characters: [line],
                needsSpace: index !== array.length - 1,
            }));
        }

        return currentText.split(splitBy).map((part, index, array) => ({
            characters: [part],
            needsSpace: index !== array.length - 1,
        }));
    }, [safeTexts, currentTextIndex, splitBy]);

    const getStaggerDelay = useCallback(
        (index: number, totalChars: number) => {
            if (staggerFrom === 'first') return index * staggerDuration;
            if (staggerFrom === 'last') return (totalChars - 1 - index) * staggerDuration;
            if (staggerFrom === 'center') {
                const center = Math.floor(totalChars / 2);
                return Math.abs(center - index) * staggerDuration;
            }
            if (staggerFrom === 'random') {
                const randomIndex = Math.floor(Math.random() * totalChars);
                return Math.abs(randomIndex - index) * staggerDuration;
            }
            return Math.abs(staggerFrom - index) * staggerDuration;
        },
        [staggerFrom, staggerDuration]
    );

    const handleIndexChange = useCallback(
        (newIndex: number) => {
            setCurrentTextIndex(newIndex);
            onNext?.(newIndex);
        },
        [onNext]
    );

    const next = useCallback(() => {
        if (safeTexts.length <= 1) return;

        const nextIndex =
            currentTextIndex === safeTexts.length - 1
                ? loop
                    ? 0
                    : currentTextIndex
                : currentTextIndex + 1;

        if (nextIndex !== currentTextIndex) {
            handleIndexChange(nextIndex);
        }
    }, [currentTextIndex, safeTexts.length, loop, handleIndexChange]);

    const previous = useCallback(() => {
        if (safeTexts.length <= 1) return;

        const previousIndex =
            currentTextIndex === 0
                ? loop
                    ? safeTexts.length - 1
                    : currentTextIndex
                : currentTextIndex - 1;

        if (previousIndex !== currentTextIndex) {
            handleIndexChange(previousIndex);
        }
    }, [currentTextIndex, safeTexts.length, loop, handleIndexChange]);

    const jumpTo = useCallback(
        (index: number) => {
            const validIndex = Math.max(0, Math.min(index, safeTexts.length - 1));
            if (validIndex !== currentTextIndex) {
                handleIndexChange(validIndex);
            }
        },
        [safeTexts.length, currentTextIndex, handleIndexChange]
    );

    const reset = useCallback(() => {
        if (currentTextIndex !== 0) {
            handleIndexChange(0);
        }
    }, [currentTextIndex, handleIndexChange]);

    useImperativeHandle(ref, () => ({ next, previous, jumpTo, reset }), [next, previous, jumpTo, reset]);

    useEffect(() => {
        if (!auto || safeTexts.length <= 1) return undefined;

        const intervalId = window.setInterval(next, rotationInterval);
        return () => window.clearInterval(intervalId);
    }, [next, rotationInterval, auto, safeTexts.length]);

    const currentText = safeTexts[currentTextIndex] ?? safeTexts[0] ?? '';

    return (
        <motion.span className={cn('text-rotate', mainClassName)} {...rest} layout transition={transition}>
            <span className="text-rotate-sr-only">{currentText}</span>
            <AnimatePresence mode={animatePresenceMode} initial={animatePresenceInitial}>
                <motion.span
                    key={currentTextIndex}
                    className={cn(splitBy === 'lines' ? 'text-rotate-lines' : 'text-rotate')}
                    layout
                    aria-hidden="true"
                >
                    {elements.map((wordObj, wordIndex, array) => {
                        const previousCharsCount = array
                            .slice(0, wordIndex)
                            .reduce((sum, word) => sum + word.characters.length, 0);
                        const totalChars = array.reduce((sum, word) => sum + word.characters.length, 0);

                        return (
                            <span key={wordIndex} className={cn('text-rotate-word', splitLevelClassName)}>
                                {wordObj.characters.map((char, charIndex) => (
                                    <motion.span
                                        key={`${char}-${charIndex}`}
                                        initial={initial}
                                        animate={animate}
                                        exit={exit}
                                        transition={{
                                            ...transition,
                                            delay: getStaggerDelay(previousCharsCount + charIndex, totalChars),
                                        }}
                                        className={cn('text-rotate-element', elementLevelClassName)}
                                    >
                                        {char}
                                    </motion.span>
                                ))}
                                {wordObj.needsSpace && <span className="text-rotate-space"> </span>}
                            </span>
                        );
                    })}
                </motion.span>
            </AnimatePresence>
        </motion.span>
    );
});

RotatingText.displayName = 'RotatingText';

export default RotatingText;
