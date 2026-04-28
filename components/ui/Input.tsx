"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string | null;
  prefix?: React.ReactNode;
  containerClassName?: string;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, prefix, className, containerClassName, id, ...props },
  ref,
) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  return (
    <div className={cn("flex flex-col gap-1.5", containerClassName)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-subtle">
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl bg-surface border border-border px-3 h-11 transition-colors",
          "focus-within:border-gold/60 focus-within:ring-2 focus-within:ring-gold/30",
          error && "border-danger/60 focus-within:ring-danger/30",
        )}
      >
        {prefix && <span className="text-text-muted text-sm">{prefix}</span>}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "flex-1 bg-transparent outline-none text-text-primary placeholder:text-text-muted text-sm w-full",
            className,
          )}
          {...props}
        />
      </div>
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string | null;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, ...props },
  ref,
) {
  const autoId = React.useId();
  const textareaId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-sm font-medium text-text-subtle">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        ref={ref}
        className={cn(
          "rounded-xl bg-surface border border-border px-3 py-3 text-sm outline-none placeholder:text-text-muted",
          "focus:border-gold/60 focus:ring-2 focus:ring-gold/30",
          error && "border-danger/60 focus:ring-danger/30",
          className,
        )}
        {...props}
      />
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
});

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string | null;
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, children, id, ...props },
  ref,
) {
  const autoId = React.useId();
  const selectId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-text-subtle">
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex items-center rounded-xl bg-surface border border-border h-11 px-2 transition-colors",
          "focus-within:border-gold/60 focus-within:ring-2 focus-within:ring-gold/30",
          error && "border-danger/60",
        )}
      >
        <select
          id={selectId}
          ref={ref}
          className={cn(
            "flex-1 bg-transparent outline-none text-sm text-text-primary px-1 appearance-none cursor-pointer",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <svg
          className="text-text-muted w-4 h-4 mr-2 pointer-events-none"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
});
