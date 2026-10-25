import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cx } from '../public/home/ui';
import { photoSrcSet } from './shopFormat';
import { safeImageUrl } from '../public/home/format';

/** − 2 + quantity stepper (1–max). */
export const QtyStepper: React.FC<{
  value: number;
  onChange: (n: number) => void;
  max?: number;
  label: string;
  size?: 'sm' | 'md';
}> = ({ value, onChange, max = 10, label, size = 'sm' }) => {
  const h = size === 'md' ? 'h-11 w-11' : 'h-10 w-10';
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-xl border border-line bg-white">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Decrease quantity"
        className={cx(h, 'inline-flex items-center justify-center rounded-l-xl text-ink hover:bg-paper disabled:text-ink-muted/40 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue')}
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="min-w-[2rem] text-center text-[15px] font-semibold tabular-nums text-ink" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Increase quantity"
        className={cx(h, 'inline-flex items-center justify-center rounded-r-xl text-ink hover:bg-paper disabled:text-ink-muted/40 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue')}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

/** Small square product photo for cart / order lines. Rackets and string packs are shown whole. */
export const ItemThumb: React.FC<{ src?: string | null; alt?: string; kind?: string; className?: string }> = ({
  src,
  alt = '',
  kind,
  className,
}) => {
  const safe = safeImageUrl(src || null);
  const [broken, setBroken] = useState(false);
  const contain = kind === 'racket' || kind === 'string';
  return (
    <div className={cx('relative shrink-0 overflow-hidden rounded-lg border border-line', contain ? 'bg-white' : 'bg-paper-deep', className || 'h-20 w-20')}>
      {safe && !broken ? (
        <img
          src={safe}
          srcSet={photoSrcSet(safe)}
          sizes="96px"
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className={cx('absolute inset-0 h-full w-full', contain ? 'object-contain p-1.5' : 'object-cover')}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-[11px] text-ink-muted">No photo</span>
      )}
    </div>
  );
};
