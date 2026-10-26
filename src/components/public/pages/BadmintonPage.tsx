import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, GraduationCap, Grid3x3, LandPlot, Recycle, Trophy, Wrench } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import type { StringProduct } from '../../../types/content';
import { analyticsService } from '../../../services/analyticsService';
import { shopService } from '../../../services/shopService';
import { PUBLIC_PAGES } from '../../../utils/publicPages';
import { BADMINTON_VIEW, peekPendingStoreSection, subscribeStoreSection, takePendingStoreSection } from '../../../utils/storeNavigation';
import { BookingSection, type BookingPreset, type BookingService } from '../home/BookingSection';
import { topBannerSlides, useHeroPlaceholder, useSiteBanners } from '../home/banners';
import { useBookingWizard } from '../home/booking';
import { BrandGridSection, type BrandTile } from '../home/BrandGridSection';
import { eventSlides, useEventDialog } from '../home/EventsHero';
import { FaqSection } from '../home/FaqSection';
import { activeStrings, formatKm } from '../home/format';
import { HeroCarousel, type HeroSlide } from '../home/HeroCarousel';
import { OffersSection } from '../home/OffersSection';
import { RacketsSection, activeRackets } from '../home/RacketsSection';
import { ReviewsSection } from '../home/ReviewsSection';
import { ServiceLogosSection, type ServiceLogo } from '../home/ServiceLogosSection';
import { ShopByProductSection, type ProductCategory } from '../home/ShopByProductSection';
import { StringBookingDialog, type StringBookingRequest } from '../home/StringBookingDialog';
import { StringsSection } from '../home/StringsSection';
import { SECTION_IDS, scrollToSection, useShop } from '../home/shop';
import { container } from '../home/ui';
import { useHomeContent } from '../home/useHomeContent';
import { PublicLayout, useNavItem, usePublicNav } from '../layout/PublicLayout';

/**
 * Menu ids that open the booking form on a service. The page has no stringing or repair sections
 * (GR website map), so "Stringing" / "Repairs" links from older screens and old /#stringing,
 * /#repairs addresses go straight to booking.
 */
const BOOKING_LINKS: Record<string, BookingService> = { stringing: 'stringing', repairs: 'repair' };

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Badminton page (/badminton; "HOMEPAGE (BADMINTON PAGE)" in the GR website map), in the map's
 * order: top banner, brand grid, booking form, our services, strings, promo banners and
 * announcements, shop by product, more promo banners and announcements, rackets (new and
 * second-hand), an events banner, reviews and FAQs. Live content comes from GET /api/content/site
 * (shared with the other pages); the booking form hands its details to the customer booking wizard
 * (login first if needed).
 */
export const BadmintonPage: React.FC = () => {
  const app = useApp();
  const { status, content } = useHomeContent();
  const SHOP = useShop();
  const go = usePublicNav();
  const navItem = useNavItem();
  const { bookStringing, bookRepair } = useBookingWizard();

  // AppContext functions are re-created on every render; effects read the latest through this ref.
  const appRef = useRef(app);
  appRef.current = app;

  const { isLoggedIn, currentRole, distanceConfig, gettingServices, repairCategories } = app;
  const isCustomer = isLoggedIn && currentRole === 'CUSTOMER';

  // The page view itself is counted by App ('badminton'); this reports the event dialog.
  const track = useCallback((page: string) => {
    const { isLoggedIn: loggedIn, currentRole: role } = appRef.current;
    if (loggedIn && role !== 'CUSTOMER') return; // staff browsing isn't counted
    analyticsService.trackPageView(page);
  }, []);

  // ---------------------------------------------------------------------------
  // Derived content
  // ---------------------------------------------------------------------------
  const strings = useMemo(() => activeStrings(content?.strings || []), [content]);
  const rackets = useMemo(() => activeRackets(content?.rackets), [content]);
  const newRackets = useMemo(() => rackets.filter((r) => r.condition !== 'used'), [rackets]);
  const usedRackets = useMemo(() => rackets.filter((r) => r.condition === 'used'), [rackets]);
  const availability = content?.availability || null;

  // ---------------------------------------------------------------------------
  // Booking
  // ---------------------------------------------------------------------------
  const [preset, setPreset] = useState<BookingPreset | null>(null);
  const nonce = useRef(0);

  const startBooking = useCallback((service: BookingService) => {
    setPreset({ service, nonce: ++nonce.current });
    requestAnimationFrame(() => scrollToSection(SECTION_IDS.book, { focus: true }));
  }, []);

  // "Book with this string" opens a short form over the catalogue instead of scrolling back up.
  const [stringBooking, setStringBooking] = useState<StringBookingRequest | null>(null);
  const bookWithString = useCallback((product: StringProduct, colour?: string) => setStringBooking({ product, colour }), []);

  // ---------------------------------------------------------------------------
  // Navigation within the page
  // ---------------------------------------------------------------------------
  const [pendingSection, setPendingSection] = useState<string | null>(() => {
    // Peek here (initialisers may run twice in development); cleared in the effect below.
    const requested = peekPendingStoreSection(BADMINTON_VIEW);
    if (requested) return requested;
    const hash = typeof window !== 'undefined' ? decodeURIComponent(window.location.hash.slice(1)) : '';
    return hash && ((Object.values(SECTION_IDS) as string[]).includes(hash) || hash in BOOKING_LINKS) ? hash : null;
  });

  const navigate = useCallback(
    (id: string) => {
      if (BOOKING_LINKS[id]) {
        startBooking(BOOKING_LINKS[id]);
        return;
      }
      if (id === 'top') {
        window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        return;
      }
      scrollToSection(id, { focus: true });
    },
    [startBooking],
  );

  // Requests from other screens (menus and footers elsewhere in the app).
  useEffect(() => {
    takePendingStoreSection(BADMINTON_VIEW); // already read by the state initialiser
    return subscribeStoreSection(() => {
      const id = takePendingStoreSection(BADMINTON_VIEW);
      if (id) setPendingSection(id);
    });
  }, []);

  // Scroll once the content the section depends on has loaded.
  useEffect(() => {
    if (!pendingSection || status === 'loading') return;
    const id = pendingSection;
    setPendingSection(null);
    if (BOOKING_LINKS[id]) {
      startBooking(BOOKING_LINKS[id]);
      return;
    }
    const raf = requestAnimationFrame(() => {
      if (!scrollToSection(id, { focus: true })) window.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(raf);
  }, [pendingSection, status, startBooking]);

  /** Same-page "#section" links anywhere on the page scroll smoothly instead of jumping. */
  const onClickCapture = (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = (e.target as HTMLElement).closest?.('a[href^="#"]');
    if (!link) return;
    const id = (link.getAttribute('href') || '').slice(1);
    if (id && (id === 'top' || document.getElementById(id) || BOOKING_LINKS[id])) {
      e.preventDefault();
      navigate(id);
    }
  };

  // ---------------------------------------------------------------------------
  // Events (top banner, the events banner further down, and their details / registration dialog)
  // ---------------------------------------------------------------------------
  const onShowEvent = useCallback(() => track('badminton/event'), [track]);
  const { events, showEvent, dialog: eventDialog } = useEventDialog(onShowEvent);

  // ---------------------------------------------------------------------------
  // Banners: top slideshow (events marked "show as banner", then admin slides, else the default
  // slide), and two spots of promo banners + announcements
  // ---------------------------------------------------------------------------
  const { liveBanners, bannerAction } = useSiteBanners(startBooking);
  const heroPlaceholder = useHeroPlaceholder(status);

  const slides: HeroSlide[] = useMemo(() => {
    const out = topBannerSlides(events, liveBanners.hero, bannerAction, SHOP, showEvent);
    if (out.length === 0) {
      out.push({
        key: 'default',
        image: '/images/site/hero-smash.webp',
        position: '72% 32%',
        mobilePosition: '68% 30%',
        alt: 'A badminton player jumping for a smash in an indoor hall',
        title: `Racket stringing and repairs in ${SHOP.locality}.`,
        text: `Free pickup and delivery within ${formatKm(distanceConfig.freeRadiusKm)}. Pay when your racket comes back, in cash or by UPI.`,
        primary: { label: 'Book stringing', onClick: () => startBooking('stringing') },
        secondary: { label: 'Book a repair', onClick: () => startBooking('repair') },
      });
    }
    return out;
  }, [events, liveBanners, bannerAction, distanceConfig.freeRadiusKm, showEvent, startBooking, SHOP]);

  /** The events banner further down: every upcoming event with a photo, rotating. */
  const eventsBannerSlides = useMemo(() => eventSlides(events, SHOP, showEvent, { allEvents: true }), [events, SHOP, showEvent]);

  // ---------------------------------------------------------------------------
  // Brand grid: brands in the live rackets and strings lists
  // ---------------------------------------------------------------------------
  const brands = useMemo<BrandTile[]>(() => {
    const byBrand = new Map<string, { rackets: number; strings: number }>();
    const add = (raw: string | null | undefined, kind: 'rackets' | 'strings') => {
      const name = (raw || '').trim();
      if (!name) return;
      const entry = byBrand.get(name) || { rackets: 0, strings: 0 };
      entry[kind] += 1;
      byBrand.set(name, entry);
    };
    newRackets.forEach((r) => add(r.brand, 'rackets'));
    strings.forEach((s) => add(s.brand, 'strings'));
    return [...byBrand.entries()]
      .sort((a, b) => b[1].rackets + b[1].strings - (a[1].rackets + a[1].strings) || a[0].localeCompare(b[0]))
      .map(([name, n]) => ({
        name,
        links: [
          ...(n.rackets ? [{ key: 'rackets', label: count(n.rackets, 'racket', 'rackets'), onOpen: () => go('rackets', { brand: name }) }] : []),
          ...(n.strings ? [{ key: 'strings', label: count(n.strings, 'string', 'strings'), onOpen: () => go('strings', { brand: name }) }] : []),
        ],
      }));
  }, [newRackets, strings, go]);

  // ---------------------------------------------------------------------------
  // Our services (logos), each opening its page
  // ---------------------------------------------------------------------------
  const services = useMemo<ServiceLogo[]>(
    () => [
      { key: 'resell', label: 'Re-sell rackets', icon: Recycle, href: PUBLIC_PAGES.rackets.path, onOpen: () => go('rackets', { condition: 'used' }) },
      { key: 'repair', label: 'Racket repair', icon: Wrench, href: PUBLIC_PAGES.services.path, onOpen: () => go('services', { service: 'repair' }) },
      { key: 'stringing', label: 'Racket stringing', icon: Grid3x3, href: PUBLIC_PAGES.services.path, onOpen: () => go('services', { service: 'stringing' }) },
      { key: 'academies', label: 'Near by academies', icon: GraduationCap, href: PUBLIC_PAGES.academies.path, onOpen: () => go('academies') },
      { key: 'courts', label: 'Near by courts', icon: LandPlot, href: PUBLIC_PAGES.courts.path, onOpen: () => go('courts') },
      { key: 'tournaments', label: 'Tournament organizers', icon: Trophy, href: PUBLIC_PAGES.tournaments.path, onOpen: () => go('tournaments') },
      { key: 'events', label: 'Events', icon: CalendarDays, href: PUBLIC_PAGES.events.path, onOpen: () => go('events') },
    ],
    [go],
  );

  // ---------------------------------------------------------------------------
  // Shop by product: one tile per catalogue the shop actually has, with live counts
  // ---------------------------------------------------------------------------
  const [apparelCount, setApparelCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    shopService
      .getApparel()
      .then((list) => alive && setApparelCount(list.length))
      .catch(() => alive && setApparelCount(null));
    return () => {
      alive = false;
    };
  }, []);

  const shopCategories = useMemo<ProductCategory[]>(() => {
    const out: ProductCategory[] = [];
    if (rackets.length) {
      out.push({
        key: 'rackets',
        name: 'Rackets',
        detail: count(rackets.length, 'racket', 'rackets'),
        // Not the rackets section's photo, which follows a little further down.
        image: '/images/site/rackets-shuttles.webp',
        onOpen: () => go('rackets'),
      });
    }
    if (strings.length) {
      out.push({
        key: 'strings',
        name: 'Strings',
        detail: count(strings.length, 'string', 'strings'),
        image: '/images/site/strings-closeup.webp',
        onOpen: () => go('strings'),
      });
    }
    // The T-shirts page always takes team orders, even before any styles are listed.
    out.push({
      key: 'tshirts',
      name: 'T-shirts & team wear',
      detail: apparelCount ? count(apparelCount, 'style', 'styles') : 'Team orders',
      image: '/images/apparel/hero.webp',
      onOpen: () => go('tshirts'),
    });
    return out;
  }, [rackets.length, strings.length, apparelCount, go]);

  return (
    <PublicLayout
      page="badminton"
      skipTo="book"
      onClickCapture={onClickCapture}
      navigator={{
        label: 'Badminton',
        items: [navItem('rackets', 'Rackets', 'rackets'), navItem('strings', 'Strings', 'strings'), navItem('services', 'Services', 'services')],
      }}
    >
      <h1 className="sr-only">
        {SHOP.name}: badminton store, racket stringing and repairs in {SHOP.area}
      </h1>
      <HeroCarousel slides={slides} placeholder={heroPlaceholder} />

      <BrandGridSection brands={brands} />

      <BookingSection
        formOnly
        strings={strings}
        stringsStatus={status}
        availability={availability}
        repairCategories={repairCategories}
        distanceConfig={distanceConfig}
        isCustomer={isCustomer}
        preset={preset}
        onBookStringing={bookStringing}
        onBookRepair={bookRepair}
      />

      <ServiceLogosSection services={services} />

      <StringsSection strings={strings} status={status} onSeeAll={() => go('strings')} onUseString={bookWithString} />

      <OffersSection promos={liveBanners.promo} announcements={liveBanners.announcement} actionFor={bannerAction} />

      <ShopByProductSection categories={shopCategories} />

      <OffersSection id="offers-more" promos={liveBanners.promo2} announcements={liveBanners.announcement2} actionFor={bannerAction} />

      {newRackets.length > 0 && <RacketsSection rackets={newRackets} onSeeAll={() => go('rackets')} />}
      {usedRackets.length > 0 && (
        <RacketsSection
          id="used-rackets"
          rackets={usedRackets}
          title="Second-hand rackets"
          intro="Used rackets the shop is selling. Message us to ask about a racket's condition before you visit."
          onSeeAll={() => go('rackets', { condition: 'used' })}
        />
      )}

      {eventsBannerSlides.length > 0 && (
        <section id={SECTION_IDS.events} aria-labelledby="events-banner-title" className="scroll-mt-20 border-t border-line bg-white py-10 sm:py-14">
          <div className={container}>
            <h2 id="events-banner-title" className="sr-only">
              Upcoming events
            </h2>
            <HeroCarousel slides={eventsBannerSlides} variant="inset" label="Upcoming events" />
          </div>
        </section>
      )}

      <ReviewsSection data={content?.reviews} status={status} />
      <FaqSection distanceConfig={distanceConfig} gettingServices={gettingServices} />

      {eventDialog}

      <StringBookingDialog
        request={stringBooking}
        availability={availability}
        isCustomer={isCustomer}
        onClose={() => setStringBooking(null)}
        onContinue={(req) => {
          setStringBooking(null);
          bookStringing(req);
        }}
      />
    </PublicLayout>
  );
};
