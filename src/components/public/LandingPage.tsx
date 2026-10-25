import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { WizardPrefill } from '../../types';
import type { Banner, BannerCtaTarget, SiteEvent } from '../../types/content';
import { analyticsService } from '../../services/analyticsService';
import { peekPendingStoreSection, subscribeStoreSection, takePendingStoreSection } from '../../utils/storeNavigation';
import { BookingSection, type BookingPreset, type BookingService, type RepairRequest, type StringingRequest } from './home/BookingSection';
import { ContactSection } from './home/ContactSection';
import { CourtsSection } from './home/CourtsSection';
import { EventDialog } from './home/EventDialog';
import { EventsSection } from './home/EventsSection';
import { categoryLabel, eventAction, eventDateText, eventPhoto, feeText, registrationStatus, spotsText, visibleEvents } from './home/events';
import { FaqSection } from './home/FaqSection';
import { activeStrings, describePickupHours, formatKm, localIsoDate, safeImageUrl, safeUrl } from './home/format';
import { HeroCarousel, type HeroSlide } from './home/HeroCarousel';
import { HowItWorksSection } from './home/HowItWorksSection';
import { RacketsSection, activeRackets } from './home/RacketsSection';
import { ReviewsSection } from './home/ReviewsSection';
import { RepairsSection, StringingSection } from './home/ServicesSection';
import { SiteFooter } from './home/SiteFooter';
import { SiteHeader, type NavItem } from './home/SiteHeader';
import { StringsSection } from './home/StringsSection';
import { SECTION_IDS, scrollToSection, useShop } from './home/shop';
import { useHomeContent } from './home/useHomeContent';

/** How long the hero shows only its photo while content loads, before falling back to the default slide. */
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

function stringingPrefill(r: StringingRequest): Partial<WizardPrefill> {
  const prefill: Partial<WizardPrefill> = {};
  if (r.brand) prefill.batBrand = r.brand;
  if (r.model) prefill.batModel = r.model;
  if (r.stringName) prefill.stringType = r.stringName;
  if (r.stringName && r.colour) prefill.stringColour = r.colour;
  if (r.tension && r.tension >= 10 && r.tension <= 40) prefill.stringTension = r.tension;
  if (r.pickupDate) prefill.pickupDate = r.pickupDate;
  return prefill;
}

function repairPrefill(r: RepairRequest): Partial<WizardPrefill> {
  const prefill: Partial<WizardPrefill> = {};
  if (r.category) prefill.repairIssue = r.category; // a live repair category name; the wizard maps it
  if (r.notes) prefill.repairDescription = r.notes;
  if (r.brand) prefill.batBrand = r.brand;
  if (r.model) prefill.batModel = r.model;
  if (r.pickupDate) prefill.pickupDate = r.pickupDate;
  return prefill;
}

/**
 * Public GR Sports homepage: one page with anchored sections (see ./home).
 * Live content (events, banners, strings, rackets, reviews, documents, availability) comes from
 * GET /api/content/site; prices and pickup rules from the public /config endpoints via AppContext.
 * The quick booking form hands its details to the customer booking wizard (login first if needed).
 */
export const LandingPage: React.FC = () => {
  const app = useApp();
  const { status, content, refreshEvents, patchEvent } = useHomeContent();
  const SHOP = useShop();

  // AppContext functions are re-created on every render; effects read the latest through this ref.
  const appRef = useRef(app);
  appRef.current = app;

  const { isLoggedIn, currentRole, distanceConfig, gettingServices, repairCategories } = app;
  const isCustomer = isLoggedIn && currentRole === 'CUSTOMER';

  const track = useCallback((page: string) => {
    const { isLoggedIn: loggedIn, currentRole: role } = appRef.current;
    if (loggedIn && role !== 'CUSTOMER') return; // staff browsing isn't counted
    analyticsService.trackPageView(page);
  }, []);

  useEffect(() => {
    track('home');
  }, [track]);

  // ---------------------------------------------------------------------------
  // Derived content
  // ---------------------------------------------------------------------------
  const strings = useMemo(() => activeStrings(content?.strings || []), [content]);
  const rackets = useMemo(() => activeRackets(content?.rackets), [content]);
  const events = useMemo(() => visibleEvents(content?.events), [content]);
  const availability = content?.availability || null;
  const { days: pickupDays, slots: pickupSlots } = describePickupHours(availability?.settings);
  const stringsStatus = status;

  const nav: NavItem[] = useMemo(
    () =>
      [
        { id: SECTION_IDS.stringing, label: 'Stringing' },
        { id: SECTION_IDS.repairs, label: 'Repairs' },
        { id: SECTION_IDS.strings, label: 'Strings' },
        rackets.length ? { id: SECTION_IDS.rackets, label: 'Rackets' } : null,
        { id: SECTION_IDS.events, label: 'Events' },
        { id: SECTION_IDS.reviews, label: 'Reviews' },
        { id: SECTION_IDS.contact, label: 'Contact' },
      ].filter(Boolean) as NavItem[],
    [rackets.length],
  );

  // ---------------------------------------------------------------------------
  // Navigation within the page
  // ---------------------------------------------------------------------------
  const [stringsExpanded, setStringsExpanded] = useState(false);
  const [racketsExpanded, setRacketsExpanded] = useState(false);
  const [pendingSection, setPendingSection] = useState<string | null>(() => {
    // Peek here (initialisers may run twice in development); cleared in the effect below.
    const requested = peekPendingStoreSection();
    if (requested) return requested;
    const hash = typeof window !== 'undefined' ? decodeURIComponent(window.location.hash.slice(1)) : '';
    return hash && (Object.values(SECTION_IDS) as string[]).includes(hash) ? hash : null;
  });

  const navigate = useCallback((id: string) => {
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      return;
    }
    scrollToSection(id, { focus: true });
  }, []);

  // Requests from other screens (navbar / footer links on the customer pages).
  useEffect(() => {
    takePendingStoreSection(); // already read by the state initialiser
    return subscribeStoreSection(() => {
      const id = takePendingStoreSection();
      if (id) setPendingSection(id);
    });
  }, []);

  // Scroll once the content the section depends on has loaded.
  useEffect(() => {
    if (!pendingSection || status === 'loading') return;
    if (pendingSection === SECTION_IDS.strings) setStringsExpanded(true);
    if (pendingSection === SECTION_IDS.rackets) setRacketsExpanded(true);
    const id = pendingSection;
    setPendingSection(null);
    const raf = requestAnimationFrame(() => {
      if (!scrollToSection(id, { focus: true })) window.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(raf);
  }, [pendingSection, status]);

  useEffect(() => {
    if (stringsExpanded) track('home/strings');
  }, [stringsExpanded, track]);
  useEffect(() => {
    if (racketsExpanded) track('home/rackets');
  }, [racketsExpanded, track]);

  /** Same-page "#section" links anywhere on the page scroll smoothly instead of jumping. */
  const onClickCapture = (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = (e.target as HTMLElement).closest?.('a[href^="#"]');
    if (!link) return;
    const id = (link.getAttribute('href') || '').slice(1);
    if (id && (id === 'top' || document.getElementById(id))) {
      e.preventDefault();
      navigate(id);
    }
  };

  // ---------------------------------------------------------------------------
  // Booking
  // ---------------------------------------------------------------------------
  const [preset, setPreset] = useState<BookingPreset | null>(null);
  const nonce = useRef(0);

  const startBooking = useCallback((service: BookingService, extra: Partial<BookingPreset> = {}) => {
    setPreset({ service, ...extra, nonce: ++nonce.current });
    requestAnimationFrame(() => scrollToSection(SECTION_IDS.book, { focus: true }));
  }, []);

  const bookWithString = useCallback(
    (label: string, colour?: string) => startBooking('stringing', { stringName: label, colour }),
    [startBooking],
  );

  const bookStringing = (req: StringingRequest) => appRef.current.openWizardWithService('GETTING', stringingPrefill(req));
  const bookRepair = (req: RepairRequest) => appRef.current.openWizardWithService('REPAIR', repairPrefill(req));

  // ---------------------------------------------------------------------------
  // Accounts
  // ---------------------------------------------------------------------------
  const accountLabel = !isLoggedIn ? 'Log in' : currentRole === 'CUSTOMER' ? 'My bookings' : currentRole === 'ADMIN' ? 'Admin dashboard' : 'Staff dashboard';
  const onAccount = () => {
    const { isLoggedIn: loggedIn, currentRole: role, setActiveView, openAuthModal } = appRef.current;
    if (!loggedIn) {
      openAuthModal('CUSTOMER');
      return;
    }
    setActiveView(role === 'CUSTOMER' ? 'customer_portal' : role === 'ADMIN' ? 'admin_portal' : 'employee_portal');
    window.scrollTo({ top: 0 });
  };
  const onStaffLogin = (role: 'EMPLOYEE' | 'ADMIN') => appRef.current.openAuthModal(role);
  const openTshirts = () => {
    appRef.current.setActiveView('apparel');
    window.scrollTo({ top: 0 });
  };
  const openCourts = useCallback(() => {
    appRef.current.setActiveView('courts');
    window.scrollTo({ top: 0 });
  }, []);

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  const [openEvent, setOpenEvent] = useState<{ id: string; intent: 'details' | 'register' } | null>(null);
  const dialogEvent = openEvent ? events.find((e) => e.id === openEvent.id) || null : null;

  const showEvent = useCallback(
    (event: SiteEvent, intent: 'details' | 'register') => {
      setOpenEvent({ id: event.id, intent });
      track('home/event');
    },
    [track],
  );

  const onRegistered = (event: SiteEvent) => {
    // Optimistic count; the refresh below replaces it with the server's numbers when it can.
    patchEvent(event.id, {
      registrationCount: event.registrationCount + 1,
      spotsLeft: typeof event.spotsLeft === 'number' ? Math.max(event.spotsLeft - 1, 0) : event.spotsLeft,
    });
    refreshEvents();
  };

  // ---------------------------------------------------------------------------
  // Hero slides: events marked "show as banner" first, then admin banners, else the default slide
  // ---------------------------------------------------------------------------
  const [heroWaitOver, setHeroWaitOver] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setHeroWaitOver(true), HERO_PLACEHOLDER_MS);
    return () => clearTimeout(t);
  }, []);
  const heroPlaceholder = status === 'loading' && !heroWaitOver;

  const slides: HeroSlide[] = useMemo(() => {
    const out: HeroSlide[] = [];

    for (const e of events) {
      const photo = eventPhoto(e);
      if (!e.showAsBanner || !photo.desktop) continue;
      const action = eventAction(e, SHOP);
      const reg = registrationStatus(e);
      const spots = e.registrationOpen ? spotsText(e) : null;
      out.push({
        key: `event-${e.id}`,
        image: photo.desktop,
        mobileImage: photo.mobile,
        alt: '',
        eyebrow: [categoryLabel(e), e.status === 'ongoing' ? 'On now' : reg].filter(Boolean).join(' · '),
        title: e.title,
        text: e.summary || undefined,
        textOnPhone: false,
        meta: [
          { icon: 'date', text: `${eventDateText(e)}${e.timeText ? `, ${e.timeText}` : ''}` },
          { icon: 'venue', text: e.venue },
          { icon: 'fee', text: feeText(e) },
          ...(spots ? [{ icon: 'spots' as const, text: spots }] : []),
        ],
        primary:
          action.kind === 'link'
            ? { label: action.label, href: action.href, external: action.external }
            : { label: action.label, onClick: () => showEvent(e, action.kind === 'form' ? 'register' : 'details') },
        secondary: action.kind === 'details' ? undefined : { label: 'Event details', onClick: () => showEvent(e, 'details') },
      });
    }

    const today = localIsoDate(new Date());
    const banners = (content?.banners || [])
      .filter((b) => b.isActive !== false && safeImageUrl(b.desktopImageUrl))
      .filter((b) => (!b.startsAt || b.startsAt <= today) && (!b.endsAt || b.endsAt >= today))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    for (const b of banners) out.push(bannerSlide(b));

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

    function bannerSlide(b: Banner): HeroSlide {
      const target = b.ctaTarget || 'none';
      const label = (b.ctaLabel || '').trim() || (target !== 'none' ? BANNER_DEFAULT_LABEL[target] : '');
      let primary: HeroSlide['primary'];
      if (target === 'url') {
        const href = safeUrl(b.ctaUrl);
        if (href) primary = { label, href, external: true };
      } else if (target === 'stringing' || target === 'repair') {
        primary = { label, onClick: () => startBooking(target) };
      } else if (target === 'tshirts') {
        primary = { label, onClick: () => appRef.current.setActiveView('apparel') };
      } else if (target === 'courts') {
        primary = { label, onClick: openCourts };
      } else if (target !== 'none') {
        const id =
          target === 'strings'
            ? SECTION_IDS.strings
            : target === 'rackets'
              ? rackets.length
                ? SECTION_IDS.rackets
                : SECTION_IDS.contact
              : target === 'tournaments'
                ? SECTION_IDS.events
                : SECTION_IDS.contact;
        primary = { label, onClick: () => navigate(id) };
      }
      return {
        key: `banner-${b.id}`,
        image: safeImageUrl(b.desktopImageUrl) as string,
        mobileImage: safeImageUrl(b.mobileImageUrl),
        alt: (b.title || '').trim() || SHOP.name,
        eyebrow: (b.badge || '').trim() || undefined,
        title: (b.title || '').trim() || undefined,
        text: (b.subtitle || '').trim() || undefined,
        primary,
      };
    }
  }, [events, content, distanceConfig.freeRadiusKm, rackets.length, showEvent, startBooking, navigate, openCourts, SHOP]);

  return (
    <div id="top" className="w-full bg-white font-sans text-ink selection:bg-accent selection:text-ink" onClickCapture={onClickCapture}>
      <a
        href="#book"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-ink focus:shadow-lg"
      >
        Skip to booking
      </a>
      <SiteHeader
        nav={nav}
        pickupDays={pickupDays}
        pickupSlots={pickupSlots}
        accountLabel={accountLabel}
        onAccount={onAccount}
        onStaffLogin={onStaffLogin}
        onNavigate={navigate}
        showStaffLinks={!isLoggedIn}
        onOpenTshirts={openTshirts}
        onOpenCourts={openCourts}
      />

      <div id="content">
        <h1 className="sr-only">
          {SHOP.name}: badminton racket stringing and repairs in {SHOP.area}
        </h1>
        <HeroCarousel slides={slides} placeholder={heroPlaceholder} />

        <BookingSection
          strings={strings}
          stringsStatus={stringsStatus}
          availability={availability}
          repairCategories={repairCategories}
          distanceConfig={distanceConfig}
          isCustomer={isCustomer}
          preset={preset}
          onBookStringing={bookStringing}
          onBookRepair={bookRepair}
        />
        <StringingSection gettingServices={gettingServices} repairCategories={repairCategories} onBook={startBooking} />
        <RepairsSection gettingServices={gettingServices} repairCategories={repairCategories} onBook={startBooking} />
        <HowItWorksSection distanceConfig={distanceConfig} availability={availability?.settings} />
        <EventsSection events={events} status={status} onOpen={showEvent} />
        <CourtsSection onOpenCourts={openCourts} />
        <StringsSection
          strings={strings}
          status={stringsStatus}
          expanded={stringsExpanded}
          onExpandedChange={setStringsExpanded}
          onUseString={bookWithString}
        />
        {rackets.length > 0 && <RacketsSection rackets={rackets} expanded={racketsExpanded} onExpandedChange={setRacketsExpanded} />}
        <ReviewsSection data={content?.reviews} status={status} />
        <FaqSection distanceConfig={distanceConfig} gettingServices={gettingServices} />
        <ContactSection availability={availability} documents={content?.documents || []} />
      </div>

      <SiteFooter
        nav={nav}
        onNavigate={navigate}
        onBook={startBooking}
        onStaffLogin={onStaffLogin}
        showStaffLinks={!isLoggedIn}
        onOpenTshirts={openTshirts}
        onOpenCourts={openCourts}
      />

      <EventDialog
        event={dialogEvent}
        intent={openEvent?.intent || 'details'}
        onClose={() => setOpenEvent(null)}
        onRegistered={onRegistered}
      />
    </div>
  );
};
