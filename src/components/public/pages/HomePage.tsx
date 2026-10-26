import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { analyticsService } from '../../../services/analyticsService';
import {
  HOME_VIEW,
  isSectionName,
  openStoreSection,
  pageForSection,
  peekPendingStoreSection,
  subscribeStoreSection,
  takePendingStoreSection,
} from '../../../utils/storeNavigation';
import type { BookingService } from '../home/BookingSection';
import { topBannerSlides, useHeroPlaceholder, useSiteBanners } from '../home/banners';
import { ContactSection } from '../home/ContactSection';
import { eventSlides, useEventDialog } from '../home/EventsHero';
import { formatKm } from '../home/format';
import { HeroCarousel, type HeroSlide } from '../home/HeroCarousel';
import { ReviewsSection } from '../home/ReviewsSection';
import { ShopByProductSection, type ProductCategory } from '../home/ShopByProductSection';
import { SECTION_IDS, scrollToSection, useShop } from '../home/shop';
import { container } from '../home/ui';
import { useHomeContent } from '../home/useHomeContent';
import { PublicLayout, usePublicNav } from '../layout/PublicLayout';

/**
 * The main page ("/"): what GR Sports does, with a way into each part of the shop. The top
 * banner, one card per section (Badminton, T-shirts, academies, tournament organizing, events,
 * courts), the events banner, reviews and how to find the shop. Badminton (rackets, strings,
 * stringing and repairs) has its own page, like the T-shirts.
 */
export const HomePage: React.FC = () => {
  const app = useApp();
  const SHOP = useShop();
  const go = usePublicNav();
  const { status, content } = useHomeContent();
  const { distanceConfig } = app;

  const appRef = useRef(app);
  appRef.current = app;
  const track = useCallback((page: string) => {
    const { isLoggedIn: loggedIn, currentRole: role } = appRef.current;
    if (loggedIn && role !== 'CUSTOMER') return; // staff browsing isn't counted
    analyticsService.trackPageView(page);
  }, []);
  useEffect(() => {
    track('home');
  }, [track]);

  // Old addresses such as "/#book" or "/#strings" (shared links, QR codes) now belong to the
  // Badminton page: forward them there, on arrival or when only the "#…" part changes. The hash
  // is dropped first so Back returns to this page.
  useEffect(() => {
    const forward = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash || !isSectionName(hash) || pageForSection(hash) === HOME_VIEW) return;
      window.history.replaceState(window.history.state, '', window.location.pathname);
      openStoreSection(appRef.current.setActiveView, hash);
    };
    forward();
    window.addEventListener('hashchange', forward);
    return () => window.removeEventListener('hashchange', forward);
  }, []);

  // Sections of this page requested from elsewhere (e.g. "contact"), scrolled to once loaded.
  const [pendingSection, setPendingSection] = useState<string | null>(() => {
    const requested = peekPendingStoreSection(HOME_VIEW);
    if (requested) return requested;
    const hash = typeof window !== 'undefined' ? decodeURIComponent(window.location.hash.slice(1)) : '';
    return hash === SECTION_IDS.contact ? hash : null;
  });
  useEffect(() => {
    takePendingStoreSection(HOME_VIEW); // already read by the state initialiser
    return subscribeStoreSection(() => {
      const id = takePendingStoreSection(HOME_VIEW);
      if (id) setPendingSection(id);
    });
  }, []);
  useEffect(() => {
    if (!pendingSection || status === 'loading') return;
    const id = pendingSection;
    setPendingSection(null);
    const raf = requestAnimationFrame(() => scrollToSection(id, { focus: true }));
    return () => cancelAnimationFrame(raf);
  }, [pendingSection, status]);

  // Events: top banner, the events banner further down, and their details / registration dialog
  const onShowEvent = useCallback(() => track('home/event'), [track]);
  const { events, showEvent, dialog: eventDialog } = useEventDialog(onShowEvent);

  // Top banner. "Book stringing" / "Book a repair" buttons open the Services page's booking form.
  const bookOnServicesPage = useCallback((service: BookingService) => go('services', { service }), [go]);
  const { liveBanners, bannerAction } = useSiteBanners(bookOnServicesPage);
  const heroPlaceholder = useHeroPlaceholder(status);

  const slides = useMemo<HeroSlide[]>(() => {
    const out = topBannerSlides(events, liveBanners.hero, bannerAction, SHOP, showEvent);
    if (out.length === 0) {
      out.push({
        key: 'default',
        image: '/images/site/hero-smash.webp',
        position: '72% 32%',
        mobilePosition: '68% 30%',
        alt: 'A badminton player jumping for a smash in an indoor hall',
        eyebrow: `${SHOP.name} · ${SHOP.locality}`,
        title: 'Badminton gear, team T-shirts and tournaments',
        text: 'Rackets and strings, stringing and repairs, custom T-shirts, academies, courts and help with your tournament.',
        primary: { label: 'Badminton store', onClick: () => go('badminton') },
        secondary: { label: 'T-shirts', onClick: () => go('tshirts') },
      });
    }
    return out;
  }, [events, liveBanners, bannerAction, showEvent, SHOP, go]);

  // Events banner further down: the events not already in the top banner (this page is short).
  const eventsBannerSlides = useMemo(
    () => eventSlides(events.filter((e) => !e.showAsBanner), SHOP, showEvent, { allEvents: true }),
    [events, SHOP, showEvent],
  );

  // One card per part of the shop
  const sections = useMemo<ProductCategory[]>(
    () => [
      {
        key: 'badminton',
        name: 'Badminton',
        detail: `Rackets, strings, stringing and repairs, with free pickup within ${formatKm(distanceConfig.freeRadiusKm)}`,
        image: '/images/site/shuttle-on-racket.webp',
        onOpen: () => go('badminton'),
      },
      {
        key: 'tshirts',
        name: 'T-shirts & team wear',
        detail: 'T-shirts from the shop, and custom printed T-shirts and jerseys for teams',
        image: '/images/apparel/hero.webp',
        onOpen: () => go('tshirts'),
      },
      {
        key: 'academies',
        name: 'Academies',
        detail: 'Coaching academies near you: pick a batch and book a slot',
        image: '/images/site/kids-hall.webp',
        onOpen: () => go('academies'),
      },
      {
        key: 'tournaments',
        name: 'Tournament organizing',
        detail: 'Umpires, tournament dress, trophies and refreshments',
        image: '/images/site/hall-players.webp',
        onOpen: () => go('tournaments'),
      },
      {
        key: 'events',
        name: 'Events',
        detail: 'Tournaments and camps, and how to register',
        image: '/images/site/events/tournament.webp',
        onOpen: () => go('events'),
      },
      {
        key: 'courts',
        name: 'Courts',
        detail: 'Book a badminton court and pay at the venue',
        image: '/images/site/court-empty.webp',
        onOpen: () => go('courts'),
      },
    ],
    [distanceConfig.freeRadiusKm, go],
  );

  return (
    <PublicLayout page="home">
      <h1 className="sr-only">
        {SHOP.name}, {SHOP.area}: badminton store, T-shirts, academies, tournaments and events
      </h1>
      <HeroCarousel slides={slides} placeholder={heroPlaceholder} />

      <ShopByProductSection id="sections" title={`What you'll find at ${SHOP.name}`} categories={sections} />

      {eventsBannerSlides.length > 0 && (
        <section id="events-banner" aria-labelledby="events-banner-title" className="scroll-mt-20 border-t border-line bg-white py-10 sm:py-14">
          <div className={container}>
            <h2 id="events-banner-title" className="sr-only">
              Upcoming events
            </h2>
            <HeroCarousel slides={eventsBannerSlides} variant="inset" label="Upcoming events" />
          </div>
        </section>
      )}

      <ReviewsSection data={content?.reviews} status={status} />
      <ContactSection availability={content?.availability || null} documents={content?.documents || []} />

      {eventDialog}
    </PublicLayout>
  );
};
