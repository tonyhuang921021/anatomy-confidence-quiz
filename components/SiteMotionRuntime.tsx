"use client";

import { useEffect } from "react";

const LOOPS = '[aria-busy="true"], .animate-spin, .animate-pulse, [data-motion-loop]';

/** One shared observer, no per-frame React work. Loading remains meaningful
 * through its existing text while decorative loops pause out of view. */
export function SiteMotionRuntime() {
  useEffect(() => {
    const root = document.documentElement;
    const visibility = () => { root.dataset.motionVisibility = document.visibilityState; };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    const targets = new Set<Element>();
    const intersection = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target instanceof HTMLElement || entry.target instanceof SVGElement) {
          entry.target.dataset.motionPaused = String(!entry.isIntersecting);
        }
      }
    });
    function scan(node: Element) {
      const candidates = [...(node.matches(LOOPS) ? [node] : []), ...Array.from(node.querySelectorAll(LOOPS))];
      for (const target of candidates) {
        if (targets.has(target)) continue;
        targets.add(target); intersection?.observe(target);
      }
    }
    scan(document.body);
    const mutation = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === "attributes" && record.target instanceof Element) scan(record.target);
        for (const node of Array.from(record.addedNodes)) if (node instanceof Element) scan(node);
      }
      for (const target of targets) {
        if (target.isConnected && target.matches(LOOPS)) continue;
        intersection?.unobserve(target); target.removeAttribute("data-motion-paused"); targets.delete(target);
      }
    });
    mutation.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-busy"] });
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      mutation.disconnect(); intersection?.disconnect();
      for (const target of targets) target.removeAttribute("data-motion-paused");
      delete root.dataset.motionVisibility;
    };
  }, []);
  return null;
}
