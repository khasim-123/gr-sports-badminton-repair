import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourtBooking, CourtVenue } from '../../types/courts';
import {
  activeVenues,
  bookingDates,
  bookingEnd,
  bookingIcs,
  bookingPaymentText,
  bookingStart,
  cancelRuleText,
  durationText,
  formatDateLong,
  formatDateShort,
  formatTime,
  formatTimeRange,
  isCourtBookingId,
  isUpcoming,
  priceText,
  splitBookings,
  venuePhotos,
} from './courtFormat';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-25T12:00:00+05:30'));
});
afterEach(() => {
  vi.useRealTimers();
});

function venue(overrides: Partial<CourtVenue> = {}): CourtVenue {
  return {
    id: 'ven-1',
    name: 'GR Sports Courts',
    address: 'Dondaparthy, Visakhapatnam',
    photos: [],
    amenities: [],
    openTime: '06:00',
    closeTime: '22:00',
    slotMinutes: 60,
    pricePerHour: 300,
    peakPricePerHour: null,
    peakStart: null,
    peakEnd: null,
    weekendPricePerHour: null,
    advanceDays: 14,
    maxSlotsPerBooking: 4,
    cancellationHours: 12,
    isActive: true,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00Z',
    courts: [{ id: 'c1', venueId: 'ven-1', name: 'Court 1', isActive: true, sortOrder: 0 }],
    ...overrides,
  };
}

function booking(overrides: Partial<CourtBooking> = {}): CourtBooking {
  return {
    id: 'CRT-48213',
    venueId: 'ven-1',
    venueName: 'GR Sports Courts',
    courtId: 'c1',
    courtName: 'Court 1',
    date: '2026-10-25',
    startTime: '18:00',
    endTime: '20:00',
    slots: 2,
    price: 800,
    customerName: 'Anil Kumar',
    customerMobile: '+919876543210',
    status: 'Confirmed',
    paymentStatus: 'Pending',
    bookedBy: 'customer',
    canCancel: true,
    createdAt: '2026-10-20T10:00:00Z',
    timeline: [],
    ...overrides,
  };
}

describe('times', () => {
  it.each([
    ['18:00', '6:00 PM'],
    ['06:05', '6:05 AM'],
    ['12:30', '12:30 PM'],
    ['00:00', '12:00 AM'],
    ['24:00', '12:00 AM'],
  ])('formatTime(%s) -> %s', (hm, expected) => {
    expect(formatTime(hm)).toBe(expected);
  });

  it.each([
    ['18:00', '20:00', '6:00–8:00 PM'],
    ['11:00', '13:00', '11:00 AM–1:00 PM'],
    ['22:00', '24:00', '10:00 PM–12:00 AM'],
    ['06:00', '06:30', '6:00–6:30 AM'],
  ])('formatTimeRange(%s, %s) -> %s', (a, b, expected) => {
    expect(formatTimeRange(a, b)).toBe(expected);
  });

  it.each([
    [30, '30 minutes'],
    [60, '1 hour'],
    [90, '1½ hours'],
    [120, '2 hours'],
    [150, '2½ hours'],
  ])('durationText(%i) -> %s', (mins, expected) => {
    expect(durationText(mins)).toBe(expected);
  });
});

describe('prices and rules', () => {
  it.each<[Partial<CourtVenue>, string]>([
    [{}, '₹300 an hour'],
    [{ peakPricePerHour: 400, peakStart: '17:00', peakEnd: '21:00', weekendPricePerHour: 400 }, '₹300 an hour, ₹400 from 5–9 PM and on weekends'],
    [{ peakPricePerHour: 400, peakStart: '17:00', peakEnd: '21:00' }, '₹300 an hour, ₹400 from 5–9 PM'],
    [{ peakPricePerHour: 400, peakStart: '11:00', peakEnd: '14:00' }, '₹300 an hour, ₹400 from 11 AM–2 PM'],
    [{ peakPricePerHour: 400, peakStart: '17:30', peakEnd: '21:00' }, '₹300 an hour, ₹400 from 5:30–9 PM'],
    [{ weekendPricePerHour: 350 }, '₹300 an hour, ₹350 on Saturdays and Sundays'],
    [
      { peakPricePerHour: 400, peakStart: '17:00', peakEnd: '21:00', weekendPricePerHour: 450 },
      '₹300 an hour, ₹400 from 5–9 PM, ₹450 on Saturdays and Sundays',
    ],
    [{ peakPricePerHour: 300, peakStart: '17:00', peakEnd: '21:00', weekendPricePerHour: 300 }, '₹300 an hour'],
    [{ peakPricePerHour: 400, peakStart: null, peakEnd: null }, '₹300 an hour'],
  ])('priceText(%o)', (overrides, expected) => {
    expect(priceText(venue(overrides))).toBe(expected);
  });

  it.each([
    [12, 'Cancel free until 12 hours before the start'],
    [1, 'Cancel free until 1 hour before the start'],
    [1.6, 'Cancel free until 2 hours before the start'],
    [0, 'Cancel free until the booking starts'],
    [null, 'Cancel free until the booking starts'],
  ])('cancelRuleText(%o) -> %s', (hours, expected) => {
    expect(cancelRuleText(hours)).toBe(expected);
  });
});

describe('dates', () => {
  it('short and long dates (year only when it is not this year)', () => {
    expect(formatDateShort('2026-11-14')).toBe('Sat 14 Nov');
    expect(formatDateLong('2026-11-14')).toBe('Saturday 14 Nov');
    expect(formatDateLong('2027-01-09')).toBe('Saturday 9 Jan 2027');
  });

  it('bookingDates lists today, tomorrow and the following days (max 60 ahead)', () => {
    vi.setSystemTime(new Date(2026, 9, 30, 9, 0));
    expect(bookingDates(3)).toEqual([
      { iso: '2026-10-30', weekday: 'Today', day: 30, month: 'Oct' },
      { iso: '2026-10-31', weekday: 'Tomorrow', day: 31, month: 'Oct' },
      { iso: '2026-11-01', weekday: 'Sun', day: 1, month: 'Nov' },
      { iso: '2026-11-02', weekday: 'Mon', day: 2, month: 'Nov' },
    ]);
    expect(bookingDates(-5)).toHaveLength(1);
    expect(bookingDates(500)).toHaveLength(61);
  });
});

describe('venues', () => {
  it('activeVenues keeps active venues with active courts, in admin order', () => {
    const list = [
      venue({
        id: 'b',
        sortOrder: 2,
        courts: [
          { id: 'b2', venueId: 'b', name: 'Court 2', isActive: true, sortOrder: 2 },
          { id: 'b1', venueId: 'b', name: 'Court 1', isActive: true, sortOrder: 1 },
          { id: 'b3', venueId: 'b', name: 'Court 3', isActive: false, sortOrder: 3 },
        ],
      }),
      venue({ id: 'a', sortOrder: 1 }),
      venue({ id: 'closed', isActive: false }),
      venue({ id: 'no-courts', courts: [{ id: 'x', venueId: 'no-courts', name: 'Old', isActive: false, sortOrder: 0 }] }),
    ];
    const result = activeVenues(list);
    expect(result.map((v) => v.id)).toEqual(['a', 'b']);
    expect(result[1].courts.map((c) => c.id)).toEqual(['b1', 'b2']);
    expect(activeVenues(null)).toEqual([]);
  });

  it('venuePhotos keeps only safe photo links', () => {
    expect(venuePhotos(venue({ photos: ['/uploads/court.jpg', 'javascript:alert(1)', 'http://evil.example/x.jpg', 'https://cdn.example.com/c.jpg'] }))).toEqual([
      '/uploads/court.jpg',
      'https://cdn.example.com/c.jpg',
    ]);
    expect(venuePhotos(null)).toEqual([]);
  });
});

describe('bookings', () => {
  it('start and end are India times; an end at midnight or after midnight is the next day', () => {
    expect(bookingStart(booking()).toISOString()).toBe('2026-10-25T12:30:00.000Z');
    expect(bookingEnd(booking()).toISOString()).toBe('2026-10-25T14:30:00.000Z');
    expect(bookingEnd(booking({ startTime: '22:00', endTime: '24:00' })).toISOString()).toBe('2026-10-25T18:30:00.000Z');
    expect(bookingEnd(booking({ startTime: '23:00', endTime: '01:00' })).toISOString()).toBe('2026-10-25T19:30:00.000Z');
  });

  it('a confirmed booking is upcoming until it ends', () => {
    const now = new Date('2026-10-25T19:59:00+05:30').getTime();
    expect(isUpcoming(booking(), now)).toBe(true);
    expect(isUpcoming(booking(), new Date('2026-10-25T20:00:00+05:30').getTime())).toBe(false);
    expect(isUpcoming(booking({ status: 'Cancelled' }), now)).toBe(false);
  });

  it('splitBookings: upcoming soonest first, the rest latest first', () => {
    const list = [
      booking({ id: 'past-old', date: '2026-10-01' }),
      booking({ id: 'next-week', date: '2026-11-01' }),
      booking({ id: 'tonight', date: '2026-10-25' }),
      booking({ id: 'cancelled', date: '2026-10-30', status: 'Cancelled' }),
      booking({ id: 'past-recent', date: '2026-10-24' }),
    ];
    const { upcoming, past } = splitBookings(list);
    expect(upcoming.map((b) => b.id)).toEqual(['tonight', 'next-week']);
    expect(past.map((b) => b.id)).toEqual(['cancelled', 'past-recent', 'past-old']);
  });

  it.each<[Partial<CourtBooking>, string]>([
    [{}, 'Pay at the venue'],
    [{ paymentStatus: 'Paid', paymentMethod: 'UPI' }, 'Paid by UPI'],
    [{ paymentStatus: 'Paid', paymentMethod: 'Other' }, 'Paid by other means'],
    [{ paymentStatus: 'Paid', paymentMethod: null }, 'Paid'],
    [{ status: 'Cancelled' }, 'Nothing to pay'],
    [{ status: 'No-show' }, 'Not paid'],
  ])('bookingPaymentText(%o) -> %s', (overrides, expected) => {
    expect(bookingPaymentText(booking(overrides))).toBe(expected);
  });

  it('isCourtBookingId', () => {
    expect(isCourtBookingId('CRT-48213')).toBe(true);
    expect(isCourtBookingId('GET-00025')).toBe(false);
    expect(isCourtBookingId(null)).toBe(false);
  });
});

describe('bookingIcs (calendar file)', () => {
  it('writes a valid event in UTC with escaped text and a reminder', () => {
    const ics = bookingIcs(booking({ venueName: 'GR Sports Courts, Dondaparthy' }), {
      address: 'Beside Ramalayam Arch; Dondaparthy',
      shopName: 'GR Sports',
      phone: '+91 76758 31496',
    });
    const lines = ics.split('\r\n');

    expect(ics.endsWith('\r\n')).toBe(true);
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('PRODID:-//GR Sports//Court booking//EN');
    expect(lines).toContain('UID:CRT-48213@grsports-courts');
    expect(lines).toContain('DTSTAMP:20261025T063000Z');
    expect(lines).toContain('DTSTART:20261025T123000Z');
    expect(lines).toContain('DTEND:20261025T143000Z');
    expect(lines).toContain('SUMMARY:Badminton – Court 1\\, GR Sports Courts\\, Dondaparthy');
    expect(lines).toContain('LOCATION:GR Sports Courts\\, Dondaparthy\\, Beside Ramalayam Arch\\; Dondaparthy');
    expect(lines).toContain(
      'DESCRIPTION:Booking CRT-48213\\nCourt 1\\, 6:00–8:00 PM\\n₹800 – pay at the venue (cash or UPI)\\nQuestions: +91 76758 31496',
    );
    expect(lines).toContain('TRIGGER:-PT1H');
    expect(lines.filter((l) => l.startsWith('BEGIN:')).length).toBe(lines.filter((l) => l.startsWith('END:')).length);
  });
});
