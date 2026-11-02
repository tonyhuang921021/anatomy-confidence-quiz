"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Retain only the visual exit. Semantics, focus and dismissal follow `open`
 * immediately. Reopening cancels removal and CSS retargets the same DOM. */
export function useMotionPresence(open: boolean) {
  const [retained, setRetained] = useState(open);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // React 18 does not serialize inert booleans consistently. Set the native
    // property before paint instead of passing a string/boolean JSX attribute.
    if (ref.current) ref.current.inert = !open;
    if (open) setRetained(true);
  }, [open]);
  useEffect(() => {
    if (open || !retained) return;
    const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--motion-swap-ms"));
    const timer = window.setTimeout(() => setRetained(false), Number.isFinite(value) ? Math.max(0, value) : 150);
    return () => window.clearTimeout(timer);
  }, [open, retained]);
  return {
    present: open || retained,
    attributes: {
      ref,
      "data-motion-presence": "",
      "data-motion-state": open ? "open" : "closed",
      "aria-hidden": open ? undefined : true
    }
  };
}
