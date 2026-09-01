'use client';

import { Component, useEffect, useId, useRef, useState, type CSSProperties, type ErrorInfo, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { NOTIF_BLUE } from '@/lib/bloub/decor';
import { BotEngine, type BotFrame, type Look } from '@/lib/bloub/engine';
import { EXPRESSION_BY_ID, type ExpressionId } from '@/lib/bloub/expressions';
import { clamp } from '@/lib/bloub/math';
import { mixHex, SHAPE_BY_ID } from '@/lib/bloub/skins';
import { DEMI_VIEWBOX, RAYON } from '@/lib/bloub/repere';
import type { StateId } from '@/lib/bloub/states';
import type { DomiPetVisualState } from '@/lib/agent/visualTypes';

// Adapted from https://github.com/jeremy-prt/bloub; see src/lib/bloub/LICENSE.bloub.txt.
type AvatarProps = {
    visualState: DomiPetVisualState;
    size?: number;
    ariaLabel?: string;
    className?: string;
    style?: CSSProperties;
    fallback?: ReactNode;
};

const PRESETS: Record<DomiPetVisualState, { state: StateId; expression: ExpressionId }> = {
    idle: { state: 'idle', expression: 'neutre' },
    viewing: { state: 'idle', expression: 'curieux' },
    thinking: { state: 'thinking', expression: 'attentif' },
    organizing: { state: 'thinking', expression: 'confus' },
    success: { state: 'notify', expression: 'heureux' },
    error: { state: 'alert', expression: 'triste' },
};

const CLOUD_RADIUSES = SHAPE_BY_ID.get('nuage')?.radii ?? null;
const BODY_COLOR = '#8b5cf6';
const PAPER_COLOR = '#ffffff';
const POINTER_YAW_MAX = 30;
const POINTER_PITCH_MAX = 22;
const IDLE_EXPRESSIONS: readonly ExpressionId[] = [
    'neutre', 'heureux', 'curieux', 'attentif', 'somnolent', 'fier', 'surpris', 'excite', 'hilare', 'timide',
];
const HOVER_EXPRESSIONS: readonly ExpressionId[] = ['surpris', 'colere'];
const IDLE_MOOD_FIRST_MIN_MS = 1800;
const IDLE_MOOD_FIRST_MAX_MS = 3600;
const IDLE_MOOD_NEXT_MIN_MS = 2400;
const IDLE_MOOD_NEXT_MAX_MS = 5200;

function randomBetween(min: number, max: number) {
    return min + Math.random() * (max - min);
}

function chooseExpression(expressions: readonly ExpressionId[], current?: ExpressionId) {
    const available = current ? expressions.filter(expression => expression !== current) : expressions;
    return available[Math.floor(Math.random() * available.length)] ?? expressions[0] ?? 'neutre';
}

function pointerLook(
    svg: SVGSVGElement,
    pointer: { x: number; y: number },
    keepExpressionTilt: boolean,
): { look: Look; key: string } | null {
    const box = svg.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    const nx = clamp((pointer.x - (box.left + box.width / 2)) / Math.max(1, window.innerWidth / 2), -1, 1);
    const ny = clamp((pointer.y - (box.top + box.height / 2)) / Math.max(1, window.innerHeight / 2), -1, 1);
    return {
        look: {
            yaw: nx * POINTER_YAW_MAX,
            pitch: -ny * POINTER_PITCH_MAX,
            mix: 1,
            spin: 0,
            wander: 0,
            upright: keepExpressionTilt ? 0 : 1,
        },
        key: `${Math.round(nx * 100)}:${Math.round(ny * 100)}:${keepExpressionTilt ? 'expression' : 'upright'}`,
    };
}

function dotAttributes(dot: BotFrame['dots'][number]) {
    const fill = dot.color ?? (dot.depth === undefined ? BODY_COLOR : mixHex(PAPER_COLOR, BODY_COLOR, dot.depth));
    const common = { fill, opacity: dot.opacity };
    if (dot.d) {
        return { ...common, d: dot.d, transform: `translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${RAYON})` };
    }
    return { ...common, cx: dot.x, cy: dot.y, r: dot.r };
}

function BloubAvatarSvg({ visualState, size = 92, ariaLabel = 'Domi', className, style }: Omit<AvatarProps, 'fallback'>) {
    const [engine] = useState(() => {
        const preset = PRESETS[visualState];
        return new BotEngine(RAYON, preset.state, CLOUD_RADIUSES, EXPRESSION_BY_ID.get(preset.expression) ?? null);
    });
    const [frame, setFrame] = useState<BotFrame>(() => engine.sample(0));
    const [reducedMotion, setReducedMotion] = useState(false);
    const clockRef = useRef(0);
    const svgRef = useRef<SVGSVGElement>(null);
    const pointerRef = useRef<{ x: number; y: number } | null>(null);
    const lookKeyRef = useRef('none');
    const moodTimerRef = useRef<number | null>(null);
    const moodExpressionRef = useRef<ExpressionId>('neutre');
    const hoveredRef = useRef(false);
    const hoverExpressionRef = useRef<ExpressionId | null>(null);
    const id = useId().replace(/:/g, '');
    const maskId = `domi-bloub-mask-${id}`;

    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setReducedMotion(query.matches);
        update();
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        const onPointerMove = (event: PointerEvent) => {
            if (event.pointerType === 'touch') return;
            pointerRef.current = { x: event.clientX, y: event.clientY };
        };
        const onPointerLeave = () => {
            pointerRef.current = null;
        };
        window.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerleave', onPointerLeave);
        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerleave', onPointerLeave);
        };
    }, []);

    useEffect(() => {
        const now = performance.now() / 1000;
        const preset = PRESETS[visualState];
        const activeExpression = visualState === 'idle' && hoveredRef.current
            ? (hoverExpressionRef.current ?? chooseExpression(HOVER_EXPRESSIONS))
            : preset.expression;
        if (visualState === 'idle' && hoveredRef.current) {
            hoverExpressionRef.current = activeExpression;
        } else {
            hoverExpressionRef.current = null;
        }
        engine.setState(preset.state, now);
        engine.setExpression(EXPRESSION_BY_ID.get(activeExpression) ?? null, now);
        engine.setShape(CLOUD_RADIUSES, now);
        moodExpressionRef.current = preset.expression;
        clockRef.current = now;
        const frameId = window.requestAnimationFrame(() => setFrame(engine.sample(now)));
        return () => window.cancelAnimationFrame(frameId);
    }, [engine, visualState]);

    useEffect(() => {
        if (moodTimerRef.current) window.clearTimeout(moodTimerRef.current);
        moodTimerRef.current = null;
        if (visualState !== 'idle' || reducedMotion) return;

        const scheduleMood = () => {
            if (!hoveredRef.current) {
                const current = moodExpressionRef.current;
                const next = chooseExpression(IDLE_EXPRESSIONS, current);
                const now = performance.now() / 1000;
                engine.setExpression(EXPRESSION_BY_ID.get(next) ?? null, now);
                moodExpressionRef.current = next;
                clockRef.current = now;
                setFrame(engine.sample(now));
            }
            moodTimerRef.current = window.setTimeout(scheduleMood, randomBetween(IDLE_MOOD_NEXT_MIN_MS, IDLE_MOOD_NEXT_MAX_MS));
        };

        moodTimerRef.current = window.setTimeout(scheduleMood, randomBetween(IDLE_MOOD_FIRST_MIN_MS, IDLE_MOOD_FIRST_MAX_MS));
        return () => {
            if (moodTimerRef.current) window.clearTimeout(moodTimerRef.current);
            moodTimerRef.current = null;
        };
    }, [engine, reducedMotion, visualState]);

    const handleAvatarPointerEnter = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (event.pointerType === 'touch') return;
        hoveredRef.current = true;
        if (visualState !== 'idle') return;
        const next = chooseExpression(HOVER_EXPRESSIONS, hoverExpressionRef.current ?? undefined);
        hoverExpressionRef.current = next;
        const now = performance.now() / 1000;
        engine.setExpression(EXPRESSION_BY_ID.get(next) ?? null, now);
        clockRef.current = now;
        setFrame(engine.sample(now));
    };

    const handleAvatarPointerLeave = () => {
        hoveredRef.current = false;
        hoverExpressionRef.current = null;
        if (visualState !== 'idle') return;
        const now = performance.now() / 1000;
        engine.setExpression(EXPRESSION_BY_ID.get(moodExpressionRef.current) ?? null, now);
        clockRef.current = now;
        setFrame(engine.sample(now));
    };

    useEffect(() => {
        if (reducedMotion) {
            const frameId = window.requestAnimationFrame(() => setFrame(engine.sample(clockRef.current)));
            return () => window.cancelAnimationFrame(frameId);
        }
        let raf = 0;
        const tick = (timestamp: number) => {
            const now = timestamp / 1000;
            clockRef.current = now;
            const canFollowPointer = visualState === 'idle' || visualState === 'viewing';
            const svg = svgRef.current;
            const pointer = pointerRef.current;
            if (canFollowPointer && !reducedMotion && svg && pointer) {
                const target = pointerLook(svg, pointer, hoveredRef.current);
                if (target && target.key !== lookKeyRef.current) {
                    engine.setLook(target.look, now);
                    lookKeyRef.current = target.key;
                }
            } else if (lookKeyRef.current !== 'none') {
                engine.setLook(null, now);
                lookKeyRef.current = 'none';
            }
            setFrame(engine.sample(now));
            raf = window.requestAnimationFrame(tick);
        };
        raf = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(raf);
    }, [engine, reducedMotion, visualState]);

    return <svg
        ref={svgRef}
        width={size}
        height={size}
        preserveAspectRatio="xMidYMid meet"
        viewBox={`${-DEMI_VIEWBOX} ${-DEMI_VIEWBOX} ${DEMI_VIEWBOX * 2} ${DEMI_VIEWBOX * 2}`}
        role="img"
        aria-label={ariaLabel}
        className={className}
        style={style}
        onPointerEnter={handleAvatarPointerEnter}
        onPointerLeave={handleAvatarPointerLeave}
    >
        <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x={-DEMI_VIEWBOX} y={-DEMI_VIEWBOX} width={DEMI_VIEWBOX * 2} height={DEMI_VIEWBOX * 2}>
                <path d={frame.bodyPath} fill="#fff" />
                {frame.eyes.map((eye, index) => <path key={index} d={eye.d} transform={eye.matrix} opacity={eye.alpha} fill="#000" />)}
                {frame.notch && <circle cx={frame.notch.x} cy={frame.notch.y} r={frame.notch.r} fill="#000" />}
            </mask>
            {frame.arcs.map(arc => <linearGradient key={arc.id} id={`${maskId}-${arc.id}`} gradientUnits="userSpaceOnUse" x1={arc.grad.x1} y1={arc.grad.y1} x2={arc.grad.x2} y2={arc.grad.y2}>
                {arc.grad.stops.map((color, index) => <stop key={index} offset={index / Math.max(1, arc.grad.stops.length - 1)} stopColor={color} />)}
            </linearGradient>)}
        </defs>

        <g fill="none" strokeLinecap="round">
            {frame.arcs.map(arc => <path key={`back-${arc.id}`} d={arc.back} stroke={`url(#${maskId}-${arc.id})`} strokeWidth={arc.width} opacity={arc.opacity} />)}
        </g>
        {frame.dotsBehind && <g>{frame.dots.map((dot, index) => dot.d
            ? <path key={`behind-${index}`} {...dotAttributes(dot)} />
            : <circle key={`behind-${index}`} {...dotAttributes(dot)} />)}</g>}
        <g opacity={frame.bodyAlpha}>
            <path d={frame.bodyPath} fill={PAPER_COLOR} />
            <g mask={`url(#${maskId})`}>
                <rect x={-DEMI_VIEWBOX} y={-DEMI_VIEWBOX} width={DEMI_VIEWBOX * 2} height={DEMI_VIEWBOX * 2} fill={BODY_COLOR} />
            </g>
        </g>
        {!frame.dotsBehind && <g>{frame.dots.map((dot, index) => dot.d
            ? <path key={`front-${index}`} {...dotAttributes(dot)} />
            : <circle key={`front-${index}`} {...dotAttributes(dot)} />)}</g>}
        {frame.notif && <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} fill={NOTIF_BLUE} />}
        <g fill="none" strokeLinecap="round">
            {frame.arcs.map(arc => <path key={`front-${arc.id}`} d={arc.front} stroke={`url(#${maskId}-${arc.id})`} strokeWidth={arc.width} opacity={arc.opacity} />)}
        </g>
    </svg>;
}

class BloubAvatarBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
    state = { hasError: false };

    static getDerivedStateFromError(): { hasError: boolean } {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.warn('[domi] bloub avatar fallback', error.message, info.componentStack);
    }

    render() {
        return this.state.hasError ? this.props.fallback : this.props.children;
    }
}

export default function DomiBloubAvatar({ fallback = '☁️', ...props }: AvatarProps) {
    return <BloubAvatarBoundary fallback={<span className="domi-bloub-fallback" aria-label={props.ariaLabel}>{fallback}</span>}>
        <BloubAvatarSvg {...props} />
    </BloubAvatarBoundary>;
}
