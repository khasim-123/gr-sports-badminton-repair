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
} from 'lucide-react';
import { formatMobile } from '../../utils/phone';
import { useShopSettings } from '../../hooks/useShopSettings';
import { formatINR } from '../../utils/format';

/** Server messages contain raw amounts like "₹450.0" or "₹1836" — show "₹450" / "₹1,836". */
const tidyRupees = (text: string) => text.replace(/₹\s?(\d+(?:\.\d+)?)/g, (_m, n: string) => formatINR(n));
import { ChangePasswordModal } from './ChangePasswordModal';
import { useStaffJobs } from '../employee/useStaffJobs';

const CUSTOMER_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'wizard', label: 'Book Service' },
  { id: 'requests', label: 'My Requests' },
  { id: 'addresses', label: 'Saved Addresses' },
  { id: 'profile', label: 'Profile' },
];

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
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs w-full overflow-x-clip print:hidden">
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
                      className={`px-3 min-h-[40px] rounded-xl transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-blue-600 text-white font-bold'
                          : tab.id === 'wizard'
                          ? 'text-blue-700 hover:bg-blue-50 font-bold'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {tab.id === 'wizard' && <PlusCircle className="w-3.5 h-3.5" />}
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
                    className={`px-3 py-1.5 rounded-xl transition-colors ${
                      activeView === 'admin_portal' && adminSubView === 'dashboard'
                        ? 'bg-purple-600 text-white font-bold'
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
                    className={`px-3 py-1.5 rounded-xl transition-colors ${
                      activeView === 'admin_portal' && adminSubView === 'requests'
                        ? 'bg-purple-600 text-white font-bold'
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
                    className={`px-3 py-1.5 rounded-xl transition-colors ${
                      activeView === 'admin_portal' && adminSubView === 'sla_monitor'
                        ? 'bg-purple-600 text-white font-bold'
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
                    className={`px-3 py-1.5 rounded-xl transition-colors ${
                      activeView === 'admin_portal' &&
                      (adminSubView === 'distance' ||
                        adminSubView === 'getting_config' ||
                        adminSubView === 'repair_config')
                        ? 'bg-purple-600 text-white font-bold'
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
                    className={`px-3 py-1.5 rounded-xl transition-colors ${
                      activeView === 'admin_portal' && adminSubView === 'team'
                        ? 'bg-purple-600 text-white font-bold'
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
              {activeView === 'login' ? (
                <button
                  onClick={() => {
                    setActiveView('landing');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-3 min-h-[40px] rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold text-xs flex items-center gap-1 transition-colors"
                  title="Back to Home"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Home</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openAuthModal('CUSTOMER')}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[40px] rounded-lg border border-slate-200 hover:border-slate-300 text-slate-800 hover:bg-slate-100 transition-colors font-semibold text-xs sm:text-sm"
                  title="Login / Register"
                >
                  <User className="w-4 h-4 text-slate-700" />
                  <span className="whitespace-nowrap">Login / Register</span>
                </button>
              )}
            </div>
          ) : (
            /* Authenticated Portal View: Role-Specific Notification Bell + QR + User Identity + Logout */
            <div className="flex items-center gap-2">
              {/* Notification Bell Dropdown (Authenticated Users Only) */}
              <div className="relative" ref={bellRef}>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors border border-slate-200 relative"
                  title="Notifications"
                  aria-label={roleUnreadCount > 0 ? `Notifications (${roleUnreadCount} unread)` : 'Notifications'}
                  aria-expanded={notificationsOpen}
                >
                  <Bell className="w-4 h-4" />
                  {roleUnreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">
                      {roleUnreadCount > 9 ? '9+' : roleUnreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Popover (click outside / Esc closes it — see bellRef effect) */}
                {notificationsOpen && (
                  <div
                    className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 space-y-3 animate-in fade-in zoom-in-95"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-slate-900">Notifications</h4>
                        {roleUnreadCount > 0 && (
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.2 rounded-full">
                            {roleUnreadCount} new
                          </span>
                        )}
                      </div>
                      {roleNotifications.length > 0 && (
                        <button
                          type="button"
                          onClick={() => markAllNotificationsRead()}
                          className="text-[11px] text-blue-600 hover:underline font-semibold min-h-[32px] px-1"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    {roleNotifications.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center">
                        No new notifications right now.
                      </p>
                    ) : (
                      <div className="max-h-[60vh] sm:max-h-72 overflow-y-auto space-y-2 pr-1">
                        {roleNotifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => {
                              markNotificationRead(notif.id);
                              if (notif.requestId && requests.some((r) => r.id === notif.requestId)) {
                                openFromNotification(notif.requestId);
                                setNotificationsOpen(false);
                              }
                            }}
                            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                              !notif.isRead
                                ? 'bg-blue-50/70 border-blue-200'
                                : 'bg-slate-50/50 border-slate-100 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <p className={`font-bold ${!notif.isRead ? 'text-blue-900' : 'text-slate-800'}`}>
                                {tidyRupees(notif.title)}
                              </p>
                              <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                                {notif.timestamp}
                              </span>
                            </div>
                            <p className="text-slate-600 mt-1 text-[11px] leading-relaxed">
                              {tidyRupees(notif.message.replace(/\+91\d{10}\b/g, (m) => formatMobile(m)))}
                            </p>
                            {notif.requestId && requests.some((r) => r.id === notif.requestId) && (
                              <span className="inline-block mt-1 text-[10px] font-mono font-bold text-blue-700 bg-white px-1.5 py-0.2 rounded border border-blue-200">
                                View {notif.requestId} →
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Profile Pill */}
              <div
                className={`hidden ${
                  currentRole === 'CUSTOMER' ? 'xl:flex' : 'sm:flex'
                } items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs`}
              >
                <div className={`w-2 h-2 rounded-full ${
                  currentRole === 'CUSTOMER' ? 'bg-blue-600' : currentRole === 'EMPLOYEE' ? 'bg-emerald-600' : 'bg-purple-600'
                }`} />
                <div className="text-left">
                  <p className="font-bold text-slate-900 leading-tight">{userName || formatMobile(userMobile) || 'Signed in'}</p>
                  <p className="text-[10px] text-slate-500 leading-tight whitespace-nowrap">
                    {currentRole === 'CUSTOMER' ? 'Player' : currentRole === 'EMPLOYEE' ? 'Staff' : 'Admin'}
                    {userName && userMobile ? ` • ${formatMobile(userMobile)}` : ''}
                  </p>
                </div>
              </div>

              {isStaffSession && (
                <button
                  type="button"
                  onClick={() => setPasswordOpen(true)}
                  title="Change your password"
                  aria-label="Change password"
                  className="flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-xl text-slate-700 bg-white hover:bg-slate-100 transition-colors border border-slate-200 text-xs font-bold"
                >
                  <KeyRound className="w-4 h-4" />
                  <span className="hidden lg:inline">Password</span>
                </button>
              )}

              {/* Logout Button */}
              <button
                type="button"
                onClick={logout}
                title={`Sign out (${[userName, formatMobile(userMobile)].filter(Boolean).join(', ')}). Returns to landing screen.`}
                aria-label="Log out"
                className="flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-200 text-xs font-bold"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </header>
  );
};

