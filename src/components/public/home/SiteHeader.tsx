import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Clock, MapPin, Menu, Phone, Shirt, Truck, UserRound, X } from 'lucide-react';
import { CartButton } from '../../shop/CartButton';
import { useModalBehavior } from './Dialog';
import { AccountButton } from './AccountButton';
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
  /** Opens the T-shirt store (/tshirts). */
  onOpenTshirts: () => void;
  /** Opens court booking (/courts). */
  onOpenCourts: () => void;
}

/** Menu groups: badminton services & gear, and courts & events. Items whose section isn't on the
 * page (e.g. no rackets listed) are left out. */
const BADMINTON_ITEMS: { id: string; note: string }[] = [
  { id: 'stringing', note: 'Restringing at the tension you choose' },
  { id: 'repairs', note: 'Frame, shaft, joint, handle and grip' },
  { id: 'strings', note: 'Strings and colours we stock' },
  { id: 'rackets', note: 'Rackets at the shop' },
];

interface GroupLink {
  key: string;
  label: string;
  note: string;
  href: string;
  onSelect: () => void;
  current?: boolean;
}

/** Desktop dropdown: opens on click or hover, closes on outside click, Esc or after choosing. */
const NavGroup: React.FC<{
  id: string;
  label: string;
  links: GroupLink[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: boolean;
}> = ({ id, label, links, open, onOpenChange, current }) => {
  const ref = useRef<HTMLLIElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const panelId = `navgroup-${id}`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  // Hover opens it for mouse users; touch and keyboard use the button.
  const hover = (next: boolean) => (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => onOpenChange(next), next ? 60 : 180);
  };

  if (links.length === 0) return null;
  return (
    <li ref={ref} className="relative" onPointerEnter={hover(true)} onPointerLeave={hover(false)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cx(
          'relative inline-flex h-11 items-center gap-1 whitespace-nowrap rounded-lg px-3 text-[15px] font-medium transition-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue',
          open || current ? 'text-ink' : 'text-ink-soft hover:text-ink',
        )}
      >
        {label}
        <ChevronDown className={cx('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        <span
          aria-hidden="true"
          className={cx('absolute inset-x-3 bottom-1.5 h-[2px] rounded-full bg-accent transition-opacity', current ? 'opacity-100' : 'opacity-0')}
        />
      </button>
      {open && (
        <div id={panelId} className="absolute left-0 top-full z-50 pt-2">
          <ul className="w-72 rounded-xl border border-line bg-white p-1.5 shadow-lg shadow-ink/10">
            {links.map((l) => (
              <li key={l.key}>
                <a
                  href={l.href}
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenChange(false);
                    l.onSelect();
                  }}
                  aria-current={l.current ? 'true' : undefined}
                  className={cx(
                    'block rounded-lg px-3 py-2.5 transition-colors hover:bg-paper focus-visible:bg-paper focus-visible:outline-none',
                    l.current && 'bg-paper',
                  )}
                >
                  <span className="block text-[15px] font-semibold text-ink">{l.label}</span>
                  <span className="block text-[13px] text-ink-muted">{l.note}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
};

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
  onOpenTshirts,
  onOpenCourts,
}) => {
  const SHOP = useShop();
  const [menuOpen, setMenuOpen] = useState(false);
  const active = useActiveSection(nav.map((n) => n.id));
  const pickupLine = pickupDays ? `Pickup ${pickupDays}${pickupSlots ? `, ${pickupSlots}` : ''}` : '';

  const go = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    onNavigate(id);
  };

  const [openGroup, setOpenGroup] = useState<'badminton' | 'play' | null>(null);
  const badmintonLinks: GroupLink[] = BADMINTON_ITEMS.flatMap(({ id, note }) => {
    const item = nav.find((n) => n.id === id);
    return item ? [{ key: id, label: item.label, note, href: `#${id}`, onSelect: () => onNavigate(id), current: active === id }] : [];
  });
  const eventsItem = nav.find((n) => n.id === 'events');
  const playLinks: GroupLink[] = [
    { key: 'courts', label: 'Book a court', note: 'Pick a court and a time', href: '/courts', onSelect: onOpenCourts },
    ...(eventsItem
      ? [{ key: 'events', label: eventsItem.label, note: 'Tournaments and coaching camps', href: '#events', onSelect: () => onNavigate('events'), current: active === 'events' }]
      : []),
  ];

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
            <a
              href="/tshirts"
              onClick={(e) => {
                e.preventDefault();
                onOpenTshirts();
              }}
              className="lg:hidden inline-flex min-h-[36px] shrink-0 items-center gap-1.5 font-semibold text-white hover:text-accent"
            >
              <Shirt className="h-4 w-4 text-accent" aria-hidden="true" />
              T-shirts
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
            <span className="sm:hidden">
              <Wordmark subline={false} />
            </span>
            <span className="hidden sm:inline">
              <Wordmark />
            </span>
          </a>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              <NavGroup
                id="badminton"
                label="Badminton"
                links={badmintonLinks}
                open={openGroup === 'badminton'}
                onOpenChange={(o) => setOpenGroup(o ? 'badminton' : null)}
                current={badmintonLinks.some((l) => l.current)}
              />
              <NavGroup
                id="play"
                label="Courts & events"
                links={playLinks}
                open={openGroup === 'play'}
                onOpenChange={(o) => setOpenGroup(o ? 'play' : null)}
                current={playLinks.some((l) => l.current)}
              />
              <li>
                <a
                  href="/tshirts"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenTshirts();
                  }}
                  className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[15px] font-medium text-ink-soft hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue"
                >
                  <Shirt className="h-[18px] w-[18px]" aria-hidden="true" />
                  T-shirts
                </a>
              </li>
            </ul>
          </nav>

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
        onClose={() => setMenuOpen(false)}
        badmintonLinks={badmintonLinks.map((l) => ({ ...l, onSelect: () => { setMenuOpen(false); window.setTimeout(l.onSelect, 0); } }))}
        playLinks={playLinks.map((l) => ({ ...l, onSelect: () => { setMenuOpen(false); window.setTimeout(l.onSelect, 0); } }))}
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
        onOpenTshirts={() => {
          setMenuOpen(false);
          onOpenTshirts();
        }}
      />
    </>
  );
};

interface MenuSheetProps {
  open: boolean;
  onClose: () => void;
  badmintonLinks: GroupLink[];
  playLinks: GroupLink[];
  pickupLine: string;
  accountLabel: string;
  onAccount: () => void;
  onStaffLogin: (role: 'EMPLOYEE' | 'ADMIN') => void;
  showStaffLinks: boolean;
  onOpenTshirts: () => void;
}

const MenuSheet: React.FC<MenuSheetProps> = ({
  open,
  onClose,
  badmintonLinks,
  playLinks,
  pickupLine,
  accountLabel,
  onAccount,
  onStaffLogin,
  showStaffLinks,
  onOpenTshirts,
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
          {[
            { heading: 'Badminton', links: badmintonLinks },
            { heading: 'Courts & events', links: playLinks },
          ].map((group) =>
            group.links.length === 0 ? null : (
              <div key={group.heading} className="mb-2">
                <p className="px-3 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">{group.heading}</p>
                <ul>
                  {group.links.map((l) => (
                    <li key={l.key}>
                      <a
                        href={l.href}
                        onClick={(e) => {
                          e.preventDefault();
                          l.onSelect();
                        }}
                        aria-current={l.current ? 'true' : undefined}
                        className={cx(
                          'flex min-h-[52px] items-center rounded-xl px-3 font-display text-[24px] font-semibold text-ink',
                          l.current ? 'bg-paper' : 'hover:bg-paper',
                        )}
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
          <div className="border-t border-line pt-2">
            <a
              href="/tshirts"
              onClick={(e) => {
                e.preventDefault();
                onOpenTshirts();
              }}
              className="flex min-h-[52px] items-center gap-3 rounded-xl px-3 font-display text-[24px] font-semibold text-ink hover:bg-paper"
            >
              <Shirt className="h-6 w-6 text-ink-soft" aria-hidden="true" />
              T-shirts &amp; team wear
            </a>
          </div>
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
