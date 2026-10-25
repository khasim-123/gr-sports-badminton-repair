import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, CalendarClock, CalendarPlus, ChevronRight, MapPin, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { courtService } from '../../services/courtService';
import type { CourtBooking } from '../../types/courts';
import { useShop } from '../public/home/shop';
import { btn, cx, fieldControl } from '../public/home/ui';
import {
  BOOKING_STATUS_STYLE,
  bookingPaymentText,
  downloadBookingIcs,
  formatDateLong,
  formatDateShort,
  formatPrice,
  formatTimeRange,
  isCourtBookingId,
  isUpcoming,
} from './courtFormat';
import { useMyCourtBookings } from './useCourts';

const card = 'bg-white rounded-2xl border border-line shadow-2xs';
const CANCEL_REASONS = ['Change of plans', 'Booked the wrong time', 'Not enough players', 'Other'];

export const CourtBookingStatusPill: React.FC<{ status: CourtBooking['status'] }> = ({ status }) => (
  <span className={cx('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap', BOOKING_STATUS_STYLE[status] || BOOKING_STATUS_STYLE.Confirmed)}>
    {status}
  </span>
);

/** Square date tile: "SAT / 14 / Nov". */
const DateTile: React.FC<{ date: string; muted?: boolean }> = ({ date, muted }) => {
  const [wd, day, mon] = formatDateShort(date).split(' ');
  return (
    <div className={cx('flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border', muted ? 'border-line bg-paper text-ink-muted' : 'border-ink bg-ink text-white')}>
      <span className={cx('text-[11px] font-semibold uppercase', muted ? 'text-ink-muted' : 'text-white/70')}>{wd}</span>
      <span className="font-display text-[24px] font-semibold leading-none">{day}</span>
      <span className={cx('text-[11px]', muted ? 'text-ink-muted' : 'text-white/70')}>{mon}</span>
    </div>
  );
};

const openCourtsPage = (setActiveView: (v: string) => void) => {
  setActiveView('courts');
  window.scrollTo({ top: 0 });
};

/** Customer sub-view 'courts': upcoming court bookings, then past ones; one booking's details. */
export const MyCourtBookings: React.FC = () => {
  const { selectedRequestId, setSelectedRequestId, setActiveView } = useApp();
  const bookings = useMyCourtBookings();
  const [openId, setOpenId] = useState<string | null>(() => (isCourtBookingId(selectedRequestId) ? selectedRequestId : null));

  // Opened from a notification / the booking confirmation.
  useEffect(() => {
    if (isCourtBookingId(selectedRequestId)) {
      setOpenId(selectedRequestId);
      setSelectedRequestId(null);
      window.scrollTo({ top: 0 });
    }
  }, [selectedRequestId, setSelectedRequestId]);

  if (openId) {
    return (
      <BookingDetail
        id={openId}
        known={bookings.bookings.find((b) => b.id === openId) || null}
        onBack={() => {
          setOpenId(null);
          window.scrollTo({ top: 0 });
        }}
        onChange={bookings.replace}
      />
    );
  }

  const empty = bookings.status === 'unsupported' || (bookings.status === 'ready' && bookings.bookings.length === 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display tracking-[0.01em] text-3xl font-bold text-slate-900">My court bookings</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Badminton courts you've booked. Pay at the venue — cash or UPI.</p>
        </div>
        <button type="button" onClick={() => openCourtsPage(setActiveView)} className={cx(btn.base, btn.primary, 'shrink-0')}>
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          Book a court
        </button>
      </div>

      {bookings.status === 'loading' && (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white border border-line" />
          ))}
        </div>
      )}
      {bookings.status === 'error' && (
        <div className={cx(card, 'p-5 text-[15px] text-ink-soft')}>
          Your court bookings couldn't be loaded.{' '}
          <button type="button" onClick={bookings.reload} className="font-semibold text-sportsBlue underline underline-offset-4">
            Try again
          </button>
        </div>
      )}
      {empty && (
        <div className={cx(card, 'p-6 sm:p-8 text-center')}>
          <p className="font-display text-2xl font-semibold text-ink">No court bookings yet</p>
          <p className="mt-1 text-[15px] text-ink-soft">When you book a badminton court, it shows up here.</p>
          <button type="button" onClick={() => openCourtsPage(setActiveView)} className={cx(btn.base, btn.secondary, 'mt-4')}>
            See free times
          </button>
        </div>
      )}
      {bookings.status === 'ready' && bookings.bookings.length > 0 && (
        <>
          <section aria-labelledby="crt-upcoming" className="space-y-3">
            <h2 id="crt-upcoming" className="text-[15px] font-semibold text-ink">
              Upcoming
            </h2>
            {bookings.upcoming.length === 0 ? (
              <p className={cx(card, 'p-4 text-[15px] text-ink-soft')}>Nothing booked right now.</p>
            ) : (
              <ul className="space-y-3">
                {bookings.upcoming.map((b) => (
                  <li key={b.id}>
                    <BookingRow booking={b} onOpen={() => setOpenId(b.id)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {bookings.past.length > 0 && (
            <section aria-labelledby="crt-past" className="space-y-3">
              <h2 id="crt-past" className="text-[15px] font-semibold text-ink">
                Past and cancelled
              </h2>
              <ul className="space-y-3">
                {bookings.past.map((b) => (
                  <li key={b.id}>
                    <BookingRow booking={b} onOpen={() => setOpenId(b.id)} muted />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
};

const BookingRow: React.FC<{ booking: CourtBooking; onOpen: () => void; muted?: boolean }> = ({ booking: b, onOpen, muted }) => (
  <button
    type="button"
    onClick={() => {
      onOpen();
      window.scrollTo({ top: 0 });
    }}
    className={cx(card, 'flex w-full items-center gap-3 p-3 sm:p-4 text-left transition-colors hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue')}
  >
    <DateTile date={b.date} muted={muted} />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[16px] font-semibold text-ink">{formatTimeRange(b.startTime, b.endTime)}</span>
        <CourtBookingStatusPill status={b.status} />
      </div>
      <p className="mt-0.5 truncate text-[14px] text-ink-soft">
        {b.courtName} · {b.venueName}
      </p>
      <p className="text-[13px] text-ink-muted">
        {b.id} · {bookingPaymentText(b)}
      </p>
    </div>
    <div className="shrink-0 text-right">
      <p className="text-[16px] font-semibold tabular-nums text-ink">{formatPrice(b.price)}</p>
      <ChevronRight className="ml-auto mt-1 h-4 w-4 text-ink-muted" aria-hidden="true" />
    </div>
  </button>
);

const BookingDetail: React.FC<{ id: string; known: CourtBooking | null; onBack: () => void; onChange: (b: CourtBooking) => void }> = ({
  id,
  known,
  onBack,
  onChange,
}) => {
  const { addToast, setActiveView } = useApp();
  const SHOP = useShop();
  const [booking, setBooking] = useState<CourtBooking | null>(known);
  const [loadError, setLoadError] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [other, setOther] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    courtService
      .getBooking(id)
      .then((b) => {
        if (cancelled) return;
        setBooking(b);
        onChange(b);
      })
      .catch(() => {
        if (!cancelled && !known) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const doCancel = async () => {
    const text = reason === 'Other' ? other.trim() : reason;
    if (!text) {
      setCancelError('Please tell us why you are cancelling.');
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await courtService.cancelBooking(id, text);
      setBooking(updated);
      onChange(updated);
      setCancelOpen(false);
      addToast('info', 'Booking cancelled', `${id} has been cancelled. The court is free for others again.`);
    } catch (err) {
      setCancelError(err instanceof Error && err.message ? err.message : `The booking could not be cancelled. Please call ${SHOP.phoneDisplay}.`);
    } finally {
      setCancelling(false);
    }
  };

  const back = (
    <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold text-ink hover:underline underline-offset-4">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      My court bookings
    </button>
  );

  if (!booking) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 sm:p-6 lg:p-8 space-y-4">
        {back}
        {loadError ? (
          <div className={cx(card, 'p-5 text-[15px] text-ink-soft')}>Booking {id} couldn't be loaded. Please try again later.</div>
        ) : (
          <div className="h-48 animate-pulse rounded-2xl bg-white border border-line" aria-hidden="true" />
        )}
      </div>
    );
  }

  const upcoming = isUpcoming(booking);
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:p-6 lg:p-8 space-y-5">
      {back}
      <section className={cx(card, 'p-4 sm:p-6')}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-3xl font-bold text-ink">{booking.id}</h1>
          <CourtBookingStatusPill status={booking.status} />
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2">
          <div>
            <dt className="text-[13px] text-ink-muted">Court</dt>
            <dd className="font-medium text-ink">
              {booking.courtName}, {booking.venueName}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-ink-muted">Date and time</dt>
            <dd className="font-medium text-ink">
              {formatDateLong(booking.date)}, {formatTimeRange(booking.startTime, booking.endTime)}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-ink-muted">Price</dt>
            <dd className="font-medium tabular-nums text-ink">{formatPrice(booking.price)}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-ink-muted">Payment</dt>
            <dd className="flex items-center gap-1.5 font-medium text-ink">
              <Wallet className="h-4 w-4 text-ink-muted" aria-hidden="true" />
              {bookingPaymentText(booking)}
              {booking.paymentStatus !== 'Paid' && booking.status === 'Confirmed' ? ' — cash or UPI' : ''}
            </dd>
          </div>
          {booking.players ? (
            <div>
              <dt className="text-[13px] text-ink-muted">Players</dt>
              <dd className="font-medium text-ink">{booking.players}</dd>
            </div>
          ) : null}
          {booking.notes ? (
            <div className="sm:col-span-2">
              <dt className="text-[13px] text-ink-muted">Your note</dt>
              <dd className="whitespace-pre-line text-ink">{booking.notes}</dd>
            </div>
          ) : null}
          {booking.status === 'Cancelled' && booking.cancelReason ? (
            <div className="sm:col-span-2">
              <dt className="text-[13px] text-ink-muted">Cancelled because</dt>
              <dd className="text-ink">{booking.cancelReason}</dd>
            </div>
          ) : null}
        </dl>
        {upcoming && (
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => downloadBookingIcs(booking, { shopName: SHOP.name, phone: SHOP.phoneDisplay })}
              className={cx(btn.base, btn.secondary)}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Add to calendar
            </button>
            <button type="button" onClick={() => openCourtsPage(setActiveView)} className={cx(btn.base, btn.secondary)}>
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Venue and directions
            </button>
          </div>
        )}
      </section>

      {booking.timeline && booking.timeline.length > 0 && (
        <section className={cx(card, 'p-4 sm:p-6')} aria-labelledby="crt-history">
          <h2 id="crt-history" className="text-[16px] font-semibold text-ink">
            History
          </h2>
          <ol className="mt-3 space-y-3">
            {booking.timeline.map((t, i) => (
              <li key={`${t.timestamp}-${i}`} className="flex gap-3 text-[14px]">
                <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ink/40" />
                <div>
                  <p className="font-medium text-ink">{t.label}</p>
                  <p className="text-[13px] text-ink-muted">{new Date(t.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                  {t.notes && <p className="text-[13px] text-ink-soft">{t.notes}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {booking.canCancel && booking.status === 'Confirmed' && (
        <section className={cx(card, 'p-4 sm:p-6')}>
          {!cancelOpen ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[14px] text-ink-soft">Can't make it? Cancel so someone else can play.</p>
              <button type="button" onClick={() => setCancelOpen(true)} className={cx(btn.base, 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50')}>
                Cancel booking
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-[16px] font-semibold text-ink">Cancel this booking?</h2>
              <div role="radiogroup" aria-label="Reason" className="flex flex-wrap gap-2">
                {CANCEL_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={reason === r}
                    onClick={() => setReason(r)}
                    className={cx(
                      'min-h-[44px] rounded-xl border px-3 text-[14px] font-medium',
                      reason === r ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink/40',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {reason === 'Other' && (
                <label className="block">
                  <span className="sr-only">Reason</span>
                  <input type="text" value={other} onChange={(e) => setOther(e.target.value.slice(0, 200))} placeholder="Tell us why" className={fieldControl} />
                </label>
              )}
              {cancelError && (
                <p className="flex items-start gap-2 text-[14px] text-rose-700" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {cancelError}
                </p>
              )}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setCancelOpen(false)} className={cx(btn.base, btn.secondary)}>
                  Keep my booking
                </button>
                <button type="button" onClick={doCancel} disabled={cancelling} className={cx(btn.base, 'bg-rose-700 text-white hover:bg-rose-800')}>
                  {cancelling ? 'Cancelling…' : 'Yes, cancel booking'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
      {!booking.canCancel && upcoming && (
        <p className="text-[14px] text-ink-soft">
          It's too close to the start to cancel online. Please call{' '}
          <a href={SHOP.phoneTel} className="font-semibold text-sportsBlue underline underline-offset-2">
            {SHOP.phoneDisplay}
          </a>{' '}
          if you can't come.
        </p>
      )}
    </div>
  );
};

/** Customer dashboard: "Your next court booking" (only when there is one). */
export const NextCourtBookingBlock: React.FC = () => {
  const { setCustomerSubView, setSelectedRequestId } = useApp();
  const bookings = useMyCourtBookings();
  if (bookings.status !== 'ready' || bookings.upcoming.length === 0) return null;
  const next = bookings.upcoming[0];
  const more = bookings.upcoming.length - 1;
  return (
    <section className={cx(card, 'p-4 sm:p-5')} aria-labelledby="dash-court">
      <div className="flex items-center justify-between gap-3">
        <h2 id="dash-court" className="font-display text-2xl font-bold text-slate-900">
          Your next court booking
        </h2>
        <button type="button" onClick={() => setCustomerSubView('courts')} className="min-h-[44px] text-[14px] font-semibold text-ink underline underline-offset-4">
          {more > 0 ? `All bookings (${bookings.upcoming.length})` : 'My court bookings'}
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          setSelectedRequestId(next.id);
          setCustomerSubView('courts');
        }}
        className="mt-2 flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-ink/30"
      >
        <DateTile date={next.date} />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-ink">
            {formatDateLong(next.date)}, {formatTimeRange(next.startTime, next.endTime)}
          </p>
          <p className="truncate text-[13px] text-ink-muted">
            {next.courtName} · {next.venueName} · {formatPrice(next.price)} · {bookingPaymentText(next)}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
      </button>
    </section>
  );
};
