import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6", className)}>
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-wide text-text-primary">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-text-muted mt-1.5">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
