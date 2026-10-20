"use client";

import { useEffect, useRef } from "react";

/** State continuity without remounting controls, moving text, or delaying updates. */
export function useSurfaceTransition(stateKey: string) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(stateKey);
  const active = useRef<Animation | null>(null);
  useEffect(() => {
    if (previous.current === stateKey) return;
    previous.current = stateKey;
    const element = ref.current;
    if (!element?.animate) return;
    const opacity = active.current?.playState === "running" ? getComputedStyle(element).opacity : 0.75;
    active.current?.cancel();
    active.current = element.animate([{ opacity }, { opacity: 1 }], {
      duration: 150, easing: "cubic-bezier(0.23, 1, 0.32, 1)"
    });
  }, [stateKey]);
  useEffect(() => () => active.current?.cancel(), []);
  return ref;
}
