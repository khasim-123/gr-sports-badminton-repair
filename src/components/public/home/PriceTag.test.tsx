import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { originalPriceHint, parseOriginalPrice } from '../../admin/content/shared';
import { PriceTag, discountPercent } from './PriceTag';

describe('PriceTag', () => {
  it('shows the price, the original price struck through and the % off', () => {
    const { container } = render(<PriceTag price={1499} mrp={1999} />);
    expect(screen.getByText('₹1,499')).toBeInTheDocument();
    expect(container.querySelector('del')).toHaveTextContent('₹1,999');
    expect(screen.getByText('25% off')).toBeInTheDocument();
    // Screen readers hear which number is the original price.
    expect(container.textContent).toContain('original price');
  });

  it('shows only the price without a higher original price', () => {
    for (const mrp of [null, undefined, 1499, 999]) {
      const { container, unmount } = render(<PriceTag price={1499} mrp={mrp} />);
      expect(container.querySelector('del')).toBeNull();
      expect(container).toHaveTextContent(/^₹1,499$/);
      unmount();
    }
  });

  it('rounds the saving to a whole percent', () => {
    expect(discountPercent(749, 999)).toBe(25);
    expect(discountPercent(990, 1000)).toBe(1);
    expect(discountPercent(999, 1000)).toBeNull(); // under 1%: not worth showing
    expect(discountPercent(null, 1000)).toBeNull();
  });
});

describe('original price field (admin)', () => {
  it('follows the same rules as the server', () => {
    expect(parseOriginalPrice('', 1500)).toEqual({ mrp: null });
    expect(parseOriginalPrice('1999', 1500)).toEqual({ mrp: 1999 });
    expect(parseOriginalPrice('1500', 1500).error).toMatch(/more than your price/);
    expect(parseOriginalPrice('1999', null).error).toMatch(/Add your price first/);
    expect(parseOriginalPrice('abc', 1500).error).toMatch(/amount in rupees/);
  });

  it('previews what customers will see', () => {
    expect(originalPriceHint('1999', '1499')).toBe('Shown as ₹1,999 struck through · 25% off');
    expect(originalPriceHint('', '1499')).toMatch(/Empty = not shown/);
  });
});
