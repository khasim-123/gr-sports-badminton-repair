import { describe, expect, it } from 'vitest';
import { formatMobile, localMobileDigits, mobileTelHref, normalizeMobile, sanitizeMobileInput } from './phone';

describe('normalizeMobile', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['(+91) 98765 43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['6000000000', '+916000000000'],
    ['5876543210', null], // Indian mobiles start with 6-9
    ['987654321', null],
    ['98765432101', null],
    ['', null],
    [null, null],
    [undefined, null],
  ])('%o -> %o', (raw, expected) => {
    expect(normalizeMobile(raw)).toBe(expected);
  });
});

describe('formatMobile / localMobileDigits / mobileTelHref', () => {
  it('formats valid numbers as "+91 98765 43210" and leaves others readable', () => {
    expect(formatMobile('+919876543210')).toBe('+91 98765 43210');
    expect(formatMobile('09876543210')).toBe('+91 98765 43210');
    expect(formatMobile(' 12345 ')).toBe('12345');
    expect(formatMobile(null)).toBe('');
  });

  it('gives the 10 local digits, or nothing when invalid', () => {
    expect(localMobileDigits('+91 98765 43210')).toBe('9876543210');
    expect(localMobileDigits('12345')).toBe('');
  });

  it('builds a tel: link only for valid numbers', () => {
    expect(mobileTelHref('98765 43210')).toBe('tel:+919876543210');
    expect(mobileTelHref('12345')).toBeUndefined();
  });
});

describe('sanitizeMobileInput (what a "+91" field keeps while typing)', () => {
  it.each([
    ['98765 43210', '9876543210'],
    ['+91 98765 43210', '9876543210'],
    ['919876543210', '9876543210'],
    ['09876543210', '9876543210'],
    ['98765432109999', '9876543210'],
    ['abc98', '98'],
    ['', ''],
  ])('%o -> %o', (raw, expected) => {
    expect(sanitizeMobileInput(raw)).toBe(expected);
  });
});
