import { useEffect, useRef, type ReactNode } from 'react';

export function MagicModal({ labelledBy, onClose, children }: { labelledBy: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);

  return <dialog ref={ref} aria-labelledby={labelledBy} onCancel={event => { event.preventDefault(); onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-background p-4 text-foreground shadow-xl backdrop:bg-slate-950/50 sm:p-6">
    {children}
  </dialog>;
}
