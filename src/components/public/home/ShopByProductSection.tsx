import React from 'react';
import { ArrowRight } from 'lucide-react';
import { siteSrcSet } from './format';
import { SECTION_IDS } from './shop';
import { SectionHeader, container, cx } from './ui';

export interface ProductCategory {
  key: string;
  name: string;
  /** Short line under the name, from live data (e.g. "8 rackets"). */
  detail: string;
  image: string;
  onOpen: () => void;
}

interface ShopByProductSectionProps {
  /** Only the catalogues the shop has; empty = the section is not shown. */
  categories: ProductCategory[];
  id?: string;
  title?: string;
  intro?: string;
}

/**
 * "Shop by product": one tile per catalogue (rackets, strings, T-shirts), each opening it. The
 * main page uses the same tiles for its sections (badminton, T-shirts, academies, …).
 */
export const ShopByProductSection: React.FC<ShopByProductSectionProps> = ({ categories, id = SECTION_IDS.shop, title = 'Shop by product', intro }) => {
  if (categories.length === 0) return null;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t border-line bg-paper py-10 sm:py-14">
      <div className={container}>
        <SectionHeader id={`${id}-title`} title={title} intro={intro} />
        <ul
          className={cx(
            'mt-6 grid gap-3 sm:gap-6',
            categories.length === 1 ? 'max-w-md' : categories.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3',
          )}
        >
          {categories.map((c) => (
            <li key={c.key}>
              {/* Phones: a compact row (photo, name, arrow). Larger screens: a photo card. */}
              <button
                type="button"
                onClick={c.onOpen}
                className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-white p-3 text-left transition-colors duration-150 hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue sm:flex-col sm:items-stretch sm:gap-0 sm:overflow-hidden sm:p-0"
              >
                <span className="relative block aspect-square w-20 shrink-0 overflow-hidden rounded-xl bg-paper-deep sm:aspect-[16/10] sm:w-full sm:rounded-none">
                  <img
                    src={c.image}
                    srcSet={siteSrcSet(c.image)}
                    sizes="(min-width: 640px) 400px, 80px"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                </span>
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3 sm:px-5 sm:py-4">
                  <span className="min-w-0">
                    <span className="block font-display text-[22px] font-semibold leading-tight text-ink sm:text-[26px]">{c.name}</span>
                    <span className="mt-0.5 block text-[14px] text-ink-muted">{c.detail}</span>
                  </span>
                  <ArrowRight
                    className="h-5 w-5 shrink-0 text-ink transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
