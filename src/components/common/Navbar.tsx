import React from 'react';
import { useApp } from '../../context/AppContext';
import { GRSportsLogo } from './GRSportsLogo';
import {
  QrCode,
  LogOut,
  LogIn,
  ArrowLeft,
  PlusCircle,
  Menu,
  X,
  Bell,
  Check,
  Search,
  ShoppingCart,
  User,
} from 'lucide-react';

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
    setQrModalOpen,
    openLoginWithRole,
    openAuthModal,
    openWizardWithService,
    logout,
    distanceConfig,
    requests,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    openRequestDetail,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Role-filtered notifications
  const roleNotifications = notifications.filter(
    (n) => n.targetRoles.includes(currentRole) || n.targetRoles.length === 0
  );
  const roleUnreadCount = roleNotifications.filter((n) => !n.isRead).length;

  // Real-time task counts for Employee Portal navigation
  const employeePickupCount = requests.filter(
    (r) => r.status === 'Accepted' || r.status === 'Employee Assigned' || r.status === 'Pickup Scheduled'
  ).length;
  const employeeGettingCount = requests.filter(
    (r) => r.serviceType === 'GETTING' && (r.status === 'Bat Picked Up' || r.status === 'Getting in Progress')
  ).length;
  const employeeRepairCount = requests.filter(
    (r) =>
      r.serviceType === 'REPAIR' &&
      (r.status === 'Bat Picked Up' ||
        r.status === 'Inspection' ||
        r.status === 'Awaiting Customer Approval' ||
        r.status === 'Repair Approved' ||
        r.status === 'Repair in Progress')
  ).length;
  const employeeDeliveryCount = requests.filter(
    (r) => r.status === 'Getting Completed' || r.status === 'Repair Completed' || r.status === 'Out for Delivery'
  ).length;
  const employeePaymentCount = requests.filter((r) => r.paymentStatus === 'Paid' && r.paymentRecord).length;

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

  const scrollToLandingSection = (sectionId: string) => {
    if (activeView !== 'landing') {
      setActiveView('landing');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } else {
      const el = document.getElementById(sectionId);
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs w-full overflow-x-clip">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand / Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleBrandLogoClick}
            className="flex items-center text-left group"
            title={isLoggedIn ? `Return to ${currentRole.toLowerCase()} dashboard` : 'GR Sports Home'}
          >
            <GRSportsLogo size="md" />
          </button>
        </div>

        {/* Center: Context-Aware Navigation (Hidden for public as requested; portal tabs visible when logged in) */}
        <div className="hidden md:flex items-center gap-1 text-xs font-semibold min-w-0 overflow-x-auto no-scrollbar py-1">
          {!isLoggedIn ? null : (
            /* Authenticated Portal Sub-Navigation (Strictly Isolated by Role) */
            <>
              {currentRole === 'CUSTOMER' && (
                <>
                  <button
                    onClick={() => {
                      setActiveView('customer_portal');
                      setCustomerSubView('dashboard');
                    }}
                    className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                      activeView === 'customer_portal' && customerSubView === 'dashboard'
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('customer_portal');
                      setCustomerSubView('wizard');
                    }}
                    className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      activeView === 'customer_portal' && customerSubView === 'wizard'
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-blue-700 hover:bg-blue-50 font-bold'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Book Service
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('customer_portal');
                      setCustomerSubView('requests');
                    }}
                    className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                      activeView === 'customer_portal' && customerSubView === 'requests'
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    My Requests
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('customer_portal');
                      setCustomerSubView('addresses');
                    }}
                    className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                      activeView === 'customer_portal' && customerSubView === 'addresses'
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Saved Addresses
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('customer_portal');
                      setCustomerSubView('profile');
                    }}
                    className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                      activeView === 'customer_portal' && customerSubView === 'profile'
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Profile
                  </button>
                </>
              )}

              {currentRole === 'EMPLOYEE' && (
                <>
                  {[
                    { id: 'dashboard', label: 'Dashboard', count: null },
                    { id: 'my_requests', label: 'All Requests', count: requests.length },
                    { id: 'pickups', label: 'Pickups', count: employeePickupCount },
                    { id: 'getting', label: 'Stringing', count: employeeGettingCount },
                    { id: 'repair', label: 'Repairs', count: employeeRepairCount },
                    { id: 'deliveries', label: 'Deliveries', count: employeeDeliveryCount },
                    { id: 'payments', label: 'Payments', count: employeePaymentCount },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveView('employee_portal');
                        setEmployeeSubView(tab.id);
                      }}
                      className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 whitespace-nowrap shrink-0 ${
                        activeView === 'employee_portal' && employeeSubView === tab.id
                          ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count !== null && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            activeView === 'employee_portal' && employeeSubView === tab.id
                              ? 'bg-emerald-800 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </>
              )}

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
                    KPI Overview
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
                    Requests Table
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
                    7-Day SLA
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
                    Pricing &amp; Logistics
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
                    Team &amp; Admins
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('admin_portal');
                      setAdminSubView('templates');
                    }}
                    className={`px-3 py-1.5 rounded-xl transition-colors ${
                      activeView === 'admin_portal' && adminSubView === 'templates'
                        ? 'bg-purple-600 text-white font-bold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Email Templates
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Search, Cart, User Login & Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Search Box matching Reference Design */}
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  scrollToLandingSection('services');
                }
              }}
              className="w-32 xs:w-44 sm:w-56 md:w-64 pl-3 pr-8 py-1.5 text-xs sm:text-sm rounded-md border border-slate-300 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 bg-white placeholder-slate-400 text-slate-800 transition-all"
            />
            <button
              type="button"
              onClick={() => scrollToLandingSection('services')}
              className="absolute right-2.5 text-slate-400 hover:text-slate-700 transition-colors"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Cart Icon with Yellow Count Badge */}
          <button
            type="button"
            onClick={() => {
              if (!isLoggedIn) {
                openAuthModal('CUSTOMER');
              } else {
                setActiveView('customer_portal');
                setCustomerSubView('requests');
              }
            }}
            className="relative p-1.5 sm:p-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Shopping Cart / Requests"
          >
            <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="absolute -top-1 -right-1 bg-yellow-400 text-slate-900 text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center border border-white shadow-xs">
              {isLoggedIn ? requests.length : 0}
            </span>
          </button>

          {!isLoggedIn ? (
            /* Unauthenticated: User Login Icon */
            <div className="flex items-center gap-1.5">
              {activeView === 'login' ? (
                <button
                  onClick={() => {
                    setActiveView('landing');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold text-xs flex items-center gap-1 transition-colors"
                  title="Back to Home"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Home</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openAuthModal('CUSTOMER')}
                  className="p-1.5 sm:p-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  title="Login / Register"
                >
                  <User className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              )}
            </div>
          ) : (
            /* Authenticated Portal View: Role-Specific Notification Bell + QR + User Identity + Logout */
            <div className="flex items-center gap-2">
              {/* Notification Bell Dropdown (Authenticated Users Only) */}
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors border border-slate-200 relative"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {roleUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                      {roleUnreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Popover */}
                {notificationsOpen && (
                  <div
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 space-y-3 animate-in fade-in zoom-in-95"
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
                          className="text-[11px] text-blue-600 hover:underline font-semibold"
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
                      <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                        {roleNotifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => {
                              markNotificationRead(notif.id);
                              if (notif.requestId) {
                                openRequestDetail(notif.requestId);
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
                                {notif.title}
                              </p>
                              <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                                {notif.timestamp}
                              </span>
                            </div>
                            <p className="text-slate-600 mt-1 text-[11px] leading-relaxed">
                              {notif.message}
                            </p>
                            {notif.requestId && (
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

              {/* Court QR Poster Button */}
              <button
                onClick={() => setQrModalOpen(true)}
                className="p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors border border-slate-200"
                title="Scan Physical Court Poster QR"
              >
                <QrCode className="w-4 h-4" />
              </button>

              {/* User Profile Pill */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                <div className={`w-2 h-2 rounded-full ${
                  currentRole === 'CUSTOMER' ? 'bg-blue-600' : currentRole === 'EMPLOYEE' ? 'bg-emerald-600' : 'bg-purple-600'
                }`} />
                <div className="text-left hidden sm:block">
                  <p className="font-bold text-slate-900 leading-tight">{userName || 'Authenticated User'}</p>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    {currentRole === 'CUSTOMER' ? 'Player' : currentRole === 'EMPLOYEE' ? 'Staff' : 'Admin'}
                  </p>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                title={`Sign out (${userName}). Returns to landing screen.`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-200 text-xs font-bold"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer Navigation (Public Landing) */}
      {mobileMenuOpen && !isLoggedIn && (
        <div className="md:hidden bg-white/95 backdrop-blur-md border-b border-slate-200 p-4 space-y-2 animate-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            <button
              onClick={() => {
                scrollToLandingSection('services');
                setMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl text-left bg-slate-50 hover:bg-slate-100 text-slate-800"
            >
              Services
            </button>
            <button
              onClick={() => {
                scrollToLandingSection('how-it-works');
                setMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl text-left bg-slate-50 hover:bg-slate-100 text-slate-800"
            >
              How It Works
            </button>
            <button
              onClick={() => {
                scrollToLandingSection('distance-map');
                setMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl text-left bg-slate-50 hover:bg-slate-100 text-slate-800"
            >
              {distanceConfig.freeRadiusKm} KM Free Radius
            </button>
            <button
              onClick={() => {
                scrollToLandingSection('pricing-sla');
                setMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl text-left bg-slate-50 hover:bg-slate-100 text-slate-800"
            >
              Pricing &amp; SLA
            </button>
            <button
              onClick={() => {
                scrollToLandingSection('faq');
                setMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl text-left bg-slate-50 hover:bg-slate-100 text-slate-800 col-span-2"
            >
              Frequently Asked Questions (FAQ)
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

