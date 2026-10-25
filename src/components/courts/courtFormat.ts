/**
 * Court booking: plain-words formatting (times, dates, prices, rules) and the .ics calendar file.
 * Times from the API are "HH:MM" (24-hour, India time); dates are "YYYY-MM-DD".
 */
import type { CourtBooking, CourtBookingStatus, CourtVenue } from '../../types/courts';
import { formatINR } from '../../utils/format';
import { localIsoDate, safeImageUrl } from '../public/home/format';

export const formatPrice = (n: number | null | undefined) => formatINR(n ?? 0);

/** "18:30" -> minutes since midnight. */
export function minutesOf(hm: string): number {
  const [h, m] = String(hm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

const meridiem = (mins: number) => (Math.floor(mins / 60) % 24 >= 12 ? 'PM' : 'AM');
function clock(mins: number, withMinutes = true): string {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return withMinutes || m ? `${h}:${String(m).padStart(2, '0')}` : String(h);
}

/** "18:00" -> "6:00 PM" (and "24:00" / "00:00" -> "12:00 AM"). */
export function formatTime(hm: string): string {
  const mins = minutesOf(hm);
  return `${clock(mins)} ${meridiem(mins)}`;
}

/** "18:00", "20:00" -> "6:00–8:00 PM"; "11:00", "13:00" -> "11:00 AM–1:00 PM". */
export function formatTimeRange(start: string, end: string): string {
  const a = minutesOf(start);
  const b = minutesOf(end);
  if (meridiem(a) === meridiem(b)) return `${clock(a)}–${clock(b)} ${meridiem(b)}`;
  return `${clock(a)} ${meridiem(a)}–${clock(b)} ${meridiem(b)}`;
}

/** Short hours for prices: "17:00", "21:00" -> "5–9 PM". */
function shortRange(start: string, end: string): string {
  const a = minutesOf(start);
  const b = minutesOf(end);
  if (meridiem(a) === meridiem(b)) return `${clock(a, false)}–${clock(b, false)} ${meridiem(b)}`;
  return `${clock(a, false)} ${meridiem(a)}–${clock(b, false)} ${meridiem(b)}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateOf(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const todayIso = () => localIsoDate(new Date());

/** "2026-11-14" -> "Sat 14 Nov". */
export function formatDateShort(iso: string): string {
  const d = dateOf(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "2026-11-14" -> "Saturday 14 Nov" (+ the year when it isn't this year). */
export function formatDateLong(iso: string): string {
  const d = dateOf(iso);
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${year}`;
}

export interface DateChip {
  iso: string;
  weekday: string; // "Today", "Tomorrow" or "Sat"
  day: number;
  month: string;
}

/** Today and the next `advanceDays` days. */
export function bookingDates(advanceDays: number): DateChip[] {
  const out: DateChip[] = [];
  const base = new Date();
  const n = Math.max(0, Math.min(60, Math.floor(advanceDays || 0)));
  for (let i = 0; i <= n; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    out.push({
      iso: localIsoDate(d),
      weekday: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : WEEKDAYS[d.getDay()],
      day: d.getDate(),
      month: MONTHS[d.getMonth()],
    });
  }
  return out;
}

/** "Open 6:00 AM – 10:00 PM, every day". */
export function hoursText(v: Pick<CourtVenue, 'openTime' | 'closeTime'>): string {
  return `${formatTime(v.openTime)} – ${formatTime(v.closeTime)}`;
}

/** "₹300 an hour, ₹400 from 5–9 PM and on weekends". */
export function priceText(v: CourtVenue): string {
  const parts = [`${formatPrice(v.pricePerHour)} an hour`];
  const peak = v.peakPricePerHour && v.peakStart && v.peakEnd && v.peakPricePerHour !== v.pricePerHour ? v.peakPricePerHour : null;
  const weekend = v.weekendPricePerHour && v.weekendPricePerHour !== v.pricePerHour ? v.weekendPricePerHour : null;
  if (peak && weekend && peak === weekend) {
    parts.push(`${formatPrice(peak)} from ${shortRange(v.peakStart as string, v.peakEnd as string)} and on weekends`);
  } else {
    if (peak) parts.push(`${formatPrice(peak)} from ${shortRange(v.peakStart as string, v.peakEnd as string)}`);
    if (weekend) parts.push(`${formatPrice(weekend)} on Saturdays and Sundays`);
  }
  return parts.join(', ');
}

/** "Cancel free until 12 hours before the start". */
export function cancelRuleText(hours: number | null | undefined): string {
  const h = Math.max(0, Math.round(hours ?? 0));
  if (h === 0) return 'Cancel free until the booking starts';
  return `Cancel free until ${h} hour${h === 1 ? '' : 's'} before the start`;
}

/** "1 hour", "1½ hours", "2 hours", "30 minutes". */
export function durationText(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const h = Math.floor(minutes / 60);
  const half = minutes % 60 >= 30;
  if (h === 1 && !half) return '1 hour';
  return `${h}${half ? '½' : ''} hours`;
}

/** Venue photo URLs that are safe to render (admin uploads), else []. */
export function venuePhotos(v: CourtVenue | null | undefined): string[] {
  return (v?.photos || []).map((p) => safeImageUrl(p)).filter((p): p is string => !!p);
}

/** Active venues with active courts, in the admin's order. */
export function activeVenues(list: CourtVenue[] | null | undefined): CourtVenue[] {
  return (Array.isArray(list) ? list : [])
    .filter((v) => v && v.isActive !== false)
    .map((v) => ({ ...v, courts: (v.courts || []).filter((c) => c.isActive !== false).sort((a, b) => a.sortOrder - b.sortOrder) }))
    .filter((v) => v.courts.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// ---------- Bookings ----------

/** Start / end of a booking as real instants (the venue is in India, UTC+5:30). */
export function bookingStart(b: Pick<CourtBooking, 'date' | 'startTime'>): Date {
  return new Date(`${b.date}T${b.startTime}:00+05:30`);
}
export function bookingEnd(b: Pick<CourtBooking, 'date' | 'endTime' | 'startTime'>): Date {
  // An end of "24:00" / "00:00" after the start means midnight at the end of that day.
  const end = new Date(`${b.date}T${b.endTime === '24:00' ? '00:00' : b.endTime}:00+05:30`);
  if (minutesOf(b.endTime) <= minutesOf(b.startTime) || b.endTime === '24:00') end.setDate(end.getDate() + 1);
  return end;
}

/** Confirmed and not finished yet. */
export function isUpcoming(b: CourtBooking, now = Date.now()): boolean {
  return b.status === 'Confirmed' && bookingEnd(b).getTime() > now;
}

/** Upcoming bookings (soonest first), then the rest (latest first). */
export function splitBookings(list: CourtBooking[]): { upcoming: CourtBooking[]; past: CourtBooking[] } {
  const now = Date.now();
  const upcoming = list.filter((b) => isUpcoming(b, now)).sort((a, b) => bookingStart(a).getTime() - bookingStart(b).getTime());
  const past = list.filter((b) => !isUpcoming(b, now)).sort((a, b) => bookingStart(b).getTime() - bookingStart(a).getTime());
  return { upcoming, past };
}

export const BOOKING_STATUS_STYLE: Record<CourtBookingStatus, string> = {
  Confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Completed: 'border-line bg-paper text-ink-soft',
  'No-show': 'border-amber-200 bg-amber-50 text-amber-800',
  Cancelled: 'border-rose-200 bg-rose-50 text-rose-700',
};

/** "Pay at the venue", "Paid by UPI", "Nothing to pay". */
export function bookingPaymentText(b: CourtBooking): string {
  if (b.paymentStatus === 'Paid') return `Paid${b.paymentMethod ? ` by ${b.paymentMethod === 'Other' ? 'other means' : b.paymentMethod}` : ''}`;
  if (b.status === 'Cancelled') return 'Nothing to pay';
  if (b.status === 'No-show') return 'Not paid';
  return 'Pay at the venue';
}

// ---------- Calendar file ----------

const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Builds an iCalendar file for one booking (times in UTC, so every calendar app reads them right). */
export function bookingIcs(b: CourtBooking, opts: { address?: string; shopName: string; phone?: string }): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${opts.shopName}//Court booking//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${b.id}@grsports-courts`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(bookingStart(b))}`,
    `DTEND:${icsStamp(bookingEnd(b))}`,
    `SUMMARY:${icsEscape(`Badminton – ${b.courtName}, ${b.venueName}`)}`,
    `LOCATION:${icsEscape([b.venueName, opts.address].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${icsEscape(
      [`Booking ${b.id}`, `${b.courtName}, ${formatTimeRange(b.startTime, b.endTime)}`, `${formatPrice(b.price)} – pay at the venue (cash or UPI)`, opts.phone ? `Questions: ${opts.phone}` : '']
        .filter(Boolean)
        .join('\n'),
    )}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(`Badminton at ${b.venueName} in 1 hour`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

/** Saves the booking as an .ics file (opens in the phone's / computer's calendar). */
export function downloadBookingIcs(b: CourtBooking, opts: { address?: string; shopName: string; phone?: string }): void {
  const blob = new Blob([bookingIcs(b, opts)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${b.id}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const isCourtBookingId = (id?: string | null): id is string => !!id && id.startsWith('CRT-');
