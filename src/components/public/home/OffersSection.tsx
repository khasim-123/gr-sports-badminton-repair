import React from 'react';
import { Megaphone } from 'lucide-react';
import type { Banner } from '../../../types/content';
import { ActionButton, type HeroAction } from './HeroCarousel';
import { formatDay, safeImageUrl, siteSrcSet } from './format';
import { SECTION_IDS } from './shop';
import { container, cx } from './ui';

interface OffersSectionProps {
  /** Promo banners (photo), already filtered to live ones and sorted. */
  promos: Banner[];
  /** Announcements (photo optional), already filtered to live ones and sorted. */
  announcements: Banner[];
  /** What a banner's button does (same targets as the top slideshow). */
  actionFor: (b: Banner) => HeroAction | undefined;
}

/**
 * Promo banners and announcements set up by the shop in Admin → Website content → Banners.
 * Nothing renders until the shop adds one, so the homepage never shows placeholder offers.
 */
export const OffersSection: React.FC<OffersSectionProps> = ({ promos, announcements, actionFor }) => {
  const shownPromos = promos.filter((b) => safeImageUrl(b.desktopImageUrl));
  if (shownPromos.length === 0 && announcements.length === 0) return null;

  // An odd number of promos opens with one wide banner, the rest sit in pairs.
  const [lead, pairs] = shownPromos.length % 2 === 1 ? [shownPromos[0], shownPromos.slice(1)] : [null, shownPromos];

  return (
    <section
      id={SECTION_IDS.offers}
      aria-labelledby="offers-title"
      className="scroll-mt-20 border-t border-line bg-paper py-16 sm:py-20"
    >
      <div className={container}>
        <h2 id="offers-title" className="sr-only">
          Offers and announcements
        </h2>

        {shownPromos.length > 0 && (
          <div className="space-y-4 sm:space-y-6">
            {lead && <PromoBanner banner={lead} action={actionFor(lead)} wide />}
            {pairs.length > 0 && (
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                {pairs.map((b) => (
                  <PromoBanner key={b.id} banner={b} action={actionFor(b)} />
                ))}
              </div>
            )}
          </div>
        )}

        {announcements.length > 0 && (
          <div className={cx(shownPromos.length > 0 && 'mt-12 sm:mt-16')}>
            <h3 className="font-display text-[28px] font-semibold leading-tight tracking-[0.01em] text-ink sm:text-[32px]">Announcements</h3>
            <ul className={cx('mt-6 grid gap-4', announcements.length === 1 ? 'max-w-3xl' : 'md:grid-cols-2')}>
              {announcements.map((b) => (
                <li key={b.id}>
                  <Announcement banner={b} action={actionFor(b)} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};

/**
 * Photo banner. Phones: photo, then the words below it. Larger screens: the words sit over the
 * photo on a dark fade (left side for the one `wide` banner, bottom for paired banners), so a
 * banner is only as tall as its photo.
 */
const PromoBanner: React.FC<{ banner: Banner; action?: HeroAction; wide?: boolean }> = ({ banner: b, action, wide }) => {
  const image = safeImageUrl(b.desktopImageUrl) as string;
  const mobileImage = safeImageUrl(b.mobileImageUrl);
  const badge = (b.badge || '').trim();
  const subtitle = (b.subtitle || '').trim();
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-ink text-white">
      <div
        className={cx(
          'relative aspect-[16/9] w-full bg-ink-soft',
          wide ? 'sm:aspect-auto sm:h-[clamp(240px,26vw,320px)]' : 'md:aspect-[4/3] lg:aspect-[16/9]',
        )}
      >
        <picture>
          {mobileImage && <source media="(max-width: 639px)" srcSet={mobileImage} />}
          <img
            src={image}
            srcSet={siteSrcSet(image)}
            sizes={wide ? '(min-width: 1200px) 1200px, 100vw' : '(min-width: 768px) 600px, 100vw'}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </picture>
        <div
          aria-hidden="true"
          className={cx(
            'absolute inset-0 hidden sm:block',
            wide
              ? 'bg-[linear-gradient(90deg,rgba(9,18,30,0.88)_0%,rgba(9,18,30,0.62)_40%,rgba(9,18,30,0.08)_75%)]'
              : 'bg-[linear-gradient(0deg,rgba(9,18,30,0.92)_0%,rgba(9,18,30,0.7)_38%,rgba(9,18,30,0)_72%)]',
          )}
        />
      </div>
      <div
        className={cx(
          'flex flex-1 flex-col p-5',
          wide
            ? 'sm:absolute sm:inset-y-0 sm:left-0 sm:max-w-[600px] sm:justify-center sm:p-10 lg:p-12'
            : 'sm:absolute sm:inset-x-0 sm:bottom-0 sm:p-6 lg:p-7',
        )}
      >
        {badge && <p className="text-[13px] font-semibold tracking-wide text-accent">{badge}</p>}
        <h3
          className={cx(
            'font-display font-semibold leading-[1.05] text-balance',
            badge && 'mt-1.5',
            wide ? 'text-[28px] sm:text-[40px]' : 'text-[26px] lg:text-[30px]',
          )}
        >
          {b.title}
        </h3>
        {subtitle && (
          <p className={cx('mt-2 max-w-[520px] text-[15px] leading-relaxed text-white/85 sm:text-[16px]', !wide && 'sm:line-clamp-2')}>{subtitle}</p>
        )}
        {action && (
          <div className={cx(wide ? 'pt-5' : 'mt-auto pt-5 sm:mt-0 sm:pt-4')}>
            <ActionButton action={action} variant="accent" />
          </div>
        )}
      </div>
    </article>
  );
};

/** Notice card: label, title, details, optional link; a photo shows as a small square beside the text. */
const Announcement: React.FC<{ banner: Banner; action?: HeroAction }> = ({ banner: b, action }) => {
  const image = safeImageUrl(b.desktopImageUrl);
  const subtitle = (b.subtitle || '').trim();
  return (
    <article className="flex h-full gap-4 rounded-2xl border border-line bg-white p-4 sm:gap-5 sm:p-5">
      {image && (
        <div className="relative aspect-square w-20 shrink-0 self-start overflow-hidden rounded-xl bg-paper-deep sm:w-28">
          <img src={image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-[#9A6B00]">
          <Megaphone className="h-4 w-4 shrink-0" aria-hidden="true" />
          {(b.badge || '').trim() || 'Announcement'}
        </p>
        <h4 className="mt-2 text-[18px] font-semibold leading-snug text-ink">{b.title}</h4>
        {subtitle && <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{subtitle}</p>}
        {b.endsAt && <p className="mt-3 text-[13px] text-ink-muted">Until {formatDay(b.endsAt)}</p>}
        {action && (
          <div className="mt-auto pt-3">
            <ActionButton action={action} variant="link" />
          </div>
        )}
      </div>
    </article>
  );
};
