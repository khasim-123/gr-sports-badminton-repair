import React from 'react';
import { ArrowRight, Check, Clock } from 'lucide-react';
import type { GettingServiceTier, RepairCategoryTier } from '../../../../types';
import { formatInr } from '../../home/format';
import { Photo } from '../../home/Photo';
import { useShop } from '../../home/shop';
import { SectionHeader, btn, container, cx } from '../../home/ui';

/** Ids on the Services page (old /#stringing and /#repairs homepage links are sent here). */
export const SERVICE_SECTION_IDS = { stringing: 'stringing', repairs: 'repairs' } as const;

/** "24 Hours" -> "24 hours" (data is admin-entered; only the unit words are lower-cased). */
function niceTurnaround(text: string): string {
  return (text || '').replace(/\b(Hours?|Days?)\b/g, (m) => m.toLowerCase()).trim();
}

interface ServicesProps {
  gettingServices: GettingServiceTier[];
  repairCategories: RepairCategoryTier[];
  onBook: (service: 'stringing' | 'repair') => void;
  /** "See the strings we stock" (opens the Strings page). */
  onOpenStrings?: () => void;
}

const priceRow = 'grid grid-cols-[1fr_auto] items-baseline gap-x-6 py-5';

/** Stringing packages with prices and turnaround (Services page). */
export const StringingSection: React.FC<ServicesProps> = ({ gettingServices, onBook, onOpenStrings }) => {
  const SHOP = useShop();
  const tiers = gettingServices.filter((t) => t.isActive !== false);
  return (
    <section id={SERVICE_SECTION_IDS.stringing} aria-labelledby="stringing-title" className="scroll-mt-20 bg-white py-10 sm:py-14">
      <div className={cx(container, 'grid gap-8 lg:grid-cols-12 lg:gap-12')}>
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <Photo
              src="/images/site/strings-closeup.webp"
              alt="A shuttlecock resting on a freshly strung racket"
              sizes="(min-width: 1024px) 460px, 100vw"
              aspect="aspect-[3/2] lg:aspect-[4/5]"
              className="rounded-xl"
            />
          </div>
        </div>
        <div className="lg:col-span-7">
          <SectionHeader
            id="stringing-title"
            title="Racket stringing"
            intro="Pick a package when you book, then choose the string, colour and tension. Times are counted from when we collect your racket."
          />
          {tiers.length > 0 ? (
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {tiers.map((t) => (
                <li key={t.id} className={priceRow}>
                  <h3 className="font-display text-[24px] font-semibold leading-tight text-ink">{t.name}</h3>
                  <p className="font-display text-[26px] font-semibold leading-tight text-ink tabular-nums">{formatInr(t.price)}</p>
                  {t.description && <p className="col-span-2 mt-1.5 text-[15px] leading-relaxed text-ink-soft">{t.description}</p>}
                  <ul className="col-span-2 mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[14px] text-ink-soft">
                    {t.turnaround && (
                      <li className="inline-flex items-center gap-1.5 font-medium text-ink">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        Ready in {niceTurnaround(t.turnaround)}
                      </li>
                    )}
                    {(t.features || []).filter(Boolean).map((f) => (
                      <li key={f} className="inline-flex items-center gap-1.5">
                        <Check className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-[15px] text-ink-soft">
              Call <a href={SHOP.phoneTel} className="font-semibold text-sportsBlue underline">{SHOP.phoneDisplay}</a> for current stringing prices.
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button type="button" onClick={() => onBook('stringing')} className={cx(btn.base, btn.primary)}>
              Book stringing
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            {onOpenStrings && (
              <a
                href="/strings"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenStrings();
                }}
                className={btn.link}
              >
                See the strings we stock
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

/** Repair problems with starting prices (Services page). */
export const RepairsSection: React.FC<ServicesProps> = ({ repairCategories, onBook }) => {
  const SHOP = useShop();
  const categories = repairCategories.filter((c) => c.isActive !== false);
  return (
    <section id={SERVICE_SECTION_IDS.repairs} aria-labelledby="repairs-title" className="scroll-mt-20 border-t border-line bg-white py-10 sm:py-14">
      <div className={cx(container, 'grid gap-8 lg:grid-cols-12 lg:gap-12')}>
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
            <ul className="mt-6 divide-y divide-line border-y border-line">
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
            <p className="mt-6 text-[15px] text-ink-soft">
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
