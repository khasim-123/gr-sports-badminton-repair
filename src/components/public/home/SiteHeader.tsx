import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, MapPin, Menu, Phone, Truck, X } from 'lucide-react';
import { useModalBehavior } from './Dialog';
import { useShop } from './shop';
import { WhatsAppIcon, Wordmark, btn, container, cx } from './ui';

export interface NavItem {
  id: string;
  label: string;
}

interface SiteHeaderProps {
  nav: NavItem[];
  pickupDays: string;
  pickupSlots: string;
  accountLabel: string;
  onAccount: () => void;
  onStaffLogin: (role: 'EMPLOYEE' | 'ADMIN') => void;
  onNavigate: (id: string) => void;
  showStaffLinks: boolean;
}

/** Highlights the nav item whose section is in the middle of the viewport. */
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join('|');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.isIntersecting));
        const current = ids.find((id) => seen.get(id));
        setActive(current || null);
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );
    // Sections may mount after data loads; re-scan a few times.
    const observed = new Set<string>();
    const scan = () =>
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el && !observed.has(id)) {
          observed.add(id);
          observer.observe(el);
        }
      });
    scan();
    const timers = [400, 1500, 4000].map((ms) => window.setTimeout(scan, ms));
    return () => {
      timers.forEach(clearTimeout);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return active;
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({
  nav,
  pickupDays,
  pickupSlots,
  accountLabel,
  onAccount,
  onStaffLogin,
  onNavigate,
  showStaffLinks,
}) => {
  const SHOP = useShop();
  const [menuOpen, setMenuOpen] = useState(false);
  const active = useActiveSection(nav.map((n) => n.id));
  const pickupLine = pickupDays ? `Pickup ${pickupDays}${pickupSlots ? `, ${pickupSlots}` : ''}` : '';

  const go = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    onNavigate(id);
  };

  return (
    <>
      {/* Info bar (scrolls away) */}
      <div className="bg-ink text-white/80 text-[13px]">
        <div className={cx(container, 'flex min-h-[36px] items-center justify-between gap-4')}>
          <p className="hidden sm:flex items-center gap-1.5 min-w-0">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
            <span className="truncate" title={SHOP.addressLines.join(', ')}>
              {[SHOP.addressLine.split(',')[0].trim(), SHOP.locality].filter(Boolean).join(', ')}
            </span>
          </p>
          <div className="flex min-w-0 flex-1 sm:flex-none items-center justify-center sm:justify-end gap-5">
            {SHOP.openingHours && (
              <p className={cx('items-center gap-1.5 min-w-0', pickupLine ? 'hidden xl:flex' : 'flex')}>
                <Clock className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                <span className="sr-only">Opening hours: </span>
                <span className="truncate">{SHOP.openingHours}</span>
              </p>
            )}
            {pickupLine && (
              <p className="flex items-center gap-1.5 min-w-0">
                <Truck className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                <span className="truncate">{pickupLine}</span>
              </p>
            )}
            <a href={SHOP.phoneTel} className="hidden md:inline-flex items-center gap-1.5 hover:text-white">
              <Phone className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              {SHOP.phoneDisplay}
            </a>
          </div>
        </div>
      </div>

      {/* Sticky header */}
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className={cx(container, 'flex h-[68px] items-center justify-between gap-4')}>
          <a
            href="#top"
            onClick={(e) => go(e, 'top')}
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sportsBlue"
            aria-label={`${SHOP.name}, back to top`}
          >
            <span className="xl:hidden">
              <Wordmark subline={false} />
            </span>
            <span className="hidden xl:inline">
              <Wordmark />
            </span>
          </a>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-0.5">
              {nav.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => go(e, item.id)}
                    aria-current={active === item.id ? 'true' : undefined}
                    className={cx(
                      'relative inline-flex h-11 items-center rounded-lg px-2.5 xl:px-3 text-[15px] font-medium transition-colors',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue',
                      active === item.id ? 'text-ink' : 'text-ink-soft hover:text-ink',
                    )}
                  >
                    {item.label}
                    <span
                      aria-hidden="true"
                      className={cx(
                        'absolute inset-x-2.5 xl:inset-x-3 bottom-1.5 h-[2px] rounded-full bg-accent transition-opacity',
                        active === item.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <a href={SHOP.phoneTel} className={cx(btn.base, btn.secondary, 'hidden sm:inline-flex px-4')}>
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call
            </a>
            <button type="button" onClick={onAccount} className={cx(btn.base, btn.primary, 'hidden sm:inline-flex px-4')}>
              {accountLabel}
            </button>
            <a
              href={SHOP.phoneTel}
              className="sm:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink"
              aria-label={`Call ${SHOP.name}, ${SHOP.phoneDisplay}`}
            >
              <Phone className="h-5 w-5" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-white"
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <MenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        nav={nav}
        active={active}
        pickupLine={pickupLine}
        accountLabel={accountLabel}
        onAccount={() => {
          setMenuOpen(false);
          onAccount();
        }}
        onNavigate={(id) => {
          setMenuOpen(false);
          // Let the sheet unmount (and the scroll lock lift) before scrolling.
          window.setTimeout(() => onNavigate(id), 0);
        }}
        onStaffLogin={(role) => {
          setMenuOpen(false);
          onStaffLogin(role);
        }}
        showStaffLinks={showStaffLinks}
      />
    </>
  );
};

interface MenuSheetProps {
  open: boolean;
  onClose: () => void;
  nav: NavItem[];
  active: string | null;
  pickupLine: string;
  accountLabel: string;
  onAccount: () => void;
  onNavigate: (id: string) => void;
  onStaffLogin: (role: 'EMPLOYEE' | 'ADMIN') => void;
  showStaffLinks: boolean;
}

const MenuSheet: React.FC<MenuSheetProps> = ({
  open,
  onClose,
  nav,
  active,
  pickupLine,
  accountLabel,
  onAccount,
  onNavigate,
  onStaffLogin,
  showStaffLinks,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalBehavior(open, panelRef, onClose, closeRef);
  const SHOP = useShop();
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-ink/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabIndex={-1}
        className="ml-auto flex h-full w-full max-w-sm flex-col overflow-y-auto overscroll-contain bg-white outline-none animate-in slide-in-from-right-4"
      >
        <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-line px-4">
          <Wordmark subline={false} />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Main" className="px-2 py-3">
          <ul>
            {nav.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(item.id);
                  }}
                  aria-current={active === item.id ? 'true' : undefined}
                  className={cx(
                    'flex min-h-[52px] items-center justify-between rounded-xl px-3 font-display text-[24px] font-semibold',
                    active === item.id ? 'text-ink bg-paper' : 'text-ink hover:bg-paper',
                  )}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto space-y-3 border-t border-line px-4 py-5">
          <button type="button" onClick={onAccount} className={cx(btn.base, btn.primary, 'w-full')}>
            {accountLabel}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <a href={SHOP.phoneTel} className={cx(btn.base, btn.secondary, 'px-3')}>
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call
            </a>
            <a href={SHOP.whatsAppLink()} target="_blank" rel="noopener noreferrer" className={cx(btn.base, btn.secondary, 'px-3')}>
              <WhatsAppIcon className="h-4 w-4 text-[#128C4B]" />
              WhatsApp
            </a>
          </div>
          {SHOP.openingHours && <p className="text-[13px] text-ink-muted">Open {SHOP.openingHours}</p>}
          {pickupLine && <p className="text-[13px] text-ink-muted">{pickupLine}</p>}
          {showStaffLinks && (
            <p className="flex flex-wrap items-center gap-x-1 text-[13px] text-ink-muted">
              <span>For the {SHOP.name} team:</span>
              <button type="button" onClick={() => onStaffLogin('EMPLOYEE')} className="min-h-[44px] px-1 underline underline-offset-4">
                Staff login
              </button>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={() => onStaffLogin('ADMIN')} className="min-h-[44px] px-1 underline underline-offset-4">
                Admin login
              </button>
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
