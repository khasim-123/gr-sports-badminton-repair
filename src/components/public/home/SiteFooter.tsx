import React, { useState } from 'react';
import { Dialog } from './Dialog';
import type { NavItem } from './SiteHeader';
import { useShop } from './shop';
import { Wordmark, container, cx } from './ui';

interface SiteFooterProps {
  nav: NavItem[];
  onNavigate: (id: string) => void;
  onBook: (service: 'stringing' | 'repair') => void;
  onStaffLogin: (role: 'EMPLOYEE' | 'ADMIN') => void;
  showStaffLinks: boolean;
  onOpenTshirts?: () => void;
}

const linkClass =
  'inline-flex min-h-[44px] items-center text-white/75 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded';

export const SiteFooter: React.FC<SiteFooterProps> = ({ nav, onNavigate, onBook, onStaffLogin, showStaffLinks, onOpenTshirts }) => {
  const SHOP = useShop();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-white">
      <div className={cx(container, 'grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12')}>
        <div className="lg:col-span-4">
          <Wordmark tone="dark" />
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-white/70">
            Badminton racket stringing and repairs in {SHOP.city}, with doorstep pickup and delivery.
          </p>
        </div>

        <nav aria-label="Footer" className="lg:col-span-3">
          <h2 className="text-[14px] font-semibold text-white">On this page</h2>
          <ul className="mt-2 grid grid-cols-2 gap-x-6 text-[15px]">
            {nav.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(item.id);
                  }}
                  className={linkClass}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lg:col-span-2">
          <h2 className="text-[14px] font-semibold text-white">Book</h2>
          <ul className="mt-2 text-[15px]">
            <li>
              <button type="button" onClick={() => onBook('stringing')} className={linkClass}>
                Racket stringing
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onBook('repair')} className={linkClass}>
                Racket repair
              </button>
            </li>
            {onOpenTshirts && (
              <li>
                <a
                  href="/tshirts"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenTshirts();
                  }}
                  className={linkClass}
                >
                  T-shirts &amp; team wear
                </a>
              </li>
            )}
          </ul>
        </div>

        <div className="lg:col-span-3">
          <h2 className="text-[14px] font-semibold text-white">Contact</h2>
          <address className="mt-2 text-[15px] not-italic leading-relaxed text-white/75">
            <p className="mb-1">
              {SHOP.addressLines.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </p>
            {SHOP.openingHours && <p className="mb-1">{SHOP.openingHours}</p>}
            <ul>
              <li>
                <a href={SHOP.phoneTel} className={linkClass}>
                  {SHOP.phoneDisplay}
                </a>
              </li>
              <li>
                <a href={SHOP.whatsAppLink()} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  WhatsApp
                </a>
              </li>
              {SHOP.email && (
                <li>
                  <a href={`mailto:${SHOP.email}`} className={cx(linkClass, 'break-all')}>
                    {SHOP.email}
                  </a>
                </li>
              )}
            </ul>
          </address>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className={cx(container, 'flex flex-col gap-2 py-5 text-[13px] text-white/60 sm:flex-row sm:items-center sm:justify-between')}>
          <p>
            © {year} {SHOP.name}, {SHOP.city}
          </p>
          <div className="flex flex-wrap items-center gap-x-5">
            <button type="button" onClick={() => setPrivacyOpen(true)} className="min-h-[44px] hover:text-white">
              Privacy
            </button>
            {showStaffLinks && (
              <>
                <button type="button" onClick={() => onStaffLogin('EMPLOYEE')} className="min-h-[44px] hover:text-white">
                  Staff login
                </button>
                <button type="button" onClick={() => onStaffLogin('ADMIN')} className="min-h-[44px] hover:text-white">
                  Admin login
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} title="Privacy" size="md">
        <div className="space-y-4 text-[15px] leading-relaxed text-ink-soft">
          <p>
            <span className="font-semibold text-ink">What we collect.</span> Your name, mobile number and pickup address when you book, so we
            can collect and return your racket. Your name and mobile number when you register for an event or write a review.
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
    </footer>
  );
};
