import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/** Accessible dialog built on the native <dialog> element (focus trap and Esc for free). */
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // jsdom (tests) does not implement showModal.
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="modal-title"
      className="m-auto w-full max-w-lg rounded-xl bg-white p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      {open && (
        <>
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 id="modal-title" className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </button>
          </header>
          <div className="px-5 py-5">{children}</div>
        </>
      )}
    </dialog>
  );
}
