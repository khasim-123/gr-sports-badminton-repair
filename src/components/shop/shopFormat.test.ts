import { describe, expect, it } from 'vitest';
import { makeApparel, makeOrder } from '../../test/fixtures';
import type { OrderStatus } from '../../types/shop';
import {
  activeApparel,
  canCustomerCancel,
  isOpenOrder,
  itemCount,
  nextStepText,
  orderDate,
  productColours,
  productInStock,
  productPhotos,
  productSizes,
  sizesLabel,
  sortedVariants,
  swatchColour,
} from './shopFormat';

describe('apparel catalogue', () => {
  it('productPhotos keeps safe, distinct photos (at most 6)', () => {
    const images = [
      '/images/apparel/tee/navy.webp',
      '/images/apparel/tee/navy.webp',
      'javascript:alert(1)',
      'http://evil.example/x.jpg',
      ...Array.from({ length: 8 }, (_, i) => `/uploads/tee-${i}.jpg`),
    ];
    const photos = productPhotos({ images });
    expect(photos).toHaveLength(6);
    expect(photos[0]).toBe('/images/apparel/tee/navy.webp');
    expect(photos).not.toContain('javascript:alert(1)');
    expect(productPhotos({ images: null as never })).toEqual([]);
  });

  it('activeApparel hides inactive / unnamed / unpriced items and puts featured first', () => {
    const list = [
      makeApparel({ id: 'b', name: 'Shorts', sortOrder: 1 }),
      makeApparel({ id: 'a', name: 'Jersey', sortOrder: 1 }),
      makeApparel({ id: 'feat', name: 'Track jacket', sortOrder: 5, isFeatured: true }),
      makeApparel({ id: 'first', name: 'Cap', sortOrder: 0 }),
      makeApparel({ id: 'hidden', isActive: false }),
      makeApparel({ id: 'nameless', name: ' ' }),
      makeApparel({ id: 'noprice', price: Number.NaN }),
    ];
    expect(activeApparel(list).map((p) => p.id)).toEqual(['feat', 'first', 'a', 'b']);
    expect(activeApparel(undefined)).toEqual([]);
  });

  it('sizes and colours come from the server, else from the variants', () => {
    const p = makeApparel();
    expect(sortedVariants(p).map((v) => v.id)).toEqual(['tee-1-m-white', 'tee-1-m-navy', 'tee-1-l-navy']);
    expect(productSizes(p)).toEqual(['M', 'L']);
    const bare = makeApparel({ sizes: [], colours: [] });
    expect(productSizes(bare)).toEqual(['M', 'L']);
    expect(productColours(bare)).toEqual([
      { colour: 'White', colourHex: undefined },
      { colour: 'Navy', colourHex: '#1B2A4A' },
    ]);
  });

  it('productInStock trusts the server flag, else checks the variants', () => {
    expect(productInStock(makeApparel({ inStock: false }))).toBe(false);
    expect(productInStock(makeApparel({ inStock: undefined as never }))).toBe(true);
    expect(productInStock(makeApparel({ inStock: undefined as never, variants: [] }))).toBe(false);
  });

  it.each([
    [['S', 'M', 'L', 'XL', 'XXL'], 'Sizes S–XXL'],
    [['M', 'L'], 'Sizes M, L'],
    [['M'], 'Size M'],
    [['Free size'], 'Free size'],
    [[], ''],
  ])('sizesLabel(%o) -> %s', (sizes, expected) => {
    expect(sizesLabel(sizes)).toBe(expected);
  });

  it('swatchColour uses a safe hex, else a known colour name', () => {
    expect(swatchColour('Navy', '#101010')).toBe('#101010');
    expect(swatchColour(' Navy Blue ', 'url(javascript:x)')).toBe('#1B2A4A');
    expect(swatchColour('Sunset', null)).toBeNull();
  });
});

describe('orders', () => {
  it.each<[OrderStatus, boolean, boolean]>([
    ['Placed', true, true],
    ['Confirmed', true, true],
    ['Packed', false, true],
    ['Out for Delivery', false, true],
    ['Ready for Pickup', false, true],
    ['Delivered', false, false],
    ['Picked Up', false, false],
    ['Cancelled', false, false],
  ])('%s: customer can cancel %s, open %s', (status, cancel, open) => {
    expect(canCustomerCancel({ status })).toBe(cancel);
    expect(isOpenOrder({ status })).toBe(open);
  });

  it('itemCount adds up the pieces', () => {
    expect(itemCount(makeOrder())).toBe(2);
    expect(itemCount({ items: [] })).toBe(0);
  });

  it('orderDate shows the date in Indian style, or the raw text when unreadable', () => {
    expect(orderDate('2026-10-25T10:30:00+05:30')).toBe('25 Oct 2026');
    expect(orderDate('soon')).toBe('soon');
  });

  it.each<[Partial<Parameters<typeof makeOrder>[0]>, string]>([
    [{ status: 'Placed', fulfilment: 'delivery' }, "We'll check your order and call you before we deliver. Pay in cash or by UPI when it arrives."],
    [{ status: 'Placed', fulfilment: 'pickup' }, "We'll check your order and message you when it's ready at the shop. Pay in cash or by UPI when you collect it."],
    [{ status: 'Packed', fulfilment: 'delivery' }, 'Your order is being packed for delivery. Pay in cash or by UPI when it arrives.'],
    [{ status: 'Confirmed', fulfilment: 'pickup' }, "Your order is being packed. We'll tell you when it's ready to collect."],
    [{ status: 'Out for Delivery' }, 'On the way to you. Pay in cash or by UPI when it arrives.'],
    [{ status: 'Ready for Pickup', fulfilment: 'pickup' }, 'Ready at the shop. Pay in cash or by UPI when you collect it.'],
    [{ status: 'Delivered' }, 'Delivered. Thank you for shopping with us.'],
    [{ status: 'Cancelled', cancelReason: 'Out of stock' }, 'Cancelled: Out of stock'],
    [{ status: 'Cancelled' }, 'This order was cancelled.'],
    // Paid in advance (admin "Record payment"): never ask for payment again.
    [{ status: 'Placed', fulfilment: 'delivery', paymentStatus: 'Paid' }, "We'll check your order and call you before we deliver. Already paid."],
    [{ status: 'Out for Delivery', paymentStatus: 'Paid' }, 'On the way to you. Already paid.'],
    [{ status: 'Ready for Pickup', fulfilment: 'pickup', paymentStatus: 'Paid' }, 'Ready at the shop. Already paid.'],
  ])('nextStepText(%o)', (overrides, expected) => {
    expect(nextStepText(makeOrder(overrides))).toBe(expected);
  });
});
