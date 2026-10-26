import React, { Suspense, lazy, useEffect } from 'react';
import { useApp } from './context/AppContext';
import { Navbar } from './components/common/Navbar';
import { TopAnnouncementBar } from './components/common/TopAnnouncementBar';
import { ToastContainer } from './components/common/ToastContainer';
import { AuthModal } from './components/public/AuthModal';
import { QrMarketingModal } from './components/common/QrMarketingModal';
import { RepairEstimateModal } from './components/customer/RepairEstimateModal';
import { RevisedEstimateModal } from './components/customer/RevisedEstimateModal';
import { Footer } from './components/common/Footer';
import { analyticsService } from './services/analyticsService';
import { CartAddedNotice, CartDrawer } from './components/shop/CartDrawer';
import { PUBLIC_VIEWS } from './utils/publicPages';

// Views
import { LandingPage } from './components/public/LandingPage';
import { CentralLogin } from './components/public/CentralLogin';
// The portals load on demand, so homepage visitors don't download the admin/staff screens.
const CustomerPortal = lazy(() => import('./components/customer/CustomerPortal').then((m) => ({ default: m.CustomerPortal })));
const EmployeePortal = lazy(() => import('./components/employee/EmployeePortal').then((m) => ({ default: m.EmployeePortal })));
const AdminPortal = lazy(() => import('./components/admin/AdminPortal').then((m) => ({ default: m.AdminPortal })));
const ApparelStore = lazy(() => import('./components/shop/ApparelStore').then((m) => ({ default: m.ApparelStore })));
const CourtsPage = lazy(() => import('./components/courts/CourtsPage').then((m) => ({ default: m.CourtsPage })));
// The other public pages (GR website map), also loaded on demand.
const EventsPage = lazy(() => import('./components/public/pages/EventsPage').then((m) => ({ default: m.EventsPage })));
const RacketsPage = lazy(() => import('./components/public/pages/RacketsPage').then((m) => ({ default: m.RacketsPage })));
const StringsPage = lazy(() => import('./components/public/pages/StringsPage').then((m) => ({ default: m.StringsPage })));
const ServicesPage = lazy(() => import('./components/public/pages/ServicesPage').then((m) => ({ default: m.ServicesPage })));
const AcademiesPage = lazy(() => import('./components/public/pages/AcademiesPage').then((m) => ({ default: m.AcademiesPage })));
const TournamentsPage = lazy(() => import('./components/public/pages/TournamentsPage').then((m) => ({ default: m.TournamentsPage })));
const PUBLIC_PAGE_VIEWS: Record<string, React.LazyExoticComponent<React.FC>> = {
  apparel: ApparelStore,
  courts: CourtsPage,
  events: EventsPage,
  rackets: RacketsPage,
  strings: StringsPage,
  services: ServicesPage,
  academies: AcademiesPage,
  tournaments: TournamentsPage,
};

const PortalLoading: React.FC = () => (
  <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500" role="status">
    <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
    Loading…
  </div>
);

const KNOWN_VIEWS = [...PUBLIC_VIEWS, 'login', 'customer_portal', 'employee_portal', 'admin_portal'];

export const App: React.FC = () => {
  const { activeView, setActiveView, isLoggedIn, currentRole, isAuthChecking, customerSubView } = useApp();

  // A view id saved by an older version of the app (e.g. removed design/prototype pages) falls
  // back to the user's own portal, or the home page.
  useEffect(() => {
    if (KNOWN_VIEWS.includes(activeView)) return;
    if (!isLoggedIn) setActiveView('landing');
    else setActiveView(currentRole === 'ADMIN' ? 'admin_portal' : currentRole === 'EMPLOYEE' ? 'employee_portal' : 'customer_portal');
  }, [activeView, isLoggedIn, currentRole, setActiveView]);

  // Page-view tracking for the admin visitor report. Staff activity is not tracked;
  // the landing page reports its own internal sections (see LandingPage).
  useEffect(() => {
    if (isAuthChecking || activeView === 'landing') return;
    if (isLoggedIn && currentRole !== 'CUSTOMER') return;
    const page = activeView === 'customer_portal' ? `customer_portal/${customerSubView}` : activeView;
    analyticsService.trackPageView(page);
  }, [activeView, customerSubView, isLoggedIn, currentRole, isAuthChecking]);

  // Enterprise Role-Based Route Guard
  const renderProtectedView = () => {
    if (isAuthChecking) {
      // A restored session is being validated with the server (GET /auth/me).
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-sm text-slate-500">
          <div className="w-10 h-10 border-4 border-ink border-t-transparent rounded-full animate-spin" />
          <span>Restoring your session…</span>
        </div>
      );
    }

    if (!isLoggedIn) {
      return <CentralLogin />;
    }

    if (activeView === 'admin_portal') {
      if (currentRole === 'ADMIN') return <AdminPortal />;
      if (currentRole === 'EMPLOYEE') return <EmployeePortal />;
      return <CustomerPortal />;
    }

    if (activeView === 'employee_portal') {
      if (currentRole === 'EMPLOYEE' || currentRole === 'ADMIN') return <EmployeePortal />;
      return <CustomerPortal />;
    }

    if (activeView === 'customer_portal') {
      return <CustomerPortal />;
    }

    return <LandingPage />;
  };

  // The public pages (homepage, /tshirts, /courts, /academies, /events, …) render their own
  // header, main and footer.
  const isStandaloneLanding = PUBLIC_VIEWS.includes(activeView);
  const PublicPage = PUBLIC_PAGE_VIEWS[activeView];
  // Admin console uses an app layout on desktop: fixed top bar + sidebar, only the main area scrolls.
  const isAdminShell = !isAuthChecking && isLoggedIn && activeView === 'admin_portal' && currentRole === 'ADMIN';
  // Customer screens (portal + login) and the staff portal keep their top bar on screen while the
  // page scrolls. `overflow-x: hidden` on an ancestor turns it into a scroll container, which
  // silently breaks `position: sticky` for the header; `clip` hides stray horizontal overflow the
  // same way without creating a scroll container. (The landing page has its own header. The admin
  // console uses its own app shell on wide screens; on phones its page scrolls, so it gets `clip`
  // too and its top bar stays visible.)
  const isCustomerFacing = activeView === 'customer_portal' || activeView === 'login';
  const isStaffPortal = activeView === 'employee_portal';
  const useStickyHeader = (isCustomerFacing || isStaffPortal || isStandaloneLanding) && !isAdminShell;

  // index.css gives both <html> and <body> `overflow-x: hidden`; with both set, <body> becomes its
  // own (non-scrolling) scroll container and every `position: sticky` element inside it stops
  // sticking. On these screens switch <body> to `clip`, which hides horizontal overflow the same
  // way without creating a scroll container.
  useEffect(() => {
    if (!useStickyHeader) return;
    const previous = document.body.style.overflowX;
    document.body.style.overflowX = 'clip';
    return () => {
      document.body.style.overflowX = previous;
    };
  }, [useStickyHeader]);

  return (
    <div
      className={`min-h-screen bg-paper flex flex-col text-slate-900 font-sans selection:bg-ink selection:text-white max-w-[100vw] ${
        useStickyHeader || isAdminShell ? 'overflow-x-clip' : 'overflow-x-hidden'
      } ${isAdminShell ? 'lg:h-screen lg:overflow-hidden print:h-auto print:overflow-visible' : ''}`}
    >
      {/* Customer-facing header: the slim announcement bar scrolls away, the navbar stays on top.
          (The landing page has its own complete header and navigation.) */}
      {!isStandaloneLanding && activeView !== 'admin_portal' && activeView !== 'employee_portal' && (
        <>
          <TopAnnouncementBar />
          <div className="sticky top-0 z-40">
            <Navbar />
          </div>
        </>
      )}
      {!isStandaloneLanding && (activeView === 'admin_portal' || activeView === 'employee_portal') && (
        <div className="sticky top-0 z-40">
          <Navbar />
        </div>
      )}

      {/* View Router */}
      {/* The homepage renders its own header, main and footer landmarks. */}
      {PublicPage ? (
        <Suspense fallback={<PortalLoading />}>
          <PublicPage />
        </Suspense>
      ) : isStandaloneLanding ? (
        <LandingPage />
      ) : (
        <main className={isAdminShell ? 'flex-1 lg:min-h-0' : 'flex-1'}>
          {activeView === 'login' && <CentralLogin />}
          {['customer_portal', 'employee_portal', 'admin_portal'].includes(activeView) && (
            <Suspense fallback={<PortalLoading />}>{renderProtectedView()}</Suspense>
          )}
        </main>
      )}

      {/* Global Footer (Only on Customer Portal & Login - Landing has its own full comprehensive footer) */}
      {!isStandaloneLanding && activeView !== 'admin_portal' && activeView !== 'employee_portal' && <Footer />}

      {/* Global Modals & Notifications */}
      <AuthModal />
      <QrMarketingModal />
      <RepairEstimateModal />
      <RevisedEstimateModal />
      <ToastContainer />
      <CartDrawer />
      <CartAddedNotice />
    </div>
  );
};

export default App;
