import { describe, expect, it } from 'vitest';
import { calendarDaysBetween, csvRow, formatDate, formatDateTime, formatINR, formatTime, parseDate, pluralDays } from './format';

describe('formatINR', () => {
  it.each([
    [1836, '₹1,836'],
    [149990, '₹1,49,990'],
    [99.5, '₹99.5'],
    [-250, '-₹250'],
    ['450', '₹450'],
    [0, '₹0'],
    [null, '₹0'],
    [undefined, '₹0'],
    [Number.NaN, '₹0'],
    ['abc', '₹0'],
  ])('%o -> %s', (amount, expected) => {
    expect(formatINR(amount as number | string | null | undefined)).toBe(expected);
  });
});

describe('parseDate', () => {
  it('reads plain dates and "date time" values as local time', () => {
    expect(parseDate('2026-10-23')).toEqual(new Date(2026, 9, 23));
    expect(parseDate('2026-10-23 16:30')).toEqual(new Date(2026, 9, 23, 16, 30));
    expect(parseDate('2026-10-23T16:30:05')).toEqual(new Date(2026, 9, 23, 16, 30, 5));
  });

  it('reads ISO timestamps with a zone as that instant', () => {
    expect(parseDate('2026-10-23T11:00:00Z')?.getTime()).toBe(Date.UTC(2026, 9, 23, 11, 0));
  });

  it('passes Dates and epoch numbers through and rejects junk', () => {
    const d = new Date(2026, 0, 1);
    expect(parseDate(d)).toBe(d);
    expect(parseDate(0)).toEqual(new Date(0));
    expect(parseDate(new Date('nope'))).toBeNull();
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate(null)).toBeNull();
  });
});

describe('formatDate / formatTime / formatDateTime', () => {
  it('formats dates as "23 Oct 2026" and times as "4:30 PM"', () => {
    expect(formatDate('2026-10-23')).toBe('23 Oct 2026');
    expect(formatTime(new Date(2026, 9, 23, 0, 5))).toBe('12:05 AM');
    expect(formatTime(new Date(2026, 9, 23, 12, 0))).toBe('12:00 PM');
    expect(formatTime(new Date(2026, 9, 23, 16, 30))).toBe('4:30 PM');
    expect(formatDateTime('2026-10-23 16:30')).toBe('23 Oct 2026, 4:30 PM');
  });

  it('falls back to the raw text, or a dash for nothing', () => {
    expect(formatDate('next week')).toBe('next week');
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined, 'Not set')).toBe('Not set');
    expect(formatDateTime('')).toBe('—');
  });
});

describe('calendarDaysBetween / pluralDays', () => {
  it('counts whole calendar days, ignoring the time of day', () => {
    expect(calendarDaysBetween(new Date(2026, 9, 25, 23, 59), new Date(2026, 9, 26, 0, 1))).toBe(1);
    expect(calendarDaysBetween(new Date(2026, 9, 25), new Date(2026, 9, 20))).toBe(-5);
    expect(calendarDaysBetween(new Date(2026, 1, 28), new Date(2026, 2, 1))).toBe(1);
  });

  it('pluralises days', () => {
    expect(pluralDays(1)).toBe('1 day');
    expect(pluralDays(-1)).toBe('-1 day');
    expect(pluralDays(3)).toBe('3 days');
  });
});

describe('csvRow', () => {
  it('quotes every cell and doubles quotes', () => {
    expect(csvRow(['GET-00025', 'Anil "AK" Kumar', 450, null, undefined])).toBe('"GET-00025","Anil ""AK"" Kumar","450","",""');
  });

  it('neutralises spreadsheet formulas but keeps plain negative numbers', () => {
    expect(csvRow(['=HYPERLINK("http://evil")', '+91 98765 43210', '@SUM(A1)', '-250', '-12.5', '-x'])).toBe(
      `"'=HYPERLINK(""http://evil"")","'+91 98765 43210","'@SUM(A1)","-250","-12.5","'-x"`,
    );
  });
});
