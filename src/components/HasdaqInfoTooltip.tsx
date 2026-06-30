'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type TooltipPlacement = 'top' | 'bottom';

type TooltipPosition = {
    left: number;
    top: number;
    placement: TooltipPlacement;
};

type HasdaqInfoTooltipProps = {
    as?: 'span' | 'strong';
    className?: string;
    tooltip: string;
    children: ReactNode;
};

const VIEWPORT_GAP = 14;
const TRIGGER_GAP = 10;
const DEFAULT_TOOLTIP_WIDTH = 280;

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export default function HasdaqInfoTooltip({ as = 'span', className = '', tooltip, children }: HasdaqInfoTooltipProps) {
    const tooltipId = useId();
    const triggerRef = useRef<HTMLElement | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<TooltipPosition>({ left: 0, top: 0, placement: 'top' });

    const updatePosition = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const tooltipWidth = tooltipRef.current?.offsetWidth || Math.min(DEFAULT_TOOLTIP_WIDTH, window.innerWidth - VIEWPORT_GAP * 2);
        const tooltipHeight = tooltipRef.current?.offsetHeight || 44;
        const canFitAbove = rect.top - tooltipHeight - TRIGGER_GAP >= VIEWPORT_GAP;
        const placement: TooltipPlacement = canFitAbove ? 'top' : 'bottom';
        const minLeft = VIEWPORT_GAP + tooltipWidth / 2;
        const maxLeft = window.innerWidth - VIEWPORT_GAP - tooltipWidth / 2;
        const centeredLeft = rect.left + rect.width / 2;
        const left = maxLeft >= minLeft ? clamp(centeredLeft, minLeft, maxLeft) : window.innerWidth / 2;
        const top = placement === 'top' ? rect.top - TRIGGER_GAP : rect.bottom + TRIGGER_GAP;

        setPosition({ left, top, placement });
    }, []);

    useEffect(() => {
        if (!open) return;

        const animationFrame = window.requestAnimationFrame(updatePosition);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.cancelAnimationFrame(animationFrame);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [open, updatePosition]);

    const showTooltip = () => {
        setOpen(true);
        window.requestAnimationFrame(updatePosition);
    };

    const hideTooltip = () => {
        setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') {
            setOpen(false);
        }
    };

    const triggerClassName = ['hasdaq-explained-metric', className].filter(Boolean).join(' ');
    const triggerProps = {
        ref: (node: HTMLElement | null) => {
            triggerRef.current = node;
        },
        className: triggerClassName,
        'aria-label': tooltip,
        'aria-describedby': open ? tooltipId : undefined,
        tabIndex: 0,
        onPointerEnter: showTooltip,
        onPointerLeave: hideTooltip,
        onFocus: showTooltip,
        onBlur: hideTooltip,
        onKeyDown: handleKeyDown,
    };

    const trigger = as === 'strong'
        ? <strong {...triggerProps}>{children}</strong>
        : <span {...triggerProps}>{children}</span>;

    return (
        <>
            {trigger}
            {open && createPortal(
                <div
                    id={tooltipId}
                    ref={tooltipRef}
                    className={`hasdaq-tooltip-layer is-${position.placement}`}
                    role="tooltip"
                    style={{ left: position.left, top: position.top }}
                >
                    {tooltip}
                </div>,
                document.body,
            )}
        </>
    );
}
