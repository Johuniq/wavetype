/**
 * Toast notification context and hook
 * Production-grade notification system for WaveType
 */

import * as React from "react";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning";
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(
  undefined
);

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${++toastId}`;
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, newToast.duration);
    }

    return id;
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = React.useCallback(() => {
    setToasts([]);
  }, []);

  return React.createElement(
    ToastContext.Provider,
    { value: { toasts, addToast, removeToast, clearToasts } },
    children
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  const toast = React.useCallback(
    (props: Omit<Toast, "id">) => context.addToast(props),
    [context]
  );

  const success = React.useCallback(
    (title: string, description?: string) =>
      context.addToast({ title, description, variant: "success" }),
    [context]
  );

  const error = React.useCallback(
    (title: string, description?: string) =>
      context.addToast({
        title,
        description,
        variant: "error",
        duration: 7000,
      }),
    [context]
  );

  const warning = React.useCallback(
    (title: string, description?: string) =>
      context.addToast({ title, description, variant: "warning" }),
    [context]
  );

  return {
    toast,
    success,
    error,
    warning,
    dismiss: context.removeToast,
    toasts: context.toasts,
  };
}
