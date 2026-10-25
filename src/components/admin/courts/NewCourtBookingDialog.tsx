/**
 * Admin books a court for a customer who phoned or walked in. Pays at the venue.
 * The start-time list comes from the server's availability for that court & date; the price shown
 * before saving is a preview (from the server's slot prices, or the venue's pricing rules), and the
 * server's price is shown once the booking is created.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { courtService } from '../../../services/courtService';
import { customerService, CustomerSummary } from '../../../services/customerService';
import type { CourtBooking, CourtVenue, VenueAvailability } from '../../../types/courts';
import { MobileInput } from '../../common/MobileInput';
import { formatINR } from '../../../utils/format';
import { formatMobile, normalizeMobile, INVALID_MOBILE_MESSAGE } from '../../../utils/phone';
import {
  Portal,
  durationMin,
  errText,
  estimateSlotPrice,
  fieldErrCls,
  fmtRange,
  fmtTime,
  formatDayLabel,
  hoursText,
  inputCls,
  labelCls,
  todayIso,
  useBodyScrollLock,
  venueSlots,
} from './shared';

export interface CourtBookingPrefill {
  venueId?: string;
  courtId?: string;
  date?: string;
  startTime?: string;
}

const sectionCls = 'p-4 rounded-2xl border border-line space-y-3';
const sectionTitle = 'text-[11px] font-bold text-slate-500 uppercase tracking-wider';

interface SlotOption {
  start: string;
  end: string;
  state: 'free' | 'booked' | 'blocked' | 'past' | 'unknown';
  price: number | null;
}

export const NewCourtBookingDialog: React.FC<{
  venues: CourtVenue[];
  prefill: CourtBookingPrefill;
  onClose: () => void;
  onCreated: (b: CourtBooking) => void;
  onOpenBooking: (b: CourtBooking) => void;
}> = ({ venues, prefill, onClose, onCreated, onOpenBooking }) => {
  const usable = venues.filter((v) => v.isActive || v.id === prefill.venueId);
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [venueId, setVenueId] = useState(prefill.venueId || usable[0]?.id || '');
  const venue = venues.find((v) => v.id === venueId) || null;
  const courts = (venue?.courts || []).filter((c) => c.isActive || c.id === prefill.courtId);
  const [courtId, setCourtId] = useState(prefill.courtId || courts[0]?.id || '');
  const [date, setDate] = useState(prefill.date || todayIso());
  const [startTime, setStartTime] = useState(prefill.startTime || '');
  const [slots, setSlots] = useState(1);
  const [players, setPlayers] = useState('');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<CourtBooking | null>(null);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [avail, setAvail] = useState<VenueAvailability | null>(null);
  const [availError, setAvailError] = useState<string | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  useBodyScrollLock();

  useEffect(() => {
    customerService.listCustomers().then((l) => setCustomers(Array.isArray(l) ? l : [])).catch(() => setCustomers([]));
  }, []);

  // Escape closes (unless saving).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [submitting, onClose]);

  // Keep the court valid for the chosen venue.
  useEffect(() => {
    if (!venue) return;
    if (!courts.some((c) => c.id === courtId)) setCourtId(courts[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  // Availability for the venue & date.
  useEffect(() => {
    if (!venueId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setAvail(null);
      return;
    }
    let cancelled = false;
    setAvailLoading(true);
    setAvailError(null);
    courtService
      .getAvailability(venueId, date)
      .then((a) => {
        if (!cancelled) setAvail(a && Array.isArray(a.courts) ? a : null);
      })
      .catch((err) => {
        if (!cancelled) {
          setAvail(null);
          setAvailError(errText(err, 'Could not check which times are free.'));
        }
      })
      .finally(() => {
        if (!cancelled) setAvailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [venueId, date]);

  const normalized = normalizeMobile(mobile);
  const matched = useMemo(() => (normalized ? customers.find((c) => c.phone === normalized) : undefined), [customers, normalized]);
  useEffect(() => {
    if (matched && !nameEdited) setName(matched.name);
  }, [matched, nameEdited]);

  const options: SlotOption[] = useMemo(() => {
    if (!venue) return [];
    const cells = avail?.courts.find((c) => c.courtId === courtId)?.cells;
    if (cells && cells.length) return cells.map((c) => ({ start: c.start, end: c.end, state: c.state, price: c.price }));
    return venueSlots(venue).map((r) => ({ ...r, state: 'unknown' as const, price: null }));
  }, [venue, avail, courtId]);

  const startIdx = options.findIndex((o) => o.start === startTime);
  const maxSlots = Math.max(1, venue?.maxSlotsPerBooking || 1);
  /** Consecutive free (or unknown) slots from the chosen start, capped at maxSlotsPerBooking. */
  const runFree = useMemo(() => {
    if (startIdx < 0) return 0;
    let n = 0;
    for (let i = startIdx; i < options.length && n < maxSlots; i++) {
      const s = options[i].state;
      if (s !== 'free' && s !== 'unknown') break;
      n++;
    }
    return n;
  }, [options, startIdx, maxSlots]);

  // Default the start time to the first free slot; keep the slot count within what's free.
  useEffect(() => {
    if (!options.length) return;
    const cur = options.find((o) => o.start === startTime);
    if (cur && (cur.state === 'free' || cur.state === 'unknown')) return;
    const first = options.find((o) => o.state === 'free' || o.state === 'unknown');
    setStartTime(first ? first.start : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);
  useEffect(() => {
    if (runFree > 0 && slots > runFree) setSlots(runFree);
  }, [runFree, slots]);

  const chosen = startIdx >= 0 ? options.slice(startIdx, startIdx + slots) : [];
  const endTime = chosen.length ? chosen[chosen.length - 1].end : '';
  const pricePreview =
    venue && chosen.length
      ? chosen.reduce((acc, o) => acc + (o.price != null ? o.price : estimateSlotPrice(venue, date, o.start)), 0)
      : null;
  const priceFromServer = chosen.length > 0 && chosen.every((o) => o.price != null);

  const playersNum = players.trim() === '' ? null : Number(players);
  const errors: Record<string, string> = {};
  if (!normalized) errors.mobile = INVALID_MOBILE_MESSAGE;
  if (name.trim().length < 2) errors.name = "Enter the customer's name.";
  if (!venue) errors.venue = 'Choose a venue.';
  if (!courtId) errors.court = 'Choose a court.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = 'Choose a date.';
  if (startIdx < 0) errors.start = 'Choose a start time.';
  else if (runFree === 0) errors.start = 'That time is not free on this court.';
  if (playersNum !== null && (!Number.isInteger(playersNum) || playersNum < 1 || playersNum > 12)) errors.players = 'Players: 1–12.';
  const err = (k: string) => (touched && errors[k] ? <p className={fieldErrCls}>{errors[k]}</p> : null);
  const bad = (k: string) => (touched && errors[k] ? '!border-rose-400' : '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length || submitting || !venue) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const b = await courtService.book({
        venueId: venue.id,
        courtId,
        date,
        startTime,
        slots,
        players: playersNum ?? undefined,
        notes: notes.trim() || undefined,
        customerName: name.trim(),
        customerMobile: normalized!,
      });
      setCreated(b);
      onCreated(b);
    } catch (err2) {
      setSubmitError(errText(err2, 'The booking could not be saved. Please try again.'));
      // Someone may have taken the slot: refresh what's free.
      courtService
        .getAvailability(venue.id, date)
        .then((a) => setAvail(a && Array.isArray(a.courts) ? a : null))
        .catch(() => undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const stateLabel = (o: SlotOption) =>
    o.state === 'booked' ? ' — booked' : o.state === 'blocked' ? ' — blocked' : o.state === 'past' ? ' — past' : '';

  return (
    <Portal>
      <div
        onClick={() => !submitting && onClose()}
        className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in"
      >
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="court-new-title"
          noValidate
          onSubmit={submit}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl my-auto flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] animate-in zoom-in-95"
        >
          <div className="flex justify-between items-start gap-3 p-4 sm:p-5 border-b border-line/70 shrink-0">
            <div className="min-w-0">
              <h3 id="court-new-title" className="text-lg font-bold text-slate-900">
                {created ? 'Court booked' : 'New court booking'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">For a customer who called or walked in. They pay at the venue (cash / UPI).</p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              disabled={submitting}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {created ? (
            <>
              <div className="overflow-y-auto p-4 sm:p-5 space-y-3 text-sm">
                <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">
                      <span className="font-mono">{created.id}</span> · {created.customerName}
                    </p>
                    <p className="text-slate-700 text-xs mt-0.5">
                      {created.courtName} · {formatDayLabel(created.date)} · {fmtRange(created.startTime, created.endTime)} (
                      {hoursText(durationMin(created))})
                    </p>
                    <p className="text-slate-700 text-xs">{formatMobile(created.customerMobile)}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-[1fr,auto] gap-x-3 gap-y-1 p-3 border border-line rounded-xl text-xs">
                  <dt className="font-bold text-slate-900 text-sm">Price (from the server)</dt>
                  <dd className="text-right font-bold text-slate-900 text-sm">{formatINR(created.price)}</dd>
                  <dt className="text-slate-500">Payment</dt>
                  <dd className="text-right font-semibold text-amber-700">Unpaid · pay at venue</dd>
                </dl>
                {pricePreview !== null && Math.abs(pricePreview - created.price) > 0.005 && (
                  <p className="text-[11px] text-slate-500">The preview was {formatINR(pricePreview)}; the server's price applies.</p>
                )}
              </div>
              <div className="shrink-0 border-t border-line/70 p-3 sm:p-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => onOpenBooking(created)}
                  className="flex-1 min-h-[44px] rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-paper"
                >
                  Open booking
                </button>
                <button type="button" onClick={onClose} className="flex-1 min-h-[44px] rounded-xl bg-ink hover:bg-ink-hover text-white text-sm font-bold">
                  Done
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="overflow-y-auto p-4 sm:p-5 space-y-4 text-sm">
                <div className={sectionCls}>
                  <p className={sectionTitle}>Customer</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="cb-mobile" className={labelCls}>
                        Mobile number
                      </label>
                      <MobileInput id="cb-mobile" value={mobile} onChange={setMobile} required aria-invalid={touched && !!errors.mobile} />
                      {err('mobile')}
                      {matched ? (
                        <p className="text-[11px] text-emerald-700 mt-1">Existing customer · {matched.name}</p>
                      ) : normalized ? (
                        <p className="text-[11px] text-slate-500 mt-1">New customer — {formatMobile(normalized)}.</p>
                      ) : null}
                    </div>
                    <div>
                      <label htmlFor="cb-name" className={labelCls}>
                        Name
                      </label>
                      <input
                        id="cb-name"
                        type="text"
                        maxLength={80}
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setNameEdited(true);
                        }}
                        className={`${inputCls} ${bad('name')}`}
                      />
                      {err('name')}
                    </div>
                  </div>
                </div>

                <div className={sectionCls}>
                  <p className={sectionTitle}>Court & time</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {usable.length > 1 && (
                      <div className="sm:col-span-2">
                        <label htmlFor="cb-venue" className={labelCls}>
                          Venue
                        </label>
                        <select id="cb-venue" value={venueId} onChange={(e) => setVenueId(e.target.value)} className={`${inputCls} ${bad('venue')}`}>
                          {usable.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                        {err('venue')}
                      </div>
                    )}
                    <div>
                      <label htmlFor="cb-court" className={labelCls}>
                        Court
                      </label>
                      <select id="cb-court" value={courtId} onChange={(e) => setCourtId(e.target.value)} className={`${inputCls} ${bad('court')}`}>
                        {courts.length === 0 && <option value="">No courts set up</option>}
                        {courts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.surface ? ` · ${c.surface}` : ''}
                          </option>
                        ))}
                      </select>
                      {err('court')}
                    </div>
                    <div>
                      <label htmlFor="cb-date" className={labelCls}>
                        Date
                      </label>
                      <input id="cb-date" type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} className={`${inputCls} ${bad('date')}`} />
                      {err('date')}
                    </div>
                    <div>
                      <label htmlFor="cb-start" className={labelCls}>
                        Start time {availLoading && <span className="font-normal text-slate-400">· checking…</span>}
                      </label>
                      <select id="cb-start" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${inputCls} ${bad('start')}`}>
                        {startIdx < 0 && <option value="">Choose…</option>}
                        {options.map((o) => (
                          <option key={o.start} value={o.start} disabled={o.state !== 'free' && o.state !== 'unknown'}>
                            {fmtTime(o.start)}
                            {stateLabel(o)}
                          </option>
                        ))}
                      </select>
                      {err('start')}
                    </div>
                    <div>
                      <label htmlFor="cb-slots" className={labelCls}>
                        Length
                      </label>
                      <select id="cb-slots" value={slots} onChange={(e) => setSlots(Number(e.target.value))} className={inputCls} disabled={runFree === 0}>
                        {Array.from({ length: Math.max(1, runFree) }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n} {n === 1 ? 'slot' : 'slots'} · {hoursText(n * (venue?.slotMinutes || 60))}
                          </option>
                        ))}
                      </select>
                      {runFree > 0 && runFree < maxSlots && (
                        <p className="text-[11px] text-slate-500 mt-1">The court is taken after {fmtTime(options[startIdx + runFree - 1]?.end)}.</p>
                      )}
                    </div>
                  </div>
                  {availError && (
                    <p className="text-[11px] text-amber-700 flex items-start gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {availError} The server checks again when you save.
                    </p>
                  )}
                  {avail && avail.bookable === false && avail.message && (
                    <p className="text-[11px] text-amber-700 flex items-start gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {avail.message}
                    </p>
                  )}
                </div>

                <div className={sectionCls}>
                  <p className={sectionTitle}>Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-[8rem,1fr] gap-3">
                    <div>
                      <label htmlFor="cb-players" className={labelCls}>
                        Players (optional)
                      </label>
                      <input
                        id="cb-players"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={12}
                        value={players}
                        onChange={(e) => setPlayers(e.target.value)}
                        className={`${inputCls} ${bad('players')}`}
                        placeholder="4"
                      />
                      {err('players')}
                    </div>
                    <div>
                      <label htmlFor="cb-notes" className={labelCls}>
                        Note (optional)
                      </label>
                      <input
                        id="cb-notes"
                        type="text"
                        maxLength={300}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className={inputCls}
                        placeholder="e.g. Needs shuttles, paying by UPI"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-line/70 p-3 sm:p-4 space-y-2">
                {chosen.length > 0 && pricePreview !== null && (
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-600 min-w-0">
                      {fmtRange(startTime, endTime)} · {hoursText(chosen.length * (venue?.slotMinutes || 60))}
                    </span>
                    <span className="text-right shrink-0">
                      <span className="font-bold text-slate-900 text-sm">{formatINR(pricePreview)}</span>
                      <span className="block text-[10px] text-slate-500">
                        {priceFromServer ? 'Server slot prices' : 'Estimate from the venue prices'} · final price on save
                      </span>
                    </span>
                  </div>
                )}
                {submitError && (
                  <div role="alert" className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}
                {touched && Object.keys(errors).length > 0 && !submitError && <p className="text-xs text-rose-700">Please fix the highlighted fields.</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="flex-1 min-h-[44px] rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-paper disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-[2] min-h-[44px] rounded-xl bg-ink hover:bg-ink-hover text-white text-sm font-bold disabled:opacity-60"
                  >
                    {submitting ? 'Booking…' : 'Book court'}
                  </button>
                </div>
              </div>
            </>
          )}
        </form>
      </div>
    </Portal>
  );
};

