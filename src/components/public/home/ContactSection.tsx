import React from 'react';
import { CalendarX, Clock, ExternalLink, FileText, Mail, MapPin, Phone, Shirt, Truck } from 'lucide-react';
import type { PublicAvailability, SiteDocument } from '../../../types/content';
import { describePickupHours, formatDay, localIsoDate, safeUrl } from './format';
import { Photo } from './Photo';
import { SECTION_IDS, useShop } from './shop';
import { SectionHeader, WhatsAppIcon, btn, container, cx } from './ui';

interface ContactSectionProps {
  availability: PublicAvailability | null;
  documents: SiteDocument[];
}

const CLOSED_LOOKAHEAD_DAYS = 21;

export const ContactSection: React.FC<ContactSectionProps> = ({ availability, documents }) => {
  const SHOP = useShop();
  const sameWhatsApp = SHOP.whatsappDisplay === SHOP.phoneDisplay;
  const { days, slots } = describePickupHours(availability?.settings);
  const today = localIsoDate(new Date());
  const until = localIsoDate(new Date(Date.now() + CLOSED_LOOKAHEAD_DAYS * 86400000));
  const closed = (availability?.settings?.closedDates || [])
    .filter((c) => c.date >= today && c.date <= until)
    .sort((a, b) => a.date.localeCompare(b.date));
  const docs = documents
    .filter((d) => d.isPublic !== false && safeUrl(d.fileUrl))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const row = 'flex items-start gap-3 py-4';

  return (
    <section id={SECTION_IDS.contact} aria-labelledby="contact-title" className="scroll-mt-20 bg-paper py-16 sm:py-24">
      <div className={cx(container, 'grid gap-10 lg:grid-cols-12 lg:gap-14')}>
        <div className="lg:col-span-6">
          <SectionHeader id="contact-title" title={`Find us in ${SHOP.locality}`} />

          <address className="mt-8 not-italic">
            <ul className="divide-y divide-line border-y border-line text-[16px] text-ink">
              <li className={row}>
                <MapPin className="mt-1 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{SHOP.name}</p>
                  {SHOP.addressLines.map((l) => (
                    <p key={l} className="text-ink-soft">
                      {l}
                    </p>
                  ))}
                  <a href={SHOP.mapsUrl} target="_blank" rel="noopener noreferrer" className={cx(btn.link, 'mt-1')}>
                    Open in Google Maps
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              </li>
              <li className={row}>
                <Phone className="mt-1 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
                <div>
                  <p className="text-[14px] text-ink-muted">{sameWhatsApp ? 'Phone and WhatsApp' : 'Phone'}</p>
                  <a href={SHOP.phoneTel} className="inline-flex min-h-[44px] items-center font-semibold underline decoration-ink/25 underline-offset-4 hover:decoration-ink">
                    {SHOP.phoneDisplay}
                  </a>
                </div>
              </li>
              {!sameWhatsApp && (
                <li className={row}>
                  <WhatsAppIcon className="mt-1 h-5 w-5 shrink-0 text-ink" />
                  <div>
                    <p className="text-[14px] text-ink-muted">WhatsApp</p>
                    <a
                      href={SHOP.whatsAppLink()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center font-semibold underline decoration-ink/25 underline-offset-4 hover:decoration-ink"
                    >
                      {SHOP.whatsappDisplay}
                    </a>
                  </div>
                </li>
              )}
              {SHOP.email && (
                <li className={row}>
                  <Mail className="mt-1 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[14px] text-ink-muted">Email</p>
                    <a
                      href={`mailto:${SHOP.email}`}
                      className="inline-flex min-h-[44px] items-center break-all font-semibold underline decoration-ink/25 underline-offset-4 hover:decoration-ink"
                    >
                      {SHOP.email}
                    </a>
                  </div>
                </li>
              )}
              {SHOP.openingHours && (
                <li className={row}>
                  <Clock className="mt-1 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
                  <div>
                    <p className="text-[14px] text-ink-muted">Shop hours</p>
                    <p>{SHOP.openingHours}</p>
                  </div>
                </li>
              )}
              {days && (
                <li className={row}>
                  <Truck className="mt-1 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
                  <div>
                    <p className="text-[14px] text-ink-muted">Doorstep pickups</p>
                    <p>
                      {days}
                      {slots ? `, ${slots}` : ''}
                    </p>
                  </div>
                </li>
              )}
              {closed.length > 0 && (
                <li className={row}>
                  <CalendarX className="mt-1 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
                  <div>
                    <p className="text-[14px] text-ink-muted">No pickups on</p>
                    <ul>
                      {closed.map((c) => (
                        <li key={c.date}>
                          {formatDay(c.date)}
                          {c.reason ? ` (${c.reason})` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              )}
              <li className={row}>
                <Shirt className="mt-1 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
                <p>
                  Team T-shirts and jerseys:{' '}
                  <a
                    href={SHOP.whatsAppLink(SHOP.greeting('I would like to ask about team T-shirts / jerseys.'))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline decoration-ink/25 underline-offset-4 hover:decoration-ink"
                  >
                    ask us on WhatsApp
                  </a>
                  .
                </p>
              </li>
            </ul>
          </address>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href={SHOP.phoneTel} className={cx(btn.base, btn.primary)}>
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call the shop
            </a>
            <a href={SHOP.whatsAppLink()} target="_blank" rel="noopener noreferrer" className={cx(btn.base, btn.secondary)}>
              <WhatsAppIcon className="h-5 w-5 text-[#128C4B]" />
              WhatsApp
            </a>
          </div>

          {docs.length > 0 && (
            <div className="mt-10">
              <h3 className="font-display text-[24px] font-semibold text-ink">Price lists and documents</h3>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {docs.map((d) => (
                  <li key={d.id}>
                    <a
                      href={safeUrl(d.fileUrl) as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[56px] items-center gap-3 py-3 text-ink hover:text-sportsBlue"
                    >
                      <FileText className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold underline decoration-ink/20 underline-offset-4">{d.title}</span>
                        <span className="block text-[14px] text-ink-muted">
                          {[d.category, d.description].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <ExternalLink className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:col-span-6">
          <Photo
            src="/images/site/rackets-shuttles.webp"
            alt="Two badminton rackets and feather shuttles on a dark table"
            sizes="(min-width: 1024px) 560px, 100vw"
            aspect="aspect-[3/2] lg:aspect-[4/5]"
            className="rounded-xl lg:sticky lg:top-28"
          />
        </div>
      </div>
    </section>
  );
};
