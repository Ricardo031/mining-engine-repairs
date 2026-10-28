import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { ToastContext, type ToastKind } from './context';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const DURATION_MS = 4500;
let nextId = 1;

/** Confirmation and error messages shown in the bottom-right corner. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++;
      setToasts((current) => [...current, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      success: (message: string) => show('success', message),
      error: (message: string) => show('error', message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg bg-white px-4 py-3 text-sm shadow-lg ring-1',
              toast.kind === 'success' ? 'ring-emerald-200' : 'ring-red-200',
            )}
          >
            {toast.kind === 'success' ? (
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden />
            ) : (
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-red-500" aria-hidden />
            )}
            <p className="flex-1 text-slate-700">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Cerrar aviso"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
