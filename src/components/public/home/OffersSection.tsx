import React from 'react';
import { Megaphone } from 'lucide-react';
import type { Banner } from '../../../types/content';
import { ActionButton, HeroCarousel, type HeroAction, type HeroSlide } from './HeroCarousel';
import { formatDay, safeImageUrl } from './format';
import { SECTION_IDS } from './shop';
import { container, cx } from './ui';

interface OffersSectionProps {
  /** Promo banners (photo), already filtered to live ones and sorted. */
  promos: Banner[];
  /** Announcements (photo optional), already filtered to live ones and sorted. */
  announcements: Banner[];
  /** What a banner's button does (same targets as the top slideshow). */
  actionFor: (b: Banner) => HeroAction | undefined;
  /** Section id (the homepage has an upper and a lower offers section). */
  id?: string;
}

/**
 * Promo banners and announcements set up by the shop in Admin → Website content → Banners.
 * Nothing renders until the shop adds one, so the homepage never shows placeholder offers.
 */
export const OffersSection: React.FC<OffersSectionProps> = ({ promos, announcements, actionFor, id = SECTION_IDS.offers }) => {
  // Promo banners run as a slideshow (one at a time), like the top of the page.
  const promoSlides: HeroSlide[] = promos
    .filter((b) => safeImageUrl(b.desktopImageUrl))
    .map((b) => ({
      key: `promo-${b.id}`,
      image: safeImageUrl(b.desktopImageUrl) as string,
      mobileImage: safeImageUrl(b.mobileImageUrl),
      alt: '',
      eyebrow: (b.badge || '').trim() || undefined,
      title: b.title,
      text: (b.subtitle || '').trim() || undefined,
      primary: actionFor(b),
    }));
  if (promoSlides.length === 0 && announcements.length === 0) return null;

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-20 border-t border-line bg-paper py-10 sm:py-14"
    >
      <div className={container}>
        <h2 id={`${id}-title`} className="sr-only">
          Offers and announcements
        </h2>

        {promoSlides.length > 0 && <HeroCarousel slides={promoSlides} variant="inset" label="Offers" />}

        {announcements.length > 0 && (
          <div className={cx(promoSlides.length > 0 && 'mt-8 sm:mt-10')}>
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
