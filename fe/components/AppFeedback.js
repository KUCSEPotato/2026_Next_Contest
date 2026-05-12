"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const FeedbackContext = createContext(null);

const TOAST_STYLES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-slate-200 bg-white text-slate-900",
};

export const APP_TOAST_EVENT = "app:toast";

export function AppFeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const dialogResolverRef = useRef(null);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, message, type = "info", duration = 2800 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, title, message, type }].slice(-4));

      if (duration > 0) {
        window.setTimeout(() => dismissToast(id), duration);
      }

      return id;
    },
    [dismissToast]
  );

  const toast = useMemo(
    () => ({
      success: (message, options = {}) =>
        showToast({ ...options, message, type: "success" }),
      error: (message, options = {}) =>
        showToast({ ...options, message, type: "error" }),
      warning: (message, options = {}) =>
        showToast({ ...options, message, type: "warning" }),
      info: (message, options = {}) =>
        showToast({ ...options, message, type: "info" }),
    }),
    [showToast]
  );

  const closeDialog = useCallback((value) => {
    if (dialogResolverRef.current) {
      dialogResolverRef.current(value);
      dialogResolverRef.current = null;
    }
    setDialog(null);
  }, []);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      dialogResolverRef.current = resolve;
      setDialog({
        type: "confirm",
        title: options.title || "확인",
        message: options.message || "",
        confirmText: options.confirmText || "확인",
        cancelText: options.cancelText || "취소",
        tone: options.tone || "default",
      });
    });
  }, []);

  const prompt = useCallback((options) => {
    return new Promise((resolve) => {
      dialogResolverRef.current = resolve;
      setDialog({
        type: options.multiline ? "prompt-textarea" : "prompt",
        title: options.title || "입력",
        message: options.message || "",
        defaultValue: options.defaultValue || "",
        placeholder: options.placeholder || "",
        confirmText: options.confirmText || "확인",
        cancelText: options.cancelText || "취소",
        inputType: options.inputType || "text",
        required: Boolean(options.required),
        tone: options.tone || "default",
      });
    });
  }, []);

  useEffect(() => {
    const handleToastEvent = (event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      if (!detail?.message) return;
      showToast(detail);
    };

    window.addEventListener(APP_TOAST_EVENT, handleToastEvent);
    return () => window.removeEventListener(APP_TOAST_EVENT, handleToastEvent);
  }, [showToast]);

  const value = useMemo(
    () => ({ toast, confirm, prompt }),
    [confirm, prompt, toast]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      {dialog ? <Dialog dialog={dialog} onClose={closeDialog} /> : null}
    </FeedbackContext.Provider>
  );
}

export function useToast() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useToast must be used within AppFeedbackProvider");
  }
  return context.toast;
}

export function useDialog() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useDialog must be used within AppFeedbackProvider");
  }
  return { confirm: context.confirm, prompt: context.prompt };
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-xl border px-4 py-3 shadow-lg backdrop-blur ${
            TOAST_STYLES[toast.type] || TOAST_STYLES.info
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {toast.title ? (
                <p className="text-sm font-bold">{toast.title}</p>
              ) : null}
              <p className="text-sm leading-5">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 rounded-md px-1 text-lg leading-none opacity-60 hover:opacity-100"
              aria-label="알림 닫기"
            >
              x
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Dialog({ dialog, onClose }) {
  const [value, setValue] = useState(dialog.defaultValue || "");
  const isPrompt = dialog.type === "prompt" || dialog.type === "prompt-textarea";
  const isDanger = dialog.tone === "danger";

  const submit = () => {
    if (isPrompt) {
      if (dialog.required && !value.trim()) return;
      onClose(value);
      return;
    }
    onClose(true);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-950">{dialog.title}</h2>
        {dialog.message ? (
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
            {dialog.message}
          </p>
        ) : null}

        {isPrompt ? (
          dialog.type === "prompt-textarea" ? (
            <textarea
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={dialog.placeholder}
              rows={5}
              className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />
          ) : (
            <input
              autoFocus
              type={dialog.inputType}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
              placeholder={dialog.placeholder}
              className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />
          )
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose(isPrompt ? null : false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {dialog.cancelText}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPrompt && dialog.required && !value.trim()}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 ${
              isDanger ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
