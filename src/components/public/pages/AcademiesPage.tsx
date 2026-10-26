import React, { useMemo, useState } from 'react';
import { CalendarClock, ExternalLink, IndianRupee, MapPin, Phone, Users } from 'lucide-react';
import type { Academy } from '../../../types/content';
import { EnquiryDialog } from '../enquiry/EnquiryDialog';
import { EventsHero } from '../home/EventsHero';
import type { HeroSlide } from '../home/HeroCarousel';
import { displayMobile, normaliseMobile, safeImageUrl, safeUrl } from '../home/format';
import { scrollToSection, useShop } from '../home/shop';
import { SectionHeader, WhatsAppIcon, btn, container, cx } from '../home/ui';
import { useHomeContent } from '../home/useHomeContent';
import { usePageIntent, useRevealIntent } from '../layout/PageIntro';
import { PublicLayout, useNavItem } from '../layout/PublicLayout';

const LIST_ID = 'academies-list';

/** The page's own banner slide; upcoming events rotate in after it. */
const PAGE_SLIDE: HeroSlide = {
  key: 'academies-default',
  image: '/images/site/kids-hall.webp',
  alt: 'Juniors playing badminton in an indoor hall',
  eyebrow: 'Academies',
  title: 'Find a coaching academy near you',
  text: 'Pick an academy and a batch, and we call you to fix the slot.',
  primary: { label: 'See academies', onClick: () => scrollToSection(LIST_ID, { focus: true }) },
};

/**
 * Academies page (GR website map): navigator (near by courts, events, tournament organizers),
 * the events banner, and the academies the shop lists; each opens a slot booking form.
 */
export const AcademiesPage: React.FC = () => {
  const SHOP = useShop();
  const navItem = useNavItem();
  const { status, content } = useHomeContent();
  // An academy picked in the site search.
  const intent = usePageIntent('academies');
  useRevealIntent(intent, status !== 'loading', (i) => (i.item ? { id: `academy-${i.item}`, highlight: true } : null));
  const academies = useMemo(() => content?.academies || [], [content]);
  const [booking, setBooking] = useState<Academy | null>(null);

  return (
    <PublicLayout
      page="academies"
      navigator={{
        label: 'Academies',
        items: [
          navItem('courts', 'Near by courts', 'courts'),
          navItem('events', 'Events', 'events'),
          navItem('tournaments', 'Tournament organizers', 'tournaments'),
        ],
      }}
    >
      <h1 className="sr-only">Badminton academies near {SHOP.name}</h1>
      <EventsHero lead={PAGE_SLIDE} label="Academies" />

      <section aria-labelledby={LIST_ID} className="bg-paper py-10 sm:py-14">
        <div className={container}>
          <SectionHeader
            id={LIST_ID}
            title="Academies near you"
            intro="Coaching academies around the city. Choose one and a batch; we call you to confirm the slot and the first day."
          />

          {status === 'loading' && (
            <div className="mt-6 grid gap-5 md:grid-cols-2" aria-hidden="true">
              {[0, 1].map((i) => (
                <div key={i} className="h-[340px] animate-pulse rounded-2xl bg-paper-deep motion-reduce:animate-none" />
              ))}
            </div>
          )}

          {status !== 'loading' && academies.length > 0 && (
            <ul className="mt-6 grid gap-5 md:grid-cols-2">
              {academies.map((a) => (
                <li key={a.id} id={`academy-${a.id}`} className="flex scroll-mt-28 rounded-2xl">
                  <AcademyCard academy={a} onBook={() => setBooking(a)} />
                </li>
              ))}
            </ul>
          )}

          {status !== 'loading' && academies.length === 0 && (
            <div className="mt-6 rounded-2xl border border-line bg-white px-6 py-10 text-center sm:px-10">
              <p className="font-display text-[26px] font-semibold text-ink">
                {status === 'error' ? "We couldn't load the academies" : 'No academies listed yet'}
              </p>
              <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-ink-soft">
                {status === 'error'
                  ? 'Check your connection and reload the page, or ask us on WhatsApp.'
                  : 'Ask us on WhatsApp about coaching near you.'}
              </p>
              <a
                href={SHOP.whatsAppLink(SHOP.greeting('I am looking for a badminton academy near me.'))}
                target="_blank"
                rel="noopener noreferrer"
                className={cx(btn.base, btn.primary, 'mt-6 px-6')}
              >
                <WhatsAppIcon className="h-4 w-4" />
                Ask on WhatsApp
              </a>
            </div>
          )}
        </div>
      </section>

      <EnquiryDialog
        open={!!booking}
        onClose={() => setBooking(null)}
        title={booking ? `Book a slot at ${booking.name}` : ''}
        description={booking?.area}
        kind="academy"
        fixed={{ academyId: booking?.id }}
        batches={booking?.batches}
        submitLabel="Book a slot"
        nextStep="We'll check with the academy and confirm your batch."
      />
    </PublicLayout>
  );
};

const Detail: React.FC<{ icon: React.ElementType; label: string; children: React.ReactNode }> = ({ icon: Icon, label, children }) => (
  <div className="flex gap-3">
    <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-ink-muted" aria-hidden="true" />
    <div className="min-w-0">
      <dt className="sr-only">{label}</dt>
      <dd className="text-[15px] leading-snug text-ink">{children}</dd>
    </div>
  </div>
);

const AcademyCard: React.FC<{ academy: Academy; onBook: () => void }> = ({ academy: a, onBook }) => {
  const photo = safeImageUrl(a.photoUrl);
  const mapUrl = safeUrl(a.mapsUrl);
  const phoneDigits = a.phone ? normaliseMobile(a.phone) : null;
  return (
    <article className="flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-white">
      {photo && (
        <div className="relative aspect-[16/7] bg-paper-deep">
          <img src={photo} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        </div>
      )}
      <div className="flex flex-1 flex-col px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
        <p className="text-[13px] font-semibold text-[#9A6B00]">{a.area}</p>
        <h3 className="mt-1 font-display text-[28px] font-semibold leading-[1.05] text-ink text-balance">{a.name}</h3>
        {a.description && <p className="mt-2 line-clamp-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{a.description}</p>}

        <dl className="mt-5 space-y-3">
          {a.batches.length > 0 && (
            <Detail icon={CalendarClock} label="Batches">
              <ul className="space-y-0.5">
                {a.batches.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </Detail>
          )}
          {a.ageGroups && (
            <Detail icon={Users} label="Who it's for">
              {a.ageGroups}
            </Detail>
          )}
          {a.fee && (
            <Detail icon={IndianRupee} label="Fee">
              {a.fee}
            </Detail>
          )}
          {(a.address || mapUrl) && (
            <Detail icon={MapPin} label="Address">
              {a.address && <span className="block">{a.address}</span>}
              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 rounded text-[14px] font-semibold text-sportsBlue underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue"
                >
                  Open in Google Maps
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
            </Detail>
          )}
          {phoneDigits && (
            <Detail icon={Phone} label="Academy phone">
              <a href={`tel:+91${phoneDigits}`} className="font-medium underline decoration-ink/25 underline-offset-4 hover:decoration-ink">
                {displayMobile(phoneDigits)}
              </a>
            </Detail>
          )}
        </dl>

        <div className="mt-auto pt-6">
          <button type="button" onClick={onBook} className={cx(btn.base, btn.primary, 'w-full px-6 sm:w-auto')}>
            Book a slot
          </button>
        </div>
      </div>
    </article>
  );
};
