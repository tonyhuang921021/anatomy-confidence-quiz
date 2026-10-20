"use client";

import { useEffect, useRef } from "react";

/** Animate UI transition.swap; opacity only, so reduced motion keeps the feedback. */
const swapTiming = { duration: 150, easing: "cubic-bezier(0.23, 1, 0.32, 1)" };

export function useQuestionChangeFeedback(questionId: string, enabled: boolean) {
  const elementRef = useRef<HTMLDivElement>(null);
  const previousQuestionId = useRef(questionId);
  const animationRef = useRef<Animation | null>(null);

  useEffect(() => {
    if (previousQuestionId.current === questionId) return;
    previousQuestionId.current = questionId;
    const element = elementRef.current;
    if (!enabled || !element) return;
    // Next/Submit can unmount the focused action. Restore a non-actionable reading
    // target immediately, without scrolling or making a held Enter answer again.
    if (document.activeElement === document.body) element.focus({ preventScroll: true });
    if (!element.animate) return;

    // Keep the same DOM and focus. A rapid change continues from the current opacity;
    // there is no exit queue, delayed state update, or second copy of the question.
    const previous = animationRef.current;
    const opacity = previous?.playState === "running"
      ? Number(getComputedStyle(element).opacity)
      : 0.75;
    previous?.cancel();
    const animation = element.animate([{ opacity }, { opacity: 1 }], swapTiming);
    animationRef.current = animation;
    animation.onfinish = () => {
      if (animationRef.current === animation) animationRef.current = null;
    };
  }, [enabled, questionId]);

  useEffect(() => () => animationRef.current?.cancel(), []);
  return elementRef;
}
