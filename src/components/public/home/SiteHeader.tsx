import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, MapPin, Menu, Phone, Shirt, Truck, UserRound, X } from 'lucide-react';
import { PUBLIC_PAGES, type PublicPageId } from '../../../utils/publicPages';
import { CartButton } from '../../shop/CartButton';
import { useModalBehavior } from './Dialog';
import { AccountButton } from './AccountButton';
import { useShop } from './shop';
import { WhatsAppIcon, Wordmark, btn, container, cx } from './ui';

/** The main menu (GR website map): one item per page. The logo opens the main page. */
const MAIN_MENU: { page: PublicPageId; label: string }[] = [
  { page: 'badminton', label: 'Badminton' },
  { page: 'tshirts', label: 'T-shirts' },
  { page: 'academies', label: 'Academies' },
  { page: 'tournaments', label: 'Tournament organizing' },
  { page: 'events', label: 'Events' },
];

/** Extra pages in the phone menu (on laptops they sit in the page navigators and the footer). */
const MORE_PAGES: { page: PublicPageId; label: string }[] = [
  { page: 'services', label: 'Stringing & repairs' },
  { page: 'rackets', label: 'Rackets' },
  { page: 'strings', label: 'Strings' },
  { page: 'courts', label: 'Book a court' },
];

interface SiteHeaderProps {
  /** The page being shown (highlighted in the menu). */
  current: PublicPageId;
  pickupLine: string;
  accountLabel: string;
  onAccount: () => void;
  onStaffLogin: (role: 'EMPLOYEE' | 'ADMIN') => void;
  showStaffLinks: boolean;
  onOpenPage: (page: PublicPageId) => void;
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({
  current,
  pickupLine,
  accountLabel,
  onAccount,
  onStaffLogin,
  showStaffLinks,
  onOpenPage,
}) => {
  const SHOP = useShop();
  const [menuOpen, setMenuOpen] = useState(false);

  // The menu bar sits at the very top and scrolls away; once it is out of view, the same links
  // show in the sticky header (laptops), so the menu is always one click away.
  const menuBarRef = useRef<HTMLElement>(null);
  const [menuBarOutOfView, setMenuBarOutOfView] = useState(false);
  useEffect(() => {
    const bar = menuBarRef.current;
    if (!bar || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setMenuBarOutOfView(!entry.isIntersecting));
    io.observe(bar);
    return () => io.disconnect();
  }, []);

  // Phones: the bar scrolls sideways; bring the current page's item into view.
  const menuScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = menuScrollRef.current;
    const item = scroller?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!scroller || !item || scroller.scrollWidth <= scroller.clientWidth) return;
    scroller.scrollLeft = Math.max(0, item.offsetLeft - (scroller.clientWidth - item.offsetWidth) / 2);
  }, [current]);

  const open = (e: React.MouseEvent, page: PublicPageId) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onOpenPage(page);
  };

  const menuLinks = (size: 'bar' | 'header') => (
    <ul className={cx('flex items-center', size === 'bar' ? 'gap-1 sm:gap-2' : 'gap-0.5 xl:gap-1')}>
      {MAIN_MENU.map(({ page, label }) => {
        const isCurrent = current === page;
        return (
          <li key={page} className="shrink-0">
            <a
              href={PUBLIC_PAGES[page].path}
              onClick={(e) => open(e, page)}
              aria-current={isCurrent ? 'page' : undefined}
              className={cx(
                'relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue',
                size === 'bar' ? 'h-11 px-2 text-[14px] sm:text-[15px]' : 'h-11 px-2.5 text-[15px] xl:px-3',
                isCurrent ? 'font-semibold text-ink' : 'text-ink-soft hover:text-ink',
              )}
            >
              {page === 'tshirts' && <Shirt className="h-[18px] w-[18px]" aria-hidden="true" />}
              {label}
              <span
                aria-hidden="true"
                className={cx(
                  'absolute bottom-1 h-[2px] rounded-full bg-accent transition-opacity',
                  size === 'bar' ? 'inset-x-2' : 'inset-x-2.5 xl:inset-x-3',
                  isCurrent ? 'opacity-100' : 'opacity-0',
                )}
              />
            </a>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Menu bar at the very top (GR website map: menu navigator, then the text ad). Phones: scrolls sideways. */}
      <nav ref={menuBarRef} aria-label="Main" className="border-b border-line bg-white">
        <div ref={menuScrollRef} className={cx(container, 'no-scrollbar overflow-x-auto')}>
          <div className="-mx-2 w-max min-w-full">{menuLinks('bar')}</div>
        </div>
      </nav>

      {/* Info bar ("text ad"; scrolls away) */}
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
            href="/"
            onClick={(e) => open(e, 'home')}
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sportsBlue"
            aria-label={`${SHOP.name}, home`}
          >
            {/* Short wordmark on phones (room for the buttons) and on smaller laptops once the menu
                moves into this row; the subline otherwise. */}
            <span className={menuBarOutOfView ? 'xl:hidden' : 'lg:hidden'}>
              <Wordmark subline={false} />
            </span>
            <span className={menuBarOutOfView ? 'hidden xl:inline' : 'hidden lg:inline'}>
              <Wordmark />
            </span>
          </a>

          {menuBarOutOfView && (
            <nav aria-label="Main menu" className="hidden lg:block">
              {menuLinks('header')}
            </nav>
          )}

          <div className="flex items-center gap-2">
            <CartButton />
            <AccountButton label={accountLabel} onClick={onAccount} />
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
        current={current}
        onClose={() => setMenuOpen(false)}
        onOpenPage={(page) => {
          setMenuOpen(false);
          window.setTimeout(() => onOpenPage(page), 0);
        }}
        pickupLine={pickupLine}
        accountLabel={accountLabel}
        onAccount={() => {
          setMenuOpen(false);
          onAccount();
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
  current: PublicPageId;
  onClose: () => void;
  onOpenPage: (page: PublicPageId) => void;
  pickupLine: string;
  accountLabel: string;
  onAccount: () => void;
  onStaffLogin: (role: 'EMPLOYEE' | 'ADMIN') => void;
  showStaffLinks: boolean;
}

const MenuSheet: React.FC<MenuSheetProps> = ({
  open,
  current,
  onClose,
  onOpenPage,
  pickupLine,
  accountLabel,
  onAccount,
  onStaffLogin,
  showStaffLinks,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalBehavior(open, panelRef, onClose, closeRef);
  const SHOP = useShop();
  if (!open) return null;

  const link = (page: PublicPageId, label: string, big: boolean) => (
    <a
      href={PUBLIC_PAGES[page].path}
      onClick={(e) => {
        e.preventDefault();
        onOpenPage(page);
      }}
      aria-current={current === page ? 'page' : undefined}
      className={cx(
        'flex items-center rounded-xl px-3 text-ink',
        big ? 'min-h-[52px] font-display text-[24px] font-semibold' : 'min-h-[44px] text-[16px] font-medium',
        current === page ? 'bg-paper' : 'hover:bg-paper',
      )}
    >
      {label}
    </a>
  );

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
            {/* Phones: the main page is listed too (on laptops it is the logo). */}
            {[{ page: 'home' as const, label: 'Home' }, ...MAIN_MENU].map(({ page, label }) => (
              <li key={page}>{link(page, label, true)}</li>
            ))}
          </ul>
          <ul className="mt-2 border-t border-line pt-2">
            {MORE_PAGES.map(({ page, label }) => (
              <li key={page}>{link(page, label, false)}</li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto space-y-3 border-t border-line px-4 py-5">
          <button type="button" onClick={onAccount} className={cx(btn.base, btn.primary, 'w-full')}>
            <UserRound className="h-4 w-4" aria-hidden="true" />
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
