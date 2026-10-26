import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { BookingSection, type BookingPreset, type BookingService } from '../home/BookingSection';
import { useBookingWizard } from '../home/booking';
import { ContactSection } from '../home/ContactSection';
import { activeStrings, formatKm } from '../home/format';
import { SECTION_IDS, scrollToSection, useShop } from '../home/shop';
import { useHomeContent } from '../home/useHomeContent';
import { PageIntro, usePageIntent } from '../layout/PageIntro';
import { PublicLayout, usePublicNav } from '../layout/PublicLayout';
import { RepairsSection, StringingSection } from './services/ServiceLists';

/**
 * Services page (GR website map): the stringing packages and repairs with their prices, the
 * booking form (stringing or repair) and how to find the shop. Opened from "Services", the
 * homepage service logos and the footer, sometimes with a service to start the form on.
 */
export const ServicesPage: React.FC = () => {
  const SHOP = useShop();
  const { isLoggedIn, currentRole, distanceConfig, gettingServices, repairCategories } = useApp();
  const { status, content } = useHomeContent();
  const go = usePublicNav();
  const intent = usePageIntent('services');
  const { bookStringing, bookRepair } = useBookingWizard();
  const strings = useMemo(() => activeStrings(content?.strings || []), [content]);

  const [preset, setPreset] = useState<BookingPreset | null>(null);
  const nonce = useRef(0);
  const startBooking = useCallback((service: BookingService) => {
    setPreset({ service, nonce: ++nonce.current });
    requestAnimationFrame(() => scrollToSection(SECTION_IDS.book, { focus: true }));
  }, []);

  // "Racket repair" / "Racket stringing" from elsewhere: open the form on that service.
  useEffect(() => {
    if (intent?.service) startBooking(intent.service);
  }, [intent, startBooking]);

  return (
    <PublicLayout page="services" skipTo={SECTION_IDS.book}>
      <PageIntro
        title="Stringing & repairs"
        intro={`Racket stringing and repairs at ${SHOP.name}, with free pickup and delivery within ${formatKm(distanceConfig.freeRadiusKm)}. Choose a package, then book below.`}
      />
      <StringingSection gettingServices={gettingServices} repairCategories={repairCategories} onBook={startBooking} onOpenStrings={() => go('strings')} />
      <RepairsSection gettingServices={gettingServices} repairCategories={repairCategories} onBook={startBooking} />
      <BookingSection
        strings={strings}
        stringsStatus={status}
        availability={content?.availability || null}
        repairCategories={repairCategories}
        distanceConfig={distanceConfig}
        isCustomer={isLoggedIn && currentRole === 'CUSTOMER'}
        preset={preset}
        onBookStringing={bookStringing}
        onBookRepair={bookRepair}
      />
      <ContactSection availability={content?.availability || null} documents={content?.documents || []} />
    </PublicLayout>
  );
};
