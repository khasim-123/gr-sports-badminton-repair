import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  UserRole,
  ServiceType,
  ServiceRequest,
  DistancePricingConfig,
  AuditLogItem,
  Address,
  RequestStatus,
  RepairEstimate,
  PaymentMethod,
  BatConditionAtPickup,
  GettingServiceTier,
  RepairCategoryTier,
  AppNotification,
  Review,
  Employee,
  WizardPrefill,
} from '../types';
import { initialDistanceConfig, gettingTypesData, repairCategoriesData } from '../data/mockData';
import {
  ApiError,
  apiClient,
  SESSION_EXPIRED_EVENT,
  AuthSession,
  authService,
  requestService,
  CreateRequestPayload,
  pricingService,
  employeeService,
  notificationService,
  auditService,
} from '../services';
import confetti from 'canvas-confetti';
import { formatMobile, normalizeMobile } from '../utils/phone';

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  /** Sticky toasts stay until closed and are never evicted by newer ones. */
  sticky?: boolean;
}

type ToastType = ToastMessage['type'];
type ToastSpec = [ToastType, string, string];

/** 'validating' = a stored session is being checked with GET /auth/me on app start. */
type SessionStatus = 'none' | 'validating' | 'valid';

interface AppContextType {
  // Navigation & Role
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  customerSubView: string;
  setCustomerSubView: (view: string) => void;
  employeeSubView: string;
  setEmployeeSubView: (view: string) => void;
  adminSubView: string;
  setAdminSubView: (view: string) => void;
  selectedRequestId: string | null;
  setSelectedRequestId: (id: string | null) => void;

  // Modals
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  authModalRole: UserRole;
  setAuthModalRole: (role: UserRole) => void;
  openAuthModal: (role?: UserRole) => void;
  qrModalOpen: boolean;
  setQrModalOpen: (open: boolean) => void;
  repairEstimateModalOpen: boolean;
  setRepairEstimateModalOpen: (open: boolean) => void;
  revisedEstimateModalOpen: boolean;
  setRevisedEstimateModalOpen: (open: boolean) => void;
  modalTargetRequestId: string | null;
  setModalTargetRequestId: (id: string | null) => void;

  // Authentication State
  isLoggedIn: boolean;
  /** True while a restored session is being validated with the server on app start. */
  isAuthChecking: boolean;
  userName: string;
  /** The signed-in user's identity: mobile number, "+91XXXXXXXXXX". */
  userMobile: string;
  userTitle?: string;
  /** Finish sign-in with a server-issued AuthSession (must carry the JWT). */
  completeLogin: (session: AuthSession) => void;
  /**
   * Legacy helper: enters the portal for the session already stored by
   * `authService.login` / `authService.register` (keeps its token).
   * Refuses when there is no stored server session for that role.
   */
  logout: () => void;
  loginRoleTab: UserRole;
  setLoginRoleTab: (role: UserRole) => void;
  openLoginWithRole: (role: UserRole) => void;
  wizardServiceType: ServiceType;
  setWizardServiceType: (type: ServiceType) => void;
  pendingWizardLaunch: boolean;
  setPendingWizardLaunch: (pending: boolean) => void;
  wizardPrefill: WizardPrefill | null;
  setWizardPrefill: (prefill: WizardPrefill | null) => void;
  openWizardWithService: (type: ServiceType, prefill?: Partial<WizardPrefill>) => void;
  addNewAddress: (address: Omit<Address, 'id'>) => Address;
  deleteAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  /** Updates the display name on this device. The mobile number is the login identity and cannot change. */
  updateUserProfile: (name: string) => void;

  // Requests Data & Actions
  requests: ServiceRequest[];
  /** True while the signed-in user's data (requests, notifications, ...) is loading. */
  isDataLoading: boolean;
  /** True once the signed-in user's data has been fetched at least once. */
  dataLoaded: boolean;
  /** True when the last attempt to load service requests failed (e.g. server unreachable). */
  requestsLoadFailed: boolean;
  /** Re-fetch the signed-in user's data from the server. */
  refreshData: () => void;
  distanceConfig: DistancePricingConfig;
  savedAddresses: Address[];
  auditLogs: AuditLogItem[];
  toasts: ToastMessage[];
  /** `durationMs: 0` keeps the toast until the user closes it. */
  addToast: (
    type: 'success' | 'info' | 'warning' | 'error',
    title: string,
    message: string,
    options?: { durationMs?: number }
  ) => void;
  removeToast: (id: string) => void;

  // Service Business Workflows (all resolve once the server has answered)
  /** Creates the request on the server. Rejects (after toasting) if the server refuses. */
  addRequest: (newReq: Partial<ServiceRequest>) => Promise<ServiceRequest>;
  updateRequestStatus: (id: string, status: RequestStatus, actor: string, notes?: string) => Promise<boolean>;
  assignEmployee: (requestId: string, employeeId: string) => Promise<boolean>;
  recordPickupCondition: (
    requestId: string,
    condition: BatConditionAtPickup,
    notes: string,
    photos: string[]
  ) => Promise<boolean>;
  createRepairEstimate: (requestId: string, estimate: RepairEstimate) => Promise<boolean>;
  approveRepairEstimate: (requestId: string) => Promise<boolean>;
  declineRepairEstimate: (requestId: string) => Promise<boolean>;
  requestPriceRevision: (
    requestId: string,
    additionalAmount: number,
    newTotal: number,
    reason: string
  ) => Promise<boolean>;
  startDelivery: (requestId: string) => Promise<boolean>;
  recordManualPayment: (
    requestId: string,
    amount: number,
    method: PaymentMethod,
    notes?: string,
    collectedBy?: string
  ) => Promise<boolean>;

  // Configuration Actions
  updateDistanceConfig: (config: DistancePricingConfig) => Promise<boolean>;
  calculateDistanceCharge: (distanceKm: number) => { charge: number; isFree: boolean; chargeableKm: number };

  // Service Pricing Configuration
  gettingServices: GettingServiceTier[];
  repairCategories: RepairCategoryTier[];
  updateGettingService: (id: string, updated: Partial<GettingServiceTier>) => Promise<boolean>;
  updateRepairCategory: (id: string, updated: Partial<RepairCategoryTier>) => Promise<boolean>;
  addGettingService: (newTier: Omit<GettingServiceTier, 'id'>) => Promise<boolean>;
  addRepairCategory: (newCategory: Omit<RepairCategoryTier, 'id'>) => Promise<boolean>;
  resetPricingToDefaults: () => Promise<boolean>;

  // Helper for opening request detail directly
  openRequestDetail: (id: string) => void;

  // Notifications
  notifications: AppNotification[];
  /** Adds a local (this-session-only) notification. */
  addNotification: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadCount: number;

  // Employee & Admin Management
  employees: Employee[];
  addEmployee: (emp: Omit<Employee, 'id' | 'activeJobsCount' | 'avatar'>) => Promise<boolean>;
  removeEmployee: (id: string) => Promise<boolean>;

  // Customer Review
  submitReview: (requestId: string, review: Review) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

/** Per-user caches that must never survive a logout (shared devices). */
const USER_CACHE_KEYS = [
  'shuttlecraft_requests',
  'shuttlecraft_employees',
  'shuttlecraft_addresses',
  'shuttlecraft_notifications',
  'shuttlecraft_audit_logs',
  'shuttlecraft_email_templates', // legacy key, still cleared on logout
];
const ADDRESSES_KEY = 'shuttlecraft_addresses';
const DIST_CONFIG_KEY = 'shuttlecraft_dist_config';
const GETTING_SERVICES_KEY = 'shuttlecraft_getting_services';
const REPAIR_CATEGORIES_KEY = 'shuttlecraft_repair_categories';

const purgeUserCaches = () => {
  USER_CACHE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  });
};

const readCache = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeCache = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
};

/** Saved pickup addresses are kept on this device only, tagged with their owner's mobile number. */
const loadSavedAddresses = (mobile: string): Address[] => {
  const owner = normalizeMobile(mobile);
  if (!owner) return [];
  const data = readCache<{ owner?: string; addresses?: Address[] } | null>(ADDRESSES_KEY, null);
  if (data && data.owner === owner && Array.isArray(data.addresses)) return data.addresses;
  return [];
};

const persistSavedAddresses = (mobile: string, addresses: Address[]) => {
  const owner = normalizeMobile(mobile);
  if (!owner) return;
  writeCache(ADDRESSES_KEY, { owner, addresses });
};

const errorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

/** 401s are handled globally (session-expired logout + toast). */
const isSessionExpiredError = (err: unknown) => err instanceof ApiError && err.status === 401;

/**
 * Views with their own URL path (the rest of the app lives at "/"): the T-shirt store (/tshirts)
 * and court booking (/courts). Both open from a direct link for anyone.
 */
const APPAREL_VIEW = 'apparel';
const COURTS_VIEW = 'courts';
const PATH_VIEWS: Record<string, string> = { [APPAREL_VIEW]: '/tshirts', [COURTS_VIEW]: '/courts' };
const isPathView = (view: string | null | undefined) => !!view && Object.prototype.hasOwnProperty.call(PATH_VIEWS, view);
/** The path-backed view for the current address, if any. */
const viewForPath = (): string | null => {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  return Object.keys(PATH_VIEWS).find((v) => PATH_VIEWS[v] === path) || null;
};

const portalForRole = (role: UserRole) =>
  role === 'ADMIN' ? 'admin_portal' : role === 'EMPLOYEE' ? 'employee_portal' : 'customer_portal';

/** Read the stored session once on startup; sessions without a JWT are discarded. */
const readInitialSession = (): AuthSession | null => {
  const stored = authService.getStoredSession();
  if (stored && stored.isLoggedIn && stored.token && !stored.isNewCustomer) return stored;
  if (stored) authService.clearStoredSession();
  // No valid session → nothing user-specific may linger on this device.
  purgeUserCaches();
  return null;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initialSession] = useState<AuthSession | null>(readInitialSession);

  // Navigation & Role
  const [currentRole, setCurrentRole] = useState<UserRole>(initialSession?.role || 'CUSTOMER');
  const [activeView, setActiveView] = useState<string>(() => {
    // The T-shirt store (/tshirts) and court booking (/courts) have their own addresses and open
    // from a direct link for anyone.
    const fromPath = viewForPath();
    if (fromPath) return fromPath;
    if (!initialSession) return 'landing';
    const view = initialSession.activeView;
    return view && view !== 'login' && !isPathView(view) ? view : portalForRole(initialSession.role);
  });
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;
  const [customerSubView, setCustomerSubView] = useState<string>(() => {
    const sub = initialSession?.customerSubView || 'dashboard';
    // The selected request id isn't persisted, so a restored detail view would be empty.
    return sub === 'detail' ? 'requests' : sub;
  });
  const [employeeSubView, setEmployeeSubView] = useState<string>(initialSession?.employeeSubView || 'dashboard');
  const [adminSubView, setAdminSubView] = useState<string>(initialSession?.adminSubView || 'dashboard');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalRole, setAuthModalRole] = useState<UserRole>('CUSTOMER');
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const [repairEstimateModalOpen, setRepairEstimateModalOpen] = useState<boolean>(false);
  const [revisedEstimateModalOpen, setRevisedEstimateModalOpen] = useState<boolean>(false);
  const [modalTargetRequestId, setModalTargetRequestId] = useState<string | null>(null);

  // Authentication
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!initialSession);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(initialSession ? 'validating' : 'none');
  const [sessionNonce, setSessionNonce] = useState<number>(0);
  const [userName, setUserName] = useState<string>(initialSession?.name || '');
  const [userMobile, setUserMobile] = useState<string>(initialSession?.mobile || '');
  const [userTitle, setUserTitle] = useState<string>(initialSession?.title || '');
  const [loginRoleTab, setLoginRoleTab] = useState<UserRole>('CUSTOMER');
  const [wizardServiceType, setWizardServiceType] = useState<ServiceType>('GETTING');
  const [pendingWizardLaunch, setPendingWizardLaunch] = useState<boolean>(false);
  const [wizardPrefill, setWizardPrefill] = useState<WizardPrefill | null>(null);

  // Public configuration — static price tiers are only a pre-load fallback.
  const [distanceConfig, setDistanceConfig] = useState<DistancePricingConfig>(() =>
    readCache<DistancePricingConfig>(DIST_CONFIG_KEY, initialDistanceConfig)
  );
  const [gettingServices, setGettingServices] = useState<GettingServiceTier[]>(() => {
    const cached = readCache<GettingServiceTier[]>(GETTING_SERVICES_KEY, gettingTypesData);
    return Array.isArray(cached) ? cached : gettingTypesData;
  });
  const [repairCategories, setRepairCategories] = useState<RepairCategoryTier[]>(() => {
    const cached = readCache<RepairCategoryTier[]>(REPAIR_CATEGORIES_KEY, repairCategoriesData);
    return Array.isArray(cached) ? cached : repairCategoriesData;
  });

  // User-specific data — always starts empty and only ever comes from the server.
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>(() =>
    initialSession ? loadSavedAddresses(initialSession.mobile || '') : []
  );
  const [isDataLoading, setIsDataLoading] = useState<boolean>(!!initialSession);
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);
  const [requestsLoadFailed, setRequestsLoadFailed] = useState<boolean>(false);
  const [reloadNonce, setReloadNonce] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const currentRoleRef = useRef<UserRole>(currentRole);
  currentRoleRef.current = currentRole;
  /** Synchronously-updated login flag (state updates are async). */
  const isLoggedInRef = useRef<boolean>(!!initialSession);
  /** Incremented whenever user data must be (re)loaded or discarded; stale responses are ignored. */
  const loadGenRef = useRef<number>(0);

  // -------------------------------------------------------------------------
  // Toasts
  // -------------------------------------------------------------------------
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const addToast = (type: ToastType, title: string, message: string, options?: { durationMs?: number }) => {
    const newToast: ToastMessage = {
      id: 'toast-' + Date.now() + Math.random().toString(36).substring(2, 6),
      type,
      title,
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const duration = options?.durationMs ?? 5500;
    newToast.sticky = duration <= 0;
    setToasts((prev) => [
      newToast,
      ...prev.filter((t) => t.sticky),
      ...prev.filter((t) => !t.sticky).slice(0, 4),
    ]);
    if (duration > 0) {
      setTimeout(() => {
        removeToast(newToast.id);
      }, duration);
    }
  };

  // -------------------------------------------------------------------------
  // Session lifecycle
  // -------------------------------------------------------------------------

  const clearUserData = () => {
    loadGenRef.current += 1; // drop any in-flight responses for the previous identity
    setRequests([]);
    setEmployees([]);
    setAuditLogs([]);
    setNotifications([]);
    setSavedAddresses([]);
    setSelectedRequestId(null);
    setModalTargetRequestId(null);
    setRepairEstimateModalOpen(false);
    setRevisedEstimateModalOpen(false);
    setDataLoaded(false);
    setIsDataLoading(false);
  };

  /** Ends the session locally (and optionally on the server). Idempotent. */
  const endSession = (opts: { callServer?: boolean; toast?: ToastSpec | null }) => {
    const wasLoggedIn = isLoggedInRef.current;
    isLoggedInRef.current = false;
    if (opts.callServer) {
      authService.logout().catch(() => undefined);
    } else {
      authService.clearStoredSession();
    }
    purgeUserCaches();
    clearUserData();
    setIsLoggedIn(false);
    setSessionStatus('none');
    setActiveView('landing');
    setCurrentRole('CUSTOMER');
    setCustomerSubView('dashboard');
    setEmployeeSubView('dashboard');
    setAdminSubView('dashboard');
    setUserName('');
    setUserMobile('');
    setUserTitle('');
    setPendingWizardLaunch(false);
    setWizardPrefill(null);
    // Toasts may hold the previous user's data (e.g. a staff member's temporary password).
    setToasts([]);
    if (wasLoggedIn && opts.toast) addToast(...opts.toast);
  };

  const logout = () => {
    endSession({
      callServer: true,
      toast: ['info', 'Logged Out', 'You have been safely signed out. Returning to home page.'],
    });
  };

  const completeLogin = (session: AuthSession) => {
    const stored = authService.getStoredSession();
    const token = session.token || stored?.token;
    if (!token && !apiClient.isMockEnabled()) {
      addToast('error', 'Sign-in failed', 'The server did not return a session token. Please try again.');
      return;
    }

    const role = session.role;
    // A customer who logs in on the court booking page stays there (to finish the booking).
    const portal = role === 'CUSTOMER' && activeViewRef.current === COURTS_VIEW ? COURTS_VIEW : portalForRole(role);
    const launchWizard = role === 'CUSTOMER' && pendingWizardLaunch;
    const targetCustomerSubView = launchWizard ? 'wizard' : 'dashboard';

    authService.setStoredSession({
      ...(stored || {}),
      ...session,
      token,
      isLoggedIn: true,
      isNewCustomer: false,
      activeView: portal,
      customerSubView: targetCustomerSubView,
      employeeSubView: 'dashboard',
      adminSubView: 'dashboard',
    });

    // Never show the previous user's data to the next one.
    purgeUserCaches();
    clearUserData();

    isLoggedInRef.current = true;
    setIsLoggedIn(true);
    setSessionStatus('valid');
    setSessionNonce((n) => n + 1);
    setCurrentRole(role);
    setUserName(session.name || '');
    setUserMobile(session.mobile || '');
    setUserTitle(session.title || '');
    setSavedAddresses(loadSavedAddresses(session.mobile || ''));
    setAuthModalOpen(false);
    setActiveView(portal);
    setCustomerSubView(targetCustomerSubView);
    setEmployeeSubView('dashboard');
    setAdminSubView('dashboard');
    if (pendingWizardLaunch) setPendingWizardLaunch(false);
    if (role !== 'CUSTOMER') setWizardPrefill(null);

    const displayName = session.name || formatMobile(session.mobile);
    addToast('success', 'Signed In', `Welcome, ${displayName}!`);
  };

  // Latest-closure ref for the global session-expired listener.
  const endSessionRef = useRef(endSession);
  endSessionRef.current = endSession;

  // 401 from any authenticated request → logout + toast (apiClient already cleared the stored session).
  useEffect(() => {
    const onExpired = () => {
      if (!isLoggedInRef.current) return;
      endSessionRef.current({
        toast: ['warning', 'Session Expired', 'Your session expired, please log in again.'],
      });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // On start, validate a restored session with GET /auth/me.
  useEffect(() => {
    if (!initialSession) return;
    let cancelled = false;
    authService
      .me()
      .then((session) => {
        if (cancelled || !isLoggedInRef.current) return;
        if (session.role && session.role !== currentRole) setCurrentRole(session.role);
        if (session.role && session.role !== initialSession.role) setActiveView(portalForRole(session.role));
        setUserName(session.name || '');
        setUserMobile(session.mobile || '');
        setUserTitle(session.title || '');
        setSessionStatus('valid');
      })
      .catch((err) => {
        if (cancelled || !isLoggedInRef.current) return;
        const status = err instanceof ApiError ? err.status : -1;
        if (status === 0 || status >= 500) {
          // Server unreachable / failing: keep the session (every request is still
          // authorised server-side, and any 401 logs the user out).
          setSessionStatus('valid');
          addToast(
            'warning',
            'Could not verify your session',
            'The server is not reachable right now. Some data may be unavailable.'
          );
          return;
        }
        endSessionRef.current({
          toast: ['warning', 'Session Expired', 'Your session expired, please log in again.'],
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the address bar in step with the T-shirt store and court booking views: entering one
  // pushes its path (/tshirts, /courts), leaving it pushes /, and the browser's back / forward
  // buttons switch the view.
  const lastAppViewRef = useRef<string | null>(isPathView(activeView) ? null : activeView);
  const viewFromHistoryRef = useRef(false);
  useEffect(() => {
    if (!isPathView(activeView)) lastAppViewRef.current = activeView;
    if (viewFromHistoryRef.current) {
      viewFromHistoryRef.current = false;
      return;
    }
    const pathView = viewForPath();
    try {
      if (isPathView(activeView) && pathView !== activeView) {
        window.history.pushState({ grView: activeView }, '', PATH_VIEWS[activeView]);
      } else if (!isPathView(activeView) && pathView) {
        window.history.pushState({ grView: activeView }, '', '/');
      }
    } catch {
      // history API unavailable (sandboxed frame): the view still changes
    }
  }, [activeView]);
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      let target: string;
      const pathView = viewForPath();
      if (pathView) target = pathView;
      else {
        const fromState = e.state && typeof e.state.grView === 'string' ? (e.state.grView as string) : '';
        target =
          fromState && !isPathView(fromState)
            ? fromState
            : lastAppViewRef.current || (isLoggedInRef.current ? portalForRole(currentRoleRef.current) : 'landing');
        if (!isLoggedInRef.current && target !== 'login') target = 'landing';
      }
      if (target === activeViewRef.current) return;
      viewFromHistoryRef.current = true;
      setActiveView(target);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Persist navigation state into the stored session (merging — the token is preserved).
  useEffect(() => {
    if (!isLoggedIn) return;
    authService.updateStoredSession({ activeView, customerSubView, employeeSubView, adminSubView });
  }, [isLoggedIn, activeView, customerSubView, employeeSubView, adminSubView]);

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  // Public configuration (GET /config/* is public). Server result always wins.
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      pricingService.getDistanceConfig(),
      pricingService.getGettingServices(),
      pricingService.getRepairCategories(),
    ]).then(([dist, getting, repair]) => {
      if (cancelled) return;
      if (dist.status === 'fulfilled' && dist.value) {
        setDistanceConfig(dist.value);
        writeCache(DIST_CONFIG_KEY, dist.value);
      }
      if (getting.status === 'fulfilled' && Array.isArray(getting.value)) {
        setGettingServices(getting.value);
        writeCache(GETTING_SERVICES_KEY, getting.value);
      }
      if (repair.status === 'fulfilled' && Array.isArray(repair.value)) {
        setRepairCategories(repair.value);
        writeCache(REPAIR_CATEGORIES_KEY, repair.value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // User data: (re)loaded whenever the signed-in identity/role changes; only
  // endpoints the role may access are called.
  useEffect(() => {
    if (!isLoggedIn || sessionStatus !== 'valid') return;
    const gen = ++loadGenRef.current;
    const role = currentRole;
    const isStaff = role === 'EMPLOYEE' || role === 'ADMIN';
    const isAdmin = role === 'ADMIN';
    setIsDataLoading(true);

    Promise.allSettled([
      requestService.getRequests(),
      notificationService.getNotifications(),
      isStaff ? employeeService.getEmployees() : Promise.resolve(null),
      isAdmin ? auditService.getAuditLogs() : Promise.resolve(null),
    ]).then(([reqs, notifs, emps, audits]) => {
      if (gen !== loadGenRef.current) return; // identity changed or logged out meanwhile

      if (reqs.status === 'fulfilled') setRequests(Array.isArray(reqs.value) ? reqs.value : []);
      setRequestsLoadFailed(reqs.status === 'rejected');
      if (notifs.status === 'fulfilled') setNotifications(Array.isArray(notifs.value) ? notifs.value : []);
      if (isStaff && emps.status === 'fulfilled') setEmployees(Array.isArray(emps.value) ? emps.value : []);
      if (isAdmin && audits.status === 'fulfilled') setAuditLogs(Array.isArray(audits.value) ? audits.value : []);

      const failures = [reqs, notifs, emps, audits]
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => r.reason);
      if (failures.length > 0 && !failures.some(isSessionExpiredError)) {
        console.error('Failed to load some data:', failures);
        addToast(
          'warning',
          'Some data could not be loaded',
          errorMessage(failures[0], 'Please check your connection and try again.')
        );
      }
      setDataLoaded(true);
      setIsDataLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, sessionStatus, currentRole, userMobile, sessionNonce, reloadNonce]);

  const refreshData = () => setReloadNonce((n) => n + 1);

  /** After a successful mutation, refresh notifications (+ audit logs for admins). */
  const refreshSideData = () => {
    if (!isLoggedInRef.current) return;
    const gen = loadGenRef.current;
    notificationService
      .getNotifications()
      .then((n) => {
        if (gen === loadGenRef.current) setNotifications(Array.isArray(n) ? n : []);
      })
      .catch(() => undefined);
    if (currentRole === 'ADMIN') {
      auditService
        .getAuditLogs()
        .then((a) => {
          if (gen === loadGenRef.current) setAuditLogs(Array.isArray(a) ? a : []);
        })
        .catch(() => undefined);
    }
  };

  const reportFailure = (title: string, err: unknown, fallback = 'The server rejected this change.') => {
    console.error(title, err);
    if (isSessionExpiredError(err)) return; // handled globally
    addToast('error', title, errorMessage(err, fallback));
  };

  /**
   * Runs a server mutation for one request. State only changes once the server
   * accepted it (no optimistic success); failures are toasted.
   */
  const mutateRequest = async (
    requestId: string,
    call: () => Promise<ServiceRequest>,
    opts: { success?: ToastSpec; errorTitle: string; onSuccess?: (updated: ServiceRequest) => void }
  ): Promise<boolean> => {
    try {
      const updated = await call();
      if (updated && updated.id) {
        setRequests((prev) => prev.map((r) => (r.id === requestId ? updated : r)));
      }
      if (opts.success) addToast(...opts.success);
      opts.onSuccess?.(updated);
      refreshSideData();
      return true;
    } catch (err) {
      reportFailure(opts.errorTitle, err);
      return false;
    }
  };

  // -------------------------------------------------------------------------
  // Navigation helpers
  // -------------------------------------------------------------------------
  const openLoginWithRole = (role: UserRole) => {
    setLoginRoleTab(role);
    setActiveView('login');
  };

  const openAuthModal = (role: UserRole = 'CUSTOMER') => {
    setAuthModalRole(role);
    setAuthModalOpen(true);
  };

  const openWizardWithService = (type: ServiceType, prefill?: Partial<WizardPrefill>) => {
    setWizardServiceType(type);
    if (prefill) {
      setWizardPrefill({ serviceType: type, ...prefill });
    } else {
      setWizardPrefill({ serviceType: type });
    }

    if (!isLoggedIn || currentRole !== 'CUSTOMER') {
      setPendingWizardLaunch(true);
      openAuthModal('CUSTOMER');
      return;
    }

    setActiveView('customer_portal');
    setCustomerSubView('wizard');
  };

  // -------------------------------------------------------------------------
  // Customer profile & addresses (kept on this device, per user)
  // -------------------------------------------------------------------------
  const updateAddresses = (updater: (prev: Address[]) => Address[]) => {
    setSavedAddresses((prev) => {
      const next = updater(prev);
      persistSavedAddresses(userMobile, next);
      return next;
    });
  };

  const addNewAddress = (addrData: Omit<Address, 'id'>): Address => {
    const newAddress: Address = {
      ...addrData,
      id: `ADDR-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    };
    updateAddresses((prev) => {
      const list = newAddress.isDefault ? prev.map((a) => ({ ...a, isDefault: false })) : prev;
      return [newAddress, ...list];
    });
    addToast('success', 'Address Saved', `${newAddress.label} address saved.`);
    return newAddress;
  };

  const deleteAddress = (id: string) => {
    updateAddresses((prev) => prev.filter((a) => a.id !== id));
    addToast('info', 'Address Removed', 'The address was removed from your profile.');
  };

  const setDefaultAddress = (id: string) => {
    updateAddresses((prev) =>
      prev.map((a) => ({
        ...a,
        isDefault: a.id === id,
      }))
    );
    addToast('success', 'Default Address Updated', 'Default pickup location updated.');
  };

  const updateUserProfile = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setUserName(trimmed);
    authService.updateStoredSession({ name: trimmed });
    addToast('success', 'Profile Updated', 'Your contact details have been updated.');
  };

  const calculateDistanceCharge = (distanceKm: number) => {
    const freeRadius = distanceConfig.freeRadiusKm;
    if (distanceKm <= freeRadius) {
      return { charge: 0, isFree: true, chargeableKm: 0 };
    }
    const chargeableKm = Math.max(0, +(distanceKm - freeRadius).toFixed(1));

    if (distanceConfig.pricingMethod === 'SLAB') {
      const matchedSlab = distanceConfig.slabs.find(
        (s) => distanceKm >= s.minKm && distanceKm <= s.maxKm
      );
      const charge = matchedSlab ? matchedSlab.price : Math.round(chargeableKm * distanceConfig.perKmRateBeyondFree);
      return { charge, isFree: false, chargeableKm };
    } else {
      // Per KM calculation
      const charge = Math.round(chargeableKm * distanceConfig.perKmRateBeyondFree);
      return { charge, isFree: false, chargeableKm };
    }
  };

  // -------------------------------------------------------------------------
  // Service request workflows
  // -------------------------------------------------------------------------
  const addRequest = async (newReq: Partial<ServiceRequest>): Promise<ServiceRequest> => {
    if (!newReq.pickupAddress) {
      const err = new Error('Please choose a pickup address.');
      addToast('error', 'Booking Failed', err.message);
      throw err;
    }
    const serviceType: ServiceType = newReq.serviceType || 'GETTING';
    const isGetting = serviceType === 'GETTING';
    const payload: CreateRequestPayload = {
      serviceType,
      customerName: newReq.customerName || userName,
      // Customers: the server always uses the logged-in number. Staff: must be a valid mobile.
      customerMobile:
        currentRole === 'CUSTOMER' ? userMobile || newReq.customerMobile || '' : newReq.customerMobile || userMobile,
      batBrand: (newReq.batBrand || '').trim(),
      batModel: (newReq.batModel || '').trim(),
      batType: newReq.batType,
      batPhotos: newReq.batPhotos || [],
      gettingType: isGetting ? newReq.gettingType : undefined,
      stringPreference: isGetting ? newReq.stringPreference : undefined,
      stringType: isGetting ? newReq.stringType : undefined,
      stringTensionLbs: isGetting ? newReq.stringTensionLbs : undefined,
      gettingPrice: isGetting ? newReq.gettingPrice : undefined,
      colour: isGetting ? newReq.colour : undefined,
      repairIssue: !isGetting ? newReq.repairIssue : undefined,
      repairDescription: !isGetting ? newReq.repairDescription : undefined,
      pickupAddress: newReq.pickupAddress,
      distanceKm: newReq.distanceKm ?? newReq.pickupAddress.distanceKm ?? 0,
      serviceCharge: newReq.serviceCharge,
      additionalNotes: newReq.additionalNotes || undefined,
      pickupDate: newReq.pickupDate || undefined,
    };

    try {
      const saved = await requestService.createRequest(payload);
      setRequests((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
      refreshSideData();
      // Staff bookings (phone / walk-in) show their own confirmation in the admin console.
      if (currentRole === 'CUSTOMER') {
        addToast('success', 'Request Created!', `Your request ${saved.id} has been placed.`);
        try {
          confetti({ particleCount: 75, spread: 60, origin: { y: 0.7 } });
        } catch {
          // ignore
        }
      }
      return saved;
    } catch (err) {
      reportFailure('Booking Failed', err, 'Your request could not be submitted. Please try again.');
      throw err;
    }
  };

  const updateRequestStatus = (id: string, status: RequestStatus, actor: string, notes?: string) =>
    mutateRequest(id, () => requestService.updateStatus(id, status, actor, notes), {
      errorTitle: 'Status Update Failed',
      success: ['info', 'Status Updated', `${id} is now ${status}`],
    });

  const assignEmployee = (requestId: string, employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    return mutateRequest(requestId, () => requestService.assignTechnician(requestId, employeeId), {
      errorTitle: 'Assignment Failed',
      success: ['success', 'Employee Assigned', `${employee?.name || 'Employee'} assigned to ${requestId}`],
    });
  };

  const recordPickupCondition = (
    requestId: string,
    condition: BatConditionAtPickup,
    notes: string,
    photos: string[]
  ) =>
    mutateRequest(requestId, () => requestService.recordPickupCondition(requestId, condition, notes, photos), {
      errorTitle: 'Pickup Not Recorded',
      success: ['success', 'Pickup Recorded', `Bat for ${requestId} collected and logged.`],
    });

  const createRepairEstimate = (requestId: string, estimate: RepairEstimate) =>
    mutateRequest(requestId, () => requestService.createRepairEstimate(requestId, estimate), {
      errorTitle: 'Estimate Not Saved',
      success: ['info', 'Estimate Created', `Estimate ₹${estimate.totalEstimate} sent to customer for approval.`],
    });

  const approveRepairEstimate = (requestId: string) => {
    setRepairEstimateModalOpen(false);
    setRevisedEstimateModalOpen(false);
    return mutateRequest(requestId, () => requestService.approveRepairEstimate(requestId), {
      errorTitle: 'Approval Failed',
      success: ['success', 'Estimate Approved!', `Repair authorized for ${requestId}. Technicians will now begin.`],
    });
  };

  const declineRepairEstimate = (requestId: string) => {
    setRepairEstimateModalOpen(false);
    setRevisedEstimateModalOpen(false);
    return mutateRequest(requestId, () => requestService.declineRepairEstimate(requestId), {
      errorTitle: 'Decline Failed',
      success: ['warning', 'Estimate Declined', `${requestId} marked as declined. Unrepaired bat will be returned.`],
    });
  };

  const requestPriceRevision = (requestId: string, additionalAmount: number, newTotal: number, reason: string) =>
    mutateRequest(
      requestId,
      () => requestService.requestPriceRevision(requestId, additionalAmount, newTotal, reason),
      {
        errorTitle: 'Revision Not Sent',
        success: [
          'warning',
          'Revised Estimate Sent',
          `Customer must approve revised price ₹${newTotal} before repair continues.`,
        ],
      }
    );

  const startDelivery = (requestId: string) =>
    mutateRequest(
      requestId,
      () =>
        requestService.updateStatus(
          requestId,
          'Out for Delivery',
          userName || 'Logistics Agent',
          'Dispatched for doorstep delivery.'
        ),
      {
        errorTitle: 'Dispatch Failed',
        success: ['info', 'Out for Delivery', `${requestId} is out for doorstep delivery.`],
      }
    );

  const recordManualPayment = (
    requestId: string,
    amount: number,
    method: PaymentMethod,
    notes?: string,
    collectedBy?: string
  ) =>
    mutateRequest(requestId, () => requestService.recordPayment(requestId, amount, method, notes, collectedBy), {
      errorTitle: 'Payment Not Recorded',
      success: [
        'success',
        'Payment Recorded!',
        `₹${amount.toLocaleString('en-IN')} collected via ${method}. Request ${requestId} completed.`,
      ],
      onSuccess: () => {
        try {
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
        } catch {
          // ignore
        }
      },
    });

  const submitReview = (requestId: string, review: Review) =>
    mutateRequest(requestId, () => requestService.submitReview(requestId, review), {
      errorTitle: 'Review Not Submitted',
      success: ['success', 'Review Submitted!', `Thank you for your ${review.rating}-star feedback.`],
    });

  // -------------------------------------------------------------------------
  // Admin configuration (server first; local state follows the server result)
  // -------------------------------------------------------------------------
  const updateDistanceConfig = async (newConfig: DistancePricingConfig): Promise<boolean> => {
    let updatedSlabs = newConfig.slabs;
    if (updatedSlabs && updatedSlabs.length > 0) {
      updatedSlabs = updatedSlabs.map((s, idx) => {
        if (idx === 0) {
          return { ...s, minKm: 0, maxKm: newConfig.freeRadiusKm, price: 0 };
        }
        if (idx === 1) {
          return { ...s, minKm: +(newConfig.freeRadiusKm + 0.1).toFixed(1) };
        }
        return s;
      });
    }
    const finalizedConfig: DistancePricingConfig = { ...newConfig, slabs: updatedSlabs };

    try {
      const saved = await pricingService.updateDistanceConfig(finalizedConfig);
      const next = saved && typeof saved === 'object' && 'freeRadiusKm' in saved ? saved : finalizedConfig;
      setDistanceConfig(next);
      writeCache(DIST_CONFIG_KEY, next);
      refreshSideData();
      addToast(
        'success',
        'Logistics Pricing Updated',
        `Free delivery radius set to ${next.freeRadiusKm} KM. Pickups beyond ${next.freeRadiusKm} KM will be charged ₹${next.perKmRateBeyondFree}/KM.`
      );
      return true;
    } catch (err) {
      reportFailure('Pricing Not Saved', err);
      return false;
    }
  };

  const updateGettingService = async (id: string, updated: Partial<GettingServiceTier>): Promise<boolean> => {
    try {
      const saved = await pricingService.updateGettingService(id, updated);
      setGettingServices((prev) => {
        const next = prev.map((item) => (item.id === id ? { ...item, ...updated, ...(saved || {}) } : item));
        writeCache(GETTING_SERVICES_KEY, next);
        return next;
      });
      refreshSideData();
      addToast('success', 'Service Price Updated', `Getting package ${id} updated.`);
      return true;
    } catch (err) {
      reportFailure('Package Not Saved', err);
      return false;
    }
  };

  const updateRepairCategory = async (id: string, updated: Partial<RepairCategoryTier>): Promise<boolean> => {
    try {
      const saved = await pricingService.updateRepairCategory(id, updated);
      setRepairCategories((prev) => {
        const next = prev.map((item) => (item.id === id ? { ...item, ...updated, ...(saved || {}) } : item));
        writeCache(REPAIR_CATEGORIES_KEY, next);
        return next;
      });
      refreshSideData();
      addToast('success', 'Service Price Updated', `Repair category ${id} base price/SLA updated.`);
      return true;
    } catch (err) {
      reportFailure('Category Not Saved', err);
      return false;
    }
  };

  const addGettingService = async (newTier: Omit<GettingServiceTier, 'id'>): Promise<boolean> => {
    try {
      const created = await pricingService.addGettingService(newTier);
      setGettingServices((prev) => {
        const next = [...prev.filter((t) => t.id !== created.id), created];
        writeCache(GETTING_SERVICES_KEY, next);
        return next;
      });
      refreshSideData();
      addToast('success', 'Package Added', `${created.name} added at ₹${created.price}.`);
      return true;
    } catch (err) {
      reportFailure('Package Not Added', err);
      return false;
    }
  };

  const addRepairCategory = async (newCategory: Omit<RepairCategoryTier, 'id'>): Promise<boolean> => {
    try {
      const created = await pricingService.addRepairCategory(newCategory);
      setRepairCategories((prev) => {
        const next = [...prev.filter((c) => c.id !== created.id), created];
        writeCache(REPAIR_CATEGORIES_KEY, next);
        return next;
      });
      refreshSideData();
      addToast('success', 'Category Added', `${created.name} added with base ₹${created.basePrice}.`);
      return true;
    } catch (err) {
      reportFailure('Category Not Added', err);
      return false;
    }
  };

  const resetPricingToDefaults = async (): Promise<boolean> => {
    const tasks: Promise<unknown>[] = [pricingService.updateDistanceConfig(initialDistanceConfig)];
    gettingTypesData.forEach((tier) => {
      if (gettingServices.some((t) => t.id === tier.id)) {
        tasks.push(pricingService.updateGettingService(tier.id, tier));
      }
    });
    repairCategoriesData.forEach((cat) => {
      if (repairCategories.some((c) => c.id === cat.id)) {
        tasks.push(pricingService.updateRepairCategory(cat.id, cat));
      }
    });
    const results = await Promise.allSettled(tasks);
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    // Re-sync with what the server actually holds now.
    const [dist, getting, repair] = await Promise.allSettled([
      pricingService.getDistanceConfig(),
      pricingService.getGettingServices(),
      pricingService.getRepairCategories(),
    ]);
    if (dist.status === 'fulfilled' && dist.value) {
      setDistanceConfig(dist.value);
      writeCache(DIST_CONFIG_KEY, dist.value);
    }
    if (getting.status === 'fulfilled' && Array.isArray(getting.value)) {
      setGettingServices(getting.value);
      writeCache(GETTING_SERVICES_KEY, getting.value);
    }
    if (repair.status === 'fulfilled' && Array.isArray(repair.value)) {
      setRepairCategories(repair.value);
      writeCache(REPAIR_CATEGORIES_KEY, repair.value);
    }
    refreshSideData();

    if (failed.length > 0) {
      reportFailure('Pricing Reset Incomplete', failed[0].reason);
      return false;
    }
    addToast('info', 'Pricing Reset', 'Distance rules and service pricing restored to defaults.');
    return true;
  };

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => {
    const now = new Date();
    const timestamp =
      now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
      ', ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newNotif: AppNotification = {
      ...notif,
      id: 'NOTIF-' + Date.now().toString().slice(-6),
      timestamp,
      isRead: false,
    };
    setNotifications((prev) => [newNotif, ...prev.slice(0, 49)]);
  };

  const markNotificationRead = (id: string) => {
    const previous = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    notificationService.markAsRead(id).catch((err) => {
      console.warn('Failed to mark notification as read', err);
      if (previous) setNotifications((prev) => prev.map((n) => (n.id === id ? previous : n)));
    });
  };

  const markAllNotificationsRead = () => {
    const snapshot = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    notificationService.markAllRead().catch((err) => {
      console.warn('Failed to mark notifications as read', err);
      setNotifications(snapshot);
    });
  };

  // -------------------------------------------------------------------------
  // Employees (admin)
  // -------------------------------------------------------------------------
  const addEmployee = async (empData: Omit<Employee, 'id' | 'activeJobsCount' | 'avatar'>): Promise<boolean> => {
    const kind = empData.userRole === 'ADMIN' ? 'Admin' : 'Employee';
    // A blank password lets the server generate a temporary one.
    const payload = { ...empData };
    if (!payload.password || !payload.password.trim()) delete payload.password;
    try {
      const created = (await employeeService.createEmployee(payload)) as Employee & {
        temporaryPassword?: string | null;
      };
      const { temporaryPassword, ...savedEmp } = created;
      setEmployees((prev) => [...prev.filter((e) => e.id !== savedEmp.id), savedEmp as Employee]);
      refreshSideData();
      const who = savedEmp.name || empData.name;
      const loginMobile = formatMobile(savedEmp.phone || empData.phone);
      addToast(
        'success',
        `${kind} Created`,
        `${who} signs in with mobile ${loginMobile} and a password. Credentials are not sent automatically — hand them over in person.`
      );
      if (temporaryPassword) {
        // Shown once — the server never returns it again.
        addToast(
          'warning',
          `Temporary password for ${who}`,
          `${temporaryPassword} — give it to ${who} in person (login: ${formatMobile(savedEmp.phone || empData.phone)}). It won't be shown again — note it down before closing this message.`,
          { durationMs: 0 }
        );
      }
      return true;
    } catch (err) {
      reportFailure(`${kind} Not Created`, err);
      return false;
    }
  };

  const removeEmployee = async (id: string): Promise<boolean> => {
    try {
      await employeeService.deleteEmployee(id);
      setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, isActive: false } : e)));
      refreshSideData();
      addToast('info', 'Employee Deactivated', 'Employee account has been deactivated.');
      return true;
    } catch (err) {
      reportFailure('Deactivation Failed', err);
      return false;
    }
  };

  const openRequestDetail = (id: string) => {
    setSelectedRequestId(id);
    if (currentRole === 'CUSTOMER') {
      setActiveView('customer_portal');
      setCustomerSubView('detail');
    } else if (currentRole === 'EMPLOYEE') {
      setActiveView('employee_portal');
    } else {
      setActiveView('admin_portal');
      setAdminSubView('requests');
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        activeView,
        setActiveView,
        customerSubView,
        setCustomerSubView,
        employeeSubView,
        setEmployeeSubView,
        adminSubView,
        setAdminSubView,
        selectedRequestId,
        setSelectedRequestId,

        authModalOpen,
        setAuthModalOpen,
        authModalRole,
        setAuthModalRole,
        openAuthModal,
        qrModalOpen,
        setQrModalOpen,
        repairEstimateModalOpen,
        setRepairEstimateModalOpen,
        revisedEstimateModalOpen,
        setRevisedEstimateModalOpen,
        modalTargetRequestId,
        setModalTargetRequestId,

        isLoggedIn,
        isAuthChecking: sessionStatus === 'validating',
        userName,
        userMobile,
        userTitle,
        completeLogin,
        logout,
        loginRoleTab,
        setLoginRoleTab,
        openLoginWithRole,
        wizardServiceType,
        setWizardServiceType,
        pendingWizardLaunch,
        setPendingWizardLaunch,
        wizardPrefill,
        setWizardPrefill,
        openWizardWithService,
        addNewAddress,
        deleteAddress,
        setDefaultAddress,
        updateUserProfile,

        requests,
        isDataLoading,
        dataLoaded,
        requestsLoadFailed,
        refreshData,
        distanceConfig,
        savedAddresses,
        auditLogs,
        toasts,
        addToast,
        removeToast,

        addRequest,
        updateRequestStatus,
        assignEmployee,
        recordPickupCondition,
        createRepairEstimate,
        approveRepairEstimate,
        declineRepairEstimate,
        requestPriceRevision,
        startDelivery,
        recordManualPayment,

        updateDistanceConfig,
        calculateDistanceCharge,
        gettingServices,
        repairCategories,
        updateGettingService,
        updateRepairCategory,
        addGettingService,
        addRepairCategory,
        resetPricingToDefaults,
        openRequestDetail,

        notifications,
        addNotification,
        markNotificationRead,
        markAllNotificationsRead,
        unreadCount,

        employees,
        addEmployee,
        removeEmployee,

        submitReview,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
