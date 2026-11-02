/** Animate UI path C: transition.swap / ease.out, read from shared CSS tokens.
 * Opacity only: no layout, positioning transform, delayed state or hidden SSR. */
export function surfaceTiming(element: Element): KeyframeAnimationOptions {
  const style = getComputedStyle(element);
  const duration = Number.parseFloat(style.getPropertyValue("--motion-swap-ms"));
  return {
    duration: Number.isFinite(duration) ? Math.max(0, duration) : 150,
    easing: style.getPropertyValue("--motion-ease-out").trim() || "cubic-bezier(0.23, 1, 0.32, 1)"
  };
}

export function animateSurface(element: HTMLElement, previous: Animation | null) {
  if (!element.animate) return null;
  const opacity = previous?.playState === "running" ? getComputedStyle(element).opacity : "0.75";
  previous?.cancel();
  return element.animate([{ opacity }, { opacity: 1 }], surfaceTiming(element));
}
