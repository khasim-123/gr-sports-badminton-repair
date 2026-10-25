/**
 * Bookings list: a date range (default the next 7 days), search, status filter and CSV export.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronRight, Download, Eye, RefreshCw, Search } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { courtService } from '../../../services/courtService';
import type { CourtBooking, CourtBookingStatus, CourtVenue } from '../../../types/courts';
import { Button } from '../../common/Button';
import { csvRow, downloadCsv, formatDateTime, formatINR } from '../../../utils/format';
import { formatMobile } from '../../../utils/phone';
import {
  BOOKING_STATUSES,
  CourtStatusPill,
  TelLink,
  addDays,
  bookingSortKey,
  cardCls,
  dayTotals,
  durationMin,
  errText,
  fmtRange,
  formatDayLabel,
  hoursText,
  inputCls,
  isToCollect,
  paymentShort,
  todayIso,
} from './shared';

type StatusFilter = 'ALL' | 'ACTIVE' | 'UNPAID' | CourtBookingStatus;

const thCls = 'py-3 px-3 whitespace-nowrap';
const tdCls = 'py-3 px-3 align-top';

export const BookingsList: React.FC<{
  venues: CourtVenue[];
  version: number;
  onOpenBooking: (b: CourtBooking) => void;
}> = ({ venues, version, onOpenBooking }) => {
  const { addToast } = useApp();
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(addDays(todayIso(), 6));
  const [venueId, setVenueId] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ACTIVE');
  const [bookings, setBookings] = useState<CourtBooking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const rangeBad = !from || !to || to < from;

  const load = useCallback(async () => {
    if (rangeBad) return;
    const mine = ++seq.current;
    setLoading(true);
    try {
      const list = await courtService.getBookings({ from, to, venueId: venueId || undefined });
      if (mine !== seq.current) return;
      setBookings((Array.isArray(list) ? list : []).sort((a, b) => bookingSortKey(a).localeCompare(bookingSortKey(b))));
      setError(null);
    } catch (err) {
      if (mine !== seq.current) return;
      setError(errText(err, 'Could not load the bookings.'));
    } finally {
      if (mine === seq.current) {
        setLoading(false);
        setLoaded(true);
      }
    }
  }, [from, to, venueId, rangeBad]);

  useEffect(() => {
    load();
  }, [load, version]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return bookings.filter((b) => {
      if (q) {
        const hit =
          b.id.toLowerCase().includes(q) ||
          (b.customerName || '').toLowerCase().includes(q) ||
          (digits.length >= 3 && (b.customerMobile || '').replace(/\D/g, '').includes(digits)) ||
          (b.courtName || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (status === 'ACTIVE') return b.status !== 'Cancelled';
      if (status === 'UNPAID') return isToCollect(b);
      if (status !== 'ALL') return b.status === status;
      return true;
    });
  }, [bookings, query, status]);

  const totals = dayTotals(filtered);
  const filtersActive = !!query.trim() || status !== 'ACTIVE';

  const setPreset = (days: number) => {
    const t = todayIso();
    setFrom(t);
    setTo(addDays(t, days - 1));
  };

  const exportCsv = () => {
    if (filtered.length === 0) {
      addToast('info', 'Nothing to export', 'There are no bookings to export.');
      return;
    }
    const lines = [
      csvRow([
        'Booking ID',
        'Date',
        'Start',
        'End',
        'Hours',
        'Venue',
        'Court',
        'Customer',
        'Mobile',
        'Players',
        'Price (INR)',
        'Payment',
        'Method',
        'Paid at',
        'Status',
        'Booked by',
        'Booked at',
        'Note',
        'Cancel reason',
      ]),
      ...filtered.map((b) =>
        csvRow([
          b.id,
          b.date,
          b.startTime,
          b.endTime,
          Math.round((durationMin(b) / 60) * 100) / 100,
          b.venueName,
          b.courtName,
          b.customerName,
          formatMobile(b.customerMobile),
          b.players ?? '',
          b.price ?? 0,
          b.paymentStatus === 'Paid' ? 'Paid' : b.status === 'Cancelled' ? 'Not due' : 'Unpaid',
          b.paymentMethod || '',
          b.paidAt ? formatDateTime(b.paidAt, '') : '',
          b.status,
          b.bookedBy === 'admin' ? 'Shop (walk-in / phone)' : 'Customer (online)',
          formatDateTime(b.createdAt, ''),
          b.notes || '',
          b.cancelReason || '',
        ])
      ),
    ];
    downloadCsv(`gr-sports-court-bookings-${from}-to-${to}.csv`, lines);
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-line shadow-2xs space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-[auto,auto,1fr,auto] gap-2 items-end">
          <label className="text-xs font-bold text-slate-600 min-w-0">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="text-xs font-bold text-slate-600 min-w-0">
            To
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <div className="col-span-2 lg:col-span-1 flex gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { label: 'Today', days: 1 },
              { label: 'Next 7 days', days: 7 },
              { label: 'Next 30 days', days: 30 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPreset(p.days)}
                className={`shrink-0 min-h-[40px] px-3 rounded-xl border text-xs font-bold ${
                  from === todayIso() && to === addDays(todayIso(), p.days - 1) ? 'bg-ink text-white border-ink' : 'bg-white text-slate-700 border-slate-300 hover:bg-paper'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="col-span-2 lg:col-span-1 flex gap-2 justify-end">
            <Button onClick={load} variant="outline" size="sm" className="min-h-[40px]" isLoading={loading && loaded} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
            <Button onClick={exportCsv} variant="outline" size="sm" className="min-h-[40px]" disabled={filtered.length === 0} leftIcon={<Download className="w-4 h-4" />}>
              Export CSV
            </Button>
          </div>
        </div>
        {rangeBad && <p className="text-xs text-rose-700">The “to” date must be on or after the “from” date.</p>}
        <div className={`grid grid-cols-1 ${venues.length > 1 ? 'sm:grid-cols-[1fr,14rem,14rem]' : 'sm:grid-cols-[1fr,14rem]'} gap-2`}>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, mobile or booking ID"
              aria-label="Search bookings"
              className={`${inputCls} pl-10`}
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Filter by status" className={inputCls}>
            <option value="ACTIVE">Not cancelled</option>
            <option value="ALL">All statuses</option>
            <option value="UNPAID">Unpaid (to collect)</option>
            <optgroup label="Exact status">
              {BOOKING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </optgroup>
          </select>
          {venues.length > 1 && (
            <select value={venueId} onChange={(e) => setVenueId(e.target.value)} aria-label="Venue" className={inputCls}>
              <option value="">All venues</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {filtered.length} of {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'} · {hoursText(totals.minutes)} · collected{' '}
            <b className="text-emerald-700">{formatINR(totals.collected)}</b> · to collect <b className="text-amber-700">{formatINR(totals.toCollect)}</b>
          </span>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setStatus('ACTIVE');
              }}
              className="font-bold text-ink hover:underline min-h-[40px] px-2"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between gap-2" role="alert">
          <span className="flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {bookings.length ? `Refresh failed: ${error}` : error}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={load} className="min-h-[36px] shrink-0">
            Retry
          </Button>
        </div>
      )}

      {!loaded ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading bookings">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${cardCls} p-4 animate-pulse space-y-2.5`}>
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Phone: cards */}
          <ul className="md:hidden space-y-2.5">
            {filtered.length === 0 && (
              <li className={`${cardCls} py-10 px-4 text-center text-sm text-slate-500`}>
                {bookings.length === 0 ? 'No bookings in these dates.' : 'No bookings match these filters.'}
              </li>
            )}
            {filtered.map((b) => (
              <li key={b.id} className={`${cardCls} p-3 space-y-2`}>
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => onOpenBooking(b)} className="text-left min-w-0">
                    <span className="block font-bold text-slate-900 text-sm">
                      {formatDayLabel(b.date)} · {fmtRange(b.startTime, b.endTime)}
                    </span>
                    <span className="block text-xs text-slate-500">
                      <span className="font-mono">{b.id}</span> · {b.courtName}
                      {venues.length > 1 ? ` · ${b.venueName}` : ''}
                    </span>
                  </button>
                  <CourtStatusPill status={b.status} />
                </div>
                <div className="flex items-end justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 break-words">{b.customerName}</p>
                    <TelLink phone={b.customerMobile} className="min-h-[36px]" />
                  </div>
                  <span className="text-right shrink-0">
                    <span className="font-bold text-slate-900">{formatINR(b.price)}</span>
                    <span className={`block text-xs ${b.paymentStatus === 'Paid' ? 'text-emerald-700' : 'text-slate-500'}`}>{paymentShort(b)}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenBooking(b)}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-line text-slate-700 font-bold text-xs hover:bg-paper"
                >
                  <Eye className="w-3.5 h-3.5" /> Open booking
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className={`${cardCls} overflow-hidden hidden md:block`}>
            <div className="overflow-auto lg:max-h-[calc(100vh-9rem)]">
              <table className="w-full min-w-[820px] text-left border-collapse text-[13px]">
                <thead>
                  <tr className="text-slate-500 font-semibold uppercase tracking-[0.06em] text-xs [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-paper [&>th]:shadow-[inset_0_-1px_0_#E3DFD6]">
                    <th className={thCls}>When</th>
                    <th className={thCls}>Court</th>
                    <th className={thCls}>Customer</th>
                    <th className={`${thCls} text-right`}>Price</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}>Booking</th>
                    <th className={`${thCls} text-right`}>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 px-4 text-center text-sm text-slate-500">
                        {bookings.length === 0 ? 'No bookings in these dates.' : 'No bookings match these filters.'}
                      </td>
                    </tr>
                  )}
                  {filtered.map((b) => (
                    <tr key={b.id} className="hover:bg-paper/70 transition-colors">
                      <td className={tdCls}>
                        <p className="font-bold text-slate-900 whitespace-nowrap">{formatDayLabel(b.date)}</p>
                        <p className="text-xs text-slate-500 whitespace-nowrap">
                          {fmtRange(b.startTime, b.endTime)} · {hoursText(durationMin(b))}
                        </p>
                      </td>
                      <td className={tdCls}>
                        <p className="font-semibold text-slate-800 whitespace-nowrap">{b.courtName}</p>
                        {venues.length > 1 && <p className="text-xs text-slate-500 max-w-[10rem] truncate">{b.venueName}</p>}
                      </td>
                      <td className={tdCls}>
                        <p className="font-bold text-slate-900 max-w-[12rem] truncate" title={b.customerName}>
                          {b.customerName}
                        </p>
                        <TelLink phone={b.customerMobile} className="text-xs font-medium" />
                      </td>
                      <td className={`${tdCls} text-right whitespace-nowrap`}>
                        <p className="font-bold text-slate-900">{formatINR(b.price)}</p>
                        <p className={`text-xs ${b.paymentStatus === 'Paid' ? 'text-emerald-700' : 'text-slate-500'}`}>{paymentShort(b)}</p>
                      </td>
                      <td className={tdCls}>
                        <CourtStatusPill status={b.status} />
                      </td>
                      <td className={tdCls}>
                        <button type="button" onClick={() => onOpenBooking(b)} className="font-mono font-bold text-ink hover:underline whitespace-nowrap">
                          {b.id}
                        </button>
                        <p className="text-xs text-slate-500 whitespace-nowrap">{b.bookedBy === 'admin' ? 'Walk-in / phone' : 'Online'}</p>
                      </td>
                      <td className={`${tdCls} text-right`}>
                        <button
                          type="button"
                          onClick={() => onOpenBooking(b)}
                          className="min-h-[36px] px-3 inline-flex items-center gap-1 rounded-lg border border-line bg-white text-slate-700 font-semibold hover:text-ink hover:border-slate-400 transition-colors duration-150"
                        >
                          Open <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
