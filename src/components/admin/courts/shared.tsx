/**
 * Admin → Courts: shared helpers (dates & times, pricing preview, blocked-time matching,
 * status pills, dialogs) and the "today" hook used by the sidebar badge and the dashboard card.
 *
 * Times are local India time "HH:MM"; dates are "YYYY-MM-DD". The server has the final say on
 * availability and prices — everything computed here is a preview.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Phone } from 'lucide-react';
import { courtService } from '../../../services/courtService';
import type { CourtBlock, CourtBooking, CourtBookingStatus, CourtVenue } from '../../../types/courts';
import { Button } from '../../common/Button';
import { parseDate } from '../../../utils/format';
import { formatMobile, mobileTelHref } from '../../../utils/phone';

// ---------------------------------------------------------------------------
// Styles (same tokens as the rest of the admin console)
// ---------------------------------------------------------------------------
export const inputCls =
  'w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-ink/40 bg-white disabled:bg-paper disabled:text-slate-500';
export const labelCls = 'block text-xs font-bold text-slate-700 mb-1';
export const cardCls = 'bg-white rounded-2xl border border-line shadow-xs';
export const sectionLabel = 'font-bold text-slate-500 uppercase tracking-wider text-[10px]';
export const fieldErrCls = 'text-[11px] text-rose-700 mt-1 font-medium';

export const HATCH_STYLE: React.CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(135deg, #EDEAE2 0 6px, #F6F4EF 6px 12px)',
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export const errText = (err: unknown, fallback: string) => {
  const m = (err as { message?: unknown })?.message;
  return typeof m === 'string' && m.trim() ? m : fallback;
};
export const errStatus = (err: unknown): number | undefined => (err as { status?: number })?.status;

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => isoDate(new Date());
export const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
};
const isoToDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
/** 0 = Monday … 6 = Sunday (the backend's weekday numbering). */
export const weekdayIndex = (iso: string) => (isoToDate(iso).getDay() + 6) % 7;
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Sun, 25 Oct 2026" */
export const formatDayLabel = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso || '—';
  const d = isoToDate(iso);
  return `${WEEKDAYS[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
/** "25 Oct" */
export const formatShortDay = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso || '—';
  const d = isoToDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
export const isWeekend = (iso: string) => weekdayIndex(iso) >= 5;

// ---------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------
export const toMin = (t: string | null | undefined): number => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
export const fromMin = (n: number) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
/** "18:00" -> "6:00 PM" */
export const fmtTime = (t: string | null | undefined) => {
  const n = toMin(t);
  if (!Number.isFinite(n)) return t || '—';
  const h = Math.floor(n / 60) % 24;
  const m = n % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};
export const fmtRange = (a: string, b: string) => `${fmtTime(a)} – ${fmtTime(b)}`;
export const hoursText = (mins: number) => {
  const h = Math.round((mins / 60) * 10) / 10;
  return `${h} ${h === 1 ? 'hr' : 'hrs'}`;
};
export const durationMin = (b: Pick<CourtBooking, 'startTime' | 'endTime'>) => {
  const d = toMin(b.endTime) - toMin(b.startTime);
  return Number.isFinite(d) && d > 0 ? d : 0;
};

export interface SlotRow {
  start: string;
  end: string;
}

/** Slots of a day from the venue hours (used when the server's availability is not available). */
export const venueSlots = (v: Pick<CourtVenue, 'openTime' | 'closeTime' | 'slotMinutes'>): SlotRow[] => {
  const open = toMin(v.openTime);
  const close = toMin(v.closeTime);
  const step = v.slotMinutes === 30 ? 30 : 60;
  if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open) return [];
  const rows: SlotRow[] = [];
  for (let t = open; t + step <= close; t += step) rows.push({ start: fromMin(t), end: fromMin(t + step) });
  return rows;
};

/** Boundaries open … close in slot steps ("06:00", "07:00", …, "22:00"). */
export const venueBoundaries = (v: Pick<CourtVenue, 'openTime' | 'closeTime' | 'slotMinutes'>): string[] => {
  const rows = venueSlots(v);
  return rows.length ? [...rows.map((r) => r.start), rows[rows.length - 1].end] : [];
};

const startOf = (b: Pick<CourtBooking, 'date' | 'startTime'>) => parseDate(`${b.date} ${b.startTime}`);
const endOf = (b: Pick<CourtBooking, 'date' | 'endTime'>) => parseDate(`${b.date} ${b.endTime}`);
export const hasStarted = (b: Pick<CourtBooking, 'date' | 'startTime'>, now = Date.now()) => {
  const s = startOf(b);
  return !!s && s.getTime() <= now;
};
export const hasEnded = (b: Pick<CourtBooking, 'date' | 'endTime'>, now = Date.now()) => {
  const e = endOf(b);
  return !!e && e.getTime() <= now;
};
export const bookingSortKey = (b: CourtBooking) => `${b.date} ${b.startTime} ${b.courtName}`;

// ---------------------------------------------------------------------------
// Pricing preview (mirrors the documented rules; the server decides)
// ---------------------------------------------------------------------------
export const hourlyRate = (v: CourtVenue, dateIso: string, start: string): number => {
  if (v.weekendPricePerHour != null && v.weekendPricePerHour > 0 && isWeekend(dateIso)) return v.weekendPricePerHour;
  if (v.peakPricePerHour != null && v.peakPricePerHour > 0 && v.peakStart && v.peakEnd) {
    const t = toMin(start);
    if (t >= toMin(v.peakStart) && t < toMin(v.peakEnd)) return v.peakPricePerHour;
  }
  return v.pricePerHour || 0;
};
export const estimateSlotPrice = (v: CourtVenue, dateIso: string, start: string) =>
  Math.round(hourlyRate(v, dateIso, start) * ((v.slotMinutes === 30 ? 30 : 60) / 60) * 100) / 100;

// ---------------------------------------------------------------------------
// Blocked times
// ---------------------------------------------------------------------------
export const isWeeklyBlock = (b: CourtBlock) => !b.date && Array.isArray(b.weekdays) && b.weekdays.length > 0;

export const blockAppliesOn = (b: CourtBlock, dateIso: string) => {
  if (b.date) return b.date === dateIso;
  if (!isWeeklyBlock(b)) return false;
  if (b.fromDate && dateIso < b.fromDate) return false;
  if (b.toDate && dateIso > b.toDate) return false;
  return (b.weekdays || []).includes(weekdayIndex(dateIso));
};

/** The block (if any) that covers this court & slot on that date. */
export const blockFor = (blocks: CourtBlock[], dateIso: string, courtId: string, start: string, end: string) => {
  const s = toMin(start);
  const e = toMin(end);
  return blocks.find(
    (b) =>
      (!b.courtId || b.courtId === courtId) &&
      blockAppliesOn(b, dateIso) &&
      toMin(b.startTime) < e &&
      toMin(b.endTime) > s
  );
};

export const describeBlockDays = (b: CourtBlock) => {
  if (b.date) return formatDayLabel(b.date);
  const days = [...(b.weekdays || [])].sort((x, y) => x - y);
  const dayText =
    days.length === 7 ? 'Every day' : days.join(',') === '0,1,2,3,4' ? 'Mon–Fri' : days.join(',') === '5,6' ? 'Sat & Sun' : days.map((d) => WEEKDAYS[d]).join(', ');
  const range = b.toDate
    ? `${formatShortDay(b.fromDate || '')} – ${formatDayLabel(b.toDate)}`
    : b.fromDate
      ? `from ${formatDayLabel(b.fromDate)}`
      : '';
  return `${dayText}${range ? ` · ${range}` : ''}`;
};

/** A block whose last day is before today. */
export const blockIsOver = (b: CourtBlock, today = todayIso()) => (b.date ? b.date < today : !!b.toDate && b.toDate < today);

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------
export const BOOKING_STATUSES: CourtBookingStatus[] = ['Confirmed', 'Completed', 'No-show', 'Cancelled'];

const STATUS_STYLE: Record<CourtBookingStatus, { pill: string; dot: string }> = {
  Confirmed: { pill: 'bg-paper text-ink border-line', dot: 'bg-ink' },
  Completed: { pill: 'bg-emerald-50 text-emerald-800 border-emerald-300', dot: 'bg-emerald-600' },
  'No-show': { pill: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  Cancelled: { pill: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
};

export const CourtStatusPill: React.FC<{ status: CourtBookingStatus | string }> = ({ status }) => {
  const s = STATUS_STYLE[status as CourtBookingStatus] || { pill: 'bg-slate-100 text-slate-700 border-line', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border text-xs px-2 py-0.5 font-medium whitespace-nowrap ${s.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {status}
    </span>
  );
};

/** Still to be paid at the venue (Confirmed or Completed, not paid). */
export const isToCollect = (b: CourtBooking) => b.paymentStatus !== 'Paid' && (b.status === 'Confirmed' || b.status === 'Completed');

export const paymentText = (b: CourtBooking) => {
  if (b.paymentStatus === 'Paid') return b.paymentMethod ? `Paid · ${b.paymentMethod}` : 'Paid';
  if (b.status === 'Cancelled') return 'Not due';
  if (b.status === 'No-show') return 'Unpaid · no-show';
  return 'Unpaid · pay at venue';
};

export const paymentShort = (b: CourtBooking) =>
  b.paymentStatus === 'Paid' ? `Paid${b.paymentMethod ? ` · ${b.paymentMethod}` : ''}` : b.status === 'Cancelled' ? 'Not due' : 'Unpaid';

/** Bookings that count for the day (cancelled ones free the court). */
export const isActiveBooking = (b: CourtBooking) => b.status !== 'Cancelled';

export const dayTotals = (bookings: CourtBooking[]) => {
  const active = bookings.filter(isActiveBooking);
  return {
    count: active.length,
    minutes: active.reduce((acc, b) => acc + durationMin(b), 0),
    collected: active.filter((b) => b.paymentStatus === 'Paid').reduce((acc, b) => acc + (b.price || 0), 0),
    toCollect: active.filter(isToCollect).reduce((acc, b) => acc + (b.price || 0), 0),
    cancelled: bookings.length - active.length,
  };
};

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------
export const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  typeof document === 'undefined' ? null : createPortal(children, document.body);

export const TelLink: React.FC<{ phone: string; className?: string }> = ({ phone, className = '' }) => {
  const href = mobileTelHref(phone);
  return href ? (
    <a
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 text-ink font-semibold hover:underline whitespace-nowrap ${className}`}
    >
      <Phone className="w-3.5 h-3.5" /> {formatMobile(phone)}
    </a>
  ) : (
    <span className="text-slate-500">{formatMobile(phone) || '—'}</span>
  );
};

export const InlineError: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p role="alert" className={`text-[11px] text-rose-700 flex items-start gap-1 font-medium ${className}`}>
    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
    <span>{children}</span>
  </p>
);

export interface ConfirmState {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<unknown> | void;
}

/** Confirmation layer above any dialog (z-70). Waits for onConfirm, then closes. */
export const ConfirmLayer: React.FC<{ confirm: ConfirmState | null; onClose: () => void }> = ({ confirm, onClose }) => {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!confirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [confirm, busy, onClose]);
  if (!confirm) return null;
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await confirm.onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };
  return (
    <Portal>
      <div
        onClick={() => !busy && onClose()}
        className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in"
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="court-confirm-title"
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95"
        >
          <h3 id="court-confirm-title" className="font-bold text-base text-slate-900 flex items-start gap-2">
            {confirm.danger && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
            {confirm.title}
          </h3>
          <div className="text-sm text-slate-600">{confirm.message}</div>
          <div className="flex gap-2 pt-1">
            <Button onClick={onClose} variant="outline" className="flex-1 min-h-[40px]" size="sm" disabled={busy}>
              {confirm.cancelLabel || 'Keep it'}
            </Button>
            <Button
              onClick={run}
              isLoading={busy}
              variant="primary"
              size="sm"
              className={`flex-1 min-h-[40px] ${confirm.danger ? 'bg-rose-600 hover:bg-rose-700' : ''}`}
            >
              {confirm.confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

/** Locks page scroll while a dialog is open. */
export const useBodyScrollLock = () => {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
};

// ---------------------------------------------------------------------------
// Today's bookings (sidebar badge + dashboard card)
// ---------------------------------------------------------------------------
export interface CourtsTodayState {
  bookings: CourtBooking[];
  loaded: boolean;
  /** The server has no court bookings endpoint yet (404). */
  unavailable: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useCourtsToday(enabled = true, pollMs = 60_000): CourtsTodayState {
  const [bookings, setBookings] = useState<CourtBooking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    const today = todayIso();
    try {
      const list = await courtService.getBookings({ from: today, to: today });
      if (mine !== seq.current) return;
      setBookings(Array.isArray(list) ? list.filter((b) => b && b.date === today) : []);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (mine !== seq.current) return;
      setUnavailable(errStatus(err) === 404);
      setError(errText(err, 'Could not load the court bookings.'));
    } finally {
      if (mine === seq.current) setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    reload();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, pollMs);
    return () => window.clearInterval(t);
  }, [enabled, pollMs, reload]);

  return { bookings, loaded, unavailable, error, reload };
}

/** Today's figures from real bookings only. */
export const courtsTodaySummary = (bookings: CourtBooking[], now = Date.now()) => {
  const remaining = bookings
    .filter((b) => b.status === 'Confirmed' && !hasEnded(b, now))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const next = remaining.find((b) => !hasStarted(b, now)) || null;
  const playing = remaining.filter((b) => hasStarted(b, now));
  const unpaid = bookings.filter(isToCollect);
  return {
    remaining: remaining.length,
    next,
    playing: playing.length,
    unpaidCount: unpaid.length,
    unpaidTotal: unpaid.reduce((acc, b) => acc + (b.price || 0), 0),
  };
};
