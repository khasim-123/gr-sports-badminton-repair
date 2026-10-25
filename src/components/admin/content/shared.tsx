/**
 * Small building blocks shared by the Website Content admin screens:
 * modal, confirm dialog, switch, form field, list skeleton, error state, tab pills.
 */
import React, { useEffect, useId } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '../../common/Button';

// ---------- helpers ----------

export const errorMessage = (err: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
};

/** Local (not UTC) date as YYYY-MM-DD. */
export const todayISO = (): string => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export const addDaysISO = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
};

/** Formats either a YYYY-MM-DD date or a full ISO timestamp for display (en-IN). */
export const formatDate = (value?: string | null, withWeekday = false): string => {
  if (!value) return '';
  let date: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    date = new Date(y, m - 1, d);
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    ...(withWeekday ? { weekday: 'short' as const } : {}),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const isHttpsUrl = (value: string): boolean => /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(value.trim());

/** Trims a string and turns empty into null (for optional API fields). */
export const nullIfEmpty = (value?: string | null): string | null => {
  const v = (value ?? '').trim();
  return v ? v : null;
};

// ---------- styles ----------

export const inputClass =
  'w-full min-h-[42px] px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-ink/40 focus:border-ink disabled:bg-paper disabled:text-slate-500';

export const inputErrorClass = '!border-rose-400 focus:!ring-rose-400 focus:!border-rose-400';

export const cardClass = 'bg-white rounded-2xl border border-slate-200/90 shadow-2xs';

// ---------- Field ----------

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, htmlFor, hint, error, required, className = '', children }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-700 mb-1">
      {label}
      {required && <span className="text-rose-600 ml-0.5" aria-hidden="true">*</span>}
    </label>
    {children}
    {error ? (
      <p className="text-xs text-rose-600 mt-1 font-medium" role="alert">
        {error}
      </p>
    ) : hint ? (
      <p className="text-xs text-slate-500 mt-1 leading-snug">{hint}</p>
    ) : null}
  </div>
);

// ---------- Switch ----------

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Visually hide the label text (still read by screen readers). */
  hideLabel?: boolean;
  onLabel?: string;
  offLabel?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled,
  hideLabel,
  onLabel,
  offLabel,
}) => {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 min-h-[40px]">
      <div className={hideLabel ? 'sr-only' : 'min-w-0'}>
        <span id={`${id}-label`} className="block text-xs font-semibold text-slate-700">
          {label}
        </span>
        {description && <span className="block text-xs text-slate-500 leading-snug">{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="shrink-0 inline-flex items-center gap-2 min-h-[40px] px-1 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:opacity-50"
      >
        {(onLabel || offLabel) && (
          <span className={`text-xs font-bold ${checked ? 'text-emerald-700' : 'text-slate-500'}`}>
            {checked ? onLabel : offLabel}
          </span>
        )}
        <span
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            checked ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              checked ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </span>
      </button>
    </div>
  );
};

// ---------- Modal ----------

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** While true the close button is disabled (e.g. a save is in flight). */
  busy?: boolean;
  /** Escape closes the modal. Off for forms so typed input is never lost by accident. */
  closeOnEscape?: boolean;
  size?: 'sm' | 'md' | 'lg';
  footer?: React.ReactNode;
  children: React.ReactNode;
  role?: 'dialog' | 'alertdialog';
}

export const Modal: React.FC<ModalProps> = ({
  open,
  title,
  subtitle,
  onClose,
  busy,
  closeOnEscape = false,
  size = 'md',
  footer,
  children,
  role = 'dialog',
}) => {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, closeOnEscape, busy, onClose]);

  if (!open) return null;

  const width = size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/70 backdrop-blur-xs">
      <div
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-white w-full ${width} rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[calc(100vh-2rem)] animate-fadeIn`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-line/70 shrink-0">
          <div className="min-w-0">
            <h3 id={titleId} className="font-bold text-base text-slate-900 break-words">
              {title}
            </h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 break-words">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="shrink-0 w-10 h-10 -mr-2 -mt-1 inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto overscroll-contain flex-1 min-h-0">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-line/70 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- ConfirmDialog ----------

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = true,
  busy,
  onConfirm,
  onCancel,
}) => (
  <Modal
    open={open}
    title={title}
    onClose={onCancel}
    busy={busy}
    closeOnEscape
    size="sm"
    role="alertdialog"
    footer={
      <>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy} className="min-h-[42px]">
          Cancel
        </Button>
        <Button
          type="button"
          variant={danger ? 'danger' : 'primary'}
          onClick={onConfirm}
          isLoading={busy}
          className="min-h-[42px]"
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="text-sm text-slate-600 leading-relaxed">{message}</div>
  </Modal>
);

// ---------- States ----------

export const ErrorState: React.FC<{ title?: string; message: string; onRetry: () => void; retrying?: boolean }> = ({
  title = "Couldn't load this section",
  message,
  onRetry,
  retrying,
}) => (
  <div className={`${cardClass} p-6 sm:p-8 text-center flex flex-col items-center`} role="alert">
    <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-3">
      <AlertTriangle className="w-6 h-6 text-rose-500" />
    </div>
    <h3 className="text-sm font-bold text-slate-900">{title}</h3>
    <p className="text-xs text-slate-500 mt-1 max-w-sm break-words">{message}</p>
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mt-4 min-h-[40px]"
      onClick={onRetry}
      isLoading={retrying}
      leftIcon={<RefreshCw className="w-4 h-4" />}
    >
      Try again
    </Button>
  </div>
);

export const ListSkeleton: React.FC<{ rows?: number; withImage?: boolean }> = ({ rows = 3, withImage = true }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className={`${cardClass} p-4 flex gap-4 animate-pulse`}>
        {withImage && <div className="w-20 h-20 sm:w-28 rounded-xl bg-slate-200 shrink-0" />}
        <div className="flex-1 space-y-2.5 py-1">
          <div className="h-4 bg-slate-200 rounded w-1/2" />
          <div className="h-3 bg-slate-100 rounded w-3/4" />
          <div className="h-3 bg-slate-100 rounded w-1/3" />
        </div>
      </div>
    ))}
  </div>
);

// ---------- Pills (filter chips) ----------

export interface PillOption<T extends string> {
  id: T;
  label: string;
  count?: number;
  highlight?: boolean;
}

export function Pills<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: PillOption<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 max-w-full">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={`shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl text-xs font-semibold border transition-colors ${
              active
                ? 'bg-sportsBlue text-white border-sportsBlue shadow-sm'
                : 'bg-white text-slate-600 border-line hover:bg-paper'
            }`}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={`text-xs min-w-[20px] px-1.5 py-0.5 rounded-full font-bold ${
                  active
                    ? 'bg-brandYellow text-sportsBlue'
                    : opt.highlight && opt.count > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Section header used at the top of each manager. */
export const SectionHeader: React.FC<{ title: string; description: string; actions?: React.ReactNode }> = ({
  title,
  description,
  actions,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
    <div className="min-w-0">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">{description}</p>
    </div>
    {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
  </div>
);
