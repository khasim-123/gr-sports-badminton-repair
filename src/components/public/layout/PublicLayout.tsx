import React, { useCallback, useRef } from 'react';
import { useApp } from '../../../context/AppContext';
import { PUBLIC_PAGES, openPublicPage, type PageIntent, type PublicPageId } from '../../../utils/publicPages';
import { describePickupHours } from '../home/format';
import { SiteFooter } from '../home/SiteFooter';
import { SiteHeader } from '../home/SiteHeader';
import { useHomeContent } from '../home/useHomeContent';
import { PageNavigator, type PageNavItem } from './PageNavigator';
import { WhatsAppButton } from './WhatsAppButton';

interface PublicLayoutProps {
  /** The page being shown (highlighted in the main menu). */
  page: PublicPageId;
  /** The page's own navigator under the header (GR website map), if it has one. */
  navigator?: { label: string; items: PageNavItem[] };
  /** Id of the element the "Skip to content" link jumps to (default: the main area). */
  skipTo?: string;
  children: React.ReactNode;
  /** Optional handler on the content wrapper (the homepage turns "#section" links into smooth scrolls). */
  onClickCapture?: (e: React.MouseEvent) => void;
}

/** Opens a public page (with an optional intent, e.g. Services with Repair selected). */
export function usePublicNav() {
  const { setActiveView } = useApp();
  return useCallback((page: PublicPageId, intent?: PageIntent) => openPublicPage(setActiveView, page, intent), [setActiveView]);
}

/** Navigator item helper: label + the page it opens. */
export function useNavItem() {
  const go = usePublicNav();
  return useCallback(
    (key: string, label: string, page: PublicPageId, intent?: PageIntent): PageNavItem => ({
      key,
      label,
      href: PUBLIC_PAGES[page].path,
      onSelect: () => go(page, intent),
    }),
    [go],
  );
}

/**
 * Shared frame of every public page: the info bar and main menu, the page's navigator, the page,
 * the common footer (GR website map: "footer must be common for each page") and the sticky
 * WhatsApp button.
 */
export const PublicLayout: React.FC<PublicLayoutProps> = ({ page, navigator, skipTo = 'content', children, onClickCapture }) => {
  const app = useApp();
  const appRef = useRef(app);
  appRef.current = app;
  const { isLoggedIn, currentRole } = app;
  const { content } = useHomeContent();
  const go = usePublicNav();

  const { days, slots } = describePickupHours(content?.availability?.settings);
  const pickupLine = days ? `Pickup ${days}${slots ? `, ${slots}` : ''}` : '';

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
  /** Footer "Tracking": the customer's bookings (after logging in). */
  const onTracking = () => {
    const { isLoggedIn: loggedIn, currentRole: role, setActiveView, setCustomerSubView, openAuthModal } = appRef.current;
    if (!loggedIn) {
      openAuthModal('CUSTOMER');
      return;
    }
    if (role === 'CUSTOMER') setCustomerSubView('requests');
    setActiveView(role === 'CUSTOMER' ? 'customer_portal' : role === 'ADMIN' ? 'admin_portal' : 'employee_portal');
    window.scrollTo({ top: 0 });
  };

  return (
    <div id="top" className="w-full bg-white font-sans text-ink selection:bg-accent selection:text-ink">
      <a
        href={`#${skipTo}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-ink focus:px-4 focus:py-3 focus:text-white"
      >
        Skip to content
      </a>
      <SiteHeader
        current={page}
        pickupLine={pickupLine}
        accountLabel={accountLabel}
        onAccount={onAccount}
        onStaffLogin={onStaffLogin}
        showStaffLinks={!isLoggedIn}
        onOpenPage={go}
      />
      {navigator && <PageNavigator label={navigator.label} items={navigator.items} />}
      <main id="content" onClickCapture={onClickCapture}>
        {children}
      </main>
      <SiteFooter
        pages={content?.pages || []}
        onOpenPage={go}
        onTracking={onTracking}
        onStaffLogin={onStaffLogin}
        showStaffLinks={!isLoggedIn}
      />
      <WhatsAppButton />
    </div>
  );
};
