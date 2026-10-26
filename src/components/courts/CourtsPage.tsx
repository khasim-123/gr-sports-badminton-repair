import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Clock, IndianRupee, MapPin, Phone, RotateCcw, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { courtService } from '../../services/courtService';
import type { CourtAvailability, CourtBooking, CourtVenue, VenueAvailability } from '../../types/courts';
import { Photo } from '../public/home/Photo';
import { scrollToSection, useShop } from '../public/home/shop';
import { WhatsAppIcon, btn, container, cx } from '../public/home/ui';
import { PublicLayout, useNavItem } from '../public/layout/PublicLayout';
import { AvailabilityGrid, type SlotSelection } from './AvailabilityGrid';
import { BookingDialog, type BookingDraft } from './BookingDialog';
import {
  bookingDates,
  cancelRuleText,
  durationText,
  formatDateLong,
  formatDateShort,
  formatPrice,
  formatTimeRange,
  hoursText,
  priceText,
  venuePhotos,
} from './courtFormat';
import { useCourtVenues } from './useCourts';

const SUBLINE = 'Court booking';
const DEFAULT_PHOTO = '/images/site/court-empty.webp';

type AvailState =
  | { status: 'idle' | 'loading'; data: VenueAvailability | null; key: string }
  | { status: 'ready'; data: VenueAvailability; key: string }
  | { status: 'error'; data: VenueAvailability | null; key: string };

/**
 * Court booking (the 'courts' view, URL /courts; "Near by courts" in the GR website map): choose
 * a day, a court and a time, then confirm (customer login needed). Paid at the venue. With no
 * venues set up yet the page says so and offers call / WhatsApp.
 */
export const CourtsPage: React.FC = () => {
  const SHOP = useShop();
  const app = useApp();
  const { isLoggedIn, currentRole, isAuthChecking, authModalOpen, setActiveView, setCustomerSubView, setSelectedRequestId, openAuthModal, addToast } = app;
  const venues = useCourtVenues();
  const navItem = useNavItem();

  const [venueId, setVenueId] = useState<string | null>(null);
  const venue: CourtVenue | null = venues.venues.find((v) => v.id === venueId) || venues.venues[0] || null;
  const dates = useMemo(() => (venue ? bookingDates(venue.advanceDays) : []), [venue]);
  const [date, setDate] = useState<string>(() => bookingDates(0)[0].iso);
  const [avail, setAvail] = useState<AvailState>({ status: 'idle', data: null, key: '' });
  const [nonce, setNonce] = useState(0);
  const [selection, setSelection] = useState<SlotSelection | null>(null);
  const [phoneCourtId, setPhoneCourtId] = useState('');
  const [notice, setNotice] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null);
  const [draft, setDraft] = useState<BookingDraft | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    const previous = document.title;
    document.title = `${SUBLINE} — ${SHOP.name}`;
    return () => {
      document.title = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the chosen date inside the venue's booking window.
  useEffect(() => {
    if (dates.length && !dates.some((d) => d.iso === date)) setDate(dates[0].iso);
  }, [dates, date]);

  // Availability for the venue + date.
  const availKey = venue ? `${venue.id}|${date}` : '';
  useEffect(() => {
    if (!venue) return;
    let cancelled = false;
    const key = `${venue.id}|${date}`;
    setAvail((s) => ({ status: 'loading', data: s.key === key ? s.data : null, key }));
    courtService
      .getAvailability(venue.id, date)
      .then((data) => {
        if (cancelled) return;
        setAvail({ status: 'ready', data, key });
      })
      .catch(() => !cancelled && setAvail({ status: 'error', data: null, key }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availKey, nonce]);

  // A new venue / date starts a fresh choice.
  useEffect(() => {
    setSelection(null);
  }, [availKey]);

  const data = avail.data && avail.key === availKey ? avail.data : null;
  const courts = data?.courts || [];
  useEffect(() => {
    if (courts.length && !courts.some((c) => c.courtId === phoneCourtId)) setPhoneCourtId(courts[0].courtId);
  }, [courts, phoneCourtId]);

  // Drop a selection that is no longer free after a refresh.
  useEffect(() => {
    if (!selection || !data) return;
    const c = data.courts.find((x) => x.courtId === selection.courtId);
    const ok = !!c && c.cells.slice(selection.start, selection.end + 1).every((cell) => cell.state === 'free');
    if (!ok) setSelection(null);
  }, [data, selection]);

  const maxSlots = Math.max(1, venue?.maxSlotsPerBooking || 1);
  const slotMinutes = data?.slotMinutes || venue?.slotMinutes || 60;

  const onTap = useCallback(
    (court: CourtAvailability, i: number) => {
      const cells = court.cells;
      const free = (a: number, b: number) => cells.slice(a, b + 1).every((c) => c.state === 'free');
      setNotice(null);
      setSelection((sel) => {
        if (!sel || sel.courtId !== court.courtId) {
          if (sel && sel.courtId !== court.courtId) setNotice({ tone: 'info', text: `Your choice moved to ${court.courtName}. One booking is for one court.` });
          return cells[i]?.state === 'free' ? { courtId: court.courtId, start: i, end: i } : sel;
        }
        // Tapping a chosen time: the first or last one is removed; a middle one becomes the last.
        if (i >= sel.start && i <= sel.end) {
          if (sel.start === sel.end) return null;
          if (i === sel.start) return { ...sel, start: i + 1 };
          if (i === sel.end) return { ...sel, end: i - 1 };
          return { ...sel, end: i };
        }
        const start = Math.min(sel.start, i);
        const end = Math.max(sel.end, i);
        if (end - start + 1 > maxSlots) {
          setNotice({ tone: 'warn', text: `One booking can be up to ${durationText(maxSlots * slotMinutes)}. Book again for more time.` });
          return sel;
        }
        if (!free(start, end)) return { courtId: court.courtId, start: i, end: i }; // not next to the choice: start again here
        return { courtId: court.courtId, start, end };
      });
    },
    [maxSlots, slotMinutes],
  );

  const selCourt = selection ? courts.find((c) => c.courtId === selection.courtId) || null : null;
  const selCells = selCourt && selection ? selCourt.cells.slice(selection.start, selection.end + 1) : [];
  const selPrice = selCells.reduce((n, c) => n + (c.price || 0), 0);
  const selStart = selCells[0]?.start;
  const selEnd = selCells[selCells.length - 1]?.end;

  // ---- booking (customer login first) ----
  const pendingBook = useRef(false);
  const openDraft = useCallback(() => {
    if (!venue || !selCourt || !selection || !selStart || !selEnd) return;
    setDraft({
      venue,
      courtId: selCourt.courtId,
      courtName: selCourt.courtName,
      date,
      startTime: selStart,
      endTime: selEnd,
      slots: selection.end - selection.start + 1,
      price: selPrice,
    });
  }, [venue, selCourt, selection, selStart, selEnd, date, selPrice]);

  const onBook = () => {
    if (isLoggedIn && currentRole === 'CUSTOMER') {
      openDraft();
      return;
    }
    if (isLoggedIn) {
      addToast('info', 'Customer accounts only', 'Courts are booked from a customer account. Staff can add bookings from the admin Courts page.');
      return;
    }
    pendingBook.current = true;
    openAuthModal('CUSTOMER');
  };
  // Resume after the login (the page stays on /courts for customers who log in here).
  useEffect(() => {
    if (!pendingBook.current) return;
    if (isLoggedIn && currentRole === 'CUSTOMER' && !isAuthChecking) {
      pendingBook.current = false;
      openDraft();
    } else if (!isLoggedIn && !authModalOpen) {
      pendingBook.current = false; // closed the login without signing in
    }
  }, [isLoggedIn, currentRole, authModalOpen, isAuthChecking, openDraft]);

  const onBooked = (_b: CourtBooking) => {
    setSelection(null);
    setNonce((n) => n + 1);
  };
  const onConflict = (message: string) => {
    setDraft(null);
    setSelection(null);
    setNotice({ tone: 'warn', text: `${message.replace(/\.?$/, '.')} We've refreshed the times — please choose another.` });
    setNonce((n) => n + 1);
    requestAnimationFrame(() => scrollToSection('book'));
  };
  const goPortal = (sub: string, id?: string) => {
    setDraft(null);
    if (id) setSelectedRequestId(id);
    setActiveView('customer_portal');
    setCustomerSubView(sub);
    window.scrollTo({ top: 0 });
  };

  const hasVenues = venues.status === 'ready' && venues.venues.length > 0;
  const photos = venuePhotos(venue);
  const heroPhoto = photos[0] || null;
  const askMessage = SHOP.greeting("I'd like to book a badminton court.\nDate: \nTime: \nHow many hours: ");

  return (
    <PublicLayout
      page="courts"
      navigator={{
        label: 'Courts',
        items: [
          navItem('academies', 'Academies', 'academies'),
          navItem('events', 'Events', 'events'),
          navItem('tournaments', 'Tournament organizers', 'tournaments'),
        ],
      }}
    >
      {venues.status === 'loading' && (
        <section className="border-b border-line bg-paper" aria-busy="true">
          <div className={cx(container, 'grid gap-8 py-6 sm:py-8 lg:grid-cols-12 lg:gap-12')}>
            <div className="space-y-4 lg:col-span-5">
              <div className="h-4 w-40 animate-pulse rounded bg-paper-deep" />
              <div className="h-12 w-4/5 animate-pulse rounded bg-paper-deep" />
              <div className="h-20 w-full animate-pulse rounded bg-paper-deep" />
            </div>
            <div className="aspect-[4/3] animate-pulse rounded-xl bg-paper-deep lg:col-span-7" />
          </div>
          <p className="sr-only" role="status">
            Loading the courts…
          </p>
        </section>
      )}

      {venues.status === 'error' && (
        <section className="border-b border-line bg-paper">
          <div className={cx(container, 'py-6 sm:py-8')}>
            <h1 className="font-display text-[40px] font-semibold leading-[1.02] text-ink sm:text-[52px]">Book a badminton court</h1>
            <div className="mt-6 max-w-xl rounded-xl border border-line bg-white px-5 py-5">
              <h2 className="font-display text-[24px] font-semibold">Court times aren't loading right now</h2>
              <p className="mt-1 text-[15px] text-ink-soft">
                Please try again, or call{' '}
                <a href={SHOP.phoneTel} className="font-semibold text-sportsBlue underline underline-offset-2">
                  {SHOP.phoneDisplay}
                </a>{' '}
                to book a court.
              </p>
              <button type="button" onClick={venues.reload} className={cx(btn.base, btn.secondary, 'mt-4')}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Try again
              </button>
            </div>
          </div>
        </section>
      )}

      {venues.status === 'ready' && !hasVenues && (
        <section className="bg-paper">
          <div className={cx(container, 'grid items-center gap-8 py-6 sm:py-8 lg:grid-cols-12 lg:gap-12')}>
            <div className="lg:col-span-5">
              <p className="text-[13px] font-semibold tracking-wide text-[#9A6B00]">
                {SHOP.name} · {SHOP.locality}
              </p>
              <h1 className="mt-1 font-display text-[44px] font-semibold leading-[0.98] text-ink text-balance sm:text-[56px]">
                Court booking opens soon
              </h1>
              <p className="mt-4 max-w-md text-[17px] leading-relaxed text-ink-soft text-pretty">
                Court booking opens soon — call or WhatsApp us to book a court.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={SHOP.whatsAppLink(askMessage)} target="_blank" rel="noopener noreferrer" className={cx(btn.base, btn.primary)}>
                  <WhatsAppIcon className="h-4 w-4" />
                  WhatsApp us
                </a>
                <a href={SHOP.phoneTel} className={cx(btn.base, btn.secondary)}>
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Call {SHOP.phoneDisplay}
                </a>
              </div>
            </div>
            <div className="lg:col-span-7">
              <Photo
                src={DEFAULT_PHOTO}
                alt="An empty indoor badminton hall with blue court mats and nets"
                sizes="(min-width: 1024px) 680px, 100vw"
                aspect="aspect-[4/3]"
                className="rounded-xl"
                eager
              />
            </div>
          </div>
        </section>
      )}

      {hasVenues && venue && (
        <>
          {/* Venue intro */}
          <section className="border-b border-line bg-paper">
            <div className={cx(container, 'grid items-center gap-8 py-6 sm:py-8 lg:grid-cols-12 lg:gap-12')}>
              <div className="lg:col-span-5">
                <p className="text-[13px] font-semibold tracking-wide text-[#9A6B00]">
                  {SHOP.name} · {venue.area || SHOP.locality}
                </p>
                <h1 className="mt-1 font-display text-[44px] font-semibold leading-[0.98] text-ink text-balance sm:text-[56px]">
                  Book a badminton court
                </h1>
                <p className="mt-3 max-w-md text-[17px] leading-relaxed text-ink-soft text-pretty">
                  {venue.name}. Choose a day, a court and a time, and pay at the venue.
                </p>
                <ul className="mt-5 space-y-2 text-[15px] text-ink-soft">
                  <li className="flex items-start gap-2.5">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                    <span>Open {hoursText(venue)}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <IndianRupee className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                    <span>{priceText(venue)}, per court</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                    <span>
                      {venue.address}
                      {venue.mapsUrl && /^https:\/\//i.test(venue.mapsUrl) && (
                        <>
                          {' · '}
                          <a href={venue.mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-sportsBlue underline underline-offset-2">
                            Map
                          </a>
                        </>
                      )}
                    </span>
                  </li>
                </ul>
                <a
                  href="#book"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection('book', { focus: true });
                  }}
                  className={cx(btn.base, btn.primary, 'mt-6')}
                >
                  See free times
                </a>
              </div>
              <div className="hidden sm:block lg:col-span-7">
                {heroPhoto ? (
                  <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-paper-deep">
                    <img src={heroPhoto} alt={`${venue.name}`} className="absolute inset-0 h-full w-full object-cover" loading="eager" decoding="async" />
                  </div>
                ) : (
                  <Photo
                    src={DEFAULT_PHOTO}
                    alt="An indoor badminton hall with blue court mats and nets"
                    sizes="(min-width: 1024px) 680px, 100vw"
                    aspect="aspect-[16/10]"
                    className="rounded-xl"
                    eager
                  />
                )}
              </div>
            </div>
          </section>

          {/* Booking */}
          <section id="book" aria-labelledby="book-title" className="scroll-mt-20 py-6 sm:py-8">
            <div className={container}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id="book-title" data-section-heading tabIndex={-1} className="font-display text-[32px] font-semibold leading-none outline-none sm:text-[40px]">
                    Choose a day and time
                  </h2>
                  <p className="mt-2 text-[15px] text-ink-soft">
                    Tap a free time, then tap more next to it for a longer game (up to {durationText(maxSlots * slotMinutes)}).
                  </p>
                </div>
                {venues.venues.length > 1 && (
                  <div role="group" aria-label="Venue" className="flex flex-wrap gap-2">
                    {venues.venues.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        aria-pressed={v.id === venue.id}
                        onClick={() => {
                          setVenueId(v.id);
                          setNotice(null);
                        }}
                        className={cx(
                          'min-h-[44px] rounded-xl border px-4 text-[15px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue',
                          v.id === venue.id ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink/40',
                        )}
                      >
                        {v.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Date strip */}
              <div role="group" aria-label="Day" className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                {dates.map((d) => {
                  const active = d.iso === date;
                  return (
                    <button
                      key={d.iso}
                      type="button"
                      aria-pressed={active}
                      aria-label={formatDateLong(d.iso)}
                      onClick={() => {
                        setDate(d.iso);
                        setNotice(null);
                      }}
                      className={cx(
                        'flex min-h-[64px] w-[68px] shrink-0 flex-col items-center justify-center rounded-xl border transition-colors',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue',
                        active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink/40',
                      )}
                    >
                      <span className={cx('text-[12px] font-medium', active ? 'text-white/75' : 'text-ink-muted')}>{d.weekday}</span>
                      <span className="font-display text-[24px] font-semibold leading-none">{d.day}</span>
                      <span className={cx('text-[12px]', active ? 'text-white/75' : 'text-ink-muted')}>{d.month}</span>
                    </button>
                  );
                })}
              </div>

              <h3 className="mt-6 text-[17px] font-semibold text-ink">{formatDateLong(date)}</h3>

              {notice && (
                <p
                  role={notice.tone === 'warn' ? 'alert' : 'status'}
                  className={cx(
                    'mt-3 flex items-start gap-2 rounded-xl border px-3.5 py-3 text-[14px]',
                    notice.tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-line bg-paper text-ink-soft',
                  )}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {notice.text}
                </p>
              )}

              <div className="mt-4">
                {(avail.status === 'loading' || avail.status === 'idle') && !data && (
                  <div className="space-y-2" aria-hidden="true">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-11 animate-pulse rounded-lg bg-paper-deep motion-reduce:animate-none" />
                    ))}
                  </div>
                )}
                {avail.status === 'error' && (
                  <div className="rounded-xl border border-line bg-paper px-5 py-5">
                    <p className="text-[15px] text-ink-soft">
                      The times for this day didn't load. Try again, or call{' '}
                      <a href={SHOP.phoneTel} className="font-semibold text-sportsBlue underline underline-offset-2">
                        {SHOP.phoneDisplay}
                      </a>
                      .
                    </p>
                    <button type="button" onClick={() => setNonce((n) => n + 1)} className={cx(btn.base, btn.secondary, 'mt-3')}>
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Try again
                    </button>
                  </div>
                )}
                {data && !data.bookable && (
                  <div className="rounded-xl border border-line bg-paper px-5 py-5">
                    <p className="text-[15px] font-semibold text-ink">{data.message || "This day can't be booked online."}</p>
                    <p className="mt-1 text-[15px] text-ink-soft">
                      Choose another day, or call{' '}
                      <a href={SHOP.phoneTel} className="font-semibold text-sportsBlue underline underline-offset-2">
                        {SHOP.phoneDisplay}
                      </a>
                      .
                    </p>
                  </div>
                )}
                {data && data.bookable && (
                  <AvailabilityGrid
                    availability={data}
                    selection={selection}
                    onTap={onTap}
                    phoneCourtId={phoneCourtId}
                    onPhoneCourtChange={setPhoneCourtId}
                    busy={avail.status === 'loading'}
                  />
                )}
              </div>
            </div>

            {/* Summary bar: sticks to the bottom of the screen while a time is chosen */}
            <div className={cx('sticky bottom-0 z-30 mt-6', !selection && 'pointer-events-none')} aria-live="polite">
              {selection && selCourt && selStart && selEnd && (
                <div className="border-t border-line bg-white/95 shadow-[0_-6px_20px_-12px_rgba(15,27,43,0.35)] backdrop-blur">
                  <div className={cx(container, 'flex items-center justify-between gap-3 py-3')}>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-ink sm:text-[16px]">
                        {selCourt.courtName} · {formatDateShort(date)} · <span className="whitespace-nowrap">{formatTimeRange(selStart, selEnd)}</span>
                      </p>
                      <p className="text-[14px] text-ink-muted">
                        <span className="font-semibold tabular-nums text-ink">{formatPrice(selPrice)}</span> · {durationText((selection.end - selection.start + 1) * slotMinutes)} · pay at the venue
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelection(null);
                          setNotice(null);
                        }}
                        className="hidden min-h-[44px] rounded-xl px-3 text-[15px] font-medium text-ink-soft hover:text-ink sm:inline-flex sm:items-center"
                      >
                        Clear
                      </button>
                      <button type="button" onClick={onBook} className={cx(btn.base, btn.primary, 'px-6')}>
                        Book
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* About the venue */}
          <section id="venue" aria-labelledby="venue-title" className="scroll-mt-20 border-t border-line bg-paper py-6 sm:py-8">
            <div className={cx(container, 'grid gap-8 lg:grid-cols-12')}>
              <div className="lg:col-span-5">
                <h2 id="venue-title" data-section-heading tabIndex={-1} className="font-display text-[32px] font-semibold leading-none outline-none sm:text-[40px]">
                  About the courts
                </h2>
                {venue.description && <p className="mt-3 whitespace-pre-line text-[16px] leading-relaxed text-ink-soft">{venue.description}</p>}
                <dl className="mt-6 space-y-4 text-[15px]">
                  <div>
                    <dt className="font-semibold text-ink">Courts</dt>
                    <dd className="mt-0.5 text-ink-soft">
                      {venue.courts.map((c) => (c.surface ? `${c.name} (${c.surface})` : c.name)).join(', ')}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink">Opening hours</dt>
                    <dd className="mt-0.5 text-ink-soft">{hoursText(venue)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink">Price</dt>
                    <dd className="mt-0.5 text-ink-soft">{priceText(venue)}, for one court.</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink">Payment</dt>
                    <dd className="mt-0.5 flex items-start gap-2 text-ink-soft">
                      <Wallet className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      Pay at the venue — cash or UPI.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink">Cancelling</dt>
                    <dd className="mt-0.5 text-ink-soft">{cancelRuleText(venue.cancellationHours)}, from My bookings. After that, call us.</dd>
                  </div>
                  {venue.rules && (
                    <div>
                      <dt className="font-semibold text-ink">Rules</dt>
                      <dd className="mt-0.5 whitespace-pre-line text-ink-soft">{venue.rules}</dd>
                    </div>
                  )}
                  {venue.amenities.length > 0 && (
                    <div>
                      <dt className="font-semibold text-ink">At the venue</dt>
                      <dd className="mt-1.5">
                        <ul className="flex flex-wrap gap-2">
                          {venue.amenities.map((a) => (
                            <li key={a} className="rounded-lg border border-line bg-white px-2.5 py-1 text-[14px] text-ink-soft">
                              {a}
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="font-semibold text-ink">Address</dt>
                    <dd className="mt-0.5 text-ink-soft">
                      {venue.address}
                      {venue.mapsUrl && /^https:\/\//i.test(venue.mapsUrl) && (
                        <a
                          href={venue.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 flex min-h-[36px] items-center gap-1 font-semibold text-sportsBlue underline underline-offset-2"
                        >
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                          Directions
                        </a>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="lg:col-span-7">
                {photos.length > 1 ? (
                  <ul className={cx('grid gap-3', photos.length > 2 && 'grid-cols-2')}>
                    {photos.slice(1, 5).map((p, i) => (
                      <li key={p} className={cx('relative overflow-hidden rounded-xl bg-paper-deep', photos.length > 2 ? 'aspect-[4/3]' : 'aspect-[16/10]')}>
                        <img src={p} alt={`${venue.name}, photo ${i + 2}`} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Photo
                    src="/images/site/hall-players.webp"
                    alt="Four players in a doubles game on blue court mats in an indoor hall"
                    sizes="(min-width: 1024px) 680px, 100vw"
                    aspect="aspect-[3/2]"
                    className="rounded-xl"
                  />
                )}
                <div className="mt-6 rounded-xl border border-line bg-white p-5">
                  <h3 className="text-[16px] font-semibold text-ink">Questions, or booking for a group?</h3>
                  <p className="mt-1 text-[15px] text-ink-soft">Call or message us — we'll help you find a time.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <a href={SHOP.whatsAppLink(askMessage)} target="_blank" rel="noopener noreferrer" className={cx(btn.base, btn.secondary)}>
                      <WhatsAppIcon className="h-4 w-4 text-[#128C4B]" />
                      WhatsApp
                    </a>
                    <a href={SHOP.phoneTel} className={cx(btn.base, btn.secondary)}>
                      <Phone className="h-4 w-4" aria-hidden="true" />
                      Call {SHOP.phoneDisplay}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
      <BookingDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onBooked={onBooked}
        onConflict={onConflict}
        onOpenProfile={() => goPortal('profile')}
        onOpenMyBookings={(id) => goPortal('courts', id)}
      />
    </PublicLayout>
  );
};
