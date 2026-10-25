import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHOP_SETTINGS } from '../../../hooks/useShopSettings';
import { makeEvent } from '../../../test/fixtures';
import {
  categoryLabel,
  eventAction,
  eventDateBlock,
  eventDateLong,
  eventDateText,
  eventPhoto,
  feeText,
  needsPartner,
  registrationStatus,
  spotsText,
  visibleEvents,
} from './events';
import { shopView } from './shop';

// "This year" is 2026 for these tests (the year is only shown for other years).
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 25, 12, 0));
});
afterAll(() => {
  vi.useRealTimers();
});

const range = (startDate: string, endDate: string | null = null) => ({ startDate, endDate });

describe('eventDateText (cards and banners)', () => {
  it.each([
    [range('2026-11-14'), 'Sat 14 Nov'],
    [range('2026-11-14', '2026-11-14'), 'Sat 14 Nov'],
    [range('2026-11-14', '2026-11-10'), 'Sat 14 Nov'], // end before start: treated as one day
    [range('2027-01-09'), 'Sat 9 Jan 2027'],
    [range('2026-11-14', '2026-11-15'), '14–15 Nov'],
    [range('2026-11-30', '2026-12-02'), '30 Nov – 2 Dec'],
    [range('2026-12-30', '2027-01-02'), '30 Dec 2026 – 2 Jan 2027'],
    [range('2027-02-06', '2027-02-07'), '6–7 Feb 2027'],
    [range('not-a-date'), 'not-a-date'],
  ])('%o -> %s', (dates, expected) => {
    expect(eventDateText(dates)).toBe(expected);
  });
});

describe('eventDateLong (event dialog)', () => {
  it.each([
    [range('2026-11-14'), 'Saturday, 14 November 2026'],
    [range('2026-11-14', '2026-11-15'), 'Saturday 14 to Sunday 15 November 2026'],
    [range('2026-11-30', '2026-12-02'), 'Monday 30 November to Wednesday 2 December 2026'],
    [range('2026-12-30', '2027-01-02'), 'Wednesday, 30 December 2026 to Saturday, 2 January 2027'],
  ])('%o -> %s', (dates, expected) => {
    expect(eventDateLong(dates)).toBe(expected);
  });
});

describe('eventDateBlock', () => {
  it('shows the day range for same-month events and the start day otherwise', () => {
    expect(eventDateBlock(range('2026-11-14'))).toEqual({ month: 'Nov', day: '14' });
    expect(eventDateBlock(range('2026-11-14', '2026-11-15'))).toEqual({ month: 'Nov', day: '14–15' });
    expect(eventDateBlock(range('2026-11-30', '2026-12-02'))).toEqual({ month: 'Nov', day: '30' });
  });
});

describe('feeText', () => {
  it.each([
    [{ entryFee: 600, feeNote: 'per pair' }, '₹600 per pair'],
    [{ entryFee: 1500, feeNote: '  ' }, '₹1,500'],
    [{ entryFee: 125000, feeNote: null }, '₹1,25,000'],
    [{ entryFee: 0, feeNote: 'per pair' }, 'Free entry'],
    [{ entryFee: null }, 'Free entry'],
    [{ entryFee: Number.NaN }, 'Free entry'],
  ])('%o -> %s', (fee, expected) => {
    expect(feeText(makeEvent(fee))).toBe(expected);
  });
});

describe('spotsText', () => {
  it.each([
    [{ spotsLeft: 12 }, '12 spots left'],
    [{ spotsLeft: 1 }, '1 spot left'],
    [{ spotsLeft: 0 }, 'Full'],
    [{ spotsLeft: -2 }, 'Full'],
    [{ spotsLeft: null }, null],
    [{ registrationMode: 'whatsapp' as const, spotsLeft: 5 }, null],
  ])('%o -> %s', (overrides, expected) => {
    expect(spotsText(makeEvent(overrides))).toBe(expected);
  });
});

describe('registrationStatus', () => {
  it.each([
    [{ registrationMode: 'none' as const }, null],
    [{ registrationOpen: false, spotsLeft: 0 }, 'Registrations full'],
    [{ registrationOpen: false, spotsLeft: 4 }, 'Registration closed'],
    [{ registrationOpen: false, registrationMode: 'whatsapp' as const, spotsLeft: 0 }, 'Registration closed'],
    [{ registrationDeadline: '2026-11-10' }, 'Register by Tue, 10 Nov'],
    [{ registrationDeadline: null }, 'Registration open'],
  ])('%o -> %s', (overrides, expected) => {
    expect(registrationStatus(makeEvent(overrides))).toBe(expected);
  });
});

describe('eventAction', () => {
  const shop = shopView({ ...DEFAULT_SHOP_SETTINGS, name: 'GR Sports', whatsapp: '+919000000001', phone: '+919000000002' });

  it('form events register on the website', () => {
    expect(eventAction(makeEvent(), shop)).toEqual({ kind: 'form', label: 'Register' });
  });

  it('WhatsApp events link to a pre-filled message to the shop', () => {
    const e = makeEvent({ registrationMode: 'whatsapp' });
    const message = "Hi GR Sports, I'd like to register for GR Sports Doubles Open 2026 (Sat 14 Nov).";
    expect(eventAction(e, shop)).toEqual({
      kind: 'link',
      label: 'Register on WhatsApp',
      href: `https://wa.me/919000000001?text=${encodeURIComponent(message)}`,
      external: true,
    });
  });

  it('phone events call the shop', () => {
    expect(eventAction(makeEvent({ registrationMode: 'phone' }), shop)).toEqual({
      kind: 'link',
      label: 'Call to register',
      href: 'tel:+919000000002',
      external: false,
    });
  });

  it('link events open the organiser page, but only for safe links', () => {
    expect(eventAction(makeEvent({ registrationMode: 'url', registrationUrl: 'https://forms.example.com/open-2026' }), shop)).toEqual({
      kind: 'link',
      label: 'Register',
      href: 'https://forms.example.com/open-2026',
      external: true,
    });
    expect(eventAction(makeEvent({ registrationMode: 'url', registrationUrl: 'javascript:alert(1)' }), shop)).toEqual({
      kind: 'details',
      label: 'View details',
    });
  });

  it('closed or no-registration events only offer the details', () => {
    expect(eventAction(makeEvent({ registrationOpen: false }), shop)).toEqual({ kind: 'details', label: 'View details' });
    expect(eventAction(makeEvent({ registrationMode: 'none' }), shop)).toEqual({ kind: 'details', label: 'View details' });
  });

  it('uses the current shop details when none are passed', () => {
    const action = eventAction(makeEvent({ registrationMode: 'whatsapp' }));
    expect(action.kind === 'link' && action.href).toMatch(/^https:\/\/wa\.me\/917675831496\?text=/);
  });
});

describe('visibleEvents', () => {
  it('keeps active, current events with a title, soonest first', () => {
    const list = [
      makeEvent({ id: 'late', startDate: '2026-12-05' }),
      makeEvent({ id: 'draft', isActive: false }),
      makeEvent({ id: 'past', status: 'past' }),
      makeEvent({ id: 'untitled', title: '   ' }),
      makeEvent({ id: 'same-day-2', startDate: '2026-11-14', sortOrder: 2 }),
      makeEvent({ id: 'same-day-1', startDate: '2026-11-14', sortOrder: 1 }),
      makeEvent({ id: 'on-now', startDate: '2026-10-20', status: 'ongoing' }),
    ];
    expect(visibleEvents(list).map((e) => e.id)).toEqual(['on-now', 'same-day-1', 'same-day-2', 'late']);
    expect(visibleEvents(undefined)).toEqual([]);
  });
});

describe('needsPartner', () => {
  it.each([
    ["Men's Doubles", true],
    ['MIXED', true],
    ['Pair event (U-13)', true],
    ['U-15 Singles', false],
    ['', false],
    [undefined, false],
  ])('%s -> %s', (category, expected) => {
    expect(needsPartner(category)).toBe(expected);
  });
});

describe('categoryLabel and eventPhoto', () => {
  it('names each kind of event', () => {
    expect(categoryLabel(makeEvent({ category: 'coaching_camp' }))).toBe('Coaching camp');
    expect(categoryLabel(makeEvent({ category: 'store_event' }))).toBe('At the shop');
    expect(categoryLabel(makeEvent({ category: 'unknown' as never }))).toBe('Event');
  });

  it('only uses safe photo URLs', () => {
    expect(eventPhoto(makeEvent({ bannerImageUrl: '/uploads/banner.jpg', mobileImageUrl: 'http://evil.example/x.jpg' }))).toEqual({
      desktop: '/uploads/banner.jpg',
      mobile: null,
    });
  });
});
