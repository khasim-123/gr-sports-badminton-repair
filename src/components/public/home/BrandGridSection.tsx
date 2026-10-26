import React from 'react';
import { ArrowRight } from 'lucide-react';
import { SectionHeader, container, cx } from './ui';

export interface BrandTile {
  name: string;
  /** Catalogues that have this brand, e.g. [{ label: '3 rackets', onOpen }, { label: '12 strings', onOpen }]. */
  links: { key: string; label: string; onOpen: () => void }[];
}

/**
 * "Brand grid" (GR website map): the brands the shop stocks, from the live rackets and strings
 * lists — names only (no logos), each opening that brand in the catalogue.
 */
export const BrandGridSection: React.FC<{ brands: BrandTile[] }> = ({ brands }) => {
  if (brands.length === 0) return null;
  return (
    <section id="brands" aria-labelledby="brands-title" className="scroll-mt-20 bg-white py-6 sm:py-8">
      <div className={container}>
        <SectionHeader id="brands-title" title="Shop by brand" />
        <ul
          className={cx(
            'mt-6 grid grid-cols-2 gap-3 sm:gap-4',
            brands.length >= 5 ? 'sm:grid-cols-3 lg:grid-cols-5' : brands.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
          )}
        >
          {brands.map((b) => (
            <li key={b.name} className="flex flex-col rounded-2xl border border-line bg-white px-4 pb-2 pt-4">
              <p className="font-display text-[26px] font-bold uppercase leading-none tracking-[0.04em] text-ink">{b.name}</p>
              <ul className="mt-2">
                {b.links.map((l) => (
                  <li key={l.key}>
                    <button
                      type="button"
                      onClick={l.onOpen}
                      aria-label={`${b.name}: ${l.label}`}
                      className="group inline-flex min-h-[40px] items-center gap-1.5 rounded text-[14px] font-medium text-ink-soft hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue"
                    >
                      {l.label}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
