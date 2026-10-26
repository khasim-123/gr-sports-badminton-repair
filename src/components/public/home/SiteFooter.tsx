import React, { useState } from 'react';
import { ExternalLink, MapPin, Phone } from 'lucide-react';
import type { SitePage, SitePageSlug } from '../../../types/content';
import { PUBLIC_PAGES, type PageIntent, type PublicPageId } from '../../../utils/publicPages';
import { Dialog } from './Dialog';
import { useShop, type SocialKey } from './shop';
import { WhatsAppIcon, Wordmark, container, cx } from './ui';

interface SiteFooterProps {
  /** Footer pages the shop has written (pages without text aren't linked). */
  pages: SitePage[];
  onOpenPage: (page: PublicPageId, intent?: PageIntent) => void;
  /** "Tracking": the customer's bookings and orders (asks to log in first). */
  onTracking: () => void;
  onStaffLogin: (role: 'EMPLOYEE' | 'ADMIN') => void;
  showStaffLinks: boolean;
}

type FooterLink =
  | { label: string; page: SitePageSlug }
  | { label: string; go: PublicPageId; intent?: PageIntent }
  | { label: string; action: 'contact' | 'privacy' | 'tracking' };

/** The footer columns from the GR website map. */
const COLUMNS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: 'GR Sports',
    links: [
      { label: 'About us', page: 'about' },
      { label: 'Our promise', page: 'promise' },
      { label: 'Local pickup', page: 'local-pickup' },
      { label: 'Express stringing', page: 'express-stringing' },
      { label: "FAQ's", go: 'badminton', intent: { section: 'faq' } },
      { label: 'Contact us', action: 'contact' },
      { label: 'Shuttlers talk', page: 'shuttlers-talk' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { label: 'Shipping', page: 'shipping' },
      { label: 'Return & cancellation', page: 'returns' },
      { label: 'Privacy policy', action: 'privacy' },
      { label: 'Terms and conditions', page: 'terms' },
      { label: 'Payments', page: 'payments' },
    ],
  },
  {
    heading: 'Services',
    links: [
      { label: 'Tracking', action: 'tracking' },
      { label: 'Stringing guide', page: 'stringing-guide' },
      { label: 'Racket repair', go: 'services', intent: { service: 'repair' } },
      { label: 'Racket stringing', go: 'services', intent: { service: 'stringing' } },
      { label: 'Academies', go: 'academies' },
      { label: 'Events', go: 'events' },
    ],
  },
];

const socialClass = 'inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15';

const linkClass =
  'inline-flex min-h-[36px] items-center text-left text-white/75 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded lg:min-h-[30px]';

export const SiteFooter: React.FC<SiteFooterProps> = ({ pages, onOpenPage, onTracking, onStaffLogin, showStaffLinks }) => {
  const SHOP = useShop();
  const [dialog, setDialog] = useState<'contact' | 'privacy' | SitePage | null>(null);
  const year = new Date().getFullYear();
  const pageFor = (slug: SitePageSlug) => pages.find((p) => p.slug === slug && (p.body || '').trim());

  const renderLink = (link: FooterLink) => {
    if ('page' in link) {
      const page = pageFor(link.page);
      if (!page) return null; // not written yet
      return (
        <button type="button" onClick={() => setDialog(page)} className={linkClass}>
          {link.label}
        </button>
      );
    }
    if ('go' in link) {
      const path = PUBLIC_PAGES[link.go].path + (link.intent?.section ? `#${link.intent.section}` : '');
      return (
        <a
          href={path}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            onOpenPage(link.go, link.intent);
          }}
          className={linkClass}
        >
          {link.label}
        </a>
      );
    }
    return (
      <button
        type="button"
        onClick={() => (link.action === 'tracking' ? onTracking() : setDialog(link.action))}
        className={linkClass}
      >
        {link.label}
      </button>
    );
  };

  const socials = (
    // Always all four; an icon becomes a link once its page is added in Shop settings.
    <ul className="flex items-center gap-2" aria-label="Social media">
      {SHOP.socials.map((s) => (
        <li key={s.key}>
          {s.url ? (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${SHOP.name} on ${s.label}`}
              title={s.label}
              className={cx(socialClass, 'transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white')}
            >
              <SocialIcon name={s.key} />
            </a>
          ) : (
            <span role="img" aria-label={s.label} title={s.label} className={socialClass}>
              <SocialIcon name={s.key} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <footer className="bg-ink text-white">
      <div className={cx(container, 'py-8 lg:py-10')}>
        {/* The shop's promises, one row on laptops */}
        {SHOP.footerHighlights.length > 0 && (
          <ul className="grid gap-x-8 gap-y-2.5 border-b border-white/10 pb-6 sm:grid-cols-3">
            {SHOP.footerHighlights.map((h) => (
              <li key={h} className="flex gap-2.5 text-[14px] leading-snug text-white/85">
                <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {h}
              </li>
            ))}
          </ul>
        )}

        <div className={cx('grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-12 lg:gap-x-8', SHOP.footerHighlights.length > 0 && 'pt-6')}>
          {/* Logo, line about the shop, social media */}
          <div className="col-span-2 lg:col-span-4">
            <Wordmark tone="dark" />
            <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-white/70">
              Badminton store, racket stringing and repairs in {SHOP.city}.
            </p>
            <div className="mt-4">{socials}</div>
          </div>

          {COLUMNS.map((col) => {
            const items = col.links.map((l) => ({ key: l.label, node: renderLink(l) })).filter((i) => i.node);
            if (items.length === 0) return null;
            return (
              <nav key={col.heading} aria-label={col.heading} className="lg:col-span-2">
                <h2 className="text-[14px] font-semibold text-white">{col.heading}</h2>
                <ul className="mt-1.5 text-[15px] lg:text-[14px]">
                  {items.map((i) => (
                    <li key={i.key}>{i.node}</li>
                  ))}
                </ul>
              </nav>
            );
          })}

          {showStaffLinks && (
            <nav aria-label="Staff and management access" className="lg:col-span-2">
              <h2 className="text-[14px] font-semibold text-white">Staff access</h2>
              <ul className="mt-1.5 text-[15px] lg:text-[14px]">
                <li>
                  <button type="button" onClick={() => onStaffLogin('EMPLOYEE')} className={linkClass}>
                    Employee login
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onStaffLogin('ADMIN')} className={linkClass}>
                    Admin login
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </div>
      </div>

      <div className="border-t border-white/10">
        {/* Right padding keeps the text clear of the floating WhatsApp button. */}
        <div className={cx(container, 'flex flex-col gap-1 py-4 pb-20 text-[13px] text-white/60 sm:flex-row sm:items-center sm:justify-between sm:pb-4 sm:pr-24 lg:pr-24')}>
          <p>
            © {year} {SHOP.name}, {SHOP.city}
          </p>
          <p>
            <a href={SHOP.phoneTel} className="hover:text-white">
              {SHOP.phoneDisplay}
            </a>
            {SHOP.email && (
              <>
                {' · '}
                <a href={`mailto:${SHOP.email}`} className="break-all hover:text-white">
                  {SHOP.email}
                </a>
              </>
            )}
          </p>
        </div>
      </div>

      <Dialog open={dialog === 'contact'} onClose={() => setDialog(null)} title="Contact us" size="md">
        <div className="space-y-4 text-[15px] leading-relaxed text-ink-soft">
          <p className="flex gap-3">
            <MapPin className="mt-1 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
            <span>
              {SHOP.addressLines.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
              <a href={SHOP.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold text-ink underline underline-offset-4">
                Open in Google Maps
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </span>
          </p>
          {SHOP.openingHours && <p className="pl-7">Open {SHOP.openingHours}</p>}
          <div className="flex flex-wrap gap-3 pl-7">
            <a href={SHOP.phoneTel} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-line px-4 font-semibold text-ink hover:border-ink/40">
              <Phone className="h-4 w-4" aria-hidden="true" />
              {SHOP.phoneDisplay}
            </a>
            <a
              href={SHOP.whatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-line px-4 font-semibold text-ink hover:border-ink/40"
            >
              <WhatsAppIcon className="h-4 w-4 text-[#128C4B]" />
              WhatsApp
            </a>
          </div>
          {SHOP.email && (
            <p className="pl-7">
              Email{' '}
              <a href={`mailto:${SHOP.email}`} className="font-semibold text-ink underline underline-offset-4 break-all">
                {SHOP.email}
              </a>
            </p>
          )}
        </div>
      </Dialog>

      <Dialog open={dialog === 'privacy'} onClose={() => setDialog(null)} title="Privacy policy" size="md">
        <div className="space-y-4 text-[15px] leading-relaxed text-ink-soft">
          <p>
            <span className="font-semibold text-ink">What we collect.</span> Your name, mobile number and pickup address when you book, so we
            can collect and return your racket. Your name and mobile number when you register for an event, send us an enquiry or write a
            review.
          </p>
          <p>
            <span className="font-semibold text-ink">Site visits.</span> We record which pages are viewed, the date and time, your device type
            and the website that referred you, using a random visitor ID stored in your browser. If you are logged in, visits are linked to
            your account. We don't store IP addresses or use third-party trackers, we keep visit records for up to 12 months, and we respect
            your browser's "Do Not Track" / Global Privacy Control setting.
          </p>
          <p>
            <span className="font-semibold text-ink">Sharing.</span> We don't sell your details. Questions or a request to delete your data:
            call {SHOP.phoneDisplay}
            {SHOP.email ? ` or email ${SHOP.email}` : ''}.
          </p>
        </div>
      </Dialog>

      <Dialog
        open={!!dialog && typeof dialog === 'object'}
        onClose={() => setDialog(null)}
        title={dialog && typeof dialog === 'object' ? dialog.title : ''}
        size="md"
      >
        <div className="space-y-4 text-[15px] leading-relaxed text-ink-soft">
          {dialog && typeof dialog === 'object'
            ? dialog.body
                .split(/\n\s*\n/)
                .map((para) => para.trim())
                .filter(Boolean)
                .map((para, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {para}
                  </p>
                ))
            : null}
        </div>
      </Dialog>
    </footer>
  );
};

/** Simple brand marks for the social links (drawn with currentColor). */
const SocialIcon: React.FC<{ name: SocialKey }> = ({ name }) => {
  const common = { viewBox: '0 0 24 24', className: 'h-5 w-5', 'aria-hidden': true } as const;
  switch (name) {
    case 'instagram':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'facebook':
      return (
        <svg {...common} fill="currentColor">
          <path d="M13.5 21v-7.5H16l.5-3h-3V8.6c0-.9.3-1.6 1.6-1.6h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4V10.5H8v3h2.5V21h3Z" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common} fill="currentColor">
          <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.16l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.32l4.36 5.77L17.75 3Zm-1.08 16.17h1.7L7.41 4.74H5.59l11.08 14.43Z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg {...common} fill="currentColor">
          <path d="M21.6 7.2a2.5 2.5 0 0 0-1.77-1.77C18.27 5 12 5 12 5s-6.27 0-7.83.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.77 1.77C5.73 19 12 19 12 19s6.27 0 7.83-.43a2.5 2.5 0 0 0 1.77-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15.2V8.8l5.2 3.2-5.2 3.2Z" />
        </svg>
      );
  }
};
