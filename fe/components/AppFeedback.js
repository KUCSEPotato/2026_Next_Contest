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
  success: "border-red-100 bg-white text-slate-900 dark:border-red-900/60 dark:bg-slate-900 dark:text-slate-100",
  error: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-100",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/50 dark:text-amber-100",
  info: "border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
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

  const confirmCoinSpend = useCallback((options) => {
    return new Promise((resolve) => {
      const amount = Number(options.amount || 0);
      const currentBalance = Number(options.currentBalance || 0);
      dialogResolverRef.current = resolve;
      setDialog({
        type: "coin-confirm",
        title: options.title || "물방울을 사용할까요?",
        message: options.message || "",
        amount,
        currentBalance,
        remainingBalance: currentBalance - amount,
        unitLabel: options.unitLabel || "방울",
        confirmText: options.confirmText || "사용하기",
        cancelText: options.cancelText || "돌아가기",
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

  useEffect(() => {
    const nativeAlert = window.alert;

    window.alert = (message) => {
      const text = String(message ?? "");
      const type = /실패|오류|에러|불가|못했습니다|확인해주세요/.test(text)
        ? "error"
        : /완료|성공|되었습니다|저장/.test(text)
          ? "success"
          : "info";

      showToast({ message: text, type, duration: 3400 });
    };

    return () => {
      window.alert = nativeAlert;
    };
  }, [showToast]);

  const value = useMemo(
    () => ({ toast, confirm, prompt, confirmCoinSpend }),
    [confirm, confirmCoinSpend, prompt, toast]
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
  return {
    confirm: context.confirm,
    prompt: context.prompt,
    confirmCoinSpend: context.confirmCoinSpend,
  };
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="fixed left-1/2 top-5 z-[100] flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 flex-col gap-3">
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
  const isCoinConfirm = dialog.type === "coin-confirm";
  const isSpendInsufficient = isCoinConfirm && dialog.remainingBalance < 0;
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
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">{dialog.title}</h2>
        {dialog.message ? (
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">
            {dialog.message}
          </p>
        ) : null}

        {isCoinConfirm ? (
          <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 text-center text-sm">
            <div className="bg-slate-50 px-3 py-4">
              <p className="text-xs font-semibold text-slate-500">현재 물방울</p>
              <p className="mt-1 text-lg font-black text-red-600">
                {dialog.currentBalance.toLocaleString("ko-KR")}
                {dialog.unitLabel}
              </p>
            </div>
            <div className="bg-white px-3 py-4">
              <p className="text-xs font-semibold text-slate-500">사용 물방울</p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {dialog.amount.toLocaleString("ko-KR")}
                {dialog.unitLabel}
              </p>
            </div>
            <div className="bg-slate-50 px-3 py-4">
              <p className="text-xs font-semibold text-slate-500">사용 후</p>
              <p className={`mt-1 text-lg font-black ${isSpendInsufficient ? "text-red-600" : "text-slate-950"}`}>
                {dialog.remainingBalance.toLocaleString("ko-KR")}
                {dialog.unitLabel}
              </p>
            </div>
          </div>
        ) : null}

        {isSpendInsufficient ? (
          <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            물방울이 부족합니다. 상점에서 물방울을 충전해주세요.
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
              className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-red-950/50"
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
              className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-red-950/50"
            />
          )
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose(isPrompt ? null : false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {dialog.cancelText}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={(isPrompt && dialog.required && !value.trim()) || isSpendInsufficient}
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
