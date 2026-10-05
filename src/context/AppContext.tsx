import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserRole,
  ServiceType,
  ServiceRequest,
  DistancePricingConfig,
  AuditLogItem,
  EmailTemplate,
  Address,
  RequestStatus,
  RepairEstimate,
  PaymentMethod,
  BatConditionAtPickup,
  GettingServiceTier,
  RepairCategoryTier,
} from '../types';
import {
  initialRequests,
  initialDistanceConfig,
  initialAuditLogs,
  initialEmailTemplates,
  defaultSavedAddresses,
  mockEmployees,
  gettingTypesData,
  repairCategoriesData,
} from '../data/mockData';
import { authService } from '../services/authService';
import confetti from 'canvas-confetti';

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
}

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
  deviceViewport: 'responsive' | 'desktop' | 'tablet' | 'mobile';
  setDeviceViewport: (vp: 'responsive' | 'desktop' | 'tablet' | 'mobile') => void;

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
  userEmail: string;
  userName: string;
  userMobile: string;
  userTitle?: string;
  loginWithEmailOtp: (email: string, name?: string, mobile?: string) => void;
  loginAsRole: (role: UserRole, email?: string, name?: string, mobile?: string, title?: string) => void;
  logout: () => void;
  loginRoleTab: UserRole;
  setLoginRoleTab: (role: UserRole) => void;
  openLoginWithRole: (role: UserRole) => void;
  wizardServiceType: ServiceType;
  setWizardServiceType: (type: ServiceType) => void;
  openWizardWithService: (type: ServiceType) => void;
  addNewAddress: (address: Omit<Address, 'id'>) => void;
  deleteAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  updateUserProfile: (name: string, mobile: string) => void;

  // Requests Data & Actions
  requests: ServiceRequest[];
  distanceConfig: DistancePricingConfig;
  savedAddresses: Address[];
  auditLogs: AuditLogItem[];
  emailTemplates: EmailTemplate[];
  toasts: ToastMessage[];
  addToast: (type: 'success' | 'info' | 'warning' | 'error', title: string, message: string) => void;
  removeToast: (id: string) => void;

  // Service Business Workflows
  addRequest: (newReq: Partial<ServiceRequest>) => string;
  updateRequestStatus: (id: string, status: RequestStatus, actor: string, notes?: string) => void;
  assignEmployee: (requestId: string, employeeId: string) => void;
  recordPickupCondition: (
    requestId: string,
    condition: BatConditionAtPickup,
    notes: string,
    photos: string[]
  ) => void;
  createRepairEstimate: (requestId: string, estimate: RepairEstimate) => void;
  approveRepairEstimate: (requestId: string) => void;
  declineRepairEstimate: (requestId: string) => void;
  requestPriceRevision: (
    requestId: string,
    additionalAmount: number,
    newTotal: number,
    reason: string
  ) => void;
  completeGettingJob: (requestId: string, notes?: string) => void;
  completeRepairJob: (requestId: string, notes?: string) => void;
  startDelivery: (requestId: string) => void;
  recordManualPayment: (
    requestId: string,
    amount: number,
    method: PaymentMethod,
    notes?: string
  ) => void;

  // Configuration Actions
  updateDistanceConfig: (config: DistancePricingConfig) => void;
  updateEmailTemplate: (id: string, subject: string, body: string) => void;
  calculateDistanceCharge: (distanceKm: number) => { charge: number; isFree: boolean; chargeableKm: number };

  // Service Pricing Configuration
  gettingServices: GettingServiceTier[];
  repairCategories: RepairCategoryTier[];
  updateGettingService: (id: string, updated: Partial<GettingServiceTier>) => void;
  updateRepairCategory: (id: string, updated: Partial<RepairCategoryTier>) => void;
  addGettingService: (newTier: Omit<GettingServiceTier, 'id'>) => void;
  addRepairCategory: (newCategory: Omit<RepairCategoryTier, 'id'>) => void;
  resetPricingToDefaults: () => void;

  // Helper for opening request detail directly
  openRequestDetail: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Stored Session helper for reload resilience
  const storedSession = authService.getStoredSession();

  // Navigation & Role
  const [currentRole, setCurrentRole] = useState<UserRole>(storedSession?.role || 'CUSTOMER');
  const [activeView, setActiveView] = useState<string>(storedSession?.activeView || 'landing');
  const [customerSubView, setCustomerSubView] = useState<string>(storedSession?.customerSubView || 'dashboard');
  const [employeeSubView, setEmployeeSubView] = useState<string>(storedSession?.employeeSubView || 'dashboard');
  const [adminSubView, setAdminSubView] = useState<string>(storedSession?.adminSubView || 'dashboard');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>('REP-00025');
  const [deviceViewport, setDeviceViewport] = useState<'responsive' | 'desktop' | 'tablet' | 'mobile'>('responsive');

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalRole, setAuthModalRole] = useState<UserRole>('CUSTOMER');
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const [repairEstimateModalOpen, setRepairEstimateModalOpen] = useState<boolean>(false);
  const [revisedEstimateModalOpen, setRevisedEstimateModalOpen] = useState<boolean>(false);
  const [modalTargetRequestId, setModalTargetRequestId] = useState<string | null>(null);

  // Authentication
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(storedSession ? storedSession.isLoggedIn : false);
  const [userEmail, setUserEmail] = useState<string>(storedSession?.email || '');
  const [userName, setUserName] = useState<string>(storedSession?.name || '');
  const [userMobile, setUserMobile] = useState<string>(storedSession?.mobile || '');
  const [userTitle, setUserTitle] = useState<string>(storedSession?.title || '');
  const [loginRoleTab, setLoginRoleTab] = useState<UserRole>('CUSTOMER');
  const [wizardServiceType, setWizardServiceType] = useState<ServiceType>('GETTING');

  // Core Data
  const [requests, setRequests] = useState<ServiceRequest[]>(() => {
    const saved = localStorage.getItem('shuttlecraft_requests');
    return saved ? JSON.parse(saved) : initialRequests;
  });

  const [distanceConfig, setDistanceConfig] = useState<DistancePricingConfig>(() => {
    const saved = localStorage.getItem('shuttlecraft_dist_config');
    return saved ? JSON.parse(saved) : initialDistanceConfig;
  });

  const [gettingServices, setGettingServices] = useState<GettingServiceTier[]>(() => {
    try {
      const saved = localStorage.getItem('shuttlecraft_getting_services');
      return saved ? JSON.parse(saved) : gettingTypesData;
    } catch {
      return gettingTypesData;
    }
  });

  const [repairCategories, setRepairCategories] = useState<RepairCategoryTier[]>(() => {
    try {
      const saved = localStorage.getItem('shuttlecraft_repair_categories');
      return saved ? JSON.parse(saved) : repairCategoriesData;
    } catch {
      return repairCategoriesData;
    }
  });

  const [savedAddresses, setSavedAddresses] = useState<Address[]>(defaultSavedAddresses);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(initialAuditLogs);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(initialEmailTemplates);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Persist requests to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('shuttlecraft_requests', JSON.stringify(requests));
    } catch (e) {
      console.error(e);
    }
  }, [requests]);

  const addToast = (type: 'success' | 'info' | 'warning' | 'error', title: string, message: string) => {
    const newToast: ToastMessage = {
      id: 'toast-' + Date.now() + Math.random().toString(36).substring(2, 6),
      type,
      title,
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setToasts((prev) => [newToast, ...prev.slice(0, 4)]);
    setTimeout(() => {
      removeToast(newToast.id);
    }, 5500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const logAudit = (user: string, role: UserRole, action: string, requestId: string, details?: string) => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newLog: AuditLogItem = {
      id: 'LOG-' + Date.now().toString().slice(-4),
      timestamp: formattedDate,
      user,
      role,
      action,
      requestId,
      details,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const loginAsRole = (
    role: UserRole,
    email?: string,
    name?: string,
    mobile?: string,
    title?: string
  ) => {
    setIsLoggedIn(true);
    setCurrentRole(role);
    setAuthModalOpen(false);

    if (role === 'CUSTOMER') {
      const finalEmail = email || 'customer@grsports.com';
      const finalName = name || 'Vikram Malhotra';
      const finalMobile = mobile || '+91 99887 76655';
      const finalTitle = title || 'Tournament Player';
      setUserEmail(finalEmail);
      setUserName(finalName);
      setUserMobile(finalMobile);
      setUserTitle(finalTitle);
      setActiveView('customer_portal');
      setCustomerSubView('dashboard');
      authService.setStoredSession({
        isLoggedIn: true,
        role: 'CUSTOMER',
        email: finalEmail,
        name: finalName,
        mobile: finalMobile,
        title: finalTitle,
        activeView: 'customer_portal',
        customerSubView: 'dashboard',
      });
      addToast('success', 'Customer Access Granted', `Welcome back, ${finalName}!`);
      logAudit(finalName, 'CUSTOMER', 'Customer Login', 'AUTH', `Email: ${finalEmail}`);
    } else if (role === 'EMPLOYEE') {
      const finalEmail = email || 'employee@grsports.com';
      const finalName = name || 'Rahul Sharma';
      const finalMobile = mobile || '+91 98765 43210';
      const finalTitle = title || 'Field Operations & Workshop Technician';
      setUserEmail(finalEmail);
      setUserName(finalName);
      setUserMobile(finalMobile);
      setUserTitle(finalTitle);
      setActiveView('employee_portal');
      setEmployeeSubView('dashboard');
      authService.setStoredSession({
        isLoggedIn: true,
        role: 'EMPLOYEE',
        email: finalEmail,
        name: finalName,
        mobile: finalMobile,
        title: finalTitle,
        activeView: 'employee_portal',
        employeeSubView: 'dashboard',
      });
      addToast('success', 'Operations Portal Access Granted', `Authenticated as ${finalName} (Operations & Workshop)`);
      logAudit(finalName, 'EMPLOYEE', 'Employee Login', 'AUTH', `Email: ${finalEmail}`);
    } else if (role === 'ADMIN') {
      const finalEmail = email || 'admin@grsports.com';
      const finalName = name || 'Priya Anand';
      const finalMobile = mobile || '+91 98451 11223';
      const finalTitle = title || 'Head of Platform Operations';
      setUserEmail(finalEmail);
      setUserName(finalName);
      setUserMobile(finalMobile);
      setUserTitle(finalTitle);
      setActiveView('admin_portal');
      setAdminSubView('dashboard');
      authService.setStoredSession({
        isLoggedIn: true,
        role: 'ADMIN',
        email: finalEmail,
        name: finalName,
        mobile: finalMobile,
        title: finalTitle,
        activeView: 'admin_portal',
        adminSubView: 'dashboard',
      });
      addToast('success', 'Admin Console Access Granted', `Authenticated as ${finalName} (Master Administrator)`);
      logAudit(finalName, 'ADMIN', 'Admin Login', 'AUTH', `Email: ${finalEmail}`);
    }
  };

  const loginWithEmailOtp = (email: string, name?: string, mobile?: string) => {
    loginAsRole('CUSTOMER', email, name || 'Vikram Malhotra', mobile || '+91 99887 76655');
  };

  const logout = () => {
    authService.clearStoredSession();
    setIsLoggedIn(false);
    setActiveView('landing');
    setCurrentRole('CUSTOMER');
    setUserEmail('');
    setUserName('');
    setUserMobile('');
    setUserTitle('');
    addToast('info', 'Logged Out', 'You have been safely signed out. Returning to home page.');
  };

  const openLoginWithRole = (role: UserRole) => {
    setLoginRoleTab(role);
    setActiveView('login');
  };

  const openAuthModal = (role: UserRole = 'CUSTOMER') => {
    setAuthModalRole(role);
    setAuthModalOpen(true);
  };

  const openWizardWithService = (type: ServiceType) => {
    setWizardServiceType(type);
    if (!isLoggedIn) {
      loginAsRole('CUSTOMER', 'customer@grsports.com', 'Vikram Malhotra', '+91 99887 76655', 'Tournament Player');
    }
    setActiveView('customer_portal');
    setCustomerSubView('wizard');
  };

  const addNewAddress = (addrData: Omit<Address, 'id'>) => {
    const newAddress: Address = {
      ...addrData,
      id: `ADDR-${Date.now().toString().slice(-4)}`,
    };
    setSavedAddresses((prev) => [newAddress, ...prev]);
    addToast('success', 'Address Saved', `${newAddress.label} address successfully registered.`);
    logAudit(userName || 'Player', 'CUSTOMER', 'Added new pickup address', newAddress.id, `${newAddress.houseFlat}, ${newAddress.area}`);
  };

  const deleteAddress = (id: string) => {
    setSavedAddresses((prev) => prev.filter((a) => a.id !== id));
    addToast('info', 'Address Removed', 'The address was removed from your profile.');
  };

  const setDefaultAddress = (id: string) => {
    setSavedAddresses((prev) =>
      prev.map((a) => ({
        ...a,
        isDefault: a.id === id,
      }))
    );
    addToast('success', 'Default Address Updated', 'Default pickup location updated.');
  };

  const updateUserProfile = (name: string, mobile: string) => {
    setUserName(name);
    setUserMobile(mobile);
    addToast('success', 'Profile Updated', 'Player contact details have been successfully saved.');
    logAudit(name, 'CUSTOMER', 'Updated player profile', 'PROFILE', `Mobile: ${mobile}`);
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

  const addRequest = (newReq: Partial<ServiceRequest>): string => {
    const isGetting = newReq.serviceType === 'GETTING';
    const prefix = isGetting ? 'GET' : 'REP';
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newId = `${prefix}-${randomNum}`;

    const distInfo = calculateDistanceCharge(newReq.distanceKm || 12);

    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const createdRequest: ServiceRequest = {
      id: newId,
      serviceType: newReq.serviceType || 'GETTING',
      customerName: newReq.customerName || userName,
      customerEmail: newReq.customerEmail || userEmail,
      customerMobile: newReq.customerMobile || userMobile,
      createdAt: now.toISOString(),
      status: 'Submitted',
      batBrand: newReq.batBrand || 'Yonex',
      batModel: newReq.batModel || 'Astrox 99',
      batType: newReq.batType || 'Head Heavy (Power / Smash)',
      batPhotos: newReq.batPhotos && newReq.batPhotos.length > 0
        ? newReq.batPhotos
        : ['https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=600&q=80'],
      gettingType: newReq.gettingType,
      stringType: newReq.stringType,
      stringTensionLbs: newReq.stringTensionLbs,
      gettingPrice: newReq.gettingPrice || 0,
      repairIssue: newReq.repairIssue,
      repairDescription: newReq.repairDescription,
      pickupAddress: newReq.pickupAddress || defaultSavedAddresses[0],
      distanceKm: newReq.distanceKm || 12,
      pickupDeliveryCharge: distInfo.charge,
      isFreeDelivery: distInfo.isFree,
      serviceCharge: newReq.serviceCharge || (isGetting ? newReq.gettingPrice || 450 : 0),
      discount: 0,
      totalAmount: (newReq.serviceCharge || (isGetting ? newReq.gettingPrice || 450 : 0)) + distInfo.charge,
      paymentStatus: 'Pending',
      timeline: [
        {
          status: 'Submitted',
          label: 'Request Submitted Online',
          timestamp: formattedTimestamp,
          actor: 'Customer (' + (newReq.customerName || userName) + ')',
          notes: 'Customer notified via Email. Awaiting Admin Review.',
        },
      ],
      additionalNotes: newReq.additionalNotes,
    };

    setRequests((prev) => [createdRequest, ...prev]);
    logAudit(userName, 'CUSTOMER', `Created ${createdRequest.serviceType} request`, newId, `${createdRequest.batBrand} ${createdRequest.batModel}`);
    addToast('success', 'Request Created!', `Your request ${newId} has been successfully placed.`);

    try {
      confetti({ particleCount: 75, spread: 60, origin: { y: 0.7 } });
    } catch (e) {
      // ignore
    }

    return newId;
  };

  const updateRequestStatus = (id: string, status: RequestStatus, actor: string, notes?: string) => {
    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id !== id) return req;
        const updatedTimeline = [
          ...req.timeline,
          {
            status,
            label: `Status updated to ${status}`,
            timestamp: formattedTimestamp,
            actor,
            notes,
          },
        ];
        return {
          ...req,
          status,
          timeline: updatedTimeline,
        };
      })
    );

    logAudit(actor, currentRole, `Updated status to ${status}`, id, notes);
    addToast('info', 'Status Updated', `${id} is now ${status}`);
  };

  const assignEmployee = (requestId: string, employeeId: string) => {
    const employee = mockEmployees.find((e) => e.id === employeeId);
    if (!employee) return;

    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        return {
          ...req,
          status: 'Employee Assigned',
          assignedEmployeeId: employee.id,
          assignedEmployeeName: employee.name,
          timeline: [
            ...req.timeline,
            {
              status: 'Employee Assigned',
              label: `Assigned to ${employee.name} (${employee.role})`,
              timestamp: formattedTimestamp,
              actor: 'Admin',
              notes: 'Notification sent to employee mobile portal.',
            },
          ],
        };
      })
    );

    logAudit('Admin', 'ADMIN', `Assigned ${employee.name}`, requestId);
    addToast('success', 'Employee Assigned', `${employee.name} assigned to ${requestId}`);
  };

  const recordPickupCondition = (
    requestId: string,
    condition: BatConditionAtPickup,
    notes: string,
    photos: string[]
  ) => {
    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        return {
          ...req,
          status: 'Bat Picked Up',
          pickupDate: now.toISOString(),
          pickupCondition: {
            condition,
            notes,
            photos,
            collectedAt: now.toISOString(),
            collectedBy: req.assignedEmployeeName || 'Amit Verma',
          },
          timeline: [
            ...req.timeline,
            {
              status: 'Bat Picked Up',
              label: `Bat Collected at Doorstep (Condition: ${condition})`,
              timestamp: formattedTimestamp,
              actor: req.assignedEmployeeName || 'Field Agent',
              notes: notes || 'Verified with customer signature / confirmation.',
            },
          ],
        };
      })
    );

    logAudit(currentRole === 'EMPLOYEE' ? 'Field Agent' : 'Staff', 'EMPLOYEE', `Recorded pickup condition: ${condition}`, requestId, notes);
    addToast('success', 'Pickup Recorded', `Bat for ${requestId} collected and logged.`);
  };

  const createRepairEstimate = (requestId: string, estimate: RepairEstimate) => {
    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        const total = estimate.totalEstimate;
        return {
          ...req,
          status: 'Awaiting Customer Approval',
          repairEstimate: estimate,
          serviceCharge: estimate.labourCharge + estimate.materialsCharge + estimate.additionalCharges,
          totalAmount: total + req.pickupDeliveryCharge,
          timeline: [
            ...req.timeline,
            {
              status: 'Inspection',
              label: 'Workshop Technical Inspection Completed',
              timestamp: formattedTimestamp,
              actor: 'Technician',
              notes: estimate.inspectionNotes,
            },
            {
              status: 'Awaiting Customer Approval',
              label: `Repair Estimate ₹${total} Generated. Awaiting Customer Approval`,
              timestamp: formattedTimestamp,
              actor: 'Technician',
              notes: 'Customer notified via Email. Repair locked until customer approves.',
            },
          ],
        };
      })
    );

    logAudit('Technician', 'EMPLOYEE', `Created repair estimate ₹${estimate.totalEstimate}`, requestId, estimate.inspectionNotes);
    addToast('info', 'Estimate Created', `Estimate ₹${estimate.totalEstimate} sent to customer for approval.`);
  };

  const approveRepairEstimate = (requestId: string) => {
    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        const approvedAmount = req.repairEstimate?.totalEstimate || req.totalAmount;
        return {
          ...req,
          status: 'Repair Approved',
          serviceCharge: approvedAmount - req.pickupDeliveryCharge,
          totalAmount: approvedAmount,
          timeline: [
            ...req.timeline,
            {
              status: 'Repair Approved',
              label: `Customer Approved Estimate of ₹${approvedAmount}`,
              timestamp: formattedTimestamp,
              actor: 'Customer (' + req.customerName + ')',
              notes: 'Repair authorized to proceed.',
            },
          ],
        };
      })
    );

    logAudit('Customer', 'CUSTOMER', 'Approved repair estimate', requestId);
    addToast('success', 'Estimate Approved!', `Repair authorized for ${requestId}. Technicians will now begin.`);
    setRepairEstimateModalOpen(false);
    setRevisedEstimateModalOpen(false);
  };

  const declineRepairEstimate = (requestId: string) => {
    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        return {
          ...req,
          status: 'Repair Declined',
          serviceCharge: 0,
          totalAmount: req.pickupDeliveryCharge, // Only delivery charge if applicable
          timeline: [
            ...req.timeline,
            {
              status: 'Repair Declined',
              label: 'Customer Declined Repair Estimate',
              timestamp: formattedTimestamp,
              actor: 'Customer (' + req.customerName + ')',
              notes: 'Arranging return delivery of unrepaired bat.',
            },
          ],
        };
      })
    );

    logAudit('Customer', 'CUSTOMER', 'Declined repair estimate', requestId);
    addToast('warning', 'Estimate Declined', `${requestId} marked as declined. Unrepaired bat will be returned.`);
    setRepairEstimateModalOpen(false);
    setRevisedEstimateModalOpen(false);
  };

  const requestPriceRevision = (
    requestId: string,
    additionalAmount: number,
    newTotal: number,
    reason: string
  ) => {
    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        const oldEstimate = req.repairEstimate || {
          labourCharge: 300,
          materialsCharge: 100,
          additionalCharges: 0,
          pickupDeliveryCharge: req.pickupDeliveryCharge,
          discount: 0,
          totalEstimate: 400,
          expectedCompletionDate: '2026-10-05',
          inspectionNotes: 'Initial estimate',
        };

        const revised: RepairEstimate = {
          ...oldEstimate,
          additionalCharges: (oldEstimate.additionalCharges || 0) + additionalAmount,
          totalEstimate: newTotal,
          isRevised: true,
          originalEstimate: oldEstimate.totalEstimate,
          revisionReason: reason,
        };

        return {
          ...req,
          status: 'Awaiting Customer Approval',
          repairEstimate: revised,
          previousEstimate: oldEstimate,
          serviceCharge: newTotal - req.pickupDeliveryCharge,
          totalAmount: newTotal,
          timeline: [
            ...req.timeline,
            {
              status: 'Awaiting Customer Approval',
              label: `Revised Estimate ₹${newTotal} sent (Reason: ${reason})`,
              timestamp: formattedTimestamp,
              actor: 'Technician',
              notes: `Original: ₹${oldEstimate.totalEstimate} + Additional: ₹${additionalAmount} = ₹${newTotal}. Work paused until customer approval.`,
            },
          ],
        };
      })
    );

    logAudit('Technician', 'EMPLOYEE', `Requested price revision to ₹${newTotal}`, requestId, reason);
    addToast('warning', 'Revised Estimate Sent', `Customer must approve revised price ₹${newTotal} before repair continues.`);
  };

  const completeGettingJob = (requestId: string, notes?: string) => {
    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        return {
          ...req,
          status: 'Getting Completed',
          timeline: [
            ...req.timeline,
            {
              status: 'Getting Completed',
              label: 'Bat Getting / Stringing Completed',
              timestamp: formattedTimestamp,
              actor: req.assignedEmployeeName || 'Stringer',
              notes: notes || 'Tension calibrated and checked on digital tester.',
            },
          ],
        };
      })
    );

    logAudit('Stringer', 'EMPLOYEE', 'Completed bat getting', requestId, notes);
    addToast('success', 'Getting Completed', `${requestId} is ready for delivery.`);
  };

  const completeRepairJob = (requestId: string, notes?: string) => {
    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        return {
          ...req,
          status: 'Repair Completed',
          timeline: [
            ...req.timeline,
            {
              status: 'Repair Completed',
              label: 'Carbon Composite Repair Completed & Cured',
              timestamp: formattedTimestamp,
              actor: req.assignedEmployeeName || 'Technician',
              notes: notes || 'Structural load tests passed. Ready for dispatch.',
            },
          ],
        };
      })
    );

    logAudit('Technician', 'EMPLOYEE', 'Completed bat repair', requestId, notes);
    addToast('success', 'Repair Completed', `${requestId} is ready for delivery.`);
  };

  const startDelivery = (requestId: string) => {
    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        return {
          ...req,
          status: 'Out for Delivery',
          timeline: [
            ...req.timeline,
            {
              status: 'Out for Delivery',
              label: 'Out for Delivery to Customer Address',
              timestamp: formattedTimestamp,
              actor: 'Logistics Agent',
              notes: 'Customer notified. Payment to be collected upon doorstep delivery.',
            },
          ],
        };
      })
    );

    logAudit('Logistics Agent', 'EMPLOYEE', 'Dispatched bat for delivery', requestId);
    addToast('info', 'Out for Delivery', `${requestId} is out for doorstep delivery.`);
  };

  const recordManualPayment = (
    requestId: string,
    amount: number,
    method: PaymentMethod,
    notes?: string
  ) => {
    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        return {
          ...req,
          status: 'Completed',
          paymentStatus: 'Paid',
          paymentRecord: {
            amount,
            method,
            collectedAt: now.toISOString(),
            collectedBy: req.assignedEmployeeName || 'Amit Verma',
            transactionNotes: notes,
          },
          timeline: [
            ...req.timeline,
            {
              status: 'Delivered',
              label: 'Delivered to Customer',
              timestamp: formattedTimestamp,
              actor: 'Delivery Agent',
            },
            {
              status: 'Payment Collected',
              label: `Manual Payment of ₹${amount} Collected (${method})`,
              timestamp: formattedTimestamp,
              actor: req.assignedEmployeeName || 'Delivery Agent',
              notes: notes || `Payment recorded manually. Method: ${method}`,
            },
            {
              status: 'Completed',
              label: 'Service Request Completed',
              timestamp: formattedTimestamp,
              actor: 'System',
              notes: 'Receipt sent to customer email.',
            },
          ],
        };
      })
    );

    logAudit('Delivery Agent', 'EMPLOYEE', `Recorded manual payment of ₹${amount} via ${method}`, requestId, notes);
    addToast('success', 'Payment Recorded!', `₹${amount} collected via ${method}. Request ${requestId} marked COMPLETED.`);

    try {
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
    } catch (e) {
      // ignore
    }
  };

  const updateDistanceConfig = (newConfig: DistancePricingConfig) => {
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

    const finalizedConfig: DistancePricingConfig = {
      ...newConfig,
      slabs: updatedSlabs,
    };

    setDistanceConfig(finalizedConfig);
    try {
      localStorage.setItem('shuttlecraft_dist_config', JSON.stringify(finalizedConfig));
    } catch (e) {}
    logAudit(
      'Admin',
      'ADMIN',
      'Updated distance pricing rules',
      'SYSTEM',
      `Free radius: ${finalizedConfig.freeRadiusKm} KM, Method: ${finalizedConfig.pricingMethod}, Rate/KM: ₹${finalizedConfig.perKmRateBeyondFree}`
    );
    addToast(
      'success',
      'Logistics Pricing Updated',
      `Free delivery radius set to ${finalizedConfig.freeRadiusKm} KM. Pickups beyond ${finalizedConfig.freeRadiusKm} KM will be charged ₹${finalizedConfig.perKmRateBeyondFree}/KM.`
    );
  };

  const updateGettingService = (id: string, updated: Partial<GettingServiceTier>) => {
    setGettingServices((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, ...updated } : item));
      try {
        localStorage.setItem('shuttlecraft_getting_services', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    logAudit('Admin', 'ADMIN', `Updated getting package (${id})`, 'SYSTEM', JSON.stringify(updated));
    addToast('success', 'Service Price Updated', `Getting package ${id} updated.`);
  };

  const updateRepairCategory = (id: string, updated: Partial<RepairCategoryTier>) => {
    setRepairCategories((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, ...updated } : item));
      try {
        localStorage.setItem('shuttlecraft_repair_categories', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    logAudit('Admin', 'ADMIN', `Updated repair category (${id})`, 'SYSTEM', JSON.stringify(updated));
    addToast('success', 'Service Price Updated', `Repair category ${id} base price/SLA updated.`);
  };

  const addGettingService = (newTier: Omit<GettingServiceTier, 'id'>) => {
    const id = 'tier_' + Date.now().toString().slice(-4);
    const created: GettingServiceTier = { ...newTier, id };
    setGettingServices((prev) => {
      const next = [...prev, created];
      try {
        localStorage.setItem('shuttlecraft_getting_services', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    logAudit('Admin', 'ADMIN', `Added getting package ${created.name}`, 'SYSTEM');
    addToast('success', 'Package Added', `${created.name} added at ₹${created.price}.`);
  };

  const addRepairCategory = (newCategory: Omit<RepairCategoryTier, 'id'>) => {
    const id = 'rep_' + Date.now().toString().slice(-4);
    const created: RepairCategoryTier = { ...newCategory, id };
    setRepairCategories((prev) => {
      const next = [...prev, created];
      try {
        localStorage.setItem('shuttlecraft_repair_categories', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    logAudit('Admin', 'ADMIN', `Added repair category ${created.name}`, 'SYSTEM');
    addToast('success', 'Category Added', `${created.name} added with base ₹${created.basePrice}.`);
  };

  const resetPricingToDefaults = () => {
    setDistanceConfig(initialDistanceConfig);
    setGettingServices(gettingTypesData);
    setRepairCategories(repairCategoriesData);
    try {
      localStorage.removeItem('shuttlecraft_dist_config');
      localStorage.removeItem('shuttlecraft_getting_services');
      localStorage.removeItem('shuttlecraft_repair_categories');
    } catch (e) {}
    logAudit('Admin', 'ADMIN', 'Reset pricing and distance configuration', 'SYSTEM');
    addToast('info', 'Pricing Reset', 'Distance rules and service pricing restored to defaults.');
  };

  const updateEmailTemplate = (id: string, subject: string, body: string) => {
    setEmailTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, subject, body } : t))
    );
    logAudit('Admin', 'ADMIN', `Updated email template ${id}`, 'SYSTEM');
    addToast('success', 'Email Template Saved', `Template updated successfully.`);
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
        deviceViewport,
        setDeviceViewport,

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
        userEmail,
        userName,
        userMobile,
        userTitle,
        loginWithEmailOtp,
        loginAsRole,
        logout,
        loginRoleTab,
        setLoginRoleTab,
        openLoginWithRole,
        wizardServiceType,
        setWizardServiceType,
        openWizardWithService,
        addNewAddress,
        deleteAddress,
        setDefaultAddress,
        updateUserProfile,

        requests,
        distanceConfig,
        savedAddresses,
        auditLogs,
        emailTemplates,
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
        completeGettingJob,
        completeRepairJob,
        startDelivery,
        recordManualPayment,

        updateDistanceConfig,
        updateEmailTemplate,
        calculateDistanceCharge,
        gettingServices,
        repairCategories,
        updateGettingService,
        updateRepairCategory,
        addGettingService,
        addRepairCategory,
        resetPricingToDefaults,
        openRequestDetail,
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
