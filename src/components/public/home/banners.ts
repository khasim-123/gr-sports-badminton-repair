import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Banner, BannerCtaTarget, BannerPlacement, SiteEvent } from '../../../types/content';
import { PUBLIC_PAGES, type PublicPageId } from '../../../utils/publicPages';
import { usePublicNav } from '../layout/PublicLayout';
import type { BookingService } from './BookingSection';
import { eventSlides, type ShowEvent } from './EventsHero';
import { localIsoDate, safeImageUrl, safeUrl } from './format';
import type { HeroAction, HeroSlide } from './HeroCarousel';
import type { ShopView } from './shop';
import { useHomeContent, type ContentStatus } from './useHomeContent';

/** How long the top banner shows only its photo while content loads, before falling back to the default slide. */
const HERO_PLACEHOLDER_MS = 1200;

const BANNER_DEFAULT_LABEL: Record<Exclude<BannerCtaTarget, 'none'>, string> = {
  stringing: 'Book stringing',
  repair: 'Book a repair',
  strings: 'See our strings',
  rackets: 'See rackets',
  tshirts: 'See T-shirts',
  courts: 'Book a court',
  tournaments: 'See events',
  url: 'Find out more',
};

/** Pages a banner button can open. */
const TARGET_PAGES: Partial<Record<BannerCtaTarget, PublicPageId>> = {
  tshirts: 'tshirts',
  courts: 'courts',
  strings: 'strings',
  rackets: 'rackets',
  tournaments: 'events',
};

export type LiveBanners = Record<BannerPlacement, Banner[]>;

/**
 * The admin's banners that are showing today, by placement, and what each banner's button does.
 * `onBook` handles the "Book stringing" / "Book a repair" buttons (the page's booking form, or
 * the Services page where there is none).
 */
export function useSiteBanners(onBook: (service: BookingService) => void) {
  const { content } = useHomeContent();
  const go = usePublicNav();

  const liveBanners = useMemo<LiveBanners>(() => {
    const today = localIsoDate(new Date());
    const live = (content?.banners || [])
      .filter((b) => b.isActive !== false)
      .filter((b) => (!b.startsAt || b.startsAt <= today) && (!b.endsAt || b.endsAt >= today))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const at = (placement: BannerPlacement) => live.filter((b) => (b.placement || 'hero') === placement);
    return { hero: at('hero'), promo: at('promo'), announcement: at('announcement'), promo2: at('promo2'), announcement2: at('announcement2') };
  }, [content]);

  const bannerAction = useCallback(
    (b: Banner): HeroAction | undefined => {
      const target = b.ctaTarget || 'none';
      if (target === 'none') return undefined;
      const label = (b.ctaLabel || '').trim() || BANNER_DEFAULT_LABEL[target];
      if (target === 'url') {
        const href = safeUrl(b.ctaUrl);
        return href ? { label, href, external: true } : undefined;
      }
      if (target === 'stringing' || target === 'repair') return { label, onClick: () => onBook(target) };
      const page = TARGET_PAGES[target];
      if (!page) return undefined;
      return {
        label,
        href: PUBLIC_PAGES[page].path,
        onClick: (e?: unknown) => {
          (e as React.MouseEvent | undefined)?.preventDefault?.();
          go(page);
        },
      };
    },
    [onBook, go],
  );

  return { liveBanners, bannerAction };
}

/** Top banner slides: events marked "show in banner", then the admin's slides (empty if neither). */
export function topBannerSlides(
  events: SiteEvent[],
  heroBanners: Banner[],
  bannerAction: (b: Banner) => HeroAction | undefined,
  shop: ShopView,
  showEvent: ShowEvent,
): HeroSlide[] {
  const out: HeroSlide[] = eventSlides(events, shop, showEvent);
  for (const b of heroBanners) {
    const image = safeImageUrl(b.desktopImageUrl);
    if (!image) continue;
    out.push({
      key: `banner-${b.id}`,
      image,
      mobileImage: safeImageUrl(b.mobileImageUrl),
      alt: (b.title || '').trim() || shop.name,
      eyebrow: (b.badge || '').trim() || undefined,
      title: (b.title || '').trim() || undefined,
      text: (b.subtitle || '').trim() || undefined,
      primary: bannerAction(b),
    });
  }
  return out;
}

/** True for a short while after the page opens while content loads: the banner shows only its photo. */
export function useHeroPlaceholder(status: ContentStatus): boolean {
  const [waitOver, setWaitOver] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setWaitOver(true), HERO_PLACEHOLDER_MS);
    return () => clearTimeout(t);
  }, []);
  return status === 'loading' && !waitOver;
}
