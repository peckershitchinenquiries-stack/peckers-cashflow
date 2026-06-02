"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Thin top loading bar that gives *immediate* feedback the instant a user
 * clicks any internal link — before the destination's `loading.tsx` even
 * mounts. It captures link clicks at the document level (so no per-link
 * wiring is needed) and completes when the URL commits to the new route.
 *
 * Works with the App Router: clicking a <Link> fires the capture handler →
 * bar starts; when navigation commits, `usePathname()` changes → bar finishes.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const [visible, setVisible] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [fading, setFading] = React.useState(false);

  const trickle = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = React.useCallback(() => {
    if (trickle.current) {
      clearInterval(trickle.current);
      trickle.current = null;
    }
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const start = React.useCallback(() => {
    clearTimers();
    setFading(false);
    setVisible(true);
    setProgress(8);
    // Creep toward ~90% so it always feels alive while the route loads.
    trickle.current = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + Math.max(0.4, (90 - p) * 0.06)));
    }, 180);
  }, [clearTimers]);

  const finish = React.useCallback(() => {
    clearTimers();
    setProgress(100);
    timers.current.push(setTimeout(() => setFading(true), 120));
    timers.current.push(
      setTimeout(() => {
        setVisible(false);
        setFading(false);
        setProgress(0);
      }, 450),
    );
  }, [clearTimers]);

  // ---- start: capture any internal link click ----
  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      // External link or same exact URL → not an in-app navigation worth showing.
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      start();
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [start]);

  // ---- finish: route committed (pathname changed) ----
  const lastPath = React.useRef(pathname);
  React.useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    finish();
  }, [pathname, finish]);

  React.useEffect(() => clearTimers, [clearTimers]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed top-0 inset-x-0 z-[100] h-[3px] pointer-events-none"
    >
      <div
        className="h-full bg-gold rounded-r-full"
        style={{
          width: `${progress}%`,
          opacity: fading ? 0 : 1,
          boxShadow: "0 0 10px rgb(var(--color-gold) / 0.6)",
          transition: "width 180ms ease-out, opacity 300ms ease-out",
        }}
      />
    </div>
  );
}
