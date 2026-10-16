import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  className,
  showTitleOnMobile = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Phones show the screen name in the top bar; keep this one only when it says more (a greeting). */
  showTitleOnMobile?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6",
        !showTitleOnMobile && (action ? "max-md:mb-4" : "max-md:hidden"),
        className,
      )}
    >
      <div className={cn(!showTitleOnMobile && "max-md:hidden")}>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-wide text-text-primary max-md:text-[22px] max-md:tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-text-muted mt-1.5 max-md:hidden">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
