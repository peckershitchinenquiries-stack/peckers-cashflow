"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function initialsOf(name?: string | null) {
  return (name ?? "")
    .split(/[\s@.]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Round profile photo, falling back to the gold initials when there is none or it fails to load. */
export function Avatar({
  url,
  name,
  className,
  textClassName,
}: {
  url?: string | null;
  name?: string | null;
  /** Sets the size, e.g. "h-8 w-8". */
  className?: string;
  textClassName?: string;
}) {
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [url]);

  return (
    <span
      className={cn(
        "relative shrink-0 rounded-full overflow-hidden bg-gold/15 text-gold border border-gold/30 flex items-center justify-center font-semibold",
        className,
      )}
    >
      {url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase public URL; next/image would need remotePatterns for no gain at this size.
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
          draggable={false}
        />
      ) : (
        <span className={textClassName ?? "text-[11px]"}>{initialsOf(name) || "•"}</span>
      )}
    </span>
  );
}
