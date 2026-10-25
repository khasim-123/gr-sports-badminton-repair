/**
 * Day view: one venue, one date. Columns = courts, rows = slots. Bookings span their slots,
 * blocked times are hatched with the reason, free slots open "New booking" prefilled.
 * Phones get a court selector and a list instead of the grid.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarPlus, ChevronLeft, ChevronRight, Lock, Plus, RefreshCw } from 'lucide-react';
import { courtService } from '../../../services/courtService';
import type { CourtBlock, CourtBooking, CourtVenue, VenueAvailability } from '../../../types/courts';
import { Button } from '../../common/Button';
import { formatINR } from '../../../utils/format';
import { formatMobile } from '../../../utils/phone';
import type { CourtBookingPrefill } from './NewCourtBookingDialog';
import {
  HATCH_STYLE,
  SlotRow,
  addDays,
  blockFor,
  cardCls,
  dayTotals,
  errText,
  fmtRange,
  fmtTime,
  formatDayLabel,
  hoursText,
  inputCls,
  isActiveBooking,
  paymentShort,
  toMin,
  todayIso,
  venueSlots,
} from './shared';

type CellState = 'free' | 'booked' | 'blocked' | 'past';

type ColumnItem =
  | { kind: 'booking'; row: number; span: number; booking: CourtBooking }
  | { kind: 'blocked'; row: number; span: number; start: string; end: string; reason: string }
  | { kind: 'taken'; row: number; span: number; start: string; end: string }
  | { kind: 'free' | 'past'; row: number; span: 1; start: string; end: string; price: number | null };

interface Column {
  id: string;
  name: string;
  surface?: string | null;
  items: ColumnItem[];
}

const BOOKING_TONE: Record<string, string> = {
  Confirmed: 'bg-ink text-white border-ink hover:bg-ink-hover',
  Completed: 'bg-emerald-50 text-emerald-950 border-emerald-300 hover:bg-emerald-100',
  'No-show': 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100',
};

const PayTag: React.FC<{ b: CourtBooking; dark?: boolean }> = ({ b, dark }) => (
  <span
    className={`inline-flex items-center rounded px-1 text-[10px] font-bold whitespace-nowrap ${
      b.paymentStatus === 'Paid'
        ? dark
          ? 'bg-emerald-400/20 text-emerald-200'
          : 'bg-emerald-100 text-emerald-800'
        : dark
          ? 'bg-accent text-ink'
          : 'bg-amber-100 text-amber-800'
    }`}
  >
    {paymentShort(b)}
  </span>
);

export const DayView: React.FC<{
  venues: CourtVenue[];
  venueId: string;
  onVenueChange: (id: string) => void;
  date: string;
  onDateChange: (d: string) => void;
  /** Bump to reload (after an action elsewhere). */
  version: number;
  onOpenBooking: (b: CourtBooking) => void;
  onNewBooking: (p: CourtBookingPrefill) => void;
}> = ({ venues, venueId, onVenueChange, date, onDateChange, version, onOpenBooking, onNewBooking }) => {
  const venue = venues.find((v) => v.id === venueId) || null;
  const [avail, setAvail] = useState<VenueAvailability | null>(null);
  const [availError, setAvailError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<CourtBooking[]>([]);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<CourtBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedKey, setLoadedKey] = useState('');
  const [phoneCourt, setPhoneCourt] = useState('');
  const [now, setNow] = useState(Date.now());
  const seq = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!venueId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const mine = ++seq.current;
    setLoading(true);
    const [a, b, k] = await Promise.allSettled([
      courtService.getAvailability(venueId, date),
      courtService.getBookings({ from: date, to: date, venueId }),
      courtService.listBlocks(venueId),
    ]);
    if (mine !== seq.current) return;
    if (a.status === 'fulfilled' && a.value && Array.isArray(a.value.courts)) {
      setAvail(a.value);
      setAvailError(null);
    } else {
      setAvail(null);
      setAvailError(a.status === 'rejected' ? errText(a.reason, 'Could not load the free / booked slots.') : null);
    }
    if (b.status === 'fulfilled') {
      setBookings((Array.isArray(b.value) ? b.value : []).filter((x) => x.date === date && x.venueId === venueId));
      setBookingsError(null);
    } else {
      setBookingsError(errText(b.reason, 'Could not load the bookings.'));
    }
    setBlocks(k.status === 'fulfilled' && Array.isArray(k.value) ? k.value : []);
    setNow(Date.now());
    setLoading(false);
    setLoadedKey(`${venueId}|${date}`);
  }, [venueId, date]);

  useEffect(() => {
    load();
  }, [load, version]);

  // Keep "past" shading and the free slots current while the page is open.
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  const rows: SlotRow[] = useMemo(() => {
    const cells = avail?.courts?.[0]?.cells;
    if (cells && cells.length) return cells.map((c) => ({ start: c.start, end: c.end }));
    return venue ? venueSlots(venue) : [];
  }, [avail, venue]);

  const columns: Column[] = useMemo(() => {
    if (!venue) return [];
    const base: { id: string; name: string; surface?: string | null }[] = avail
      ? avail.courts.map((c) => ({ id: c.courtId, name: c.courtName, surface: c.surface }))
      : [...venue.courts].filter((c) => c.isActive).sort((x, y) => x.sortOrder - y.sortOrder);
    const active = bookings.filter(isActiveBooking);
    active.forEach((b) => {
      if (!base.some((c) => c.id === b.courtId)) base.push({ id: b.courtId, name: b.courtName });
    });
    const isToday = date === todayIso();
    const past = date < todayIso();
    const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();

    return base.map((court) => {
      const cells = avail?.courts.find((c) => c.courtId === court.id)?.cells;
      const mine = active.filter((b) => b.courtId === court.id);
      const covered = new Array(rows.length).fill(false);
      const items: ColumnItem[] = [];
      mine.forEach((b) => {
        const s = toMin(b.startTime);
        const e = toMin(b.endTime);
        const idx = rows.map((r, i) => (toMin(r.start) >= s && toMin(r.start) < e ? i : -1)).filter((i) => i >= 0);
        if (!idx.length) return;
        idx.forEach((i) => (covered[i] = true));
        items.push({ kind: 'booking', row: idx[0], span: idx[idx.length - 1] - idx[0] + 1, booking: b });
      });
      const stateAt = (i: number): CellState => {
        const c = cells?.[i];
        if (c && c.start === rows[i].start) return c.state;
        if (blockFor(blocks, date, court.id, rows[i].start, rows[i].end)) return 'blocked';
        if (past || (isToday && toMin(rows[i].start) < nowMin)) return 'past';
        return 'free';
      };
      let i = 0;
      while (i < rows.length) {
        if (covered[i]) {
          i++;
          continue;
        }
        const st = stateAt(i);
        if (st === 'blocked') {
          const blk = blockFor(blocks, date, court.id, rows[i].start, rows[i].end);
          const reason = blk?.reason || 'Blocked';
          let j = i + 1;
          while (j < rows.length && !covered[j] && stateAt(j) === 'blocked') {
            const nb = blockFor(blocks, date, court.id, rows[j].start, rows[j].end);
            if ((nb?.reason || 'Blocked') !== reason) break;
            j++;
          }
          items.push({ kind: 'blocked', row: i, span: j - i, start: rows[i].start, end: rows[j - 1].end, reason });
          i = j;
        } else if (st === 'booked') {
          // Booked according to the server, but the booking isn't in the list (e.g. list failed to load).
          let j = i + 1;
          while (j < rows.length && !covered[j] && stateAt(j) === 'booked') j++;
          items.push({ kind: 'taken', row: i, span: j - i, start: rows[i].start, end: rows[j - 1].end });
          i = j;
        } else {
          items.push({ kind: st, row: i, span: 1, start: rows[i].start, end: rows[i].end, price: cells?.[i]?.price ?? null });
          i++;
        }
      }
      items.sort((x, y) => x.row - y.row);
      return { ...court, items };
    });
  }, [venue, avail, bookings, blocks, rows, date, now]);

  useEffect(() => {
    if (!columns.some((c) => c.id === phoneCourt)) setPhoneCourt(columns[0]?.id || '');
  }, [columns, phoneCourt]);

  const totals = dayTotals(bookings);
  const slotMinutes = venue?.slotMinutes === 30 ? 30 : 60;
  const rowH = slotMinutes === 30 ? 48 : 64;
  const firstLoad = loading && loadedKey !== `${venueId}|${date}`;
  const phoneColumn = columns.find((c) => c.id === phoneCourt) || null;

  // Today: scroll the grid so the current hour is near the top (once per venue & date).
  useEffect(() => {
    const el = gridRef.current;
    if (!el || !loadedKey || date !== todayIso() || !rows.length) return;
    const d = new Date();
    const nowMin = d.getHours() * 60 + d.getMinutes();
    const idx = rows.findIndex((r) => toMin(r.end) > nowMin);
    el.scrollTop = idx > 0 ? (idx - 1) * rowH : idx < 0 ? el.scrollHeight : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey]);

  const book = (courtId: string, start: string) => onNewBooking({ venueId, courtId, date, startTime: start });

  const controls = (
    <div className="bg-white p-3 rounded-2xl border border-line shadow-2xs flex flex-col md:flex-row md:items-center gap-2 md:justify-between">
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          type="button"
          onClick={() => onDateChange(addDays(date, -1))}
          aria-label="Previous day"
          className="w-10 h-10 shrink-0 rounded-xl border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-paper"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && onDateChange(e.target.value)}
          aria-label="Date"
          className={`${inputCls} !w-auto min-w-0 flex-1 md:flex-none font-semibold`}
        />
        <button
          type="button"
          onClick={() => onDateChange(addDays(date, 1))}
          aria-label="Next day"
          className="w-10 h-10 shrink-0 rounded-xl border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-paper"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onDateChange(todayIso())}
          disabled={date === todayIso()}
          className="min-h-[40px] px-3 shrink-0 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-paper disabled:opacity-50"
        >
          Today
        </button>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        {venues.length > 1 && (
          <select value={venueId} onChange={(e) => onVenueChange(e.target.value)} aria-label="Venue" className={`${inputCls} md:!w-56 min-w-0`}>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.isActive ? '' : ' (hidden)'}
              </option>
            ))}
          </select>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[40px] shrink-0"
          onClick={load}
          isLoading={loading && !firstLoad}
          leftIcon={<RefreshCw className="w-4 h-4" />}
          aria-label="Refresh"
        >
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="min-h-[40px] shrink-0"
          onClick={() => onNewBooking({ venueId, date, courtId: phoneCourt || undefined })}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New booking
        </Button>
      </div>
    </div>
  );

  const totalsRow = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { label: 'Bookings', value: String(totals.count), detail: totals.cancelled ? `${totals.cancelled} cancelled` : formatDayLabel(date), tone: 'text-slate-900' },
        { label: 'Booked hours', value: hoursText(totals.minutes), detail: `${columns.length} ${columns.length === 1 ? 'court' : 'courts'}`, tone: 'text-slate-900' },
        { label: 'Collected', value: formatINR(totals.collected), detail: 'Paid at the venue', tone: 'text-emerald-600' },
        { label: 'To collect', value: formatINR(totals.toCollect), detail: 'Unpaid bookings', tone: 'text-amber-600' },
      ].map((c) => (
        <div key={c.label} className="bg-white px-3 py-2.5 rounded-2xl border border-slate-200/90 shadow-2xs min-w-0">
          <p className="text-xs font-semibold text-slate-500 truncate">{c.label}</p>
          <p className="flex items-baseline gap-2 min-w-0">
            <span className={`text-xl font-bold ${c.tone}`}>{c.value}</span>
            <span className="text-xs text-slate-500 truncate">{c.detail}</span>
          </p>
        </div>
      ))}
    </div>
  );

  if (!venue) {
    return (
      <div className={`${cardCls} p-6 sm:p-8 text-center`}>
        <h3 className="text-sm font-bold text-slate-900">No venue yet</h3>
        <p className="text-xs text-slate-500 mt-1">Add a venue and its courts in Setup to start taking bookings.</p>
      </div>
    );
  }

  const bookingBlock = (b: CourtBooking, span: number) => {
    const dark = b.status === 'Confirmed';
    return (
      <button
        type="button"
        onClick={() => onOpenBooking(b)}
        title={`${b.customerName} · ${formatMobile(b.customerMobile)} · ${fmtRange(b.startTime, b.endTime)} · ${formatINR(b.price)} · ${b.status}`}
        className={`w-full h-full text-left rounded-lg border px-2 py-1 overflow-hidden flex flex-col gap-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          BOOKING_TONE[b.status] || BOOKING_TONE.Confirmed
        } ${dark ? 'border-l-4 !border-l-accent' : 'border-l-4'}`}
      >
        <span className="flex items-center justify-between gap-1 min-w-0">
          <span className="font-bold text-xs truncate">{b.customerName}</span>
          {b.status !== 'Confirmed' && <span className="text-[10px] font-bold uppercase tracking-wide shrink-0">{b.status}</span>}
        </span>
        <span className={`flex items-center gap-1 min-w-0 text-xs ${dark ? 'text-white/80' : 'text-slate-700'}`}>
          <span className="font-semibold">{formatINR(b.price)}</span>
          <PayTag b={b} dark={dark} />
          {span === 1 && <span className="truncate">{formatMobile(b.customerMobile)}</span>}
        </span>
        {span > 1 && (
          <>
            <span className={`text-xs truncate ${dark ? 'text-white/80' : 'text-slate-700'}`}>{formatMobile(b.customerMobile)}</span>
            <span className={`text-xs truncate ${dark ? 'text-white/60' : 'text-slate-500'}`}>
              {fmtRange(b.startTime, b.endTime)}
              {b.players ? ` · ${b.players} players` : ''}
            </span>
          </>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-4 min-w-0">
      {controls}

      {avail && avail.bookable === false && avail.message && (
        <div className="p-3 rounded-xl bg-paper border border-line text-xs text-slate-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" /> <span>{avail.message}</span>
        </div>
      )}
      {(bookingsError || availError) && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between gap-2" role="alert">
          <span className="flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {bookingsError ? `Bookings: ${bookingsError}` : `Free / booked slots: ${availError}`}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={load} className="min-h-[36px] shrink-0">
            Retry
          </Button>
        </div>
      )}

      {totalsRow}

      {firstLoad ? (
        <div className={`${cardCls} p-6 animate-pulse space-y-3`} aria-busy="true" aria-label="Loading the day">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-40 bg-slate-100 rounded" />
        </div>
      ) : columns.length === 0 || rows.length === 0 ? (
        <div className={`${cardCls} p-6 sm:p-8 text-center`}>
          <h3 className="text-sm font-bold text-slate-900">{columns.length === 0 ? 'No courts at this venue' : 'No opening hours set'}</h3>
          <p className="text-xs text-slate-500 mt-1">
            {columns.length === 0 ? 'Add courts to this venue in Setup.' : 'Set the opening and closing time in Setup.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop / tablet: grid (scrolls inside the card) */}
          <div className={`${cardCls} hidden md:block overflow-hidden`}>
            <div ref={gridRef} className="overflow-auto max-h-[calc(100dvh-10rem)] min-h-[320px] overscroll-contain">
              <div
                className="grid relative"
                style={{
                  gridTemplateColumns: `4.5rem repeat(${columns.length}, minmax(9.5rem, 1fr))`,
                  gridTemplateRows: `auto repeat(${rows.length}, ${rowH}px)`,
                  minWidth: `calc(4.5rem + ${columns.length} * 9.5rem)`,
                }}
              >
                <div className="sticky top-0 left-0 z-30 bg-paper border-b border-r border-line" style={{ gridColumn: 1, gridRow: 1 }} />
                {columns.map((c, ci) => (
                  <div
                    key={c.id}
                    className="sticky top-0 z-20 bg-paper border-b border-line px-2 py-2 text-center min-w-0"
                    style={{ gridColumn: ci + 2, gridRow: 1 }}
                  >
                    <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
                    {c.surface && <p className="text-[10px] text-slate-500 truncate">{c.surface}</p>}
                  </div>
                ))}
                {rows.map((r, ri) => (
                  <div
                    key={r.start}
                    className="sticky left-0 z-10 bg-white border-r border-line text-xs font-semibold text-slate-500 px-2 pt-1 text-right whitespace-nowrap"
                    style={{ gridColumn: 1, gridRow: ri + 2 }}
                  >
                    {fmtTime(r.start)}
                  </div>
                ))}
                {/* row lines */}
                {rows.map((r, ri) => (
                  <div
                    key={`line-${r.start}`}
                    aria-hidden="true"
                    className="border-b border-line/60 pointer-events-none"
                    style={{ gridColumn: `2 / span ${columns.length}`, gridRow: ri + 2 }}
                  />
                ))}
                {columns.map((c, ci) =>
                  c.items.map((it) => {
                    const style: React.CSSProperties = { gridColumn: ci + 2, gridRow: `${it.row + 2} / span ${it.span}` };
                    const key = `${c.id}-${it.row}-${it.kind}`;
                    if (it.kind === 'booking')
                      return (
                        <div key={key} className="p-1 z-[1] min-w-0" style={style}>
                          {bookingBlock(it.booking, it.span)}
                        </div>
                      );
                    if (it.kind === 'blocked')
                      return (
                        <div key={key} className="p-1 min-w-0" style={style}>
                          <div
                            className="w-full h-full rounded-lg border border-dashed border-slate-300 px-2 py-1 overflow-hidden text-slate-600"
                            style={HATCH_STYLE}
                            title={`Blocked: ${it.reason} (${fmtRange(it.start, it.end)})`}
                          >
                            <p className="text-xs font-bold flex items-center gap-1 min-w-0">
                              <Lock className="w-3 h-3 shrink-0" />
                              <span className="truncate">{it.reason}</span>
                            </p>
                            {it.span > 1 && <p className="text-[10px] truncate">{fmtRange(it.start, it.end)}</p>}
                          </div>
                        </div>
                      );
                    if (it.kind === 'taken')
                      return (
                        <div key={key} className="p-1 min-w-0" style={style}>
                          <div className="w-full h-full rounded-lg bg-slate-200 text-slate-600 text-xs font-bold px-2 py-1">Booked</div>
                        </div>
                      );
                    if (it.kind === 'past')
                      return <div key={key} className="bg-slate-50/80 border-l border-line/40" style={style} aria-hidden="true" />;
                    return (
                      <div key={key} className="p-1 min-w-0" style={style}>
                        <button
                          type="button"
                          onClick={() => book(c.id, it.start)}
                          aria-label={`Book ${c.name} at ${fmtTime(it.start)}`}
                          className="group w-full h-full rounded-lg border border-transparent hover:border-ink/30 hover:bg-paper text-slate-400 hover:text-ink text-xs font-semibold flex items-center justify-center gap-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
                        >
                          <span className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 inline-flex items-center gap-1">
                            <CalendarPlus className="w-3.5 h-3.5" /> Book{it.price != null ? ` · ${formatINR(it.price)}` : ''}
                          </span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 border-t border-line text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-ink border-l-2 border-accent" /> Confirmed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Completed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> No-show
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border border-dashed border-slate-300" style={HATCH_STYLE} /> Blocked
              </span>
              <span>Click a free slot to book it.</span>
            </div>
          </div>

          {/* Phone: court selector + list */}
          <div className="md:hidden space-y-3">
            <div role="group" aria-label="Court" className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
              {columns.map((c) => {
                const n = c.items.filter((it) => it.kind === 'booking').length;
                const on = c.id === phoneCourt;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPhoneCourt(c.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl text-xs font-bold border transition-colors ${
                      on ? 'bg-ink text-white border-ink' : 'bg-white text-slate-700 border-line'
                    }`}
                  >
                    {c.name}
                    <span className={`text-[10px] min-w-[20px] px-1.5 py-0.5 rounded-full ${on ? 'bg-accent text-ink' : 'bg-slate-100 text-slate-600'}`}>{n}</span>
                  </button>
                );
              })}
            </div>
            {phoneColumn && (
              <ul className={`${cardCls} divide-y divide-line/70`}>
                {phoneColumn.items.map((it) => {
                  const key = `${phoneColumn.id}-${it.row}-${it.kind}`;
                  const time = (
                    <span className="w-16 shrink-0 text-xs font-semibold text-slate-500 pt-0.5">{fmtTime(it.kind === 'booking' ? it.booking.startTime : it.start)}</span>
                  );
                  if (it.kind === 'booking') {
                    const b = it.booking;
                    return (
                      <li key={key} className="flex gap-2 p-2.5">
                        {time}
                        <button
                          type="button"
                          onClick={() => onOpenBooking(b)}
                          className={`flex-1 min-w-0 text-left rounded-xl border border-l-4 px-3 py-2 ${BOOKING_TONE[b.status] || BOOKING_TONE.Confirmed} ${
                            b.status === 'Confirmed' ? '!border-l-accent' : ''
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm truncate">{b.customerName}</span>
                            <span className="font-bold text-sm shrink-0">{formatINR(b.price)}</span>
                          </span>
                          <span className={`flex items-center justify-between gap-2 text-xs mt-0.5 ${b.status === 'Confirmed' ? 'text-white/80' : 'text-slate-700'}`}>
                            <span className="truncate">
                              {fmtRange(b.startTime, b.endTime)} · {formatMobile(b.customerMobile)}
                            </span>
                            <PayTag b={b} dark={b.status === 'Confirmed'} />
                          </span>
                          {b.status !== 'Confirmed' && <span className="block text-[10px] font-bold uppercase tracking-wide mt-0.5">{b.status}</span>}
                        </button>
                      </li>
                    );
                  }
                  if (it.kind === 'blocked')
                    return (
                      <li key={key} className="flex gap-2 p-2.5">
                        {time}
                        <div className="flex-1 min-w-0 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-slate-600" style={HATCH_STYLE}>
                          <p className="text-xs font-bold flex items-center gap-1">
                            <Lock className="w-3 h-3 shrink-0" /> <span className="truncate">{it.reason}</span>
                          </p>
                          <p className="text-xs">{fmtRange(it.start, it.end)}</p>
                        </div>
                      </li>
                    );
                  if (it.kind === 'taken')
                    return (
                      <li key={key} className="flex gap-2 p-2.5">
                        {time}
                        <div className="flex-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Booked · {fmtRange(it.start, it.end)}</div>
                      </li>
                    );
                  if (it.kind === 'past')
                    return (
                      <li key={key} className="flex gap-2 px-2.5 py-2 bg-slate-50/70">
                        {time}
                        <span className="text-xs text-slate-400">Past</span>
                      </li>
                    );
                  return (
                    <li key={key} className="flex gap-2 p-2.5 items-center">
                      {time}
                      <button
                        type="button"
                        onClick={() => book(phoneColumn.id, it.start)}
                        className="flex-1 min-h-[40px] rounded-xl border border-line text-xs font-bold text-slate-700 hover:bg-paper inline-flex items-center justify-between px-3"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarPlus className="w-3.5 h-3.5" /> Free — book
                        </span>
                        {it.price != null && <span className="text-slate-500 font-semibold">{formatINR(it.price)}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};
