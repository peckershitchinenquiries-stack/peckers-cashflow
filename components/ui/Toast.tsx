"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Toast = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
};

type ToastContextValue = {
  notify: (msg: string, type?: Toast["type"]) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(0);

  const remove = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  const notify = React.useCallback((message: string, type: Toast["type"] = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => remove(id), 4200);
  }, []);

  const value: ToastContextValue = {
    notify,
    success: (m) => notify(m, "success"),
    error: (m) => notify(m, "error"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-[calc(100vw-2rem)] sm:max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "rounded-xl border bg-surface px-4 py-3 shadow-xl flex items-start gap-3 animate-slide-in",
              t.type === "success" && "border-success/40",
              t.type === "error" && "border-danger/40",
              t.type === "info" && "border-border",
            )}
          >
            <span
              className={cn(
                "mt-1 h-2 w-2 rounded-full flex-shrink-0",
                t.type === "success" && "bg-success",
                t.type === "error" && "bg-danger",
                t.type === "info" && "bg-gold",
              )}
            />
            <p className="text-sm text-text-primary flex-1">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              className="text-text-muted hover:text-text-primary text-sm"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
