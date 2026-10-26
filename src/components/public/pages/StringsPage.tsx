import React, { useCallback, useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import type { StringProduct } from '../../../types/content';
import { useBookingWizard } from '../home/booking';
import { activeStrings } from '../home/format';
import { StringBookingDialog, type StringBookingRequest } from '../home/StringBookingDialog';
import { StringsSection } from '../home/StringsSection';
import { useHomeContent } from '../home/useHomeContent';
import { PageIntro, usePageIntent } from '../layout/PageIntro';
import { PublicLayout } from '../layout/PublicLayout';
import { ServiceCta } from './ServiceCta';

/** Strings page (GR website map): the full strings catalogue, with brand filter, search and "Book with this string". */
export const StringsPage: React.FC = () => {
  const { isLoggedIn, currentRole } = useApp();
  const { status, content } = useHomeContent();
  const intent = usePageIntent('strings');
  const { bookStringing } = useBookingWizard();
  const strings = useMemo(() => activeStrings(content?.strings || []), [content]);
  const [stringBooking, setStringBooking] = useState<StringBookingRequest | null>(null);
  const bookWithString = useCallback((product: StringProduct, colour?: string) => setStringBooking({ product, colour }), []);

  return (
    <PublicLayout page="strings">
      <PageIntro
        title="Strings"
        intro="The strings and colours we have in the shop right now. Tap a colour to see the pack, then book stringing with it."
      />
      <StringsSection
        // A brand chosen elsewhere (e.g. the homepage brand grid) starts the list filtered to it,
        // also when the list finishes loading after the page opens.
        key={`${intent?.brand || 'all'}-${status}`}
        mode="page"
        showHeader={false}
        strings={strings}
        status={status}
        initialBrand={intent?.brand}
        onUseString={bookWithString}
      />
      <ServiceCta title="Want it strung for you?" text="Book a pickup: we collect your racket, string it with your choice of string and tension, and bring it back." />
      <StringBookingDialog
        request={stringBooking}
        availability={content?.availability || null}
        isCustomer={isLoggedIn && currentRole === 'CUSTOMER'}
        onClose={() => setStringBooking(null)}
        onContinue={(req) => {
          setStringBooking(null);
          bookStringing(req);
        }}
      />
    </PublicLayout>
  );
};
