"use client";

import { useEffect, useRef } from "react";
import { HEADER_STICKY_VAR, stuckHeaderHeight } from "@/lib/sticky-offset";

/**
 * Renders nothing. Placed inside the sticky <header>, it measures it and keeps `--header-sticky-h` on <html> equal to
 * the part of the header that stays on screen (see lib/sticky-offset.ts). Without JavaScript, or before the first
 * measurement, the CSS fallback in globals.css applies.
 */
export function HeaderOffset() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const header = marker.current?.closest("header");
    if (!header) return;
    const root = document.documentElement;
    const measure = () => {
      const style = getComputedStyle(header);
      const px = stuckHeaderHeight({
        position: style.position,
        height: header.getBoundingClientRect().height,
        top: parseFloat(style.top),
      });
      root.style.setProperty(HEADER_STICKY_VAR, `${px}px`);
    };
    measure();
    // Size changes (a wrapping row, a menu) and media-query changes (the top bar, the short-landscape rule).
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      root.style.removeProperty(HEADER_STICKY_VAR);
    };
  }, []);
  return <span ref={marker} hidden />;
}
