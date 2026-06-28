'use client';

import React, {
    Children,
    useLayoutEffect,
    useRef,
    useState,
    type ButtonHTMLAttributes,
    type HTMLAttributes,
    type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type StepIndicatorRenderProps = {
    step: number;
    currentStep: number;
    onStepClick: (step: number) => void;
};

type StepperProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    children: ReactNode;
    initialStep?: number;
    currentStep?: number;
    onStepChange?: (step: number) => void;
    onFinalStepCompleted?: () => void;
    stepCircleContainerClassName?: string;
    stepContainerClassName?: string;
    contentClassName?: string;
    footerClassName?: string;
    backButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
    nextButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
    backButtonText?: string;
    nextButtonText?: string;
    completeButtonText?: string;
    disableStepIndicators?: boolean;
    renderStepIndicator?: (props: StepIndicatorRenderProps) => ReactNode;
};

export default function Stepper({
    children,
    initialStep = 1,
    currentStep: controlledStep,
    onStepChange = () => {},
    onFinalStepCompleted = () => {},
    stepCircleContainerClassName = '',
    stepContainerClassName = '',
    contentClassName = '',
    footerClassName = '',
    backButtonProps = {},
    nextButtonProps = {},
    backButtonText = 'Back',
    nextButtonText = 'Continue',
    completeButtonText = 'Complete',
    disableStepIndicators = false,
    renderStepIndicator,
    className = '',
    ...rest
}: StepperProps) {
    const [uncontrolledStep, setUncontrolledStep] = useState(initialStep);
    const [direction, setDirection] = useState(0);
    const stepsArray = Children.toArray(children);
    const totalSteps = stepsArray.length;
    const currentStep = controlledStep ?? uncontrolledStep;
    const isCompleted = currentStep > totalSteps;
    const isLastStep = currentStep === totalSteps;

    const updateStep = (newStep: number) => {
        if (controlledStep === undefined) {
            setUncontrolledStep(newStep);
        }

        if (newStep > totalSteps) {
            onFinalStepCompleted();
            return;
        }

        onStepChange(newStep);
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setDirection(-1);
            updateStep(currentStep - 1);
        }
    };

    const handleNext = () => {
        if (!isLastStep) {
            setDirection(1);
            updateStep(currentStep + 1);
        }
    };

    const handleComplete = () => {
        setDirection(1);
        updateStep(totalSteps + 1);
    };

    const {
        className: backButtonClassName = '',
        onClick: onBackButtonClick,
        type: backButtonType = 'button',
        ...restBackButtonProps
    } = backButtonProps;
    const {
        className: nextButtonClassName = '',
        onClick: onNextButtonClick,
        type: nextButtonType = 'button',
        ...restNextButtonProps
    } = nextButtonProps;

    const handleBackButtonClick: React.MouseEventHandler<HTMLButtonElement> = event => {
        onBackButtonClick?.(event);
        if (!event.defaultPrevented) handleBack();
    };

    const handleNextButtonClick: React.MouseEventHandler<HTMLButtonElement> = event => {
        onNextButtonClick?.(event);
        if (event.defaultPrevented) return;
        if (isLastStep) {
            handleComplete();
            return;
        }
        handleNext();
    };

    return (
        <div className={`reactbits-stepper ${className}`} {...rest}>
            <div className={`reactbits-stepper-shell ${stepCircleContainerClassName}`}>
                <div className={`reactbits-stepper-track ${stepContainerClassName}`}>
                    {stepsArray.map((_, index) => {
                        const stepNumber = index + 1;
                        const isNotLastStep = index < totalSteps - 1;

                        return (
                            <React.Fragment key={stepNumber}>
                                {renderStepIndicator ? (
                                    renderStepIndicator({
                                        step: stepNumber,
                                        currentStep,
                                        onStepClick: clickedStep => {
                                            if (disableStepIndicators) return;
                                            setDirection(clickedStep > currentStep ? 1 : -1);
                                            updateStep(clickedStep);
                                        },
                                    })
                                ) : (
                                    <StepIndicator
                                        step={stepNumber}
                                        disableStepIndicators={disableStepIndicators}
                                        currentStep={currentStep}
                                        onClickStep={clickedStep => {
                                            setDirection(clickedStep > currentStep ? 1 : -1);
                                            updateStep(clickedStep);
                                        }}
                                    />
                                )}
                                {isNotLastStep && <StepConnector isComplete={currentStep > stepNumber} />}
                            </React.Fragment>
                        );
                    })}
                </div>

                <StepContentWrapper
                    isCompleted={isCompleted}
                    currentStep={currentStep}
                    direction={direction}
                    className={`reactbits-stepper-content ${contentClassName}`}
                >
                    {stepsArray[currentStep - 1]}
                </StepContentWrapper>

                {!isCompleted && (
                    <div className={`reactbits-stepper-footer ${footerClassName}`}>
                        <div className={`reactbits-stepper-nav ${currentStep !== 1 ? 'spread' : 'end'}`}>
                            {currentStep !== 1 && (
                                <button
                                    type={backButtonType}
                                    onClick={handleBackButtonClick}
                                    className={`reactbits-stepper-back-button ${backButtonClassName}`}
                                    {...restBackButtonProps}
                                >
                                    {backButtonText}
                                </button>
                            )}
                            <button
                                type={nextButtonType}
                                onClick={handleNextButtonClick}
                                className={`reactbits-stepper-next-button ${nextButtonClassName}`}
                                {...restNextButtonProps}
                            >
                                {isLastStep ? completeButtonText : nextButtonText}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function StepContentWrapper({
    isCompleted,
    currentStep,
    direction,
    children,
    className,
}: {
    isCompleted: boolean;
    currentStep: number;
    direction: number;
    children: ReactNode;
    className: string;
}) {
    const [parentHeight, setParentHeight] = useState(0);

    return (
        <motion.div
            className={className}
            style={{ position: 'relative', overflow: 'hidden' }}
            animate={{ height: isCompleted ? 0 : parentHeight }}
            transition={{ type: 'spring', duration: 0.4 }}
        >
            <AnimatePresence initial={false} mode="sync" custom={direction}>
                {!isCompleted && (
                    <SlideTransition key={currentStep} direction={direction} onHeightReady={setParentHeight}>
                        {children}
                    </SlideTransition>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function SlideTransition({
    children,
    direction,
    onHeightReady,
}: {
    children: ReactNode;
    direction: number;
    onHeightReady: (height: number) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        const updateHeight = () => onHeightReady(container.offsetHeight);
        updateHeight();

        if (typeof ResizeObserver === 'undefined') return undefined;

        const observer = new ResizeObserver(updateHeight);
        observer.observe(container);
        return () => observer.disconnect();
    }, [children, onHeightReady]);

    return (
        <motion.div
            ref={containerRef}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
        >
            {children}
        </motion.div>
    );
}

const stepVariants = {
    enter: (direction: number) => ({
        x: direction >= 0 ? '100%' : '-100%',
        opacity: 0,
    }),
    center: {
        x: '0%',
        opacity: 1,
    },
    exit: (direction: number) => ({
        x: direction >= 0 ? '-50%' : '50%',
        opacity: 0,
    }),
};

export function Step({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <div className={`reactbits-stepper-step ${className}`}>{children}</div>;
}

function StepIndicator({
    step,
    currentStep,
    onClickStep,
    disableStepIndicators,
}: {
    step: number;
    currentStep: number;
    onClickStep: (step: number) => void;
    disableStepIndicators: boolean;
}) {
    const status = currentStep === step ? 'active' : currentStep < step ? 'inactive' : 'complete';

    const handleClick = () => {
        if (step !== currentStep && !disableStepIndicators) onClickStep(step);
    };

    return (
        <motion.button
            type="button"
            onClick={handleClick}
            className="reactbits-stepper-indicator"
            disabled={disableStepIndicators}
            animate={status}
            initial={false}
        >
            <motion.span
                variants={{
                    inactive: { scale: 1, backgroundColor: '#ffffff', color: '#7c6cf2' },
                    active: { scale: 1, backgroundColor: '#6c5ce7', color: '#6c5ce7' },
                    complete: { scale: 1, backgroundColor: '#6c5ce7', color: '#ffffff' },
                }}
                transition={{ duration: 0.3 }}
                className="reactbits-stepper-indicator-inner"
            >
                {status === 'complete' ? (
                    <CheckIcon className="reactbits-stepper-check-icon" />
                ) : status === 'active' ? (
                    <span className="reactbits-stepper-active-dot" />
                ) : (
                    <span className="reactbits-stepper-number">{step}</span>
                )}
            </motion.span>
        </motion.button>
    );
}

function StepConnector({ isComplete }: { isComplete: boolean }) {
    const lineVariants = {
        incomplete: { width: 0, backgroundColor: 'transparent' },
        complete: { width: '100%', backgroundColor: '#6c5ce7' },
    };

    return (
        <span className="reactbits-stepper-connector" aria-hidden="true">
            <motion.span
                className="reactbits-stepper-connector-inner"
                variants={lineVariants}
                initial={false}
                animate={isComplete ? 'complete' : 'incomplete'}
                transition={{ duration: 0.4 }}
            />
        </span>
    );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.1, type: 'tween', ease: 'easeOut', duration: 0.3 }}
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
            />
        </svg>
    );
}
