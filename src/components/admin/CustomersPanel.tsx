import { PageHeader } from './PageHeader';
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Phone, Plus, Search, Users } from 'lucide-react';
import { customerService, CustomerDetail, CustomerSummary } from '../../services/customerService';
import { StatusBadge } from '../common/Badge';
import { Button } from '../common/Button';
import { formatDate, formatDateTime, formatINR } from '../../utils/format';
import { formatMobile, mobileTelHref } from '../../utils/phone';
import type { RequestStatus } from '../../types';

const inputCls =
  'w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-ink/40 bg-white';
const cardCls = 'bg-white rounded-2xl border border-line shadow-xs';
const thCls = 'py-3 px-4 whitespace-nowrap';
const tdCls = 'py-3 px-4 align-top';

interface Props {
  /** Opens the existing request detail dialog. */
  onOpenRequest: (id: string) => void;
  onNewBooking: (prefill?: { mobile?: string; name?: string }) => void;
  /** Bumped by the parent after a booking is created so the list refreshes. */
  refreshKey?: number;
}

const TelLink: React.FC<{ phone: string }> = ({ phone }) => {
  const href = mobileTelHref(phone);
  return href ? (
    <a
      href={href}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-ink font-semibold hover:underline whitespace-nowrap"
    >
      <Phone className="w-3.5 h-3.5" /> {formatMobile(phone)}
    </a>
  ) : (
    <span>{formatMobile(phone) || '—'}</span>
  );
};

export const CustomersPanel: React.FC<Props> = ({ onOpenRequest, onNewBooking, refreshKey = 0 }) => {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<CustomerSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const reqSeq = useRef(0);

  // Debounced server-side search.
  useEffect(() => {
    const seq = ++reqSeq.current;
    const t = window.setTimeout(() => {
      setError(null);
      customerService
        .listCustomers(search)
        .then((r) => seq === reqSeq.current && setRows(r))
        .catch((err: any) => seq === reqSeq.current && setError(err?.message || 'Could not load customers.'));
    }, search ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [search, refreshKey]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let live = true;
    setDetail(null);
    setDetailError(null);
    customerService
      .getCustomer(selectedId)
      .then((d) => live && setDetail(d))
      .catch((err: any) => live && setDetailError(err?.message || 'Could not load this customer.'));
    return () => {
      live = false;
    };
  }, [selectedId, refreshKey]);

  // ------------------------------------------------------------------ detail
  if (selectedId) {
    const c = detail?.customer || rows?.find((r) => r.id === selectedId);
    return (
      <div className="space-y-4 animate-in fade-in">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-1 min-h-[40px] text-sm font-bold text-ink hover:underline"
        >
          <ChevronLeft className="w-4 h-4" /> All customers
        </button>

        {c && (
          <div className={`${cardCls} p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4`}>
            <div className="min-w-0 space-y-1">
              <h2 className="font-display tracking-[0.01em] text-3xl sm:text-4xl font-bold text-slate-900 break-words">{c.name}</h2>
              <p className="text-sm">
                <TelLink phone={c.phone} />
              </p>
              {c.address && <p className="text-xs text-slate-600">{c.address}</p>}
              <p className="text-xs text-slate-500">Customer since {formatDate(c.createdAt)}</p>
            </div>
            <Button
              onClick={() => onNewBooking({ mobile: c.phone, name: c.name })}
              size="sm"
              className="min-h-[40px] shrink-0"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              New booking for this customer
            </Button>
          </div>
        )}

        {c && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Bookings', String(c.bookings)],
              ['Open now', String(c.openBookings)],
              ['Last booking', c.lastBookingAt ? formatDate(c.lastBookingAt) : '—'],
              ['Total paid', formatINR(c.totalPaid)],
            ].map(([label, value]) => (
              <div key={label} className="bg-white rounded-2xl border border-line p-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        )}

        <div className={`${cardCls} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-line/70">
            <p className="text-sm font-bold text-slate-900">Booking history</p>
          </div>
          {detailError ? (
            <p className="p-5 text-sm text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {detailError}
            </p>
          ) : !detail ? (
            <p className="p-5 text-sm text-slate-500">Loading…</p>
          ) : detail.requests.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No bookings yet.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {detail.requests.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onOpenRequest(r.id)}
                    className="w-full text-left px-4 py-3 hover:bg-paper flex items-center gap-3 min-h-[56px]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 flex flex-wrap items-center gap-2">
                        <span className="font-mono">{r.id}</span>
                        <StatusBadge status={r.status as RequestStatus} size="sm" />
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {r.serviceType === 'GETTING' ? 'Stringing' : 'Repair'} · {[r.batBrand, r.batModel].filter(Boolean).join(' ')} ·{' '}
                        {formatDateTime(r.createdAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-900">{formatINR(r.totalAmount)}</p>
                      <p className={`text-xs font-semibold ${r.paymentStatus === 'Paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {r.paymentStatus === 'Paid' ? 'Paid' : r.status === 'Cancelled' ? 'Cancelled' : 'Unpaid'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------- list
  return (
    <div className="space-y-4 animate-in fade-in">
      <PageHeader
        title="Customers"
        subtitle="Everyone who has an account, with their bookings and payments."
        actions={
          <Button onClick={() => onNewBooking()} size="sm" className="min-h-[40px]" leftIcon={<Plus className="w-4 h-4" />}>
            New booking
          </Button>
        }
      />

      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-line shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or mobile"
            aria-label="Search customers"
            className={`${inputCls} pl-10`}
          />
        </div>
        {rows && (
          <p className="text-xs text-slate-500 mt-2">
            {rows.length} customer{rows.length === 1 ? '' : 's'}
            {search.trim() ? ` matching “${search.trim()}”` : ''}
          </p>
        )}
      </div>

      {error ? (
        <div className={`${cardCls} p-5 text-sm text-rose-700 flex items-center gap-2`}>
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      ) : !rows ? (
        <div className={`${cardCls} p-5 text-sm text-slate-500`}>Loading customers…</div>
      ) : rows.length === 0 ? (
        <div className={`${cardCls} p-10 text-center space-y-3`}>
          <Users className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm text-slate-600">
            {search.trim() ? 'No customer matches that name or mobile.' : 'No customers yet. They appear here after their first sign-in or booking.'}
          </p>
          <Button onClick={() => onNewBooking()} variant="outline" size="sm" className="min-h-[40px]" leftIcon={<Plus className="w-4 h-4" />}>
            New booking
          </Button>
        </div>
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="md:hidden space-y-2">
            {rows.map((c) => (
              <li key={c.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(c.id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelectedId(c.id))}
                  className="bg-white rounded-2xl border border-line p-3 flex items-start gap-3 cursor-pointer hover:bg-paper"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-bold text-slate-900 truncate">{c.name}</p>
                    <p className="text-xs">
                      <TelLink phone={c.phone} />
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.bookings} booking{c.bookings === 1 ? '' : 's'}
                      {c.openBookings ? ` · ${c.openBookings} open` : ''} · last {c.lastBookingAt ? formatDate(c.lastBookingAt) : '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900">{formatINR(c.totalPaid)}</p>
                    <p className="text-xs text-slate-500">paid</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className={`${cardCls} overflow-x-auto hidden md:block`}>
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className={thCls}>Name</th>
                  <th className={thCls}>Mobile</th>
                  <th className={`${thCls} text-right`}>Bookings</th>
                  <th className={`${thCls} text-right`}>Open</th>
                  <th className={thCls}>Last booking</th>
                  <th className={`${thCls} text-right`}>Total paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className="hover:bg-paper cursor-pointer"
                  >
                    <td className={`${tdCls} font-bold text-slate-900`}>
                      <button type="button" onClick={() => setSelectedId(c.id)} className="text-left hover:underline">
                        {c.name}
                      </button>
                    </td>
                    <td className={tdCls}>
                      <TelLink phone={c.phone} />
                    </td>
                    <td className={`${tdCls} text-right`}>{c.bookings}</td>
                    <td className={`${tdCls} text-right`}>
                      {c.openBookings ? <span className="font-bold text-ink">{c.openBookings}</span> : <span className="text-slate-400">0</span>}
                    </td>
                    <td className={`${tdCls} whitespace-nowrap text-slate-700`}>
                      {c.lastBookingAt ? formatDate(c.lastBookingAt) : <span className="text-slate-400">No bookings</span>}
                    </td>
                    <td className={`${tdCls} text-right font-semibold text-slate-900`}>{formatINR(c.totalPaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
