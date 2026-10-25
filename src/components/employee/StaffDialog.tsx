import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X } from 'lucide-react';

interface StaffDialogProps {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  /** While saving, the dialog can't be dismissed. */
  busy?: boolean;
  children: React.ReactNode;
  footer: React.ReactNode;
  role?: 'dialog' | 'alertdialog';
  width?: 'sm' | 'md';
}

/**
 * Dialog shell for the staff portal. Rendered into <body> (the sticky header uses backdrop-blur,
 * which would trap a fixed overlay inside it). Bottom sheet on phones, centred card on larger
 * screens; the body scrolls while the header and the action buttons stay visible.
 * z-[55]: above the sticky header (z-40) and toasts (z-50) — the dialogs show the server's
 * error message themselves, and a toast must never cover the dialog's buttons on a phone.
 */
export const StaffDialog: React.FC<StaffDialogProps> = ({
  title,
  subtitle,
  onClose,
  busy = false,
  children,
  footer,
  role = 'dialog',
  width = 'md',
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    // Stop the page behind from scrolling (only the vertical axis: App sets overflow-x on <body>).
    const root = document.documentElement;
    const prevOverflowY = root.style.overflowY;
    root.style.overflowY = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      root.style.overflowY = prevOverflowY;
      previousFocus?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${width === 'sm' ? 'sm:max-w-md' : 'sm:max-w-lg'} bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col motion-safe:animate-fadeIn max-h-[calc(100dvh-0.75rem)] sm:max-h-[calc(100dvh-2rem)] outline-none`}
      >
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-line/70 shrink-0">
          <div className="min-w-0 pt-1">
            <h2 id={titleId} className="font-display tracking-[0.01em] text-[22px] leading-tight font-bold text-ink">
              {title}
            </h2>
            {subtitle && <div className="text-[13px] text-slate-500 mt-0.5">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="w-11 h-11 -mr-2 shrink-0 flex items-center justify-center rounded-xl text-slate-500 hover:text-ink hover:bg-paper disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-4 text-[15px]">{children}</div>
        <div className="flex gap-2 px-4 sm:px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-line/70 shrink-0">
          {footer}
        </div>
      </div>
    </div>,
    document.body
  );
};

/** Standard footer buttons (≥ 44px tall). */
export const DialogButtons: React.FC<{
  onCancel: () => void;
  busy: boolean;
  submitLabel: string;
  busyLabel?: string;
  tone?: 'primary' | 'success' | 'danger';
  /** Set when the buttons live inside a <form> (submit type). */
  form?: string;
  onSubmit?: () => void;
  disabled?: boolean;
}> = ({ onCancel, busy, submitLabel, busyLabel = 'Saving…', tone = 'primary', form, onSubmit, disabled }) => {
  const toneCls =
    tone === 'success'
      ? 'bg-emerald-600 hover:bg-emerald-700'
      : tone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700'
      : 'bg-ink hover:bg-ink-hover';
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="flex-1 sm:flex-none sm:px-5 min-h-[48px] rounded-xl border border-line bg-white text-[15px] font-bold text-ink hover:bg-paper transition-colors duration-150 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Cancel
      </button>
      <button
        type={form ? 'submit' : 'button'}
        form={form}
        onClick={form ? undefined : onSubmit}
        disabled={busy || disabled}
        className={`flex-[2] sm:flex-1 min-h-[48px] px-4 rounded-xl text-[15px] font-bold text-white transition-colors duration-150 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${toneCls}`}
      >
        {busy ? busyLabel : submitLabel}
      </button>
    </>
  );
};

export const FieldError: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
  children ? (
    <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  ) : null;

export const fieldLabel = 'block text-sm font-semibold text-ink mb-1.5';
export const inputCls =
  'w-full min-h-[48px] px-3 rounded-xl border border-slate-300 text-base text-slate-900 bg-white focus:ring-2 focus:ring-ink/30 focus:border-ink outline-none';
export const textareaCls =
  'w-full px-3 py-2.5 rounded-xl border border-slate-300 text-base text-slate-900 bg-white focus:ring-2 focus:ring-ink/30 focus:border-ink outline-none';
