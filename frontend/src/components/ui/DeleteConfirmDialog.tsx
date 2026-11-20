'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Trash2, X } from 'lucide-react';

type DeleteConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  onCheckboxChange?: (checked: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteConfirmDialog({
  title,
  description,
  confirmLabel,
  busy = false,
  checkboxLabel,
  checkboxChecked = false,
  onCheckboxChange,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mounted, busy, onCancel]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto overscroll-contain px-4 py-[max(16px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]">
      <button
        type="button"
        aria-label="Cancel delete"
        onClick={() => { if (!busy) onCancel(); }}
        className="fixed inset-0 bg-black/65 backdrop-blur-[2px]"
      />
      <section
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative my-auto w-full max-w-[360px] max-h-[calc(100dvh_-_32px)] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#1F2630] p-4 text-white shadow-xl shadow-black/40"
      >
        <header className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/[0.10] text-red-300">
            <Trash2 size={17} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-[15px] font-semibold leading-5 tracking-[-0.01em]">{title}</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            disabled={busy}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/45 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
          >
            <X size={17} />
          </button>
        </header>
        <p className="mt-3 pl-12 text-[13px] leading-5 text-white/55">{description}</p>
        {checkboxLabel && onCheckboxChange && (
          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-[#18212b] px-3 py-3 text-[13px] text-white/80">
            <input type="checkbox" checked={checkboxChecked} onChange={event => onCheckboxChange(event.target.checked)} disabled={busy} className="h-4 w-4 accent-[#d6a83f]" />
            <span>{checkboxLabel}</span>
          </label>
        )}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-10 rounded-lg px-3.5 text-[13px] font-medium text-white/65 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#b4232f] px-3.5 text-[13px] font-semibold text-white transition hover:bg-[#9f1d2a] disabled:cursor-wait disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
