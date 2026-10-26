import React from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import type { RepairCategoryTier } from '../../../types';
import { formatInr } from './format';
import { Photo } from './Photo';
import { SECTION_IDS, useShop } from './shop';
import { SectionHeader, btn, container, cx } from './ui';

/** "24 Hours" -> "24 hours" (data is admin-entered; only the unit words are lower-cased). */
function niceTurnaround(text: string): string {
  return (text || '').replace(/\b(Hours?|Days?)\b/g, (m) => m.toLowerCase()).trim();
}

interface ServicesProps {
  repairCategories: RepairCategoryTier[];
  onBook: (service: 'stringing' | 'repair') => void;
}

const priceRow = 'grid grid-cols-[1fr_auto] items-baseline gap-x-6 py-5';

export const RepairsSection: React.FC<ServicesProps> = ({ repairCategories, onBook }) => {
  const SHOP = useShop();
  const categories = repairCategories.filter((c) => c.isActive !== false);
  return (
    <section id={SECTION_IDS.repairs} aria-labelledby="repairs-title" className="scroll-mt-20 border-t border-line bg-white py-16 sm:py-24">
      <div className={cx(container, 'grid gap-10 lg:grid-cols-12 lg:gap-14')}>
        <div className="lg:order-2 lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <Photo
              src="/images/site/racket-dark.webp"
              alt="A red badminton racket and a feather shuttle on a dark table"
              sizes="(min-width: 1024px) 460px, 100vw"
              aspect="aspect-[3/2] lg:aspect-[4/5]"
              position="60% 50%"
              className="rounded-xl"
            />
          </div>
        </div>
        <div className="lg:order-1 lg:col-span-7">
          <SectionHeader
            id="repairs-title"
            title="Racket repairs"
            intro="Cracked frame, broken shaft, loose handle or worn grip. We inspect the racket first and send you an estimate with the price and the date it will be ready. Work starts only after you approve it."
          />
          {categories.length > 0 ? (
            <ul className="mt-8 divide-y divide-line border-y border-line">
              {categories.map((c) => (
                <li key={c.id} className={priceRow}>
                  <h3 className="font-display text-[24px] font-semibold leading-tight text-ink">{c.name}</h3>
                  <p className="whitespace-nowrap text-right leading-tight">
                    {c.basePrice > 0 ? (
                      <>
                        <span className="mr-1.5 text-[14px] text-ink-muted">from</span>
                        <span className="font-display text-[26px] font-semibold text-ink tabular-nums">{formatInr(c.basePrice)}</span>
                      </>
                    ) : (
                      <span className="text-[15px] text-ink-soft">After inspection</span>
                    )}
                  </p>
                  {c.description && <p className="col-span-2 mt-1.5 text-[15px] leading-relaxed text-ink-soft">{c.description}</p>}
                  {c.turnaround && (
                    <p className="col-span-2 mt-2.5 inline-flex items-center gap-1.5 text-[14px] font-medium text-ink">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      Usually {niceTurnaround(c.turnaround)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-[15px] text-ink-soft">
              Call <a href={SHOP.phoneTel} className="font-semibold text-sportsBlue underline">{SHOP.phoneDisplay}</a> to ask about a repair.
            </p>
          )}
          <p className="mt-5 text-[14px] leading-relaxed text-ink-muted">
            Prices are starting prices; the final price is in your estimate. Not every break can be repaired safely. If yours can't, we tell
            you after the inspection.
          </p>
          <div className="mt-8">
            <button type="button" onClick={() => onBook('repair')} className={cx(btn.base, btn.primary)}>
              Book a repair
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
