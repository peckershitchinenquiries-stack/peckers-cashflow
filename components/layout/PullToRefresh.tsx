"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const TRIGGER = 55;
const MAX_PULL = 110;

/** Phone-only pull-down-to-refresh, re-fetching the page's server data. */
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = React.useState(0);
  const [refreshing, startRefresh] = React.useTransition();
  const start = React.useRef<{ x: number; y: number } | null>(null);
  const active = React.useRef(false);
  const pullRef = React.useRef(0);

  React.useEffect(() => {
    if (!window.matchMedia("(max-width: 767px) and (pointer: coarse)").matches) return;

    const reset = () => {
      start.current = null;
      active.current = false;
      pullRef.current = 0;
      setPull(0);
    };

    const onStart = (e: TouchEvent) => {
      // Not while a sheet or modal holds the page, and only from the very top.
      if (window.scrollY > 0 || document.body.style.overflow === "hidden" || e.touches.length > 1) {
        start.current = null;
        return;
      }
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
      active.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!start.current) return;
      const t = e.touches[0];
      const dy = t.clientY - start.current.y;
      const dx = Math.abs(t.clientX - start.current.x);
      if (!active.current) {
        if (dy > 8 && dy > dx * 1.5 && window.scrollY <= 0) active.current = true;
        else if (dy < 0 || dx > 12) {
          start.current = null;
          return;
        } else return;
      }
      const distance = Math.min(MAX_PULL, dy * 0.5);
      pullRef.current = distance;
      setPull(distance);
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
      if (active.current && pullRef.current >= TRIGGER) {
        startRefresh(() => router.refresh());
      }
      reset();
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", reset);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", reset);
    };
  }, [router]);

  const ready = pull >= TRIGGER;
  const visible = pull > 0 || refreshing;
  const offset = refreshing ? 56 : pull;

  return (
    <div
      aria-hidden={!visible}
      className="md:hidden print:hidden pointer-events-none fixed inset-x-0 z-[25] flex justify-center"
      style={{
        top: "calc(3.5rem + env(safe-area-inset-top))",
        transform: `translateY(${offset - 44}px)`,
        opacity: visible ? Math.min(1, offset / 40) : 0,
        transition: pull > 0 ? "none" : "transform 0.2s ease, opacity 0.2s ease",
      }}
    >
      <span
        className={cn(
          "h-9 w-9 rounded-full bg-surface border border-border shadow-lg flex items-center justify-center",
          ready || refreshing ? "text-gold" : "text-text-muted",
        )}
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className={refreshing ? "animate-spin" : undefined}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        >
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 4v5h-5" />
        </svg>
      </span>
    </div>
  );
}
