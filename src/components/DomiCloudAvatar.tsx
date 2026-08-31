'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DomiPetVisualState } from '@/lib/agent/visualTypes';

type IdleMood = 'calm' | 'curious' | 'happy' | 'focused' | 'sleepy';
type HoverMood = 'surprised' | 'angry';

function randomDelay(min: number, max: number) {
    return Math.round(min + Math.random() * (max - min));
}

export default function DomiCloudAvatar({
    state = 'idle',
    size = 88,
    hovered = false,
    hoverMood = 'surprised',
    label = 'Domi',
}: {
    state?: DomiPetVisualState;
    size?: number;
    hovered?: boolean;
    hoverMood?: HoverMood;
    label?: string;
}) {
    const [idleMood, setIdleMood] = useState<IdleMood>('calm');
    const [blink, setBlink] = useState(false);
    const reducedMotionRef = useRef(false);
    const gazeRef = useRef({ x: 0, y: 0 });
    const eyesRef = useRef<SVGGElement | null>(null);

    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => { reducedMotionRef.current = media.matches; };
        update();
        media.addEventListener?.('change', update);
        return () => media.removeEventListener?.('change', update);
    }, []);

    useEffect(() => {
        let timeoutId: number | undefined;
        const schedule = () => {
            if (document.visibilityState !== 'visible') return;
            timeoutId = window.setTimeout(() => {
                if (!reducedMotionRef.current && document.visibilityState === 'visible' && state === 'idle' && !hovered) {
                    const moods: IdleMood[] = ['calm', 'curious', 'happy', 'focused', 'sleepy'];
                    setIdleMood(current => moods[(moods.indexOf(current) + 1 + Math.floor(Math.random() * (moods.length - 1))) % moods.length]);
                }
                schedule();
            }, randomDelay(2500, 5000));
        };
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden' && timeoutId) {
                window.clearTimeout(timeoutId);
                timeoutId = undefined;
            } else if (document.visibilityState === 'visible' && !timeoutId) {
                schedule();
            }
        };
        schedule();
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            if (timeoutId) window.clearTimeout(timeoutId);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [hovered, state]);

    useEffect(() => {
        let timeoutId: number | undefined;
        let active = true;
        const schedule = () => {
            if (!active || document.visibilityState !== 'visible') return;
            timeoutId = window.setTimeout(() => {
                if (active && document.visibilityState === 'visible' && !reducedMotionRef.current) {
                    setBlink(true);
                    window.setTimeout(() => { if (active) setBlink(false); }, 140);
                }
                schedule();
            }, randomDelay(3400, 7600));
        };
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden' && timeoutId) {
                window.clearTimeout(timeoutId);
                timeoutId = undefined;
            } else if (document.visibilityState === 'visible' && !timeoutId) {
                schedule();
            }
        };
        schedule();
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            active = false;
            if (timeoutId) window.clearTimeout(timeoutId);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    useEffect(() => {
        if (window.matchMedia('(pointer: coarse)').matches) return;
        let frame = 0;
        let latest = { x: 0, y: 0 };
        const handlePointerMove = (event: PointerEvent) => {
            latest = { x: event.clientX, y: event.clientY };
            if (frame) return;
            frame = window.requestAnimationFrame(() => {
                frame = 0;
                const dx = Math.max(-1, Math.min(1, (latest.x - window.innerWidth / 2) / Math.max(1, window.innerWidth / 2)));
                const dy = Math.max(-1, Math.min(1, (latest.y - window.innerHeight / 2) / Math.max(1, window.innerHeight / 2)));
                gazeRef.current = { x: dx, y: dy };
                eyesRef.current?.setAttribute('transform', `translate(${Math.round(dx * 3.5)} ${Math.round(dy * 1.5)})`);
            });
        };
        window.addEventListener('pointermove', handlePointerMove, { passive: true });
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            if (frame) window.cancelAnimationFrame(frame);
        };
    }, []);

    useEffect(() => {
        const { x, y } = gazeRef.current;
        eyesRef.current?.setAttribute('transform', `translate(${Math.round(x * 3.5)} ${Math.round(y * 1.5)})`);
    }, [state, idleMood, hoverMood, blink]);

    const mood = useMemo(() => {
        if (hovered) return hoverMood;
        if (state === 'viewing') return 'curious';
        if (state === 'thinking' || state === 'organizing') return 'focused';
        if (state === 'success') return 'happy';
        if (state === 'error') return 'confused';
        return idleMood;
    }, [hovered, hoverMood, idleMood, state]);

    const eyeScale = blink ? 'scale(1 0.08)' : mood === 'surprised' ? 'scale(1.12 1.2)' : mood === 'focused' ? 'scale(0.8 0.92)' : mood === 'sleepy' ? 'scale(1 0.42)' : 'scale(1 1)';
    const cloudClass = `domi-cloud-avatar domi-cloud-avatar--${mood} domi-cloud-avatar--${state}`;

    return (
        <svg
            className={cloudClass}
            width={size}
            height={size * 0.83}
            viewBox="0 0 160 132"
            role="img"
            aria-label={label}
            data-visual-state={state}
        >
            <defs>
                <linearGradient id="domi-cloud-fill" x1="18" y1="18" x2="140" y2="118" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#9d72ff" />
                    <stop offset="1" stopColor="#7346dc" />
                </linearGradient>
                <filter id="domi-cloud-shadow" x="-20%" y="-20%" width="140%" height="150%">
                    <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#6c49cf" floodOpacity="0.2" />
                </filter>
            </defs>
            <path
                d="M43 105C26 103 16 91 16 75c0-15 9-27 24-31C42 23 55 10 72 10c10 0 20 4 27 12 6-7 14-11 23-11 18 0 31 14 31 31 0 4-1 8-2 12 8 6 13 16 13 27 0 19-14 33-34 33H43Z"
                fill="url(#domi-cloud-fill)"
                filter="url(#domi-cloud-shadow)"
            />
            <g ref={eyesRef} className="domi-cloud-eyes" transform="translate(0 0)">
                <g transform="translate(0 0)">
                    {mood === 'happy' ? (
                        <>
                            <path d="M52 59c4-7 11-7 15 0" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
                            <path d="M94 59c4-7 11-7 15 0" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
                        </>
                    ) : mood === 'confused' ? (
                        <>
                            <ellipse cx="59" cy="59" rx="6" ry="11" fill="#fff" style={{ transform: eyeScale, transformOrigin: '59px 59px' }} />
                            <ellipse cx="101" cy="59" rx="6" ry="11" fill="#fff" style={{ transform: eyeScale, transformOrigin: '101px 59px' }} />
                            <path d="M50 43c5-4 10-4 15-1M94 42c5-2 10-1 14 2" fill="none" stroke="#6339c9" strokeWidth="3" strokeLinecap="round" />
                        </>
                    ) : mood === 'angry' ? (
                        <>
                            <ellipse cx="59" cy="59" rx="6" ry="12" fill="#fff" style={{ transform: eyeScale, transformOrigin: '59px 59px' }} />
                            <ellipse cx="101" cy="59" rx="6" ry="12" fill="#fff" style={{ transform: eyeScale, transformOrigin: '101px 59px' }} />
                            <path d="M49 45c6 4 11 4 17 0M94 45c5 4 10 4 16 0" fill="none" stroke="#6339c9" strokeWidth="3" strokeLinecap="round" />
                        </>
                    ) : (
                        <>
                            <ellipse cx="59" cy="59" rx="6" ry="12" fill="#fff" style={{ transform: eyeScale, transformOrigin: '59px 59px' }} />
                            <ellipse cx="101" cy="59" rx="6" ry="12" fill="#fff" style={{ transform: eyeScale, transformOrigin: '101px 59px' }} />
                        </>
                    )}
                </g>
            </g>
            {mood === 'surprised' && <circle cx="130" cy="32" r="3" fill="#45d2d8" />}
            {mood === 'happy' && <path d="M75 79c4 6 10 8 16 0" fill="none" stroke="#6339c9" strokeWidth="3" strokeLinecap="round" />}
            {mood === 'focused' && <circle cx="126" cy="30" r="2.5" fill="#45d2d8" />}
        </svg>
    );
}
