import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: "info" | "success" | "warning";
}

interface ToastContextValue {
  push: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<Toast["tone"], string> = {
  info: "border-primary/40 bg-surface-2",
  success: "border-success/50 bg-surface-2",
  warning: "border-live/50 bg-surface-2",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-32 z-50 flex w-80 -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-rise pointer-events-auto rounded-xl border ${TONE_STYLES[t.tone]} px-4 py-3 shadow-xl backdrop-blur`}
          >
            <p className="text-sm font-semibold text-foreground">{t.title}</p>
            {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
