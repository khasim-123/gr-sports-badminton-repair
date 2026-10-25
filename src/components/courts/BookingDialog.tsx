import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CalendarPlus, CheckCircle2, Wallet } from 'lucide-react';
import { ApiError } from '../../services/apiClient';
import { courtService } from '../../services/courtService';
import type { CourtBooking, CourtVenue } from '../../types/courts';
import { Dialog } from '../public/home/Dialog';
import { useShop } from '../public/home/shop';
import { btn, cx, fieldControl, fieldLabel } from '../public/home/ui';
import { cancelRuleText, downloadBookingIcs, formatDateLong, formatPrice, formatTimeRange } from './courtFormat';

export interface BookingDraft {
  venue: CourtVenue;
  courtId: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  slots: number;
  price: number;
}

interface Props {
  draft: BookingDraft | null;
  onClose: () => void;
  onBooked: (booking: CourtBooking) => void;
  /** 409: the time was taken meanwhile. */
  onConflict: (message: string) => void;
  onOpenProfile: () => void;
  onOpenMyBookings: (id: string) => void;
}

const PLAYER_CHOICES = [1, 2, 3, 4];

/** Players + note → "Confirm booking" → confirmation with "Add to calendar". */
export const BookingDialog: React.FC<Props> = ({ draft, onClose, onBooked, onConflict, onOpenProfile, onOpenMyBookings }) => {
  const SHOP = useShop();
  const [players, setPlayers] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ text: string; profile?: boolean } | null>(null);
  const [booked, setBooked] = useState<CourtBooking | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const key = draft ? `${draft.courtId}|${draft.date}|${draft.startTime}|${draft.slots}` : '';

  useEffect(() => {
    setPlayers(null);
    setNote('');
    setError(null);
    setBooked(null);
    setSaving(false);
  }, [key]);

  // Focus the main button of the confirmation once it shows.
  useEffect(() => {
    if (booked) requestAnimationFrame(() => doneRef.current?.focus({ preventScroll: true }));
  }, [booked]);

  if (!draft) return null;
  const venue = draft.venue;
  const cancelRule = cancelRuleText(venue.cancellationHours);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const booking = await courtService.book({
        venueId: venue.id,
        courtId: draft.courtId,
        date: draft.date,
        startTime: draft.startTime,
        slots: draft.slots,
        ...(players ? { players } : {}),
        ...(note.trim() ? { notes: note.trim() } : {}),
      });
      setBooked(booking);
      onBooked(booking);
    } catch (err) {
      const msg = err instanceof Error && err.message && !/^HTTP Request failed/.test(err.message) ? err.message : '';
      if (err instanceof ApiError && err.status === 409) {
        onConflict(msg || 'Someone has just booked this time.');
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        setError({ text: msg || 'Please add your name to your profile before booking a court.', profile: true });
      } else if (err instanceof ApiError && err.status === 401) {
        setError({ text: 'Please log in again to book.' });
      } else {
        setError({ text: msg || `The booking didn't go through. Please try again, or call ${SHOP.phoneDisplay}.` });
      }
    } finally {
      setSaving(false);
    }
  };

  if (booked) {
    return (
      <Dialog open onClose={onClose} title="Court booked" size="sm" initialFocusRef={doneRef as React.RefObject<HTMLElement>}>
        <div className="space-y-5">
          <p className="flex items-start gap-2.5 text-[15px] text-ink-soft">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
            <span>
              Your court is booked. Booking number <span className="font-semibold text-ink">{booked.id}</span>.
            </span>
          </p>
          <dl className="divide-y divide-line rounded-xl border border-line text-[15px]">
            {[
              ['Court', `${booked.courtName}, ${booked.venueName}`],
              ['Date', formatDateLong(booked.date)],
              ['Time', formatTimeRange(booked.startTime, booked.endTime)],
              ['Price', formatPrice(booked.price)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="text-right font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-1.5 text-[14px] text-ink-soft">
            <li className="flex items-start gap-2">
              <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              Pay at the venue — cash or UPI.
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden="true" className="ml-1.5 mr-0.5 mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {cancelRule}, from My bookings.
            </li>
          </ul>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => downloadBookingIcs(booked, { address: venue.address, shopName: SHOP.name, phone: SHOP.phoneDisplay })}
              className={cx(btn.base, btn.secondary, 'sm:flex-1')}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Add to calendar
            </button>
            <button type="button" onClick={() => onOpenMyBookings(booked.id)} className={cx(btn.base, btn.secondary, 'sm:flex-1')}>
              My bookings
            </button>
          </div>
          <button ref={doneRef} type="button" onClick={onClose} className={cx(btn.base, btn.primary, 'w-full')}>
            Done
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Book this court"
      description={`${draft.courtName} · ${formatDateLong(draft.date)} · ${formatTimeRange(draft.startTime, draft.endTime)}`}
      size="sm"
      initialFocusRef={confirmRef as React.RefObject<HTMLElement>}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-5"
      >
        <dl className="divide-y divide-line rounded-xl border border-line text-[15px]">
          {[
            ['Venue', venue.name],
            ['Court', draft.courtName],
            ['Date', formatDateLong(draft.date)],
            ['Time', formatTimeRange(draft.startTime, draft.endTime)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="text-right font-medium text-ink">{v}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="font-semibold text-ink">To pay at the venue</dt>
            <dd className="text-right text-[17px] font-semibold tabular-nums text-ink">{formatPrice(draft.price)}</dd>
          </div>
        </dl>

        <fieldset>
          <legend className={fieldLabel}>
            How many players? <span className="font-normal text-ink-muted">(optional)</span>
          </legend>
          <div className="grid grid-cols-4 gap-2">
            {PLAYER_CHOICES.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={players === n}
                onClick={() => setPlayers(players === n ? null : n)}
                className={cx(
                  'min-h-[44px] rounded-xl border text-[15px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue',
                  players === n ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink/40',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className={fieldLabel}>
            Note for us <span className="font-normal text-ink-muted">(optional)</span>
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            rows={2}
            placeholder="For example: we need to borrow rackets"
            className={cx(fieldControl, 'min-h-[72px] py-2.5')}
          />
        </label>

        <p className="text-[14px] leading-relaxed text-ink-soft">
          Pay at the venue — cash or UPI. {cancelRule}.
        </p>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[14px] text-rose-800" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p>{error.text}</p>
              {error.profile && (
                <button type="button" onClick={onOpenProfile} className="mt-1 min-h-[36px] font-semibold text-rose-900 underline underline-offset-4">
                  Add your name in Profile
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={cx(btn.base, btn.secondary)}>
            Back
          </button>
          <button ref={confirmRef} type="submit" disabled={saving} className={cx(btn.base, btn.primary, 'sm:min-w-[180px]')}>
            {saving ? 'Booking…' : 'Confirm booking'}
          </button>
        </div>
      </form>
    </Dialog>
  );
};
