import React from 'react';
import { formatInr } from './format';
import { cx } from './ui';

/** Whole-number % saved against the original price, or null when there's no saving to show. */
export function discountPercent(price: number | null | undefined, mrp: number | null | undefined): number | null {
  if (!price || !mrp || !(mrp > price)) return null;
  const off = Math.round(((mrp - price) / mrp) * 100);
  return off >= 1 ? off : null;
}

const SIZES = {
  /** Admin lists. */
  compact: { price: 'text-[13px] font-semibold', mrp: 'text-[12px]', off: 'text-[12px]' },
  /** Product cards. */
  card: { price: 'text-[16px] font-semibold', mrp: 'text-[14px]', off: 'text-[13px]' },
  /** Racket cards (bigger price). */
  display: { price: 'font-display text-[24px] font-semibold', mrp: 'text-[15px]', off: 'text-[14px]' },
  /** Product dialog. */
  large: { price: 'font-display text-[28px] font-semibold', mrp: 'text-[17px]', off: 'text-[15px]' },
} as const;

/**
 * The shop's price, then the original price (MRP) struck through and the % saved — only when an
 * original price higher than the price is set.
 */
export const PriceTag: React.FC<{ price: number; mrp?: number | null; size?: keyof typeof SIZES; className?: string }> = ({
  price,
  mrp,
  size = 'card',
  className,
}) => {
  const s = SIZES[size];
  const off = discountPercent(price, mrp);
  return (
    <span className={cx('inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums', className)}>
      <span className={cx('text-ink', s.price)}>{formatInr(price)}</span>
      {off !== null && (
        <>
          <span className="sr-only">, original price</span>
          <del className={cx('text-ink-muted decoration-ink-muted/70', s.mrp)}>{formatInr(mrp as number)}</del>
          <span className={cx('font-semibold text-[#1E7A44]', s.off)}>{off}% off</span>
        </>
      )}
    </span>
  );
};
