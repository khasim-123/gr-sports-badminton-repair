import React from 'react';
import { siteSrcSet } from './format';
import { cx } from './ui';

interface PhotoProps {
  /** e.g. "/images/site/strings-closeup.webp" (the -sm variant is picked up automatically). */
  src: string;
  alt: string;
  /** CSS `sizes` for the srcset. */
  sizes: string;
  className?: string;
  imgClassName?: string;
  /** Aspect box (no layout shift), e.g. "aspect-[4/5]". */
  aspect?: string;
  position?: string;
  eager?: boolean;
}

/** A bundled site photo in a fixed aspect-ratio box with srcset, lazy by default. */
export const Photo: React.FC<PhotoProps> = ({ src, alt, sizes, className, imgClassName, aspect = 'aspect-[3/2]', position, eager }) => (
  <div className={cx('relative overflow-hidden bg-paper-deep', aspect, className)}>
    <img
      src={src}
      srcSet={siteSrcSet(src)}
      sizes={sizes}
      alt={alt}
      width={1920}
      height={1280}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={cx('absolute inset-0 h-full w-full object-cover', imgClassName)}
      style={position ? { objectPosition: position } : undefined}
    />
  </div>
);
