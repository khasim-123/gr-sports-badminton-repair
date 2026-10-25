/**
 * Small building blocks shared by the Website Content admin screens, so every manager looks and
 * behaves the same: form field (label above, hint or error below), switch, form sections, modal
 * with a fixed save bar, confirm dialog, notices, stat tiles, search box, list skeleton, error and
 * "no matches" states, filter pills. Field styles follow the customer-facing forms
 * (src/components/public/home/ui.tsx: fieldLabel / fieldHint / fieldControl).
 */
import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '../../common/Button';

// ---------- helpers ----------

export const errorMessage = (err: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) {
      // The API client's generic "HTTP Request failed with status 500" means nothing to the owner.
      const http = /^HTTP Request failed with status (\d+)/i.exec(msg.trim());
      if (http) return Number(http[1]) >= 500 ? 'The server had a problem. Please try again in a minute.' : fallback;
      return msg;
    }
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

export const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/** Same look as the customer forms: 14px label, 13px hint, 44px+ control with 15px text. */
export const labelClass = 'block text-[14px] font-medium text-ink mb-1.5';
export const hintClass = 'mt-1.5 text-[13px] leading-snug text-ink-muted';

export const inputClass =
  'block w-full min-h-[44px] px-3.5 py-2.5 text-[15px] leading-snug rounded-xl border border-line bg-white text-ink placeholder:text-ink-muted/60 transition-colors duration-150 hover:border-ink/30 focus:outline-none focus:border-ink focus:ring-2 focus:ring-ink/15 disabled:bg-paper disabled:text-ink-muted disabled:hover:border-line aria-[invalid=true]:border-rose-500';

export const inputErrorClass = '!border-rose-500 focus:!border-rose-500 focus:!ring-rose-500/20';

export const cardClass = 'bg-white rounded-2xl border border-line';

/** Square icon button used for row actions (edit, delete, move). 44px on phones, 40px on laptops. */
export const iconButtonClass = `shrink-0 w-11 h-11 sm:w-10 sm:h-10 inline-flex items-center justify-center rounded-xl border border-line bg-white text-ink-soft transition-colors duration-150 hover:bg-paper hover:text-ink hover:border-slate-300 disabled:opacity-40 disabled:pointer-events-none ${focusRing}`;
export const iconButtonDangerClass = `shrink-0 w-11 h-11 sm:w-10 sm:h-10 inline-flex items-center justify-center rounded-xl border border-line bg-white text-ink-muted transition-colors duration-150 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 disabled:opacity-40 disabled:pointer-events-none ${focusRing}`;

/** Wrapper for a stack of <Switch> rows. */
export const switchGroupClass = 'divide-y divide-line rounded-2xl border border-line bg-white px-4';

/** Small status chip (e.g. "Hidden", "Featured"). */
export const chipClass = 'inline-flex items-center gap-1 text-[12px] font-semibold leading-none px-2 py-1 rounded-full border';

// ---------- Field ----------

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  /** Adds a quiet "(optional)" after the label, like the customer forms. */
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}

const CONTROL_TAGS = new Set(['input', 'select', 'textarea']);

/** Inline error under a field: rose text with an icon (same as the customer forms). */
export const FieldError: React.FC<{ id?: string; children: React.ReactNode; className?: string }> = ({ id, children, className = '' }) => (
  <p id={id} role="alert" className={`mt-1.5 flex items-start gap-1.5 text-[13px] font-medium leading-snug text-rose-700 ${className}`}>
    <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </p>
);

export const Field: React.FC<FieldProps> = ({ label, htmlFor, hint, error, required, optional, className = '', children }) => {
  const helpId = `${htmlFor}-help`;
  const hasHelp = !!error || !!hint;
  // Wire the control to its label/help text and mark it invalid, when the child is a plain control.
  let control = children;
  if (React.isValidElement(children) && typeof children.type === 'string' && CONTROL_TAGS.has(children.type)) {
    const props = children.props as { 'aria-describedby'?: string };
    control = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      'aria-invalid': error ? true : undefined,
      'aria-required': required || undefined,
      'aria-describedby': [props['aria-describedby'], hasHelp ? helpId : null].filter(Boolean).join(' ') || undefined,
    });
  }
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
        {required && (
          <span className="ml-0.5 text-rose-600" aria-hidden="true">
            *
          </span>
        )}
        {optional && <span className="font-normal text-ink-muted"> (optional)</span>}
      </label>
      {control}
      {error ? (
        <FieldError id={helpId}>{error}</FieldError>
      ) : hint ? (
        <p id={helpId} className={hintClass}>
          {hint}
        </p>
      ) : null}
    </div>
  );
};

/**
 * After a failed save: scrolls the first invalid control of the form into view (inside the dialog
 * body, without moving the page behind) and focuses it. Field marks controls with aria-invalid.
 */
export const focusFirstInvalid = (formId: string) => {
  requestAnimationFrame(() => {
    const form = document.getElementById(formId);
    const el = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!el) return;
    let box: HTMLElement | null = el.parentElement;
    while (box && box !== document.body) {
      const { overflowY } = getComputedStyle(box);
      if (/(auto|scroll)/.test(overflowY) && box.scrollHeight > box.clientHeight + 1) break;
      box = box.parentElement;
    }
    if (box && box !== document.body) {
      const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
      box.scrollTo({ top: Math.max(0, top - box.clientHeight / 3) });
    }
    el.focus({ preventScroll: true });
  });
};

/** Top-of-form summary after a failed save. */
export const FixFieldsNotice: React.FC<{ count: number }> = ({ count }) =>
  count > 0 ? (
    <Notice tone="error">
      {count === 1 ? 'Please fix the highlighted field.' : `Please fix the ${count} highlighted fields.`}
    </Notice>
  ) : null;

/** Save failed on the server: the form keeps what was typed. */
export const SaveFailedNotice: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <Notice tone="error">
      <span className="font-semibold">Not saved.</span> {message} Your changes are still here, so you can try again.
    </Notice>
  ) : null;

// ---------- Form sections ----------

/** A titled group inside a long form (e.g. "Photos", "Details", "On the website"). */
export const FormSection: React.FC<{
  title: string;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, description, className = '', children }) => {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`space-y-4 ${className}`}>
      <div className="border-b border-line pb-2">
        <h3 id={id} className="text-[16px] font-semibold leading-snug text-ink">
          {title}
        </h3>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
};

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
    <div className={hideLabel ? 'inline-flex' : 'flex items-center justify-between gap-4 py-3'}>
      <div className={hideLabel ? 'sr-only' : 'min-w-0'}>
        <span id={`${id}-label`} className="block text-[14px] font-medium leading-snug text-ink">
          {label}
        </span>
        {description && (
          <span id={`${id}-desc`} className="mt-0.5 block text-[13px] leading-snug text-ink-muted">
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`group shrink-0 inline-flex items-center justify-end gap-2.5 min-h-[44px] min-w-[44px] px-1 rounded-xl disabled:opacity-50 disabled:cursor-wait ${focusRing}`}
      >
        {(onLabel || offLabel) && (
          <span className={`text-[13px] font-semibold ${checked ? 'text-emerald-700' : 'text-ink-muted'}`}>
            {checked ? onLabel : offLabel}
          </span>
        )}
        <span
          aria-hidden="true"
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 ${
            checked ? 'bg-emerald-600' : 'bg-slate-300 group-hover:bg-slate-400/80'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out motion-reduce:transition-none ${
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
  const panelRef = useRef<HTMLDivElement>(null);
  // Latest props for the key handler, so it doesn't need re-binding on every render.
  const live = useRef({ onClose, busy, closeOnEscape });
  live.current = { onClose, busy, closeOnEscape };
  // Remember what had focus *before* the dialog rendered (an autoFocus button inside would
  // otherwise already have taken it by the time effects run).
  const restoreFocus = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current && typeof document !== 'undefined') {
    restoreFocus.current = document.activeElement as HTMLElement | null;
  }
  wasOpen.current = open;

  useEffect(() => {
    if (!open) return;
    const previousFocus = restoreFocus.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog (unless a control inside already took it, e.g. autoFocus).
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (e.key === 'Escape') {
        if (live.current.closeOnEscape && !live.current.busy) live.current.onClose();
        return;
      }
      // Keep Tab inside this dialog while focus is in it.
      if (e.key !== 'Tab' || !panel.contains(document.activeElement)) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.tabIndex !== -1 && el.getClientRects().length > 0);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      // Give focus back to whatever opened the dialog (e.g. the row's Edit button).
      if (previousFocus && previousFocus !== document.body && document.contains(previousFocus)) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const width = size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg';

  // Rendered into <body>: the app header uses backdrop-blur, which would otherwise trap a fixed
  // overlay below it (the header stayed undimmed above the dialog).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60">
      <div
        ref={panelRef}
        tabIndex={-1}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-white w-full ${width} rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-0.75rem)] sm:max-h-[calc(100dvh-2rem)] outline-none motion-safe:animate-fadeIn`}
      >
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-4 pb-3 border-b border-line shrink-0">
          <div className="min-w-0 pt-1">
            <h2 id={titleId} className="font-display tracking-[0.01em] text-[22px] sm:text-[24px] leading-tight font-bold text-ink break-words">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-ink-muted break-words">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className={`shrink-0 w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-xl text-ink-muted transition-colors duration-150 hover:bg-paper hover:text-ink disabled:opacity-40 ${focusRing}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 sm:px-6 py-5 overflow-y-auto overscroll-contain flex-1 min-h-0">{children}</div>
        {footer && (
          // Always-visible save bar: Cancel + the main action, 44px tall, side by side on phones too.
          <div className="flex items-center justify-end gap-2 px-5 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-line bg-white rounded-b-none sm:rounded-b-2xl shrink-0 [&>*]:min-h-[44px] max-sm:[&>button]:flex-1">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
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
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy} autoFocus className="min-h-[44px] sm:px-5">
          Cancel
        </Button>
        <Button
          type="button"
          variant={danger ? 'danger' : 'primary'}
          onClick={onConfirm}
          isLoading={busy}
          className="min-h-[44px] sm:px-5"
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="text-[15px] text-ink-soft leading-relaxed">{message}</div>
  </Modal>
);

// ---------- Notices ----------

const NOTICE_TONES = {
  error: { box: 'bg-rose-50 border-rose-200 text-rose-800', icon: AlertCircle },
  warning: { box: 'bg-amber-50 border-amber-200 text-amber-900', icon: AlertTriangle },
  info: { box: 'bg-paper border-line text-ink', icon: Info },
  success: { box: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: CheckCircle2 },
} as const;

/** One-line message box: save failures, "refresh failed", "unsaved changes", helpful facts. */
export const Notice: React.FC<{
  tone?: keyof typeof NOTICE_TONES;
  children: React.ReactNode;
  /** Optional button on the right, e.g. "Try again". */
  action?: React.ReactNode;
  className?: string;
  /** Hide the leading icon (e.g. for plain info summaries). */
  plain?: boolean;
}> = ({ tone = 'info', children, action, className = '', plain }) => {
  const t = NOTICE_TONES[tone];
  const Icon = t.icon;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3.5 py-2.5 text-[14px] leading-snug ${t.box} ${className}`}
    >
      <div className="flex min-w-0 flex-1 basis-56 items-start gap-2.5 py-0.5">
        {!plain && <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
        <div className="min-w-0">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

/** "Refresh failed" banner shown above a list that is still usable. */
export const RefreshFailed: React.FC<{ message: string; onRetry: () => void; retrying?: boolean }> = ({ message, onRetry, retrying }) => (
  <Notice
    tone="warning"
    action={
      <Button type="button" size="sm" variant="secondary" onClick={onRetry} isLoading={retrying} className="min-h-[40px]">
        Try again
      </Button>
    }
  >
    Couldn't refresh the list. {message}
  </Notice>
);

// ---------- Stat tiles ----------

const STAT_TONES = {
  default: 'text-ink',
  good: 'text-emerald-700',
  warn: 'text-amber-700',
  bad: 'text-rose-700',
  muted: 'text-ink-muted',
} as const;

export const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  tone?: keyof typeof STAT_TONES;
  /** Small text after the number, e.g. "/ 64". */
  suffix?: React.ReactNode;
}> = ({ label, value, tone = 'default', suffix }) => (
  <div className={`${cardClass} px-4 py-3`}>
    <p className="text-[13px] leading-tight text-ink-muted">{label}</p>
    <p className={`mt-1.5 font-display text-[28px] leading-none font-semibold tabular-nums ${STAT_TONES[tone]}`}>
      {value}
      {suffix && <span className="ml-1 text-[18px] font-semibold text-ink-muted">{suffix}</span>}
    </p>
  </div>
);

export const StatGrid: React.FC<{ children: React.ReactNode; label?: string }> = ({ children, label = 'Summary' }) => (
  <div role="group" aria-label={label} className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
    {children}
  </div>
);

// ---------- Search ----------

export const SearchField: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}> = ({ id, label, value, onChange, placeholder }) => (
  <div className="relative">
    <label htmlFor={id} className="sr-only">
      {label}
    </label>
    <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
    <input
      id={id}
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      className={`${inputClass} pl-10 pr-11 [&::-webkit-search-cancel-button]:hidden`}
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear search"
        className={`absolute right-0.5 top-1/2 -translate-y-1/2 w-11 h-11 inline-flex items-center justify-center rounded-xl text-ink-muted hover:text-ink ${focusRing}`}
      >
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);

// ---------- States ----------

export const ErrorState: React.FC<{ title?: string; message: string; onRetry: () => void; retrying?: boolean }> = ({
  title = "Couldn't load this section",
  message,
  onRetry,
  retrying,
}) => (
  <div className={`${cardClass} px-6 py-10 sm:py-12 text-center flex flex-col items-center`} role="alert">
    <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center">
      <AlertTriangle className="w-6 h-6 text-rose-600" aria-hidden="true" />
    </div>
    <h3 className="mt-4 text-[17px] font-semibold text-ink">{title}</h3>
    <p className="mt-1 text-[14px] leading-relaxed text-ink-muted max-w-sm break-words">{message}</p>
    <Button
      type="button"
      variant="secondary"
      className="mt-5 min-h-[44px] px-5"
      onClick={onRetry}
      isLoading={retrying}
      leftIcon={<RefreshCw className="w-4 h-4" />}
    >
      Try again
    </Button>
  </div>
);

/** Shown when a search / filter hides every item. */
export const NoMatches: React.FC<{ title: string; onClear: () => void; clearLabel?: string; hint?: string }> = ({
  title,
  onClear,
  clearLabel = 'Clear search & filters',
  hint = 'Try a different search or filter.',
}) => (
  <div className={`${cardClass} px-6 py-10 text-center`} role="status">
    <p className="text-[16px] font-semibold text-ink">{title}</p>
    {hint && <p className="mt-1 text-[14px] text-ink-muted">{hint}</p>}
    <Button type="button" variant="secondary" className="mt-4 min-h-[44px] px-5" onClick={onClear}>
      {clearLabel}
    </Button>
  </div>
);

export const ListSkeleton: React.FC<{ rows?: number; withImage?: boolean }> = ({ rows = 3, withImage = true }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className={`${cardClass} p-4 flex gap-4 motion-safe:animate-pulse`}>
        {withImage && <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-paper-deep shrink-0" />}
        <div className="flex-1 space-y-3 py-1">
          <div className="h-4 bg-paper-deep rounded w-1/2" />
          <div className="h-3 bg-paper rounded w-3/4" />
          <div className="h-3 bg-paper rounded w-1/3" />
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
    // Wraps instead of scrolling sideways, so every filter is visible on a phone.
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={`shrink-0 inline-flex items-center gap-2 min-h-[44px] sm:min-h-[40px] pl-3.5 pr-3 rounded-full text-[14px] font-medium border transition-colors duration-150 ${focusRing} ${
              active ? 'bg-ink text-white border-ink' : 'bg-white text-ink-soft border-line hover:border-ink/30 hover:text-ink'
            }`}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={`text-[12px] leading-none min-w-[22px] text-center px-1.5 py-1 rounded-full font-semibold tabular-nums ${
                  active
                    ? 'bg-accent text-ink'
                    : opt.highlight && opt.count > 0
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-paper-deep text-ink-soft'
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

/** Section header used at the top of each manager: title, one or two lines of context, the main action. */
export const SectionHeader: React.FC<{ title: string; description: React.ReactNode; actions?: React.ReactNode }> = ({
  title,
  description,
  actions,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-x-6 gap-y-3">
    <div className="min-w-0">
      <h3 className="font-display tracking-[0.01em] text-[24px] sm:text-[26px] leading-tight font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-muted max-w-2xl text-pretty">{description}</p>
    </div>
    {actions && <div className="flex flex-wrap gap-2 shrink-0 [&>button]:min-h-[44px]">{actions}</div>}
  </div>
);
