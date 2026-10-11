// One toast at a time, announced politely to screen readers.
import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';

type Action = { label: string; run: () => void };
type Show = (message: string, action?: Action) => void;

const ToastContext = createContext<Show>(() => undefined);
export const useToast = () => useContext(ToastContext);

const VISIBLE_MS = 3200;
const WITH_ACTION_MS = 8000;

export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [toast, setToast] = useState<{ message: string; action?: Action; n: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback<Show>((message, action) => setToast((t) => ({ message, action, n: (t?.n ?? 0) + 1 })), []);

  useEffect(() => {
    if (!toast) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), toast.action ? WITH_ACTION_MS : VISIBLE_MS);
    return () => clearTimeout(timer.current);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div class={`toast${toast ? ' on' : ''}`} role="status" aria-live="polite">
        {toast?.message}
        {toast?.action && (
          <button
            type="button"
            class="toast-action"
            onClick={() => {
              toast.action?.run();
              setToast(null);
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </ToastContext.Provider>
  );
}
