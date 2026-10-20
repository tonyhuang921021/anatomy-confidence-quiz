"use client";

import { useEffect } from "react";

/** Progressive enhancement: every section is readable without JS or observation. */
export function HomePageMotion() {
  useEffect(() => {
    const root = document.querySelector(".home-motion");
    if (!root || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-home-revealed", "true");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12 });
    root.querySelectorAll("[data-home-reveal]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  return null;
}
