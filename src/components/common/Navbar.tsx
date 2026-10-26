import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GRSportsLogo } from './GRSportsLogo';
import {
  LogOut,
  ArrowLeft,
  PlusCircle,
  Bell,
  User,
  KeyRound,
  ChevronDown,
  MapPin,
  UserRound,
} from 'lucide-react';
import { formatMobile } from '../../utils/phone';
import { useShopSettings } from '../../hooks/useShopSettings';
import { formatINR } from '../../utils/format';

/** Server messages contain raw amounts like "₹450.0" or "₹1836" — show "₹450" / "₹1,836". */
const tidyRupees = (text: string) => text.replace(/₹\s?(\d+(?:\.\d+)?)/g, (_m, n: string) => formatINR(n));
import { ChangePasswordModal } from './ChangePasswordModal';
import { CartButton } from '../shop/CartButton';
import { useStaffJobs } from '../employee/useStaffJobs';

/** Main customer sections. Profile and saved addresses live in the account menu (right). */
const CUSTOMER_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'wizard', label: 'Book a service' },
  { id: 'requests', label: 'My requests' },
  { id: 'orders', label: 'My orders' },
  { id: 'courts', label: 'My courts' },
];

/** Closes a popover on a click/tap outside `ref` or on Esc. */
const useDismiss = (open: boolean, ref: React.RefObject<HTMLElement>, close: () => void) => {
  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, ref, close]);
};

export const Navbar: React.FC = () => {
  const {
    currentRole,
    activeView,
    setActiveView,
    customerSubView,
    setCustomerSubView,
    employeeSubView,
    setEmployeeSubView,
    adminSubView,
    setAdminSubView,
    isLoggedIn,
    userName,
    userMobile,
    openAuthModal,
    logout,
    requests,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    openRequestDetail,
    setSelectedRequestId,
  } = useApp();
  const shop = useShopSettings();

  // Customer account menu (profile, addresses, log out).
  const [accountOpen, setAccountOpen] = React.useState(false);
  const accountRef = React.useRef<HTMLDivElement>(null);
  const closeAccount = React.useCallback(() => setAccountOpen(false), []);
  useDismiss(accountOpen, accountRef, closeAccount);
  const firstName = (userName || '').trim().split(/\s+/)[0];
  const openCustomerSection = (id: string) => {
    setAccountOpen(false);
    setActiveView('customer_portal');
    setCustomerSubView(id);
  };

  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const bellRef = React.useRef<HTMLDivElement>(null);
  // Close the notifications panel on a click/tap outside it or Esc. (A full-screen overlay can't be
  // used here: the header's backdrop-blur traps fixed children inside the header.)
  React.useEffect(() => {
    if (!notificationsOpen) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setNotificationsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [notificationsOpen]);

  // Role-filtered notifications
  const roleNotifications = notifications.filter(
    (n) => n.targetRoles.includes(currentRole) || n.targetRoles.length === 0
  );
  const roleUnreadCount = roleNotifications.filter((n) => !n.isRead).length;
  /** Staff and admins have no shopping cart, storefront search or court QR tools. */
  const isStaffSession = isLoggedIn && (currentRole === 'ADMIN' || currentRole === 'EMPLOYEE');
  const [passwordOpen, setPasswordOpen] = useState(false);

  // Staff portal tabs: my open jobs, new (unassigned) requests, completed.
  const staffJobs = useStaffJobs();
  const staffTabs = [
    { id: 'dashboard', label: 'My jobs', count: staffJobs.open.length },
    { id: 'new', label: 'New requests', count: staffJobs.unassigned.length },
    { id: 'done', label: 'Completed', count: null as number | null },
  ];
  /** Opens a request from a notification (staff open it in their own job view). */
  const openFromNotification = (requestId: string) => {
    if (currentRole === 'EMPLOYEE') {
      setSelectedRequestId(requestId);
      setActiveView('employee_portal');
      setEmployeeSubView('detail');
    } else {
      openRequestDetail(requestId);
    }
  };

  /** Shop orders ("ORD-…") open in the customer's Orders screen or the admin Orders page. */
  const isOrderId = (id?: string | null): id is string => !!id && id.startsWith('ORD-');
  const canOpenOrder = currentRole === 'CUSTOMER' || currentRole === 'ADMIN';
  const openOrderFromNotification = (orderId: string) => {
    setSelectedRequestId(orderId);
    if (currentRole === 'CUSTOMER') {
      setActiveView('customer_portal');
      setCustomerSubView('orders');
    } else if (currentRole === 'ADMIN') {
      setActiveView('admin_portal');
      setAdminSubView('orders');
    }
  };

  /** Court bookings ("CRT-…") open in the customer's Courts screen or the admin Courts page. */
  const isCourtBookingId = (id?: string | null): id is string => !!id && id.startsWith('CRT-');
  const openCourtBookingFromNotification = (bookingId: string) => {
    setSelectedRequestId(bookingId);
    if (currentRole === 'CUSTOMER') {
      setActiveView('customer_portal');
      setCustomerSubView('courts');
    } else if (currentRole === 'ADMIN') {
      setActiveView('admin_portal');
      setAdminSubView('courts');
    }
  };
  /** Website enquiries ("ENQ-…": academy slots, tournament organizing, custom T-shirts) open in the admin inbox. */
  const isEnquiryId = (id?: string | null): id is string => !!id && id.startsWith('ENQ-');
  const openEnquiryFromNotification = (enquiryId: string) => {
    setSelectedRequestId(enquiryId);
    setActiveView('admin_portal');
    setAdminSubView('enquiries');
  };
  /** Shop orders and court bookings open on their own screens; service requests in the request view. */
  const canOpenLinked = (id?: string | null) =>
    ((isOrderId(id) || isCourtBookingId(id)) && canOpenOrder) || (isEnquiryId(id) && currentRole === 'ADMIN');

  const handleBrandLogoClick = () => {
    if (!isLoggedIn) {
      setActiveView('landing');
    } else {
      if (currentRole === 'CUSTOMER') {
        setActiveView('customer_portal');
        setCustomerSubView('dashboard');
      } else if (currentRole === 'EMPLOYEE') {
        setActiveView('employee_portal');
        setEmployeeSubView('dashboard');
      } else if (currentRole === 'ADMIN') {
        setActiveView('admin_portal');
        setAdminSubView('dashboard');
      }
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-line shadow-2xs w-full overflow-x-clip print:hidden">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand / Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleBrandLogoClick}
            className="flex items-center min-h-[44px] text-left group"
            title={isLoggedIn ? `Return to ${currentRole.toLowerCase()} dashboard` : `${shop.name} Home`}
          >
            <GRSportsLogo />
          </button>
        </div>

        {/* Center: Context-Aware Navigation (Hidden for public as requested; portal tabs visible when logged in) */}
        <div
          className={`hidden ${
            isLoggedIn && currentRole === 'CUSTOMER' ? 'lg:flex' : 'md:flex'
          } items-center gap-1 text-xs font-semibold min-w-0 overflow-x-auto no-scrollbar py-1`}
        >
          {!isLoggedIn ? null : (
            /* Authenticated Portal Sub-Navigation (Strictly Isolated by Role) */
            <>
              {currentRole === 'CUSTOMER' &&
                CUSTOMER_TABS.map((tab) => {
                  const active =
                    activeView === 'customer_portal' &&
                    (customerSubView === tab.id || (tab.id === 'requests' && customerSubView === 'detail'));
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveView('customer_portal');
                        setCustomerSubView(tab.id);
                      }}
                      aria-current={active ? 'page' : undefined}
                      className={`px-3.5 min-h-[40px] rounded-xl transition-colors duration-150 flex items-center gap-1.5 whitespace-nowrap shrink-0 text-sm ${
                        active
                          ? 'bg-ink text-white font-semibold'
                          : tab.id === 'wizard'
                          ? 'text-ink hover:bg-paper font-semibold'
                          : 'text-slate-600 hover:text-ink hover:bg-paper font-medium'
                      }`}
                    >
                      {tab.id === 'wizard' && <PlusCircle className="w-4 h-4" aria-hidden="true" />}
                      {tab.label}
                    </button>
                  );
                })}

              {currentRole === 'EMPLOYEE' &&
                staffTabs.map((tab) => {
                  const active =
                    activeView === 'employee_portal' &&
                    (employeeSubView === tab.id || (tab.id === 'dashboard' && !['new', 'done', 'detail'].includes(employeeSubView)));
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveView('employee_portal');
                        setEmployeeSubView(tab.id);
                      }}
                      aria-current={active ? 'page' : undefined}
                      className={`px-3 min-h-[40px] rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 text-sm ${
                        active ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count !== null && tab.count > 0 && (
                        <span
                          className={`text-[11px] px-1.5 rounded-full font-bold ${
                            active ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}

              {currentRole === 'ADMIN' && (
                <div className="lg:hidden flex items-center gap-1">
                  <button
                    onClick={() => {
                      setActiveView('admin_portal');
                      setAdminSubView('dashboard');
                    }}
                    className={`px-3 min-h-[40px] rounded-xl transition-colors ${
                      activeView === 'admin_portal' && adminSubView === 'dashboard'
                        ? 'bg-ink text-white font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('admin_portal');
                      setAdminSubView('requests');
                    }}
                    className={`px-3 min-h-[40px] rounded-xl transition-colors ${
                      activeView === 'admin_portal' && adminSubView === 'requests'
                        ? 'bg-ink text-white font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Requests
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('admin_portal');
                      setAdminSubView('sla_monitor');
                    }}
                    className={`px-3 min-h-[40px] rounded-xl transition-colors ${
                      activeView === 'admin_portal' && adminSubView === 'sla_monitor'
                        ? 'bg-ink text-white font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Repair SLA
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('admin_portal');
                      setAdminSubView('distance');
                    }}
                    className={`px-3 min-h-[40px] rounded-xl transition-colors ${
                      activeView === 'admin_portal' &&
                      (adminSubView === 'distance' ||
                        adminSubView === 'getting_config' ||
                        adminSubView === 'repair_config')
                        ? 'bg-ink text-white font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Pricing &amp; Delivery
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('admin_portal');
                      setAdminSubView('team');
                    }}
                    className={`px-3 min-h-[40px] rounded-xl transition-colors ${
                      activeView === 'admin_portal' && adminSubView === 'team'
                        ? 'bg-ink text-white font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Staff &amp; Admins
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: notifications, account & sign-out */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {!isLoggedIn ? (
            /* Unauthenticated: User Login Icon */
            <div className="flex items-center gap-1.5">
              <CartButton />
              {activeView === 'login' ? (
                <button
                  onClick={() => {
                    setActiveView('landing');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-3 min-h-[44px] min-w-[44px] justify-center rounded-xl border border-line hover:bg-paper text-slate-800 font-semibold text-sm flex items-center gap-1.5 transition-colors duration-150"
                  aria-label="Back to home"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span className="hidden sm:inline">Home</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openAuthModal('CUSTOMER')}
                  className="flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl border border-line hover:border-slate-300 text-slate-800 hover:bg-paper transition-colors duration-150 font-semibold text-sm"
                >
                  <User className="w-4 h-4 text-slate-700" aria-hidden="true" />
                  <span className="whitespace-nowrap">Sign in</span>
                </button>
              )}
            </div>
          ) : (
            /* Authenticated Portal View: Role-Specific Notification Bell + QR + User Identity + Logout */
            <div className="flex items-center gap-2">
              {/* Shopping cart: customers only (staff and admins don't shop from the app). */}
              {currentRole === 'CUSTOMER' && <CartButton />}
              {/* Notification Bell Dropdown (Authenticated Users Only) */}
              <div className="relative" ref={bellRef}>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-600 hover:text-ink hover:bg-slate-100 transition-colors border border-line relative"
                  title="Notifications"
                  aria-label={roleUnreadCount > 0 ? `Notifications (${roleUnreadCount} unread)` : 'Notifications'}
                  aria-expanded={notificationsOpen}
                >
                  <Bell className="w-[18px] h-[18px]" aria-hidden="true" />
                  {roleUnreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] font-bold tabular-nums flex items-center justify-center ring-2 ring-white" aria-hidden="true">
                      {roleUnreadCount > 9 ? '9+' : roleUnreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Popover (click outside / Esc closes it — see bellRef effect) */}
                {notificationsOpen && (
                  <div
                    className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-96 bg-white rounded-2xl shadow-xl border border-line p-4 z-50 space-y-3 animate-in fade-in zoom-in-95"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-line/70">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-ink" />
                        <h4 className="text-sm font-semibold text-slate-900">Notifications</h4>
                        {roleUnreadCount > 0 && (
                          <span className="text-xs font-semibold bg-paper-deep text-ink px-2 py-0.5 rounded-full">
                            {roleUnreadCount} new
                          </span>
                        )}
                      </div>
                      {roleNotifications.length > 0 && (
                        <button
                          type="button"
                          onClick={() => markAllNotificationsRead()}
                          className="text-xs text-ink hover:underline font-semibold min-h-[36px] px-1.5 rounded-lg"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    {roleNotifications.length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center">
                        You're all caught up.
                      </p>
                    ) : (
                      <div className="max-h-[60vh] sm:max-h-72 overflow-y-auto space-y-2 pr-1">
                        {roleNotifications.map((notif) => (
                          <div
                            key={notif.id}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                (e.currentTarget as HTMLElement).click();
                              }
                            }}
                            onClick={() => {
                              markNotificationRead(notif.id);
                              if (isOrderId(notif.requestId) && canOpenOrder) {
                                openOrderFromNotification(notif.requestId);
                                setNotificationsOpen(false);
                              } else if (isCourtBookingId(notif.requestId) && canOpenOrder) {
                                openCourtBookingFromNotification(notif.requestId);
                                setNotificationsOpen(false);
                              } else if (isEnquiryId(notif.requestId) && currentRole === 'ADMIN') {
                                openEnquiryFromNotification(notif.requestId);
                                setNotificationsOpen(false);
                              } else if (notif.requestId && requests.some((r) => r.id === notif.requestId)) {
                                openFromNotification(notif.requestId);
                                setNotificationsOpen(false);
                              }
                            }}
                            className={`p-3 rounded-xl border text-[13px] cursor-pointer transition-colors duration-150 ${
                              !notif.isRead
                                ? 'bg-paper border-line hover:border-slate-300'
                                : 'bg-white border-line/70 hover:bg-paper'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <p className={`flex items-start gap-1.5 ${!notif.isRead ? 'font-semibold text-ink' : 'font-medium text-slate-700'}`}>
                                {!notif.isRead && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-label="Unread" />}
                                {tidyRupees(notif.title)}
                              </p>
                              <span className="text-xs text-slate-500 shrink-0 tabular-nums">
                                {notif.timestamp}
                              </span>
                            </div>
                            <p className="text-slate-600 mt-1 text-xs leading-relaxed">
                              {tidyRupees(notif.message.replace(/\+91\d{10}\b/g, (m) => formatMobile(m)))}
                            </p>
                            {notif.requestId && (requests.some((r) => r.id === notif.requestId) || canOpenLinked(notif.requestId)) && (
                              <span className="inline-block mt-1.5 text-xs font-semibold text-ink underline underline-offset-2">
                                Open {notif.requestId}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Customers: one account menu (profile, addresses, log out) keeps the header uncluttered. */}
              {currentRole === 'CUSTOMER' && (
                <div className="relative" ref={accountRef}>
                  <button
                    type="button"
                    onClick={() => setAccountOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={accountOpen}
                    aria-label={`Your account${userName ? ` (${userName})` : ''}`}
                    className={`flex items-center gap-2 min-h-[44px] min-w-[44px] justify-center xl:justify-start pl-1.5 pr-1.5 xl:pr-2.5 rounded-xl border transition-colors duration-150 ${
                      accountOpen || (activeView === 'customer_portal' && ['profile', 'addresses'].includes(customerSubView))
                        ? 'border-ink bg-paper'
                        : 'border-line bg-white hover:bg-paper'
                    }`}
                  >
                    <span className="w-8 h-8 rounded-lg bg-ink text-white font-display text-base font-semibold flex items-center justify-center" aria-hidden="true">
                      {firstName ? firstName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                    </span>
                    <span className="hidden xl:block text-sm font-semibold text-slate-800 max-w-[8rem] truncate">{firstName || 'Account'}</span>
                    <ChevronDown className={`hidden xl:block w-4 h-4 text-slate-500 transition-transform duration-150 ${accountOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>

                  {accountOpen && (
                    <div
                      role="menu"
                      aria-label="Your account"
                      className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-line shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 origin-top-right"
                    >
                      <div className="px-3 py-2.5 border-b border-line/70 mb-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{userName || 'Signed in'}</p>
                        {userMobile && <p className="text-xs text-slate-500 tabular-nums mt-0.5">{formatMobile(userMobile)}</p>}
                      </div>
                      {[
                        { id: 'profile', label: 'Profile', icon: <UserRound className="w-4 h-4" /> },
                        { id: 'addresses', label: 'Pickup addresses', icon: <MapPin className="w-4 h-4" /> },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitem"
                          onClick={() => openCustomerSection(item.id)}
                          className={`w-full flex items-center gap-2.5 px-3 min-h-[44px] rounded-xl text-sm text-left transition-colors duration-150 ${
                            activeView === 'customer_portal' && customerSubView === item.id
                              ? 'bg-paper text-ink font-semibold'
                              : 'text-slate-700 hover:bg-paper'
                          }`}
                        >
                          <span className="text-slate-500" aria-hidden="true">{item.icon}</span>
                          {item.label}
                        </button>
                      ))}
                      <div className="border-t border-line/70 mt-1 pt-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setAccountOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 min-h-[44px] rounded-xl text-sm text-left text-rose-700 hover:bg-rose-50 transition-colors duration-150"
                        >
                          <LogOut className="w-4 h-4" aria-hidden="true" />
                          Log out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Staff / admin identity pill */}
              {currentRole !== 'CUSTOMER' && (
                <div className="hidden sm:flex items-center gap-2 px-3 min-h-[44px] rounded-xl bg-paper border border-line text-xs">
                  <div className={`w-2 h-2 rounded-full ${currentRole === 'EMPLOYEE' ? 'bg-emerald-600' : 'bg-ink'}`} aria-hidden="true" />
                  <div className="text-left">
                    <p className="font-semibold text-slate-900 leading-tight">{userName || formatMobile(userMobile) || 'Signed in'}</p>
                    <p className="text-xs text-slate-500 leading-tight whitespace-nowrap tabular-nums">
                      {currentRole === 'EMPLOYEE' ? 'Staff' : 'Admin'}
                      {userName && userMobile ? ` · ${formatMobile(userMobile)}` : ''}
                    </p>
                  </div>
                </div>
              )}

              {isStaffSession && (
                <button
                  type="button"
                  onClick={() => setPasswordOpen(true)}
                  title="Change your password"
                  aria-label="Change password"
                  className="flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-xl text-slate-700 bg-white hover:bg-paper transition-colors duration-150 border border-line text-[13px] font-semibold"
                >
                  <KeyRound className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden lg:inline">Password</span>
                </button>
              )}

              {/* Logout Button (staff and admins; customers log out from the account menu) */}
              {currentRole !== 'CUSTOMER' && (
              <button
                type="button"
                onClick={logout}
                title={`Sign out (${[userName, formatMobile(userMobile)].filter(Boolean).join(', ')}). Returns to landing screen.`}
                aria-label="Log out"
                className="flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-xl text-rose-700 bg-white hover:bg-rose-50 transition-colors duration-150 border border-line text-[13px] font-semibold"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Log out</span>
              </button>
              )}
            </div>
          )}
        </div>
      </div>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </header>
  );
};

