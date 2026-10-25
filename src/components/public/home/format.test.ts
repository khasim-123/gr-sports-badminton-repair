import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeStringProduct, makeVariant } from '../../../test/fixtures';
import type { DistancePricingConfig, GettingServiceTier } from '../../../types';
import {
  activeStrings,
  beyondFreeShort,
  beyondFreeText,
  describePickupHours,
  describeWeekdays,
  formatDay,
  formatInr,
  formatKm,
  formatSlot,
  hasPrice,
  inStockCount,
  localIsoDate,
  parseIsoDate,
  productLabel,
  relativeDate,
  safeHex,
  safeImageUrl,
  safeUrl,
  siteSrcSet,
  sortedVariants,
  turnaroundRange,
} from './format';

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 25, 12, 0));
});
afterAll(() => {
  vi.useRealTimers();
});

describe('URL safety', () => {
  it.each([
    ['/images/strings/bg65.webp', '/images/strings/bg65.webp'],
    ['  /uploads/a.jpg  ', '/uploads/a.jpg'],
    ['https://example.com/a b', 'https://example.com/a%20b'],
    ['http://example.com', 'http://example.com/'],
    ['//evil.example/x.js', null],
    ['javascript:alert(1)', null],
    ['data:text/html,<script>alert(1)</script>', null],
    ['ftp://example.com/file', null],
    ['not a url', null],
    ['   ', null],
    [null, null],
    [undefined, null],
  ])('safeUrl(%o) -> %o', (input, expected) => {
    expect(safeUrl(input)).toBe(expected);
  });

  it.each([
    ['https://cdn.example.com/p.jpg', 'https://cdn.example.com/p.jpg'],
    ['/uploads/p.jpg', '/uploads/p.jpg'],
    ['http://localhost:8040/uploads/p.jpg', 'http://localhost:8040/uploads/p.jpg'],
    ['http://127.0.0.1/uploads/p.jpg', 'http://127.0.0.1/uploads/p.jpg'],
    ['http://cdn.example.com/p.jpg', null],
    ['http://localhost.evil.example/p.jpg', null],
    ['javascript:alert(1)', null],
  ])('safeImageUrl(%o) -> %o', (input, expected) => {
    expect(safeImageUrl(input)).toBe(expected);
  });

  it.each([
    ['#fff', '#fff'],
    ['#FFFFFF', '#FFFFFF'],
    [' #11223344 ', '#11223344'],
    ['#12345', null],
    ['red', null],
    ['#fff; background:url(x)', null],
    [null, null],
  ])('safeHex(%o) -> %o', (input, expected) => {
    expect(safeHex(input)).toBe(expected);
  });
});

describe('siteSrcSet', () => {
  it('builds a srcset for the bundled site and apparel photos only', () => {
    expect(siteSrcSet('/images/site/hero.webp')).toBe('/images/site/hero-sm.webp 800w, /images/site/hero.webp 1920w');
    expect(siteSrcSet('/images/site/hero-sm.webp')).toBe('/images/site/hero-sm.webp 800w, /images/site/hero.webp 1920w');
    expect(siteSrcSet('/images/apparel/tee/navy.webp')).toBe('/images/apparel/tee/navy-sm.webp 800w, /images/apparel/tee/navy.webp 1600w');
    expect(siteSrcSet('/uploads/hero.webp')).toBeUndefined();
    expect(siteSrcSet('/images/site/hero.jpg')).toBeUndefined();
    expect(siteSrcSet(null)).toBeUndefined();
  });
});

describe('money', () => {
  it('formats rupees with Indian digit grouping', () => {
    expect(formatInr(149990)).toBe('₹1,49,990');
    expect(formatInr(650)).toBe('₹650');
    expect(formatInr(99.5)).toBe('₹99.5');
  });

  it('only counts positive finite numbers as a price', () => {
    expect(hasPrice(650)).toBe(true);
    expect(hasPrice(0)).toBe(false);
    expect(hasPrice(null)).toBe(false);
    expect(hasPrice(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('dates', () => {
  it('localIsoDate uses the local calendar day', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('parseIsoDate reads YYYY-MM-DD as a local date, and rejects junk', () => {
    expect(parseIsoDate('2026-11-14')).toEqual(new Date(2026, 10, 14));
    expect(parseIsoDate('2026-11')).toBeNull();
    expect(parseIsoDate('abc')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
  });

  it('formatDay shows the weekday, and the year only for other years', () => {
    expect(formatDay('2026-10-26')).toBe('Mon, 26 Oct');
    expect(formatDay('2026-10-26', { weekday: false })).toBe('26 Oct');
    expect(formatDay('2027-01-04')).toMatch(/^Mon, 4 Jan,? 2027$/);
    expect(formatDay('soon')).toBe('soon');
  });

  it.each([
    ['2026-10-25T11:59:40', 'just now'],
    ['2026-10-25T09:00:00', '3 hours ago'],
    ['2026-10-24T12:00:00', 'yesterday'],
    ['2026-10-22T12:00:00', '3 days ago'],
    ['2026-10-18T12:00:00', 'last week'],
    ['2026-08-20T12:00:00', '2 months ago'],
    ['2025-09-01T12:00:00', 'last year'],
    ['garbage', ''],
  ])('relativeDate(%s) -> %s', (iso, expected) => {
    expect(relativeDate(iso)).toBe(expected);
  });
});

describe('pickup days and hours', () => {
  it.each([
    [[0, 1, 2, 3, 4, 5], 'Mon–Sat'],
    [[0, 2, 4], 'Mon, Wed, Fri'],
    [[0, 1], 'Mon, Tue'],
    [[0, 1, 2, 3, 4, 5, 6], 'Every day'],
    [[5, 5, 9, -1, 4, 3], 'Thu–Sat'],
    [[], ''],
    [undefined, ''],
  ])('describeWeekdays(%o) -> %s', (days, expected) => {
    expect(describeWeekdays(days)).toBe(expected);
  });

  it('formatSlot joins the times with an unbreakable dash', () => {
    expect(formatSlot(' 10:00 - 13:00 ')).toBe('10:00⁠–⁠13:00');
  });

  it('describePickupHours lists the days and slots in plain words', () => {
    const settings = {
      openWeekdays: [0, 1, 2, 3, 4, 5],
      dailyPickupCapacity: 0,
      leadTimeDays: 0,
      bookingWindowDays: 14,
      closedDates: [],
    };
    expect(describePickupHours({ ...settings, pickupSlots: ['10:00 - 13:00', '16:00 - 19:00'] })).toEqual({
      days: 'Mon–Sat',
      slots: `${formatSlot('10:00 - 13:00')} and ${formatSlot('16:00 - 19:00')}`,
    });
    expect(describePickupHours({ ...settings, pickupSlots: ['08:00 - 10:00', '12:00 - 14:00', '17:00 - 19:00'] }).slots).toBe(
      `${formatSlot('08:00 - 10:00')}, ${formatSlot('12:00 - 14:00')} and ${formatSlot('17:00 - 19:00')}`,
    );
    expect(describePickupHours({ ...settings, pickupSlots: [] }).slots).toBe('');
    expect(describePickupHours(null)).toEqual({ days: '', slots: '' });
  });
});

describe('strings catalogue', () => {
  it('productLabel does not repeat the brand', () => {
    expect(productLabel({ brand: 'Yonex', name: 'BG 65 Titanium' })).toBe('Yonex BG 65 Titanium');
    expect(productLabel({ brand: 'Yonex', name: 'yonex Exbolt 63' })).toBe('yonex Exbolt 63');
    expect(productLabel({ brand: '', name: ' Aerobite ' })).toBe('Aerobite');
  });

  it('sortedVariants orders colours by sortOrder without changing the product', () => {
    const p = makeStringProduct({
      variants: [makeVariant({ id: 'b', colour: 'Black', sortOrder: 2 }), makeVariant({ id: 'a', colour: 'White', sortOrder: 1 })],
    });
    expect(sortedVariants(p).map((v) => v.colour)).toEqual(['White', 'Black']);
    expect(p.variants[0].colour).toBe('Black');
  });

  it('inStockCount counts colours in stock, or uses the server count when there are no variants', () => {
    expect(inStockCount(makeStringProduct())).toBe(2);
    expect(inStockCount(makeStringProduct({ variants: [], inStockCount: 4 }))).toBe(4);
  });

  it('activeStrings hides inactive and nameless strings and sorts by the admin order', () => {
    const list = [
      makeStringProduct({ id: '3', name: 'Exbolt 65', sortOrder: 1 }),
      makeStringProduct({ id: '2', name: 'Aerobite', sortOrder: 1 }),
      makeStringProduct({ id: '1', name: 'BG 80', sortOrder: 0 }),
      makeStringProduct({ id: 'x', name: 'Hidden', isActive: false }),
      makeStringProduct({ id: 'y', name: '  ' }),
    ];
    expect(activeStrings(list).map((p) => p.id)).toEqual(['1', '2', '3']);
  });
});

describe('pickup pricing text', () => {
  const base: DistancePricingConfig = {
    shopLocationName: 'GR Sports',
    shopLat: 17.7,
    shopLng: 83.3,
    freeRadiusKm: 15,
    perKmRateBeyondFree: 15,
    pricingMethod: 'PER_KM',
    maxServiceDistanceKm: 40,
    slabs: [],
  };

  it('formatKm drops needless decimals', () => {
    expect(formatKm(15)).toBe('15 km');
    expect(formatKm(12.5)).toBe('12.5 km');
  });

  it('per-km pricing', () => {
    expect(beyondFreeText(base)).toBe("Beyond that it's ₹15 per km.");
    expect(beyondFreeShort(base)).toEqual({ value: '₹15/km', label: 'beyond 15 km' });
  });

  it('slab pricing lists the paid slabs by distance', () => {
    const slab: DistancePricingConfig = {
      ...base,
      pricingMethod: 'SLAB',
      slabs: [
        { minKm: 20, maxKm: 30, price: 100 },
        { minKm: 0, maxKm: 15, price: 0 },
        { minKm: 15, maxKm: 20, price: 50 },
      ],
    };
    expect(beyondFreeText(slab)).toBe('Beyond that, a flat charge by distance: ₹50 up to 20 km, ₹100 up to 30 km.');
    expect(beyondFreeShort(slab)).toEqual({ value: 'from ₹50', label: 'beyond 15 km, by distance' });
  });

  it('falls back to the per-km rate, or says nothing when pickup is always free', () => {
    expect(beyondFreeText({ ...base, pricingMethod: 'SLAB', slabs: [{ minKm: 0, maxKm: 40, price: 0 }] })).toBe("Beyond that it's ₹15 per km.");
    expect(beyondFreeText({ ...base, perKmRateBeyondFree: 0 })).toBe('');
    expect(beyondFreeShort({ ...base, perKmRateBeyondFree: 0 })).toBeNull();
  });
});

describe('turnaroundRange', () => {
  const tier = (turnaround: string): GettingServiceTier => ({ id: turnaround, name: turnaround, price: 0, turnaround, description: '', features: [] });

  it.each([
    [['24 Hours'], 'about 24 hours'],
    [['24 Hours', '24–36 Hours', '48 hours'], 'between 24 and 48 hours'],
    [['24 Hours', '2 Days'], null],
    [['Same day hours'], null],
    [[], null],
  ])('%o -> %s', (turnarounds, expected) => {
    expect(turnaroundRange(turnarounds.map(tier))).toBe(expected);
  });
});
