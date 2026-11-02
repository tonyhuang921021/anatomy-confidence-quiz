"use client";

import { useEffect, useRef } from "react";
import { animateSurface } from "@/lib/siteMotion";

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
    active.current = animateSurface(element, active.current);
  }, [stateKey]);
  useEffect(() => () => active.current?.cancel(), []);
  return ref;
}
