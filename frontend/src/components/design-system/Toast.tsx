"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { CheckCircle2, AlertTriangle, X, Info } from "lucide-react";

type ToastType = "success" | "warning" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  remove: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, remove }}>
      {children}
      {typeof window !== "undefined" &&
        createPortal(
          <div className="toast-container">
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-green-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-orange-400" />,
    error: <AlertTriangle className="w-4 h-4 text-red-400" />,
    info: <Info className="w-4 h-4 text-teal-400" />,
  };

  const borders = {
    success: "border-green-500/30",
    warning: "border-orange-500/30",
    error: "border-red-500/30",
    info: "border-teal-500/30",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 bg-background-panel border rounded-xl shadow-panel-lg min-w-[280px] max-w-md animate-slide-in-up",
        borders[toast.type]
      )}
      role="status"
      aria-live="polite"
    >
      {icons[toast.type]}
      <span className="text-sm font-medium text-foreground flex-1">{toast.message}</span>
      <button onClick={onClose} className="text-foreground-subtle hover:text-foreground focus-ring rounded-lg p-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
