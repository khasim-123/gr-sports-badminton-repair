import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/Badge';
import { Button } from '../common/Button';
import {
  ServiceRequest,
  RequestStatus,
  DistancePricingConfig,
  GettingServiceTier,
  RepairCategoryTier,
  Employee,
} from '../../types';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Wrench,
  Compass,
  DollarSign,
  Clock,
  BarChart3,
  Settings,
  Search,
  Download,
  Printer,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Eye,
  ChevronRight,
  MapPin,
  Edit3,
  Plus,
  RotateCcw,
  X,
  LayoutTemplate,
  KeyRound,
  Phone,
  Save,
  Trash2,
  Users,
} from 'lucide-react';
import { WebsiteContentPanel } from './content/WebsiteContentPanel';
import { ShopSettingsForm } from './ShopSettingsForm';
import { CustomersPanel } from './CustomersPanel';
import { NewBookingDialog, NewBookingPrefill } from './NewBookingDialog';
import { requestService } from '../../services/requestService';
import { MobileInput } from '../common/MobileInput';
import { formatMobile, mobileTelHref, normalizeMobile, INVALID_MOBILE_MESSAGE } from '../../utils/phone';
import {
  formatINR,
  formatDate,
  formatDateTime,
  parseDate,
  calendarDaysBetween,
  pluralDays,
  csvRow,
  downloadCsv,
} from '../../utils/format';
import { VisitorReports } from './reports/VisitorReports';
import { employeeService } from '../../services/employeeService';
import { useRequestPhotos } from '../../hooks/useRequestPhotos';
import type { PaymentMethod } from '../../types';

// ---------------------------------------------------------------------------
// Request stages (used by the dashboard work queue and the requests filter)
// ---------------------------------------------------------------------------
const STAGES: { id: string; label: string; statuses: RequestStatus[]; dot: string }[] = [
  { id: 'new', label: 'New – accept & assign', statuses: ['Submitted', 'Accepted'], dot: 'bg-ink' },
  { id: 'pickup', label: 'Waiting for pickup', statuses: ['Employee Assigned', 'Pickup Scheduled'], dot: 'bg-ink' },
  {
    id: 'workshop',
    label: 'In the workshop',
    statuses: ['Bat Picked Up', 'Inspection', 'Repair Estimate', 'Repair Approved', 'Repair in Progress', 'Getting in Progress'],
    dot: 'bg-amber-500',
  },
  { id: 'approval', label: 'Waiting for customer approval', statuses: ['Awaiting Customer Approval'], dot: 'bg-orange-500' },
  {
    id: 'delivery',
    label: 'Ready / out for delivery',
    statuses: ['Getting Completed', 'Repair Completed', 'Repair Declined', 'Out for Delivery', 'Delivered', 'Payment Pending'],
    dot: 'bg-teal-500',
  },
  { id: 'done', label: 'Completed', statuses: ['Payment Collected', 'Completed', 'Completed Without Repair'], dot: 'bg-emerald-500' },
  { id: 'cancelled', label: 'Cancelled', statuses: ['Cancelled'], dot: 'bg-slate-400' },
];

const ALL_STATUSES: RequestStatus[] = [
  'Submitted',
  'Accepted',
  'Employee Assigned',
  'Pickup Scheduled',
  'Bat Picked Up',
  'Inspection',
  'Repair Estimate',
  'Awaiting Customer Approval',
  'Repair Approved',
  'Repair in Progress',
  'Getting in Progress',
  'Getting Completed',
  'Repair Completed',
  'Out for Delivery',
  'Delivered',
  'Payment Pending',
  'Payment Collected',
  'Completed',
  'Repair Declined',
  'Completed Without Repair',
  'Cancelled',
];

const CLOSED_STATUSES = new Set<RequestStatus>(['Payment Collected', 'Completed', 'Completed Without Repair', 'Cancelled']);
const NOT_PICKED_UP = new Set<RequestStatus>(['Submitted', 'Accepted', 'Employee Assigned', 'Pickup Scheduled']);
/** Repair is back with the customer (or will not happen) — the turnaround clock stops. */
const SLA_STOPPED = new Set<RequestStatus>([
  'Delivered',
  'Payment Pending',
  'Payment Collected',
  'Completed',
  'Completed Without Repair',
  'Repair Declined',
  'Cancelled',
]);

const isOpenRequest = (r: ServiceRequest) => !CLOSED_STATUSES.has(r.status);
const DEFAULT_SLA_DAYS = 7;

type SlaState = 'not_started' | 'on_track' | 'due_soon' | 'overdue';
interface SlaItem {
  request: ServiceRequest;
  slaDays: number;
  start: Date | null;
  due: Date | null;
  daysLeft: number | null;
  dayNumber: number | null;
  state: SlaState;
}

const SLA_ORDER: Record<SlaState, number> = { overdue: 0, due_soon: 1, on_track: 2, not_started: 3 };

const slaLabel = (item: SlaItem): string => {
  if (item.state === 'not_started' || item.daysLeft === null) return 'Starts at pickup';
  if (item.daysLeft < 0) return `${pluralDays(-item.daysLeft)} overdue`;
  if (item.daysLeft === 0) return 'Due today';
  return `${pluralDays(item.daysLeft)} left`;
};

const SLA_STATE_LABEL: Record<SlaState, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  on_track: 'On track',
  not_started: 'Not picked up',
};

const SLA_STATE_CLASS: Record<SlaState, string> = {
  overdue: 'bg-rose-100 text-rose-800 border border-rose-200',
  due_soon: 'bg-amber-100 text-amber-800 border border-amber-200',
  on_track: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  not_started: 'bg-slate-100 text-slate-600 border border-line',
};

/** Distance form (strings so fields can be cleared while typing). */
interface DistForm {
  shopLocationName: string;
  shopLat: string;
  shopLng: string;
  freeRadiusKm: string;
  perKmRateBeyondFree: string;
  maxServiceDistanceKm: string;
  pricingMethod: 'PER_KM' | 'SLAB';
  /** Paid slabs only (the first, free slab always runs 0 → free radius at ₹0). */
  slabs: { maxKm: string; price: string }[];
}

const toDistForm = (c: DistancePricingConfig): DistForm => ({
  shopLocationName: c.shopLocationName || '',
  shopLat: String(c.shopLat ?? ''),
  shopLng: String(c.shopLng ?? ''),
  freeRadiusKm: String(c.freeRadiusKm ?? ''),
  perKmRateBeyondFree: String(c.perKmRateBeyondFree ?? ''),
  maxServiceDistanceKm: String(c.maxServiceDistanceKm ?? ''),
  pricingMethod: c.pricingMethod === 'SLAB' ? 'SLAB' : 'PER_KM',
  slabs: (c.slabs || []).slice(1).map((s) => ({ maxKm: String(s.maxKm), price: String(s.price) })),
});

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));

/** Validates the form; returns the config to save or an error message. */
const fromDistForm = (f: DistForm): { config?: DistancePricingConfig; error?: string } => {
  const free = num(f.freeRadiusKm);
  const rate = num(f.perKmRateBeyondFree);
  const max = num(f.maxServiceDistanceKm);
  const lat = num(f.shopLat);
  const lng = num(f.shopLng);
  if (!f.shopLocationName.trim()) return { error: 'Enter the workshop address.' };
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { error: 'Latitude must be a number between -90 and 90.' };
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { error: 'Longitude must be a number between -180 and 180.' };
  if (!Number.isFinite(free) || free <= 0 || free > 100) return { error: 'Free radius must be between 0 and 100 KM.' };
  if (!Number.isFinite(rate) || rate < 0) return { error: 'Rate per KM must be 0 or more.' };
  if (!Number.isFinite(max) || max <= free) return { error: 'Max serviceable radius must be larger than the free radius.' };
  const slabs: DistancePricingConfig['slabs'] = [{ minKm: 0, maxKm: free, price: 0 }];
  let prevMax = free;
  for (let i = 0; i < f.slabs.length; i++) {
    const sMax = num(f.slabs[i].maxKm);
    const sPrice = num(f.slabs[i].price);
    if (!Number.isFinite(sMax) || sMax <= prevMax) {
      return { error: `Slab ${i + 2}: "up to" KM must be more than ${prevMax} KM.` };
    }
    if (!Number.isFinite(sPrice) || sPrice < 0) return { error: `Slab ${i + 2}: enter a price of ₹0 or more.` };
    slabs.push({ minKm: +(prevMax + 0.1).toFixed(1), maxKm: sMax, price: sPrice });
    prevMax = sMax;
  }
  if (f.pricingMethod === 'SLAB' && slabs.length < 2) return { error: 'Add at least one paid slab, or use per-KM pricing.' };
  return {
    config: {
      shopLocationName: f.shopLocationName.trim(),
      shopLat: lat,
      shopLng: lng,
      freeRadiusKm: free,
      perKmRateBeyondFree: rate,
      pricingMethod: f.pricingMethod,
      maxServiceDistanceKm: max,
      slabs,
    },
  };
};

/** Same rule the server applies (backend pricing_service.calculate_delivery_charge). */
const previewCharge = (km: number, c: DistancePricingConfig) => {
  if (km <= c.freeRadiusKm) return { charge: 0, chargeableKm: 0, viaSlab: false };
  const chargeableKm = +(km - c.freeRadiusKm).toFixed(1);
  if (c.pricingMethod === 'SLAB' && c.slabs.length) {
    const slab = c.slabs.find((s) => s.minKm <= km && km <= s.maxKm);
    if (slab) return { charge: slab.price, chargeableKm, viaSlab: true };
  }
  return { charge: Math.round(chargeableKm * c.perKmRateBeyondFree), chargeableKm, viaSlab: false };
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '?';

/** Server log text: show mobiles as "+91 98765 43210" and amounts as "₹1,49,990". */
const prettyLogText = (text: string) =>
  text
    .replace(/\+91\d{10}\b/g, (m) => formatMobile(m))
    .replace(/₹\s?(\d+(?:\.\d+)?)/g, (_, n) => formatINR(Number(n)));

const serviceLabel = (r: ServiceRequest) => (r.serviceType === 'GETTING' ? 'Stringing' : 'Repair');

/** Amount cell text: unquoted repairs have no amount yet. */
const amountText = (r: ServiceRequest) =>
  r.totalAmount > 0 ? formatINR(r.totalAmount) : r.serviceType === 'REPAIR' ? 'Quote pending' : formatINR(0);

const paymentText = (r: ServiceRequest) => {
  if (r.paymentStatus === 'Paid') return 'Paid';
  if (r.status === 'Cancelled') return 'Not due';
  if (r.paymentStatus === 'Not Applicable') return 'Not applicable';
  return 'Unpaid';
};

const DISTANCE_SOURCE_TEXT: Record<string, string> = {
  location: "from the customer's phone location",
  customer: 'entered by the customer',
  staff: 'corrected by staff',
};

interface ConfirmState {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<unknown> | void;
}

const inputCls =
  'w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-ink/40 bg-white';
const labelCls = 'block text-xs font-bold text-slate-700 mb-1';
const cardCls = 'bg-white rounded-2xl border border-line shadow-xs';

export const AdminPortal: React.FC = () => {
  const {
    requests,
    adminSubView,
    setAdminSubView,
    distanceConfig,
    updateDistanceConfig,
    assignEmployee,
    updateRequestStatus,
    gettingServices,
    repairCategories,
    updateGettingService,
    updateRepairCategory,
    addGettingService,
    addRepairCategory,
    resetPricingToDefaults,
    addToast,
    employees,
    addEmployee,
    removeEmployee,
    recordManualPayment,
    auditLogs,
    userName,
    userMobile,
    selectedRequestId,
    setSelectedRequestId,
    isDataLoading,
    refreshData,
  } = useApp();

  // New booking (phone / walk-in) dialog + customers list refresh
  const [newBooking, setNewBooking] = useState<NewBookingPrefill | null>(null);
  const [customersRefresh, setCustomersRefresh] = useState(0);

  // Correct distance (request detail)
  const [distanceFix, setDistanceFix] = useState<{ km: string; reason: string } | null>(null);
  const [distanceFixSaving, setDistanceFixSaving] = useState(false);
  const [distanceFixError, setDistanceFixError] = useState<string | null>(null);

  // Team & Admin Management Form State
  const [teamName, setTeamName] = useState('');
  /** 10 local digits; the +91 prefix is shown by MobileInput. */
  const [teamPhone, setTeamPhone] = useState('');
  const [teamPhoneError, setTeamPhoneError] = useState<string | null>(null);
  const [isCreatingMember, setIsCreatingMember] = useState(false);
  const [teamRole, setTeamRole] = useState<'Technician' | 'Pickup & Delivery Agent' | 'Master Stringer'>('Technician');
  const [teamUserRole, setTeamUserRole] = useState<'EMPLOYEE' | 'ADMIN'>('EMPLOYEE');
  const [teamPassword, setTeamPassword] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  // Request detail / assign / confirm dialogs
  const [detailRequestId, setDetailRequestId] = useState<string | null>(null);
  const [assignModalReqId, setAssignModalReqId] = useState<string | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [statusDraft, setStatusDraft] = useState<RequestStatus | ''>('');
  const [statusNote, setStatusNote] = useState('');
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  // Record a payment from the request detail (admin collected it at the counter, or a staff
  // member handed it over without recording it on their phone).
  const [paymentForm, setPaymentForm] = useState<{ amount: string; method: PaymentMethod; notes: string } | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const resetStaffPassword = async (empId: string, empName: string) => {
    try {
      const res = await employeeService.resetPassword(empId);
      addToast(
        'success',
        `New password for ${empName}`,
        `Temporary password: ${res.temporaryPassword} — hand it over in person. Their old password no longer works.`,
        { durationMs: 0 }
      );
    } catch (err: any) {
      addToast('error', 'Password not reset', err?.message || 'Please try again.');
    }
  };
  const [isConfirming, setIsConfirming] = useState(false);

  // Distance & free radius form
  const [distForm, setDistForm] = useState<DistForm>(() => toDistForm(distanceConfig));
  const [isSavingDist, setIsSavingDist] = useState(false);
  const [calcDistInput, setCalcDistInput] = useState<number>(15);

  // Payments filter
  const [payFilter, setPayFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');

  // Activity log (reports)
  const [showSignIns, setShowSignIns] = useState(false);
  const [activityLimit, setActivityLimit] = useState(25);

  // Getting Service Modal state
  const [editingGettingItem, setEditingGettingItem] = useState<GettingServiceTier | null>(null);
  const [getFormName, setGetFormName] = useState('');
  const [getFormPrice, setGetFormPrice] = useState<number | string>(0);
  const [getFormTurnaround, setGetFormTurnaround] = useState('');
  const [getFormDesc, setGetFormDesc] = useState('');
  const [getFormFeatures, setGetFormFeatures] = useState('');

  // Repair Category Modal state
  const [editingRepairItem, setEditingRepairItem] = useState<RepairCategoryTier | null>(null);
  const [repFormName, setRepFormName] = useState('');
  const [repFormBasePrice, setRepFormBasePrice] = useState<number | string>(0);
  const [repFormSlaDays, setRepFormSlaDays] = useState<number | string>(7);
  const [repFormTurnaround, setRepFormTurnaround] = useState('');
  const [repFormDesc, setRepFormDesc] = useState('');

  // Add Service Modals
  const [addGettingModalOpen, setAddGettingModalOpen] = useState(false);
  const [addRepairModalOpen, setAddRepairModalOpen] = useState(false);
  const [isSavingTier, setIsSavingTier] = useState(false);

  const navRef = useRef<HTMLElement | null>(null);
  // On desktop only the main area scrolls (the sidebar and top bar stay put).
  const mainRef = useRef<HTMLElement | null>(null);
  const actor = userName || 'Admin';

  // ---------------------------------------------------------------------------
  // Derived data (everything below is computed from server data)
  // ---------------------------------------------------------------------------
  const activeEmployees = employees.filter((e) => e.isActive !== false);
  const openRequests = requests.filter(isOpenRequest);
  const paidRequests = requests.filter((r) => r.paymentStatus === 'Paid');
  const unpaidRequests = requests.filter(
    (r) => r.paymentStatus === 'Pending' && r.status !== 'Cancelled' && r.totalAmount > 0
  );
  const totalCollected = paidRequests.reduce((acc, r) => acc + (r.paymentRecord?.amount ?? r.totalAmount ?? 0), 0);
  const pendingCollection = unpaidRequests.reduce((acc, r) => acc + (r.totalAmount || 0), 0);
  const gettingCount = requests.filter((r) => r.serviceType === 'GETTING').length;
  const repairCount = requests.filter((r) => r.serviceType === 'REPAIR').length;
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
  const withinFreeRadius = requests.filter(
    (r) => typeof r.distanceKm === 'number' && r.distanceKm <= distanceConfig.freeRadiusKm
  ).length;

  const openJobsFor = (empId: string) =>
    requests.filter((r) => r.assignedEmployeeId === empId && isOpenRequest(r)).length;

  const stageCounts = STAGES.map((s) => ({
    ...s,
    count: requests.filter((r) => s.statuses.includes(r.status)).length,
  }));

  // Repair SLA (turnaround counted from pickup until the bat is delivered back)
  const slaDaysFor = (r: ServiceRequest): number => {
    const issue = (r.repairIssue || '').toLowerCase();
    if (!issue) return DEFAULT_SLA_DAYS;
    const exact = repairCategories.find((c) => c.name.toLowerCase().startsWith(issue));
    const firstWord = issue.split(/\s+/)[0];
    const loose = exact || repairCategories.find((c) => c.name.toLowerCase().split(/[\s/&()]+/).includes(firstWord));
    return loose && loose.slaDays > 0 ? loose.slaDays : DEFAULT_SLA_DAYS;
  };

  const today = new Date();
  const repairSlaItems: SlaItem[] = requests
    .filter((r) => r.serviceType === 'REPAIR' && !SLA_STOPPED.has(r.status))
    .map((r) => {
      const slaDays = slaDaysFor(r);
      const pickedUp = !NOT_PICKED_UP.has(r.status);
      const start = pickedUp ? parseDate(r.pickupCondition?.collectedAt) || parseDate(r.pickupDate) || parseDate(r.createdAt) : null;
      let due: Date | null = null;
      if (start) {
        due = parseDate(r.targetDate);
        if (!due) {
          due = new Date(start);
          due.setDate(due.getDate() + slaDays);
        }
      }
      const daysLeft = due ? calendarDaysBetween(today, due) : null;
      const dayNumber = start ? calendarDaysBetween(start, today) + 1 : null;
      let state: SlaState = 'not_started';
      if (daysLeft !== null) state = daysLeft < 0 ? 'overdue' : daysLeft <= 2 ? 'due_soon' : 'on_track';
      return { request: r, slaDays, start, due, daysLeft, dayNumber, state };
    })
    .sort((a, b) => SLA_ORDER[a.state] - SLA_ORDER[b.state] || (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  const slaOverdue = repairSlaItems.filter((s) => s.state === 'overdue').length;
  const slaDueSoon = repairSlaItems.filter((s) => s.state === 'due_soon').length;
  const slaNotStarted = repairSlaItems.filter((s) => s.state === 'not_started').length;

  // Requests table filter
  const filteredRequests = requests.filter((req) => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const digits = q.replace(/\D/g, '');
      const matches =
        req.id.toLowerCase().includes(q) ||
        req.customerName.toLowerCase().includes(q) ||
        `${req.batBrand} ${req.batModel}`.toLowerCase().includes(q) ||
        (req.assignedEmployeeName || '').toLowerCase().includes(q) ||
        (digits.length >= 3 && (req.customerMobile || '').replace(/\D/g, '').includes(digits));
      if (!matches) return false;
    }
    if (statusFilter.startsWith('stage:')) {
      const stage = STAGES.find((s) => s.id === statusFilter.slice(6));
      if (stage && !stage.statuses.includes(req.status)) return false;
    } else if (statusFilter === 'OPEN') {
      if (!isOpenRequest(req)) return false;
    } else if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
    if (serviceFilter !== 'ALL' && req.serviceType !== serviceFilter) return false;
    if (paymentFilter === 'Paid' && req.paymentStatus !== 'Paid') return false;
    if (paymentFilter === 'Pending' && (req.paymentStatus === 'Paid' || req.status === 'Cancelled')) return false;
    return true;
  });
  const filtersActive = !!searchQuery.trim() || statusFilter !== 'ALL' || serviceFilter !== 'ALL' || paymentFilter !== 'ALL';

  const detailRequest = detailRequestId ? requests.find((r) => r.id === detailRequestId) || null : null;
  const detailPhotos = useRequestPhotos(detailRequest);
  const assignRequest = assignModalReqId ? requests.find((r) => r.id === assignModalReqId) || null : null;

  // Distance form helpers
  const distParsed = fromDistForm(distForm);
  const distDirty = JSON.stringify(distForm) !== JSON.stringify(toDistForm(distanceConfig));
  const previewConfig = distParsed.config || distanceConfig;
  const sliderMax = Math.max(previewConfig.maxServiceDistanceKm || 35, previewConfig.freeRadiusKm + 1);
  const preview = previewCharge(calcDistInput, previewConfig);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------
  // Keep the distance form in step with the server config while it has no unsaved edits.
  const distDirtyRef = useRef(distDirty);
  distDirtyRef.current = distDirty;
  useEffect(() => {
    if (!distDirtyRef.current) setDistForm(toDistForm(distanceConfig));
  }, [distanceConfig]);

  // A notification click (openRequestDetail) selects a request: open it here.
  useEffect(() => {
    if (selectedRequestId && requests.some((r) => r.id === selectedRequestId)) {
      setDetailRequestId(selectedRequestId);
      setSelectedRequestId(null);
    }
  }, [selectedRequestId, requests, setSelectedRequestId]);

  // Mobile: keep the active section visible in the horizontal section scroller.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || window.innerWidth >= 1024) return;
    const active = nav.querySelector<HTMLElement>('[data-active="true"]');
    if (active) nav.scrollLeft = active.offsetLeft - nav.clientWidth / 2 + active.clientWidth / 2;
  }, [adminSubView]);

  // Reset the status form whenever another request is opened.
  useEffect(() => {
    setStatusDraft('');
    setStatusNote('');
    setDistanceFix(null);
    setDistanceFixError(null);
  }, [detailRequestId]);

  // Escape closes the top-most dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmState) setConfirmState(null);
      else if (assignModalReqId) setAssignModalReqId(null);
      else if (detailRequestId) setDetailRequestId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmState, assignModalReqId, detailRequestId]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const goTo = (view: string) => {
    setAdminSubView(view);
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  };

  const openStage = (stageId: string) => {
    setSearchQuery('');
    setServiceFilter('ALL');
    setPaymentFilter('ALL');
    setStatusFilter(`stage:${stageId}`);
    goTo('requests');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setServiceFilter('ALL');
    setPaymentFilter('ALL');
  };

  const stamp = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const exportRequestsCsv = (list: ServiceRequest[]) => {
    if (list.length === 0) {
      addToast('info', 'Nothing to export', 'There are no service requests to export.');
      return;
    }
    const lines = [
      csvRow([
        'Request ID',
        'Created',
        'Customer',
        'Mobile',
        'Service',
        'Racket',
        'Status',
        'Assigned staff',
        'Distance (KM)',
        'Pickup & delivery charge (INR)',
        'Total amount (INR)',
        'Payment',
      ]),
      ...list.map((r) =>
        csvRow([
          r.id,
          formatDateTime(r.createdAt, ''),
          r.customerName,
          formatMobile(r.customerMobile),
          serviceLabel(r),
          `${r.batBrand} ${r.batModel}`.trim(),
          r.status,
          r.assignedEmployeeName || '',
          r.distanceKm,
          r.pickupDeliveryCharge || 0,
          r.totalAmount || 0,
          paymentText(r),
        ])
      ),
    ];
    downloadCsv(`gr-sports-service-requests-${stamp()}.csv`, lines);
  };

  const exportPaymentsCsv = () => {
    if (requests.length === 0) {
      addToast('info', 'Nothing to export', 'There are no service requests yet.');
      return;
    }
    const lines = [
      csvRow([
        'Request ID',
        'Customer',
        'Mobile',
        'Status',
        'Amount due (INR)',
        'Payment',
        'Method',
        'Amount collected (INR)',
        'Collected by',
        'Collected at',
        'Notes',
      ]),
      ...requests.map((r) =>
        csvRow([
          r.id,
          r.customerName,
          formatMobile(r.customerMobile),
          r.status,
          r.totalAmount || 0,
          paymentText(r),
          r.paymentRecord?.method || '',
          r.paymentRecord?.amount ?? '',
          r.paymentRecord?.collectedBy || '',
          r.paymentRecord ? formatDateTime(r.paymentRecord.collectedAt, '') : '',
          r.paymentRecord?.transactionNotes || '',
        ])
      ),
    ];
    downloadCsv(`gr-sports-payments-${stamp()}.csv`, lines);
  };

  const openAssign = (req: ServiceRequest) => {
    setSelectedEmpId(req.assignedEmployeeId || '');
    setAssignModalReqId(req.id);
  };

  const runConfirm = async () => {
    if (!confirmState || isConfirming) return;
    setIsConfirming(true);
    try {
      await confirmState.onConfirm();
    } finally {
      setIsConfirming(false);
      setConfirmState(null);
    }
  };

  const saveDistance = async () => {
    if (!distParsed.config) {
      addToast('warning', 'Check the delivery settings', distParsed.error || 'Some values are invalid.');
      return;
    }
    setIsSavingDist(true);
    const ok = await updateDistanceConfig(distParsed.config);
    setIsSavingDist(false);
    if (ok) setDistForm(toDistForm(distParsed.config));
  };

  const setDist = (patch: Partial<DistForm>) => setDistForm((f) => ({ ...f, ...patch }));

  const navItems: { id: string; label: string; icon: React.ElementType; badge?: number; badgeTitle?: string; alert?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'requests', label: 'Service Requests', icon: FileSpreadsheet, badge: openRequests.length, badgeTitle: 'Open requests' },
    { id: 'customers', label: 'Customers', icon: Users },
    {
      id: 'sla_monitor',
      label: 'Repair SLA Monitor',
      icon: Clock,
      badge: slaOverdue + slaDueSoon || undefined,
      badgeTitle: 'Repairs overdue or due within 2 days',
      alert: slaOverdue > 0,
    },
    { id: 'payments', label: 'Payments', icon: DollarSign, badge: unpaidRequests.length || undefined, badgeTitle: 'Unpaid requests' },
    { id: 'distance', label: 'Delivery & Free Radius', icon: Compass },
    { id: 'getting_config', label: 'Stringing Packages', icon: Wrench },
    { id: 'repair_config', label: 'Repair Categories', icon: Wrench },
    { id: 'reports', label: 'Reports & Activity', icon: BarChart3 },
    { id: 'website_content', label: 'Website Content', icon: LayoutTemplate },
    { id: 'team', label: 'Staff & Admins', icon: UserCheck, badge: activeEmployees.length, badgeTitle: 'Active staff accounts' },
    { id: 'settings', label: 'Shop Settings', icon: Settings },
  ];

  const pageHeader = (title: string, subtitle: React.ReactNode, actions?: React.ReactNode) => (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display tracking-[0.01em] text-3xl sm:text-4xl font-bold text-slate-900">{title}</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0 print:hidden">{actions}</div>}
    </div>
  );

  const emptyRow = (cols: number, text: string) => (
    <tr>
      <td colSpan={cols} className="py-10 px-4 text-center text-sm text-slate-500">
        {text}
      </td>
    </tr>
  );

  const thCls = 'py-3 px-4 whitespace-nowrap';
  const tdCls = 'py-3 px-4 align-top';

  const visibleActivity = auditLogs.filter((l) => showSignIns || !/login|sign[- ]?in|logout/i.test(l.action));

  return (
    <div className="flex flex-col lg:flex-row lg:h-full lg:min-h-0 bg-paper border-t border-line print:block print:h-auto">
      {/* Sidebar: fixed full-height column on desktop (scrolls on its own only if the menu is taller than the
          screen); horizontal scroller on mobile */}
      <aside className="w-full lg:w-64 lg:h-full lg:overflow-y-auto sidebar-scroll bg-ink text-white/75 border-r border-white/10 shrink-0 select-none z-20 print:hidden">
        <div className="p-3 lg:p-3 flex flex-col gap-2">
          <div className="px-3 py-1 lg:py-2 lg:mb-1 lg:border-b border-white/10">
            <h3 className="font-display text-xl font-bold text-white tracking-[0.01em]">GR Sports Admin</h3>
            <p className="text-[11px] text-white/50 hidden lg:block">Shop management</p>
          </div>

          <nav
            ref={navRef}
            aria-label="Admin sections"
            className="flex lg:flex-col overflow-x-auto lg:overflow-visible gap-1.5 lg:gap-0.5 pb-1 lg:pb-0 no-scrollbar scroll-smooth"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = adminSubView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-active={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => goTo(item.id)}
                  className={`flex items-center justify-between gap-2 px-3 min-h-[40px] lg:min-h-[36px] rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 lg:w-full ${
                    isActive ? 'bg-accent text-ink font-bold' : 'text-white/75 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span
                      title={item.badgeTitle}
                      className={`text-[10px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full font-bold ${
                        item.alert ? 'bg-rose-600 text-white' : isActive ? 'bg-ink text-white' : 'bg-white/10 text-white/80'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

        </div>
      </aside>

      {/* Main work area */}
      <main
        ref={mainRef}
        className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 min-w-0 lg:h-full lg:overflow-y-auto print:h-auto print:overflow-visible"
      >
        {isDataLoading && (
          <p className="text-xs text-slate-500 flex items-center gap-2 print:hidden" role="status">
            <span className="w-3 h-3 border-2 border-ink border-t-transparent rounded-full animate-spin" />
            Loading the latest data…
          </p>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* DASHBOARD                                                          */}
        {/* ------------------------------------------------------------------ */}
        {adminSubView === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in">
            {pageHeader(
              'Dashboard',
              'Live figures from your service requests, payments and repair deadlines.',
              <>
                <Button
                  onClick={() => exportRequestsCsv(requests)}
                  variant="outline"
                  size="sm"
                  className="min-h-[40px]"
                  leftIcon={<Download className="w-4 h-4" />}
                >
                  Export CSV
                </Button>
                <Button onClick={() => goTo('requests')} variant="primary" size="sm" className="min-h-[40px]">
                  View all requests
                </Button>
              </>
            )}

            {/* KPI cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                <p className="text-xs font-semibold text-slate-500">Total requests</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{requests.length}</p>
                <p className="text-[11px] text-slate-500 mt-2">
                  {openRequests.length} open · Stringing {gettingCount} · Repair {repairCount}
                </p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                <p className="text-xs font-semibold text-slate-500">Collected</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">{formatINR(totalCollected)}</p>
                <p className="text-[11px] text-slate-500 mt-2">
                  From {paidRequests.length} paid {paidRequests.length === 1 ? 'request' : 'requests'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => goTo('payments')}
                className="text-left bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-amber-300 transition-colors"
              >
                <p className="text-xs font-semibold text-slate-500">To be collected</p>
                <p className="text-2xl font-black text-amber-600 mt-1">{formatINR(pendingCollection)}</p>
                <p className="text-[11px] text-slate-500 mt-2">
                  {unpaidRequests.length} unpaid {unpaidRequests.length === 1 ? 'request' : 'requests'} (collected on delivery)
                </p>
              </button>

              <button
                type="button"
                onClick={() => goTo('sla_monitor')}
                className="text-left bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-rose-300 transition-colors"
              >
                <p className="text-xs font-semibold text-slate-500">Repair deadlines</p>
                <p className={`text-2xl font-black mt-1 ${slaOverdue > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {slaOverdue} overdue
                </p>
                <p className="text-[11px] text-slate-500 mt-2">
                  {slaDueSoon} due within 2 days · {repairSlaItems.length} active repairs
                </p>
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              {/* Work queue by stage */}
              <div className={`${cardCls} p-5 sm:p-6 space-y-3 xl:col-span-2`}>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Work queue by stage</h3>
                  <p className="text-[11px] text-slate-500">Tap a stage to see those requests.</p>
                </div>
                <div className="divide-y divide-line/70">
                  {stageCounts.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => openStage(s.id)}
                      className="w-full min-h-[44px] flex items-center justify-between gap-3 py-2 text-left hover:bg-paper rounded-lg px-2 -mx-2"
                    >
                      <span className="flex items-center gap-2.5 text-sm text-slate-700">
                        <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                      <span className="flex items-center gap-1 text-sm font-bold text-slate-900">
                        {s.count}
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Repair deadlines */}
              <div className={`${cardCls} p-5 sm:p-6 space-y-3 xl:col-span-3`}>
                <div className="flex justify-between items-center gap-3">
                  <h3 className="text-sm font-bold text-slate-900">Repair deadlines</h3>
                  <button
                    type="button"
                    onClick={() => goTo('sla_monitor')}
                    className="text-xs text-ink font-bold hover:underline min-h-[40px] px-2"
                  >
                    Open SLA monitor
                  </button>
                </div>

                {repairSlaItems.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No repairs in progress.</p>
                ) : (
                  <div className="divide-y divide-line/70">
                    {repairSlaItems.slice(0, 5).map((item) => (
                      <button
                        key={item.request.id}
                        type="button"
                        onClick={() => setDetailRequestId(item.request.id)}
                        className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-paper rounded-lg px-2 -mx-2"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2">
                            <span className="font-mono text-xs font-bold text-ink">{item.request.id}</span>
                            <span className="text-xs font-bold text-slate-900">
                              {item.request.batBrand} {item.request.batModel}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {item.request.customerName}
                            {item.request.repairIssue ? ` · ${item.request.repairIssue}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${SLA_STATE_CLASS[item.state]}`}>
                            {slaLabel(item)}
                          </span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {item.due ? `Due ${formatDate(item.due)}` : 'Not picked up yet'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Service mix & free radius */}
              <div className={`${cardCls} p-5 sm:p-6 space-y-4`}>
                <h3 className="text-sm font-bold text-slate-900">Service mix</h3>
                {[
                  { label: 'Stringing (getting)', count: gettingCount, bar: 'bg-ink', text: 'text-ink' },
                  { label: 'Repairs', count: repairCount, bar: 'bg-amber-500', text: 'text-amber-700' },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span>{row.label}</span>
                      <span className={row.text}>
                        {row.count} ({pct(row.count, requests.length)}%)
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`${row.bar} h-full rounded-full`} style={{ width: `${pct(row.count, requests.length)}%` }} />
                    </div>
                  </div>
                ))}

                {requests.length > 0 && (
                  <div className="p-3 bg-paper rounded-xl border border-line/70 text-xs text-slate-600">
                    <b>Free radius:</b> {withinFreeRadius} of {requests.length} requests (
                    {pct(withinFreeRadius, requests.length)}%) are within the current {distanceConfig.freeRadiusKm} KM free
                    pickup & delivery radius.
                  </div>
                )}
              </div>

              {/* Shortcuts to configuration */}
              <div className={`${cardCls} p-5 sm:p-6 space-y-3`}>
                <h3 className="text-sm font-bold text-slate-900">Pricing & delivery settings</h3>
                {[
                  {
                    view: 'getting_config',
                    title: 'Stringing packages',
                    detail: gettingServices.length
                      ? `${gettingServices.length} packages · ${formatINR(Math.min(...gettingServices.map((g) => g.price)))} – ${formatINR(
                          Math.max(...gettingServices.map((g) => g.price))
                        )}`
                      : 'No packages yet',
                  },
                  {
                    view: 'repair_config',
                    title: 'Repair categories',
                    detail: `${repairCategories.length} categories with base prices and SLA days`,
                  },
                  {
                    view: 'distance',
                    title: 'Delivery & free radius',
                    detail: `Free within ${distanceConfig.freeRadiusKm} KM · ${
                      distanceConfig.pricingMethod === 'SLAB'
                        ? 'distance slabs beyond'
                        : `${formatINR(distanceConfig.perKmRateBeyondFree)}/KM beyond`
                    }`,
                  },
                  { view: 'sla_monitor', title: 'Repair SLA monitor', detail: `${repairSlaItems.length} active repairs` },
                ].map((s) => (
                  <button
                    key={s.view}
                    type="button"
                    onClick={() => goTo(s.view)}
                    className="w-full min-h-[48px] flex items-center justify-between gap-3 p-3 rounded-xl border border-line hover:border-line hover:bg-paper text-left transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-900">{s.title}</span>
                      <span className="block text-[11px] text-slate-500 truncate">{s.detail}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* SERVICE REQUESTS                                                   */}
        {/* ------------------------------------------------------------------ */}
        {adminSubView === 'requests' && (
          <div className="space-y-4 animate-in fade-in">
            {pageHeader(
              'Service Requests',
              'Search and filter requests, open a request to see everything about it, assign staff or change its status.',
              <>
                <Button
                  onClick={() => setNewBooking({})}
                  size="sm"
                  className="min-h-[40px]"
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  New booking
                </Button>
                <Button
                  onClick={() => exportRequestsCsv(filteredRequests)}
                  variant="outline"
                  size="sm"
                  className="min-h-[40px]"
                  leftIcon={<Download className="w-4 h-4" />}
                >
                  Export {filtersActive ? `${filteredRequests.length} shown` : 'all'} (CSV)
                </Button>
              </>
            )}

            {/* Filter Bar */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-line shadow-2xs space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ID, name, mobile, racket, staff"
                  aria-label="Search requests"
                  className={`${inputCls} pl-10`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by status"
                  className={inputCls}
                >
                  <option value="ALL">All statuses</option>
                  <option value="OPEN">Open (not completed or cancelled)</option>
                  <optgroup label="Stage">
                    {STAGES.map((s) => (
                      <option key={s.id} value={`stage:${s.id}`}>
                        {s.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Exact status">
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </optgroup>
                </select>

                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  aria-label="Filter by service"
                  className={inputCls}
                >
                  <option value="ALL">All services</option>
                  <option value="GETTING">Stringing (getting)</option>
                  <option value="REPAIR">Repair</option>
                </select>

                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  aria-label="Filter by payment"
                  className={inputCls}
                >
                  <option value="ALL">All payments</option>
                  <option value="Pending">Unpaid</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  Showing {filteredRequests.length} of {requests.length} requests
                </span>
                {filtersActive && (
                  <button type="button" onClick={clearFilters} className="font-bold text-ink hover:underline min-h-[40px] px-2">
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {/* Requests table (scrolls inside its card on small screens) */}
            <div className={`${cardCls} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left border-collapse text-xs [&_td]:px-3 [&_th]:px-3">
                  <thead>
                    <tr className="bg-paper border-b border-line text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className={thCls}>Request</th>
                      <th className={thCls}>Customer</th>
                      <th className={thCls}>Service & racket</th>
                      <th className={thCls}>Assigned staff</th>
                      <th className={thCls}>Distance</th>
                      <th className={thCls}>Amount</th>
                      <th className={thCls}>Status</th>
                      <th className={`${thCls} text-right sticky right-0 bg-paper shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.15)]`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {filteredRequests.length === 0 &&
                      emptyRow(8, requests.length === 0 ? 'No service requests yet.' : 'No requests match these filters.')}
                    {filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-paper/70 transition-colors">
                        <td className={tdCls}>
                          <button
                            type="button"
                            onClick={() => setDetailRequestId(req.id)}
                            className="font-mono font-bold text-ink hover:underline whitespace-nowrap"
                          >
                            {req.id}
                          </button>
                          <p className="text-[11px] text-slate-500 whitespace-nowrap">{formatDate(req.createdAt)}</p>
                        </td>
                        <td className={tdCls}>
                          <p className="font-bold text-slate-900">{req.customerName}</p>
                          {mobileTelHref(req.customerMobile) ? (
                            <a href={mobileTelHref(req.customerMobile)} className="text-[11px] text-ink hover:underline whitespace-nowrap">
                              {formatMobile(req.customerMobile)}
                            </a>
                          ) : (
                            <p className="text-[11px] text-slate-500">{formatMobile(req.customerMobile)}</p>
                          )}
                        </td>
                        <td className={tdCls}>
                          <span className={`font-semibold ${req.serviceType === 'GETTING' ? 'text-ink' : 'text-amber-700'}`}>
                            {serviceLabel(req)}
                          </span>
                          <p className="text-slate-600">
                            {req.batBrand} {req.batModel}
                          </p>
                        </td>
                        <td className={tdCls}>
                          {req.assignedEmployeeName ? (
                            <span className="font-medium text-slate-800">{req.assignedEmployeeName}</span>
                          ) : isOpenRequest(req) ? (
                            <button
                              type="button"
                              onClick={() => openAssign(req)}
                              className="min-h-[40px] px-2.5 rounded-lg bg-paper text-ink font-bold hover:bg-paper-deep whitespace-nowrap"
                            >
                              + Assign staff
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className={`${tdCls} whitespace-nowrap`}>
                          <span className={req.isFreeDelivery ? 'text-emerald-700 font-semibold' : 'text-slate-700'}>
                            {req.distanceKm} KM
                          </span>
                          <p className="text-[11px] text-slate-500">
                            {req.isFreeDelivery ? 'Free delivery' : `+${formatINR(req.pickupDeliveryCharge)}`}
                          </p>
                        </td>
                        <td className={`${tdCls} whitespace-nowrap`}>
                          <p className="font-bold text-slate-900">{amountText(req)}</p>
                          <p className={`text-[11px] ${req.paymentStatus === 'Paid' ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {paymentText(req)}
                          </p>
                        </td>
                        <td className={tdCls}>
                          <StatusBadge status={req.status} size="sm" />
                        </td>
                        <td className={`${tdCls} text-right sticky right-0 bg-white shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.15)]`}>
                          <div className="flex items-center justify-end gap-1.5">
                            {req.status === 'Submitted' && (
                              <button
                                type="button"
                                onClick={() => updateRequestStatus(req.id, 'Accepted', actor, 'Accepted by admin')}
                                className="min-h-[40px] px-3 bg-emerald-50 text-emerald-700 rounded-lg font-bold hover:bg-emerald-100 transition-colors"
                              >
                                Accept
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDetailRequestId(req.id)}
                              className="min-h-[40px] px-3 inline-flex items-center gap-1 rounded-lg border border-line text-slate-700 font-bold hover:text-ink hover:border-line hover:bg-paper transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" /> Open
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* REPAIR SLA MONITOR                                                 */}
        {/* ------------------------------------------------------------------ */}
        {adminSubView === 'sla_monitor' && (
          <div className="space-y-6 animate-in fade-in">
            {pageHeader(
              'Repair SLA Monitor',
              <>
                Turnaround is counted in calendar days from the day the racket is picked up until it is delivered back. The SLA
                days for each repair come from <b>Repair Categories</b> (default {DEFAULT_SLA_DAYS} days).
              </>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: 'Active repairs', value: repairSlaItems.length, cls: 'text-slate-900' },
                { label: 'Overdue', value: slaOverdue, cls: slaOverdue ? 'text-rose-600' : 'text-slate-900' },
                { label: 'Due within 2 days', value: slaDueSoon, cls: slaDueSoon ? 'text-amber-600' : 'text-slate-900' },
                { label: 'Not picked up yet', value: slaNotStarted, cls: 'text-slate-900' },
              ].map((c) => (
                <div key={c.label} className="bg-white p-4 rounded-2xl border border-line shadow-2xs">
                  <p className="text-xs font-semibold text-slate-500">{c.label}</p>
                  <p className={`text-2xl font-black mt-1 ${c.cls}`}>{c.value}</p>
                </div>
              ))}
            </div>

            <div className={`${cardCls} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left border-collapse text-xs [&_td]:px-3 [&_th]:px-3">
                  <thead>
                    <tr className="bg-paper border-b border-line text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className={thCls}>Request</th>
                      <th className={thCls}>Customer</th>
                      <th className={thCls}>Issue</th>
                      <th className={thCls}>Picked up</th>
                      <th className={thCls}>Due</th>
                      <th className={thCls}>Time left</th>
                      <th className={thCls}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {repairSlaItems.length === 0 && emptyRow(7, 'No repairs in progress.')}
                    {repairSlaItems.map((item) => (
                      <tr key={item.request.id} className="hover:bg-paper/70">
                        <td className={tdCls}>
                          <button
                            type="button"
                            onClick={() => setDetailRequestId(item.request.id)}
                            className="block -my-2 py-2 font-mono font-bold text-ink hover:underline whitespace-nowrap text-left"
                          >
                            {item.request.id}
                          </button>
                        </td>
                        <td className={`${tdCls} font-bold text-slate-900`}>{item.request.customerName}</td>
                        <td className={`${tdCls} text-slate-700`}>{item.request.repairIssue || '—'}</td>
                        <td className={`${tdCls} text-slate-600 whitespace-nowrap`}>
                          {item.start ? formatDate(item.start) : 'Not yet'}
                          {item.dayNumber !== null && <p className="text-[11px] text-slate-500">Day {item.dayNumber} since pickup</p>}
                        </td>
                        <td className={`${tdCls} text-slate-600 whitespace-nowrap`}>
                          {item.due ? formatDate(item.due) : '—'}
                          <p className="text-[11px] text-slate-500">SLA {pluralDays(item.slaDays)}</p>
                        </td>
                        <td className={`${tdCls} whitespace-nowrap`}>
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${SLA_STATE_CLASS[item.state]}`}>
                            {slaLabel(item)}
                          </span>
                        </td>
                        <td className={tdCls}>
                          <StatusBadge status={item.request.status} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SHARED PRICING SUB-NAVIGATION (distance / stringing / repair) */}
        {(adminSubView === 'distance' || adminSubView === 'getting_config' || adminSubView === 'repair_config') && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-2 bg-white rounded-2xl border border-line shadow-2xs">
            <div className="hidden md:flex overflow-x-auto no-scrollbar gap-1.5">
              {[
                { id: 'distance', label: `Delivery & free radius (${distanceConfig.freeRadiusKm} KM)`, icon: Compass },
                { id: 'getting_config', label: `Stringing packages (${gettingServices.length})`, icon: Wrench },
                { id: 'repair_config', label: `Repair categories (${repairCategories.length})`, icon: Wrench },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => goTo(t.id)}
                    className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      adminSubView === t.id ? 'bg-ink text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <Button
              onClick={() =>
                setConfirmState({
                  title: 'Reset pricing to defaults?',
                  message: (
                    <>
                      This restores the original delivery rules (free within 10 KM, {formatINR(15)}/KM beyond, workshop
                      location) and the original prices and details of the standard stringing packages and repair categories.
                      Packages or categories you added yourself are not changed. Customers see the new prices immediately.
                    </>
                  ),
                  confirmLabel: 'Reset pricing',
                  danger: true,
                  onConfirm: () => resetPricingToDefaults(),
                })
              }
              variant="outline"
              size="sm"
              className="min-h-[40px] text-xs text-rose-700 hover:bg-rose-50 border-rose-200 shrink-0"
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reset pricing to defaults
            </Button>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* DELIVERY & FREE RADIUS                                             */}
        {/* ------------------------------------------------------------------ */}
        {adminSubView === 'distance' && (
          <div className="space-y-6 animate-in fade-in">
            {pageHeader(
              'Delivery & Free Radius',
              <>
                Live now: free pickup & delivery within <b>{distanceConfig.freeRadiusKm} KM</b>; beyond that{' '}
                {distanceConfig.pricingMethod === 'SLAB' ? (
                  'distance slabs apply'
                ) : (
                  <>
                    <b>{formatINR(distanceConfig.perKmRateBeyondFree)}/KM</b> for the extra distance
                  </>
                )}
                .
              </>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Configuration form (saved only when you press Save) */}
              <form
                className={`${cardCls} p-5 sm:p-6 space-y-5`}
                onSubmit={(e) => {
                  e.preventDefault();
                  saveDistance();
                }}
              >
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Compass className="w-4 h-4 text-ink" />
                  Workshop location & delivery charges
                </h3>

                <div>
                  <label htmlFor="dist-shop" className={labelCls}>
                    Workshop address
                  </label>
                  <input
                    id="dist-shop"
                    type="text"
                    value={distForm.shopLocationName}
                    onChange={(e) => setDist({ shopLocationName: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="dist-lat" className={labelCls}>
                      Latitude
                    </label>
                    <input
                      id="dist-lat"
                      type="number"
                      inputMode="decimal"
                      step="0.0001"
                      value={distForm.shopLat}
                      onChange={(e) => setDist({ shopLat: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="dist-lng" className={labelCls}>
                      Longitude
                    </label>
                    <input
                      id="dist-lng"
                      type="number"
                      inputMode="decimal"
                      step="0.0001"
                      value={distForm.shopLng}
                      onChange={(e) => setDist({ shopLng: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 -mt-3">Customer distances are measured from this point.</p>

                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-3">
                  <div>
                    <label htmlFor="dist-free" className="block text-xs font-black text-emerald-950">
                      Free pickup & delivery radius (KM)
                    </label>
                    <p className="text-[11px] text-emerald-800">Customers within this distance pay ₹0 for pickup & delivery.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id="dist-free"
                      type="number"
                      inputMode="decimal"
                      min={0.5}
                      max={100}
                      step={0.5}
                      value={distForm.freeRadiusKm}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setDist({ freeRadiusKm: e.target.value })}
                      className="w-28 min-h-[40px] px-3 rounded-xl border border-emerald-300 bg-white text-base font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {[5, 8, 10, 12, 15].map((km) => (
                      <button
                        key={km}
                        type="button"
                        onClick={() => setDist({ freeRadiusKm: String(km) })}
                        className={`min-h-[40px] text-xs font-bold px-3 rounded-xl border transition-all ${
                          num(distForm.freeRadiusKm) === km
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-line hover:bg-emerald-100 hover:text-emerald-900'
                        }`}
                      >
                        {km} KM
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className={labelCls}>Charge beyond the free radius</span>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Charge method">
                    {[
                      { id: 'PER_KM' as const, label: 'Per KM rate' },
                      { id: 'SLAB' as const, label: 'Distance slabs' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={distForm.pricingMethod === m.id}
                        onClick={() => setDist({ pricingMethod: m.id })}
                        className={`min-h-[40px] rounded-xl text-xs font-bold border ${
                          distForm.pricingMethod === m.id
                            ? 'bg-ink text-white border-ink'
                            : 'bg-paper text-slate-700 border-line hover:bg-slate-100'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="dist-rate" className={labelCls}>
                      Rate per extra KM (₹)
                    </label>
                    <input
                      id="dist-rate"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={distForm.perKmRateBeyondFree}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setDist({ perKmRateBeyondFree: e.target.value })}
                      className={inputCls}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      {distForm.pricingMethod === 'SLAB'
                        ? 'Used only for distances not covered by a slab.'
                        : 'Charged for each KM beyond the free radius.'}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="dist-max" className={labelCls}>
                      Max service radius (KM)
                    </label>
                    <input
                      id="dist-max"
                      type="number"
                      inputMode="decimal"
                      min={1}
                      value={distForm.maxServiceDistanceKm}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setDist({ maxServiceDistanceKm: e.target.value })}
                      className={inputCls}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">For reference — bookings beyond it are not blocked.</p>
                  </div>
                </div>

                {distForm.pricingMethod === 'SLAB' && (
                  <div className="space-y-2 pt-3 border-t border-line">
                    <p className="text-xs font-bold text-slate-700">Distance slabs (flat charge per slab)</p>
                    <div className="flex items-center justify-between p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs">
                      <span className="font-semibold text-emerald-900">0 – {distForm.freeRadiusKm || '?'} KM</span>
                      <span className="font-bold text-emerald-700">Free</span>
                    </div>
                    {distForm.slabs.map((slab, i) => {
                      const prev = i === 0 ? num(distForm.freeRadiusKm) : num(distForm.slabs[i - 1].maxKm);
                      return (
                        <div key={i} className="flex flex-wrap items-end gap-2 p-2.5 bg-paper rounded-xl border border-line text-xs">
                          <span className="font-semibold text-slate-600 min-w-[80px] pb-2.5">
                            From {Number.isFinite(prev) ? +(prev + 0.1).toFixed(1) : '?'} KM
                          </span>
                          <label className="flex-1 min-w-[90px]">
                            <span className="block text-[11px] text-slate-500 mb-0.5">Up to (KM)</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={slab.maxKm}
                              onChange={(e) =>
                                setDist({ slabs: distForm.slabs.map((s, j) => (j === i ? { ...s, maxKm: e.target.value } : s)) })
                              }
                              className={inputCls}
                            />
                          </label>
                          <label className="flex-1 min-w-[90px]">
                            <span className="block text-[11px] text-slate-500 mb-0.5">Charge (₹)</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={slab.price}
                              onChange={(e) =>
                                setDist({ slabs: distForm.slabs.map((s, j) => (j === i ? { ...s, price: e.target.value } : s)) })
                              }
                              className={inputCls}
                            />
                          </label>
                          <button
                            type="button"
                            aria-label={`Remove slab ${i + 2}`}
                            onClick={() => setDist({ slabs: distForm.slabs.filter((_, j) => j !== i) })}
                            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-[40px]"
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={() => {
                        const last = distForm.slabs.length
                          ? num(distForm.slabs[distForm.slabs.length - 1].maxKm)
                          : num(distForm.freeRadiusKm);
                        setDist({
                          slabs: [...distForm.slabs, { maxKm: Number.isFinite(last) ? String(last + 5) : '', price: '' }],
                        });
                      }}
                    >
                      Add slab
                    </Button>
                  </div>
                )}

                {distParsed.error && distDirty && (
                  <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {distParsed.error}
                  </p>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-3 border-t border-line/70">
                  {distDirty && (
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      className="min-h-[40px]"
                      onClick={() => setDistForm(toDistForm(distanceConfig))}
                    >
                      Discard changes
                    </Button>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    className="min-h-[40px]"
                    isLoading={isSavingDist}
                    disabled={!distDirty || !!distParsed.error}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    {distDirty ? 'Save delivery settings' : 'Saved'}
                  </Button>
                </div>
              </form>

              {/* Charge preview */}
              <div className="bg-ink text-white p-5 sm:p-6 rounded-2xl border border-white/10 shadow-lg space-y-4 self-start">
                <div>
                  <h3 className="text-sm font-bold text-emerald-400">Delivery charge preview</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    What a customer at this distance would pay for pickup & delivery
                    {distDirty ? ' with the values in the form (not saved yet)' : ' with the saved settings'}.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="dist-sim">Customer distance</label>
                    <span className="font-bold text-white text-sm">{calcDistInput} KM</span>
                  </div>
                  <input
                    id="dist-sim"
                    type="range"
                    min="0.5"
                    max={sliderMax}
                    step="0.5"
                    value={Math.min(calcDistInput, sliderMax)}
                    onChange={(e) => setCalcDistInput(parseFloat(e.target.value))}
                    className="w-full h-10 accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>0 KM</span>
                    <span className="text-emerald-400 font-bold">{previewConfig.freeRadiusKm} KM free</span>
                    <span>{sliderMax} KM</span>
                  </div>
                </div>

                <div className="p-4 bg-ink/80 rounded-2xl border border-white/10 text-xs space-y-2.5">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">Free radius</span>
                    <span className="font-bold text-emerald-400">{previewConfig.freeRadiusKm} KM</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">Beyond the free radius</span>
                    <span className="font-bold text-amber-400">{preview.chargeableKm} KM</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">Worked out with</span>
                    <span className="font-bold text-slate-200 text-right">
                      {preview.chargeableKm === 0
                        ? 'Within free radius'
                        : preview.viaSlab
                        ? 'Distance slab'
                        : `${formatINR(previewConfig.perKmRateBeyondFree)} × ${preview.chargeableKm} KM`}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-white/10 flex justify-between items-baseline gap-3">
                    <span className="text-sm font-extrabold">Pickup & delivery charge</span>
                    <span className="text-emerald-400 font-mono text-lg font-extrabold">
                      {preview.charge === 0 ? 'Free' : formatINR(preview.charge)}
                    </span>
                  </div>
                </div>
                {calcDistInput > (previewConfig.maxServiceDistanceKm || Infinity) && (
                  <p className="text-[11px] text-amber-300">This is beyond your max service radius.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STRINGING (GETTING) PACKAGES                                       */}
        {/* ------------------------------------------------------------------ */}
        {adminSubView === 'getting_config' && (
          <div className="space-y-6 animate-in fade-in">
            {pageHeader(
              'Stringing Packages',
              'Prices, turnaround and inclusions shown to customers when they book stringing. Changes apply to new bookings immediately.',
              <Button
                onClick={() => {
                  setGetFormName('');
                  setGetFormPrice('');
                  setGetFormTurnaround('');
                  setGetFormDesc('');
                  setGetFormFeatures('');
                  setAddGettingModalOpen(true);
                }}
                variant="primary"
                size="sm"
                className="min-h-[40px]"
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add package
              </Button>
            )}

            {gettingServices.length === 0 && (
              <p className={`${cardCls} p-8 text-center text-sm text-slate-500`}>No stringing packages yet.</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gettingServices.map((item) => (
                <div key={item.id} className={`${cardCls} p-5 space-y-3 flex flex-col justify-between`}>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-base text-slate-900">{item.name}</h3>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Turnaround: <b>{item.turnaround || '—'}</b>
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xl font-black text-ink">{formatINR(item.price)}</span>
                        {item.isActive === false && (
                          <span className="block text-[10px] text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded mt-0.5">
                            Hidden from customers
                          </span>
                        )}
                      </div>
                    </div>
                    {item.description && <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>}
                    {item.features.length > 0 && (
                      <div className="p-2.5 bg-paper rounded-xl text-xs space-y-1">
                        {item.features.map((f, i) => (
                          <p key={i} className="text-slate-700 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> {f}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-line/70 flex justify-end">
                    <Button
                      onClick={() => {
                        setEditingGettingItem(item);
                        setGetFormName(item.name);
                        setGetFormPrice(item.price);
                        setGetFormTurnaround(item.turnaround);
                        setGetFormDesc(item.description);
                        setGetFormFeatures(item.features.join(', '));
                      }}
                      variant="outline"
                      size="sm"
                      className="text-xs font-bold min-h-[40px]"
                      leftIcon={<Edit3 className="w-3.5 h-3.5 text-ink" />}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* REPAIR CATEGORIES                                                  */}
        {/* ------------------------------------------------------------------ */}
        {adminSubView === 'repair_config' && (
          <div className="space-y-6 animate-in fade-in">
            {pageHeader(
              'Repair Categories',
              'Starting prices and SLA days per repair type. The final repair price is set by the estimate after inspection.',
              <Button
                onClick={() => {
                  setRepFormName('');
                  setRepFormBasePrice('');
                  setRepFormSlaDays(7);
                  setRepFormTurnaround('');
                  setRepFormDesc('');
                  setAddRepairModalOpen(true);
                }}
                variant="primary"
                size="sm"
                className="min-h-[40px]"
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add category
              </Button>
            )}

            {repairCategories.length === 0 && (
              <p className={`${cardCls} p-8 text-center text-sm text-slate-500`}>No repair categories yet.</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {repairCategories.map((cat) => (
                <div key={cat.id} className={`${cardCls} p-5 space-y-3 flex flex-col justify-between`}>
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-base text-slate-900">{cat.name}</h3>
                        <span className="text-[11px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                          SLA: {pluralDays(cat.slaDays)}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xl font-black text-slate-900">{formatINR(cat.basePrice)}</span>
                        <span className="block text-[10px] text-slate-500 font-semibold">Starting price</span>
                      </div>
                    </div>
                    {cat.description && <p className="text-xs text-slate-600 leading-relaxed">{cat.description}</p>}
                    <div className="text-[11px] text-slate-500">
                      Typical turnaround shown to customers: <b>{cat.turnaround || '—'}</b>
                    </div>
                    {cat.isActive === false && (
                      <span className="inline-block text-[10px] text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded">
                        Hidden from customers
                      </span>
                    )}
                  </div>

                  <div className="pt-3 border-t border-line/70 flex justify-end">
                    <Button
                      onClick={() => {
                        setEditingRepairItem(cat);
                        setRepFormName(cat.name);
                        setRepFormBasePrice(cat.basePrice);
                        setRepFormSlaDays(cat.slaDays);
                        setRepFormTurnaround(cat.turnaround);
                        setRepFormDesc(cat.description);
                      }}
                      variant="outline"
                      size="sm"
                      className="text-xs font-bold min-h-[40px]"
                      leftIcon={<Edit3 className="w-3.5 h-3.5 text-ink" />}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WEBSITE CONTENT (banners, strings & stock, reviews, documents, availability) */}
        {adminSubView === 'website_content' && <WebsiteContentPanel />}

        {/* ------------------------------------------------------------------ */}
        {/* PAYMENTS                                                           */}
        {/* ------------------------------------------------------------------ */}
        {adminSubView === 'payments' && (
          <div className="space-y-6 animate-in fade-in">
            {pageHeader(
              'Payments',
              'Cash and UPI payments are collected in person when the racket is delivered and recorded by staff in the staff app.',
              <Button
                onClick={exportPaymentsCsv}
                variant="outline"
                size="sm"
                className="min-h-[40px]"
                leftIcon={<Download className="w-4 h-4" />}
              >
                Export payments (CSV)
              </Button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-2xl border border-line shadow-2xs">
                <p className="text-xs font-semibold text-slate-500">Collected</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">{formatINR(totalCollected)}</p>
                <p className="text-[11px] text-slate-500 mt-1">{paidRequests.length} paid</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-line shadow-2xs">
                <p className="text-xs font-semibold text-slate-500">To be collected</p>
                <p className="text-2xl font-black text-amber-600 mt-1">{formatINR(pendingCollection)}</p>
                <p className="text-[11px] text-slate-500 mt-1">{unpaidRequests.length} unpaid (excludes cancelled)</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-line shadow-2xs">
                <p className="text-xs font-semibold text-slate-500">Collected by method</p>
                <p className="text-sm font-bold text-slate-900 mt-2">
                  {(['Cash', 'UPI', 'Other'] as const)
                    .map((m) => {
                      const sum = paidRequests
                        .filter((r) => r.paymentRecord?.method === m)
                        .reduce((a, r) => a + (r.paymentRecord?.amount || 0), 0);
                      return sum > 0 ? `${m} ${formatINR(sum)}` : null;
                    })
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </p>
              </div>
            </div>

            <div className="flex gap-1.5" role="tablist" aria-label="Filter payments">
              {[
                { id: 'ALL' as const, label: `All (${requests.length})` },
                { id: 'UNPAID' as const, label: `Unpaid (${unpaidRequests.length})` },
                { id: 'PAID' as const, label: `Paid (${paidRequests.length})` },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={payFilter === t.id}
                  onClick={() => setPayFilter(t.id)}
                  className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold border ${
                    payFilter === t.id ? 'bg-ink text-white border-ink' : 'bg-white text-slate-700 border-line hover:bg-paper'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className={`${cardCls} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-paper border-b border-line text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className={thCls}>Request</th>
                      <th className={thCls}>Customer</th>
                      <th className={thCls}>Amount</th>
                      <th className={thCls}>Payment</th>
                      <th className={thCls}>Method</th>
                      <th className={thCls}>Collected by</th>
                      <th className={thCls}>Collected on</th>
                      <th className={thCls}>Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {(() => {
                      const rows =
                        payFilter === 'PAID' ? paidRequests : payFilter === 'UNPAID' ? unpaidRequests : requests;
                      if (rows.length === 0) return emptyRow(8, 'No payments to show.');
                      return rows.map((r) => (
                        <tr key={r.id} className="hover:bg-paper/70">
                          <td className={tdCls}>
                            <button
                              type="button"
                              onClick={() => setDetailRequestId(r.id)}
                              className="block -my-2 py-2 font-mono font-bold text-ink hover:underline whitespace-nowrap text-left"
                            >
                              {r.id}
                            </button>
                            <p className="mt-0.5 text-[11px] text-slate-500 whitespace-nowrap">{r.status}</p>
                          </td>
                          <td className={`${tdCls} font-bold text-slate-900`}>{r.customerName}</td>
                          <td className={`${tdCls} font-black text-slate-900 whitespace-nowrap`}>
                            {r.paymentRecord ? formatINR(r.paymentRecord.amount) : amountText(r)}
                          </td>
                          <td className={tdCls}>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
                                r.paymentStatus === 'Paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.status === 'Cancelled'
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {paymentText(r)}
                            </span>
                          </td>
                          <td className={`${tdCls} font-semibold text-slate-700 whitespace-nowrap`}>
                            {r.paymentRecord?.method || (r.paymentStatus === 'Paid' ? '—' : 'On delivery')}
                          </td>
                          <td className={`${tdCls} text-slate-600`}>{r.paymentRecord?.collectedBy || '—'}</td>
                          <td className={`${tdCls} text-slate-600 whitespace-nowrap`}>
                            {r.paymentRecord ? formatDateTime(r.paymentRecord.collectedAt) : '—'}
                          </td>
                          <td className={`${tdCls} text-slate-500`}>{r.paymentRecord?.transactionNotes || '—'}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* REPORTS & ACTIVITY                                                 */}
        {/* ------------------------------------------------------------------ */}
        {adminSubView === 'reports' && (
          <div className="space-y-6 animate-in fade-in">
            {pageHeader(
              'Reports & Activity',
              'Website visitors, customer activity, service request exports and the admin activity log.',
              <>
                <Button
                  onClick={() => window.print()}
                  variant="outline"
                  size="sm"
                  className="min-h-[40px]"
                  leftIcon={<Printer className="w-4 h-4" />}
                >
                  Print / Save PDF
                </Button>
                <Button
                  onClick={() => exportRequestsCsv(requests)}
                  variant="primary"
                  size="sm"
                  className="min-h-[40px]"
                  leftIcon={<Download className="w-4 h-4" />}
                >
                  Export service requests (CSV)
                </Button>
              </>
            )}

            <VisitorReports />

            {/* Activity log (audit trail recorded by the server) */}
            <div className={`${cardCls} overflow-hidden`}>
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Activity log</h3>
                  <p className="text-xs text-slate-500">
                    Changes made by staff and admins (prices, assignments, status changes, payments, accounts, downloads).
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 min-h-[40px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSignIns}
                    onChange={(e) => setShowSignIns(e.target.checked)}
                    className="w-4 h-4 accent-ink"
                  />
                  Show sign-ins
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-paper border-y border-line text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className={thCls}>When</th>
                      <th className={thCls}>Who</th>
                      <th className={thCls}>What</th>
                      <th className={thCls}>Reference</th>
                      <th className={thCls}>Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {visibleActivity.length === 0 && emptyRow(5, 'No activity recorded yet.')}
                    {visibleActivity.slice(0, activityLimit).map((log) => (
                      <tr key={log.id}>
                        <td className={`${tdCls} whitespace-nowrap text-slate-600`}>{formatDateTime(log.timestamp)}</td>
                        <td className={tdCls}>
                          <p className="font-semibold text-slate-900">{log.user}</p>
                          <p className="text-[10px] text-slate-500">{log.role === 'ADMIN' ? 'Admin' : log.role === 'EMPLOYEE' ? 'Staff' : 'Customer'}</p>
                        </td>
                        <td className={`${tdCls} text-slate-800`}>{prettyLogText(log.action)}</td>
                        <td className={`${tdCls} font-mono text-slate-600 whitespace-nowrap`}>
                          {requests.some((r) => r.id === log.requestId) ? (
                            <button
                              type="button"
                              onClick={() => setDetailRequestId(log.requestId)}
                              className="text-ink font-bold hover:underline min-h-[40px]"
                            >
                              {log.requestId}
                            </button>
                          ) : (
                            log.requestId || '—'
                          )}
                        </td>
                        <td className={`${tdCls} text-slate-500`}>{log.details ? prettyLogText(log.details) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {visibleActivity.length > activityLimit && (
                <div className="p-3 border-t border-line/70 text-center print:hidden">
                  <button
                    type="button"
                    onClick={() => setActivityLimit((n) => n + 50)}
                    className="min-h-[40px] px-4 text-xs font-bold text-ink hover:underline"
                  >
                    Show more ({visibleActivity.length - activityLimit} older)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* SHOP SETTINGS                                                      */}
        {/* ------------------------------------------------------------------ */}
        {adminSubView === 'customers' && (
          <CustomersPanel
            onOpenRequest={(id) => setDetailRequestId(id)}
            onNewBooking={(prefill) => setNewBooking(prefill || {})}
            refreshKey={customersRefresh}
          />
        )}

        {adminSubView === 'settings' && (
          <div className="space-y-6 animate-in fade-in max-w-3xl">
            {pageHeader('Shop Settings', 'Edit the shop details, and find where every other setting is managed.')}

            <ShopSettingsForm />

            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider pt-2">Other settings</p>

            <div className={`${cardCls} divide-y divide-line/70`}>
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Workshop location & delivery</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{distanceConfig.shopLocationName}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Free pickup & delivery within {distanceConfig.freeRadiusKm} KM ·{' '}
                    {distanceConfig.pricingMethod === 'SLAB'
                      ? 'distance slabs beyond'
                      : `${formatINR(distanceConfig.perKmRateBeyondFree)}/KM beyond`}
                  </p>
                </div>
                <Button onClick={() => goTo('distance')} variant="outline" size="sm" className="min-h-[40px] shrink-0">
                  Edit delivery settings
                </Button>
              </div>

              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prices</p>
                  <p className="text-sm text-slate-900 mt-1">
                    {gettingServices.length} stringing packages · {repairCategories.length} repair categories
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => goTo('getting_config')} variant="outline" size="sm" className="min-h-[40px]">
                    Stringing packages
                  </Button>
                  <Button onClick={() => goTo('repair_config')} variant="outline" size="sm" className="min-h-[40px]">
                    Repair categories
                  </Button>
                </div>
              </div>

              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Website content & pickup days</p>
                  <p className="text-sm text-slate-900 mt-1">Banners, strings & stock, rackets, reviews, documents and pickup availability.</p>
                </div>
                <Button onClick={() => goTo('website_content')} variant="outline" size="sm" className="min-h-[40px] shrink-0">
                  Website content
                </Button>
              </div>

              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Staff accounts</p>
                  <p className="text-sm text-slate-900 mt-1">{activeEmployees.length} active staff and admin accounts.</p>
                </div>
                <Button onClick={() => goTo('team')} variant="outline" size="sm" className="min-h-[40px] shrink-0">
                  Manage staff
                </Button>
              </div>

              <div className="p-5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payments</p>
                <p className="text-sm text-slate-900 mt-1">
                  No online payments. Customers pay in person by cash or UPI when the racket is delivered; staff record each payment.
                </p>
              </div>

              <div className="p-5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Signed in as</p>
                <p className="text-sm text-slate-900 mt-1">
                  {userName || 'Admin'}
                  {userMobile ? ` · ${formatMobile(userMobile)}` : ''}
                </p>
              </div>
            </div>

          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* STAFF & ADMINS                                                     */}
        {/* ------------------------------------------------------------------ */}
        {adminSubView === 'team' && (
          <div className="space-y-6 animate-in fade-in">
            {pageHeader(
              'Staff & Admins',
              'Create sign-in accounts for stringers, technicians, pickup & delivery staff and admins.'
            )}

            {/* Account Creation Card */}
            <div className={`${cardCls} p-5 sm:p-6 space-y-4`}>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line/70">
                <h3 className="font-bold text-base text-slate-900">Create account</h3>
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold" role="radiogroup" aria-label="Account type">
                  {[
                    { id: 'EMPLOYEE' as const, label: 'Staff', on: 'bg-ink' },
                    { id: 'ADMIN' as const, label: 'Admin', on: 'bg-purple-600' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={teamUserRole === t.id}
                      onClick={() => setTeamUserRole(t.id)}
                      className={`min-h-[40px] px-4 rounded-lg transition-all ${
                        teamUserRole === t.id ? `${t.on} text-white shadow-xs` : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <form
                noValidate
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (isCreatingMember) return;
                  if (!teamName.trim()) {
                    addToast('error', 'Name required', "Please enter the person's name.");
                    return;
                  }
                  const phone = normalizeMobile(teamPhone);
                  if (!phone) {
                    setTeamPhoneError(INVALID_MOBILE_MESSAGE);
                    return;
                  }
                  if (teamPassword.trim() && teamPassword.trim().length < 8) {
                    addToast('error', 'Password too short', 'Use at least 8 characters, or leave it blank to generate one.');
                    return;
                  }
                  setIsCreatingMember(true);
                  const ok = await addEmployee({
                    name: teamName.trim(),
                    phone,
                    role: (teamUserRole === 'ADMIN' ? 'Platform Admin' : teamRole) as Employee['role'],
                    userRole: teamUserRole,
                    password: teamPassword.trim() || undefined,
                  });
                  setIsCreatingMember(false);
                  if (ok) {
                    setTeamName('');
                    setTeamPhone('');
                    setTeamPhoneError(null);
                    setTeamPassword('');
                  }
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="team-name" className={labelCls}>
                      Full name *
                    </label>
                    <input
                      id="team-name"
                      type="text"
                      required
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="e.g. Suresh Nair"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label htmlFor="team-mobile" className={labelCls}>
                      Mobile number * <span className="font-medium text-slate-400">(used to sign in)</span>
                    </label>
                    <MobileInput
                      id="team-mobile"
                      name="team-mobile"
                      value={teamPhone}
                      onChange={(v) => {
                        setTeamPhone(v);
                        setTeamPhoneError(null);
                      }}
                      required
                      aria-invalid={!!teamPhoneError}
                      aria-describedby={teamPhoneError ? 'team-mobile-error' : undefined}
                    />
                    {teamPhoneError && (
                      <p id="team-mobile-error" className="text-[11px] text-rose-600 mt-1">
                        {teamPhoneError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {teamUserRole === 'EMPLOYEE' ? (
                    <div>
                      <label htmlFor="team-role" className={labelCls}>
                        Job *
                      </label>
                      <select
                        id="team-role"
                        value={teamRole}
                        onChange={(e) => setTeamRole(e.target.value as typeof teamRole)}
                        className={inputCls}
                      >
                        <option value="Technician">Technician (repairs)</option>
                        <option value="Pickup & Delivery Agent">Pickup & Delivery Agent</option>
                        <option value="Master Stringer">Master Stringer (stringing)</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <span className={labelCls}>Access</span>
                      <p className="min-h-[40px] flex items-center px-3 rounded-xl border border-purple-200 bg-purple-50 text-xs text-purple-800 font-semibold">
                        Full admin access (prices, staff, reports)
                      </p>
                    </div>
                  )}

                  <div>
                    <label htmlFor="team-password" className={labelCls}>
                      Password
                    </label>
                    <input
                      id="team-password"
                      type="text"
                      autoComplete="off"
                      value={teamPassword}
                      onChange={(e) => setTeamPassword(e.target.value)}
                      placeholder="Leave blank to generate one"
                      aria-describedby="team-password-help"
                      className={inputCls}
                    />
                    <p id="team-password-help" className="text-[11px] text-slate-500 mt-1">
                      At least 8 characters if you set one.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-line/70">
                  <span className="text-[11px] text-slate-500 flex items-start gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-ink shrink-0 mt-0.5" />
                    <span>
                      They sign in with this mobile number and password. Nothing is sent automatically — a generated password is
                      shown once after creation; hand it over in person.
                    </span>
                  </span>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isCreatingMember}
                    className={`shrink-0 min-h-[40px] ${teamUserRole === 'ADMIN' ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    {teamUserRole === 'ADMIN' ? 'Create admin' : 'Create staff account'}
                  </Button>
                </div>
              </form>
            </div>

            {/* Team Members List */}
            <div className={`${cardCls} overflow-hidden`}>
              <div className="p-5 sm:p-6 pb-3">
                <h3 className="font-bold text-base text-slate-900">Active accounts ({activeEmployees.length})</h3>
                <p className="text-xs text-slate-500">Open jobs = assigned requests that are not completed or cancelled.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-paper text-slate-600 uppercase tracking-wider border-y border-line text-[10px] font-bold">
                    <tr>
                      <th className={thCls}>Name</th>
                      <th className={thCls}>Job</th>
                      <th className={thCls}>Access</th>
                      <th className={thCls}>Mobile (sign-in)</th>
                      <th className={thCls}>Open jobs</th>
                      <th className={`${thCls} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {activeEmployees.length === 0 && emptyRow(6, 'No staff accounts yet.')}
                    {activeEmployees.map((emp) => {
                      const isSelf = !!userMobile && normalizeMobile(emp.phone) === normalizeMobile(userMobile);
                      const openJobs = openJobsFor(emp.id);
                      return (
                        <tr key={emp.id} className="hover:bg-paper/80 transition-colors">
                          <td className={tdCls}>
                            <div className="flex items-center gap-2.5">
                              <span
                                aria-hidden="true"
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${
                                  emp.userRole === 'ADMIN' ? 'bg-purple-600' : 'bg-ink'
                                }`}
                              >
                                {initials(emp.name)}
                              </span>
                              <div>
                                <p className="font-bold text-slate-900">
                                  {emp.name}
                                  {isSelf && <span className="ml-1.5 text-[10px] font-bold text-slate-500">(you)</span>}
                                </p>
                                <p className="text-[10px] text-slate-500 font-mono">{emp.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className={`${tdCls} font-medium text-slate-700`}>{emp.role}</td>
                          <td className={tdCls}>
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                emp.userRole === 'ADMIN'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-paper-deep text-ink border border-line'
                              }`}
                            >
                              {emp.userRole === 'ADMIN' ? 'Admin' : 'Staff'}
                            </span>
                          </td>
                          <td className={`${tdCls} text-slate-600 whitespace-nowrap`}>
                            {mobileTelHref(emp.phone) ? (
                              <a href={mobileTelHref(emp.phone)} className="hover:underline">
                                {formatMobile(emp.phone)}
                              </a>
                            ) : (
                              formatMobile(emp.phone) || '—'
                            )}
                          </td>
                          <td className={tdCls}>
                            <span className={openJobs > 0 ? 'font-bold text-slate-900' : 'text-slate-500'}>{openJobs}</span>
                          </td>
                          <td className={`${tdCls} text-right`}>
                            <div className="-my-2 flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmState({
                                    title: `Reset ${emp.name}'s password?`,
                                    message: (
                                      <>
                                        A new temporary password will be shown once. Their current password stops working
                                        immediately — hand the new one over in person.
                                      </>
                                    ),
                                    confirmLabel: 'Reset password',
                                    onConfirm: () => resetStaffPassword(emp.id, emp.name),
                                  })
                                }
                                className="min-h-[40px] px-3 rounded-lg text-ink hover:bg-paper font-bold text-[11px]"
                              >
                                Reset password
                              </button>
                            )}
                            {isSelf ? (
                              <span className="text-[11px] text-slate-400">—</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmState({
                                    title: `Deactivate ${emp.name}?`,
                                    message: (
                                      <>
                                        {emp.name} will no longer be able to sign in with <span className="whitespace-nowrap">{formatMobile(emp.phone)}</span>.
                                        {openJobs > 0 && (
                                          <>
                                            {' '}
                                            They still have <b>{openJobs} open {openJobs === 1 ? 'job' : 'jobs'}</b> — reassign
                                            them from Service Requests.
                                          </>
                                        )}
                                      </>
                                    ),
                                    confirmLabel: 'Deactivate',
                                    danger: true,
                                    onConfirm: () => removeEmployee(emp.id),
                                  })
                                }
                                className="min-h-[40px] px-3 rounded-lg text-red-700 hover:bg-red-50 font-bold text-[11px]"
                              >
                                Deactivate
                              </button>
                            )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ==================================================================== */}
      {/* MODAL: ASSIGN STAFF                                                   */}
      {/* ==================================================================== */}
      {assignRequest && (
        <div
          onClick={() => setAssignModalReqId(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto flex flex-col max-h-[calc(100vh-2rem)] animate-in zoom-in-95"
          >
            <div className="shrink-0 flex items-start justify-between gap-3">
              <div>
                <h3 id="assign-title" className="font-bold text-base text-slate-900">
                  {assignRequest.assignedEmployeeId ? 'Reassign staff' : 'Assign staff'}
                </h3>
                <p className="text-xs text-slate-500">
                  {assignRequest.id} · {assignRequest.customerName} · {serviceLabel(assignRequest)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setAssignModalReqId(null)}
                className="w-10 h-10 -mr-2 -mt-2 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 overflow-y-auto" role="radiogroup" aria-label="Staff member">
              {activeEmployees.length === 0 && (
                <p className="text-sm text-slate-500 py-4 text-center">No active staff. Create accounts under Staff & Admins.</p>
              )}
              {activeEmployees.map((emp) => {
                const openJobs = openJobsFor(emp.id);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    role="radio"
                    aria-checked={selectedEmpId === emp.id}
                    onClick={() => setSelectedEmpId(emp.id)}
                    className={`w-full p-3 rounded-2xl border-2 flex items-center justify-between gap-3 text-left text-xs ${
                      selectedEmpId === emp.id ? 'border-ink bg-paper' : 'border-line hover:bg-paper'
                    }`}
                  >
                    <span>
                      <span className="block font-bold text-slate-900">
                        {emp.name}
                        {assignRequest.assignedEmployeeId === emp.id && (
                          <span className="ml-1.5 text-[10px] text-ink">(currently assigned)</span>
                        )}
                      </span>
                      <span className="block text-slate-500 text-[11px]">
                        {emp.role}
                        {emp.userRole === 'ADMIN' ? ' · Admin' : ''}
                      </span>
                    </span>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-700 whitespace-nowrap">
                      {openJobs} open {openJobs === 1 ? 'job' : 'jobs'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2 shrink-0">
              <Button onClick={() => setAssignModalReqId(null)} variant="outline" className="flex-1 min-h-[40px]" size="sm">
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!selectedEmpId) return;
                  setIsAssigning(true);
                  const ok = await assignEmployee(assignRequest.id, selectedEmpId);
                  setIsAssigning(false);
                  if (ok) setAssignModalReqId(null);
                }}
                disabled={!selectedEmpId || selectedEmpId === assignRequest.assignedEmployeeId}
                isLoading={isAssigning}
                variant="primary"
                className="flex-1 min-h-[40px]"
                size="sm"
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      <NewBookingDialog
        open={newBooking !== null}
        prefill={newBooking}
        onClose={() => setNewBooking(null)}
        onCreated={(saved) => {
          setNewBooking(null);
          setCustomersRefresh((n) => n + 1);
          addToast('success', 'Booking created', `${saved.id} for ${saved.customerName} · ${formatMobile(saved.customerMobile)}`);
          setDetailRequestId(saved.id);
        }}
      />

      {/* ==================================================================== */}
      {/* MODAL: REQUEST DETAIL                                                 */}
      {/* ==================================================================== */}
      {detailRequest && (
        <div
          onClick={() => setDetailRequestId(null)}
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl my-auto flex flex-col max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] animate-in zoom-in-95"
          >
            <div className="flex justify-between items-start gap-3 p-4 sm:p-6 pb-3 border-b border-line/70 shrink-0">
              <div className="min-w-0">
                <h3 id="detail-title" className="text-lg font-bold text-slate-900 flex flex-wrap items-center gap-2">
                  <span className="font-mono">{detailRequest.id}</span>
                  <StatusBadge status={detailRequest.status} size="sm" />
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {serviceLabel(detailRequest)} · {detailRequest.batBrand} {detailRequest.batModel} · Booked{' '}
                  {formatDateTime(detailRequest.createdAt)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setDetailRequestId(null)}
                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-paper rounded-xl space-y-1">
                  <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Customer</p>
                  <p className="font-bold text-slate-900 text-sm">{detailRequest.customerName}</p>
                  {mobileTelHref(detailRequest.customerMobile) ? (
                    <a
                      href={mobileTelHref(detailRequest.customerMobile)}
                      className="inline-flex items-center gap-1 text-ink font-semibold hover:underline min-h-[40px]"
                    >
                      <Phone className="w-3.5 h-3.5" /> {formatMobile(detailRequest.customerMobile)}
                    </a>
                  ) : (
                    <p className="text-slate-600">{formatMobile(detailRequest.customerMobile) || '—'}</p>
                  )}
                </div>

                <div className="p-3 bg-paper rounded-xl space-y-1">
                  <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Pickup address</p>
                  <p className="text-slate-800">
                    {[
                      detailRequest.pickupAddress?.houseFlat,
                      detailRequest.pickupAddress?.street,
                      detailRequest.pickupAddress?.area,
                      detailRequest.pickupAddress?.city,
                      detailRequest.pickupAddress?.pincode,
                    ]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </p>
                  {detailRequest.pickupAddress?.landmark && (
                    <p className="text-slate-500">Landmark: {detailRequest.pickupAddress.landmark}</p>
                  )}
                  <p className="font-semibold text-slate-700">
                    {detailRequest.distanceKm} KM from the workshop ·{' '}
                    {detailRequest.isFreeDelivery ? (
                      <span className="text-emerald-700">free delivery</span>
                    ) : (
                      `${formatINR(detailRequest.pickupDeliveryCharge)} delivery`
                    )}
                  </p>
                  {detailRequest.pickupAddress?.distanceSource && (
                    <p className="text-slate-500">
                      Distance{' '}
                      {DISTANCE_SOURCE_TEXT[detailRequest.pickupAddress.distanceSource] || detailRequest.pickupAddress.distanceSource}
                    </p>
                  )}
                  {detailRequest.paymentStatus !== 'Paid' && detailRequest.status !== 'Cancelled' && !distanceFix && (
                    <button
                      type="button"
                      onClick={() => {
                        setDistanceFixError(null);
                        setDistanceFix({ km: String(detailRequest.distanceKm ?? ''), reason: '' });
                      }}
                      className="mt-1 inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-100"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Correct distance
                    </button>
                  )}
                  {distanceFix && detailRequest.paymentStatus !== 'Paid' && detailRequest.status !== 'Cancelled' && (
                    <form
                      className="mt-2 space-y-2 border-t border-line pt-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const km = Number(distanceFix.km);
                        if (distanceFix.km.trim() === '' || !Number.isFinite(km) || km < 0 || km > 200) {
                          setDistanceFixError('Enter the distance in KM (0–200).');
                          return;
                        }
                        if (distanceFix.reason.trim().length < 3) {
                          setDistanceFixError('Say why the distance is being corrected.');
                          return;
                        }
                        setDistanceFixSaving(true);
                        setDistanceFixError(null);
                        try {
                          const updated = await requestService.correctDistance(
                            detailRequest.id,
                            Math.round(km * 10) / 10,
                            distanceFix.reason.trim()
                          );
                          setDistanceFix(null);
                          addToast(
                            'success',
                            'Distance corrected',
                            `${updated?.id || detailRequest.id}: ${updated?.distanceKm ?? km} KM · total ${formatINR(
                              updated?.totalAmount ?? detailRequest.totalAmount
                            )}`
                          );
                          refreshData();
                        } catch (err: any) {
                          setDistanceFixError(err?.message || 'The distance could not be corrected. Please try again.');
                        } finally {
                          setDistanceFixSaving(false);
                        }
                      }}
                    >
                      <p className="text-[11px] text-slate-500">
                        Recalculates the pickup & delivery charge and the total. The customer sees the new amount.
                      </p>
                      <label className="block text-[11px] font-bold text-slate-600">
                        Distance (KM)
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="200"
                          step="0.1"
                          required
                          value={distanceFix.km}
                          onChange={(e) => setDistanceFix({ ...distanceFix, km: e.target.value })}
                          className="mt-1 w-full min-h-[40px] px-2 rounded-lg border border-slate-300 text-sm font-semibold bg-white"
                        />
                      </label>
                      <label className="block text-[11px] font-bold text-slate-600">
                        Reason
                        <input
                          type="text"
                          maxLength={200}
                          required
                          placeholder="e.g. Checked on Google Maps"
                          value={distanceFix.reason}
                          onChange={(e) => setDistanceFix({ ...distanceFix, reason: e.target.value })}
                          className="mt-1 w-full min-h-[40px] px-2 rounded-lg border border-slate-300 text-sm bg-white"
                        />
                      </label>
                      {distanceFixError && (
                        <p role="alert" className="text-[11px] text-rose-700 flex items-start gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {distanceFixError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDistanceFix(null);
                            setDistanceFixError(null);
                          }}
                          className="flex-1 min-h-[40px] rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={distanceFixSaving}
                          className="flex-1 min-h-[40px] rounded-lg bg-ink text-white text-xs font-bold disabled:opacity-60"
                        >
                          {distanceFixSaving ? 'Saving…' : 'Save distance'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 border border-line rounded-xl space-y-1">
                  <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Racket & service</p>
                  <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
                    <dt className="text-slate-500">Racket</dt>
                    <dd className="font-semibold text-slate-900">
                      {detailRequest.batBrand} {detailRequest.batModel}
                    </dd>
                    {detailRequest.batType && (
                      <>
                        <dt className="text-slate-500">Type</dt>
                        <dd className="text-slate-800">{detailRequest.batType}</dd>
                      </>
                    )}
                    {detailRequest.serviceType === 'GETTING' ? (
                      <>
                        {detailRequest.gettingType && (
                          <>
                            <dt className="text-slate-500">Package</dt>
                            <dd className="text-slate-800">{detailRequest.gettingType}</dd>
                          </>
                        )}
                        {(detailRequest.stringType || detailRequest.stringPreference) && (
                          <>
                            <dt className="text-slate-500">String</dt>
                            <dd className="text-slate-800">{detailRequest.stringType || detailRequest.stringPreference}</dd>
                          </>
                        )}
                        {detailRequest.stringTensionLbs ? (
                          <>
                            <dt className="text-slate-500">Tension</dt>
                            <dd className="text-slate-800">{detailRequest.stringTensionLbs} lbs</dd>
                          </>
                        ) : null}
                        {detailRequest.colour && (
                          <>
                            <dt className="text-slate-500">Colour</dt>
                            <dd className="text-slate-800">{detailRequest.colour}</dd>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <dt className="text-slate-500">Issue</dt>
                        <dd className="text-slate-800">{detailRequest.repairIssue || '—'}</dd>
                        {detailRequest.repairDescription && (
                          <>
                            <dt className="text-slate-500">Details</dt>
                            <dd className="text-slate-800">{detailRequest.repairDescription}</dd>
                          </>
                        )}
                      </>
                    )}
                    <dt className="text-slate-500">Pickup date</dt>
                    <dd className="text-slate-800">{formatDate(detailRequest.pickupDate, 'Not chosen')}</dd>
                  </dl>
                  {detailRequest.additionalNotes && (
                    <p className="text-slate-600 pt-1">
                      <b>Customer note:</b> {detailRequest.additionalNotes}
                    </p>
                  )}
                  {detailPhotos.batPhotos.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {detailPhotos.batPhotos.slice(0, 6).map((src, i) => (
                        <a key={i} href={src} target="_blank" rel="noreferrer" className="block">
                          <img src={src} alt={`Racket photo ${i + 1}`} className="w-14 h-14 rounded-lg object-cover border border-line" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3 border border-line rounded-xl space-y-1">
                  <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Charges & payment</p>
                  <dl className="grid grid-cols-[1fr,auto] gap-x-3 gap-y-1">
                    <dt className="text-slate-500">Service</dt>
                    <dd className="text-right text-slate-800">{formatINR(detailRequest.serviceCharge)}</dd>
                    <dt className="text-slate-500">Pickup & delivery</dt>
                    <dd className="text-right text-slate-800">
                      {detailRequest.isFreeDelivery ? 'Free' : formatINR(detailRequest.pickupDeliveryCharge)}
                    </dd>
                    {detailRequest.discount > 0 && (
                      <>
                        <dt className="text-slate-500">Discount</dt>
                        <dd className="text-right text-emerald-700">-{formatINR(detailRequest.discount)}</dd>
                      </>
                    )}
                    <dt className="font-bold text-slate-900 border-t border-line/70 pt-1">Total</dt>
                    <dd className="text-right font-bold text-slate-900 border-t border-line/70 pt-1">{amountText(detailRequest)}</dd>
                    <dt className="text-slate-500">Payment</dt>
                    <dd className={`text-right font-semibold ${detailRequest.paymentStatus === 'Paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {paymentText(detailRequest)}
                    </dd>
                  </dl>
                  {detailRequest.paymentStatus !== 'Paid' && detailRequest.status !== 'Cancelled' && !paymentForm && (
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentForm({ amount: String(detailRequest.totalAmount || ''), method: 'Cash', notes: '' })
                      }
                      className="mt-2 w-full min-h-[40px] rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 font-bold text-xs hover:bg-emerald-100"
                    >
                      Record payment
                    </button>
                  )}
                  {paymentForm && detailRequest.paymentStatus !== 'Paid' && (
                    <form
                      className="mt-2 space-y-2 border-t border-line/70 pt-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const amount = Number(paymentForm.amount);
                        if (!Number.isFinite(amount) || amount <= 0) {
                          addToast('error', 'Check the amount', 'Enter the amount received in rupees.');
                          return;
                        }
                        setPaymentSaving(true);
                        const ok = await recordManualPayment(
                          detailRequest.id,
                          amount,
                          paymentForm.method,
                          paymentForm.notes.trim() || undefined,
                          userName || 'Admin'
                        );
                        setPaymentSaving(false);
                        if (ok) setPaymentForm(null);
                      }}
                    >
                      <p className="text-[11px] text-slate-500">
                        Marks the request as paid and completed. Recorded as collected by {userName || 'Admin'}.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[11px] font-bold text-slate-600">
                          Amount (₹)
                          <input
                            type="number"
                            inputMode="decimal"
                            min="1"
                            step="any"
                            required
                            value={paymentForm.amount}
                            onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                            className="mt-1 w-full min-h-[40px] px-2 rounded-lg border border-slate-300 text-sm font-semibold"
                          />
                        </label>
                        <label className="text-[11px] font-bold text-slate-600">
                          Method
                          <select
                            value={paymentForm.method}
                            onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })}
                            className="mt-1 w-full min-h-[40px] px-2 rounded-lg border border-slate-300 text-sm bg-white"
                          >
                            <option value="Cash">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="Other">Other</option>
                          </select>
                        </label>
                      </div>
                      <label className="block text-[11px] font-bold text-slate-600">
                        Note (optional, e.g. UPI reference)
                        <input
                          type="text"
                          maxLength={200}
                          value={paymentForm.notes}
                          onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                          className="mt-1 w-full min-h-[40px] px-2 rounded-lg border border-slate-300 text-sm"
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentForm(null)}
                          className="flex-1 min-h-[40px] rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={paymentSaving}
                          className="flex-1 min-h-[40px] rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-60"
                        >
                          {paymentSaving ? 'Saving…' : 'Save payment'}
                        </button>
                      </div>
                    </form>
                  )}
                  {detailRequest.paymentRecord && (
                    <p className="text-slate-600 pt-1">
                      {formatINR(detailRequest.paymentRecord.amount)} by {detailRequest.paymentRecord.method}, collected by{' '}
                      {detailRequest.paymentRecord.collectedBy} on {formatDateTime(detailRequest.paymentRecord.collectedAt)}
                      {detailRequest.paymentRecord.transactionNotes ? ` — ${detailRequest.paymentRecord.transactionNotes}` : ''}
                    </p>
                  )}
                </div>
              </div>

              {detailRequest.repairEstimate && (
                <div className="p-3 border border-amber-200 bg-amber-50/50 rounded-xl space-y-1">
                  <p className="font-bold text-amber-800 uppercase tracking-wider text-[10px]">
                    Repair estimate{detailRequest.repairEstimate.isRevised ? ' (revised)' : ''}
                  </p>
                  <dl className="grid grid-cols-[1fr,auto] gap-x-3 gap-y-1 max-w-sm">
                    <dt className="text-slate-600">Labour</dt>
                    <dd className="text-right">{formatINR(detailRequest.repairEstimate.labourCharge)}</dd>
                    <dt className="text-slate-600">Materials</dt>
                    <dd className="text-right">{formatINR(detailRequest.repairEstimate.materialsCharge)}</dd>
                    {detailRequest.repairEstimate.additionalCharges > 0 && (
                      <>
                        <dt className="text-slate-600">Additional</dt>
                        <dd className="text-right">{formatINR(detailRequest.repairEstimate.additionalCharges)}</dd>
                      </>
                    )}
                    <dt className="text-slate-600">Pickup & delivery</dt>
                    <dd className="text-right">{formatINR(detailRequest.repairEstimate.pickupDeliveryCharge)}</dd>
                    {detailRequest.repairEstimate.discount > 0 && (
                      <>
                        <dt className="text-slate-600">Discount</dt>
                        <dd className="text-right">-{formatINR(detailRequest.repairEstimate.discount)}</dd>
                      </>
                    )}
                    <dt className="font-bold">Estimate total</dt>
                    <dd className="text-right font-bold">{formatINR(detailRequest.repairEstimate.totalEstimate)}</dd>
                  </dl>
                  {detailRequest.status === 'Repair Declined' || detailRequest.status === 'Completed Without Repair' ? (
                    <p className="text-slate-600">
                      Customer declined the estimate. Due on return: pickup & delivery{' '}
                      {formatINR(detailRequest.pickupDeliveryCharge || 0)}
                      {(detailRequest.repairEstimate.declinedRepairFee || 0) > 0
                        ? ` + declined-repair fee ${formatINR(detailRequest.repairEstimate.declinedRepairFee || 0)}`
                        : ''}
                      .
                    </p>
                  ) : null}
                  {detailRequest.repairEstimate.isRevised && detailRequest.repairEstimate.originalEstimate !== undefined && (
                    <p className="text-slate-600">
                      Original estimate {formatINR(detailRequest.repairEstimate.originalEstimate)}
                      {detailRequest.repairEstimate.revisionReason ? ` — ${detailRequest.repairEstimate.revisionReason}` : ''}
                    </p>
                  )}
                  {detailRequest.repairEstimate.expectedCompletionDate && (
                    <p className="text-slate-600">
                      Expected completion: {formatDate(detailRequest.repairEstimate.expectedCompletionDate)}
                    </p>
                  )}
                  {detailRequest.repairEstimate.inspectionNotes && (
                    <p className="text-slate-600">Inspection notes: {detailRequest.repairEstimate.inspectionNotes}</p>
                  )}
                </div>
              )}

              {detailRequest.pickupCondition && (
                <div className="p-3 border border-line rounded-xl space-y-1">
                  <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Condition at pickup</p>
                  <p className="text-slate-800">
                    <b>{detailRequest.pickupCondition.condition}</b>
                    {detailRequest.pickupCondition.notes ? ` — ${detailRequest.pickupCondition.notes}` : ''}
                  </p>
                  <p className="text-slate-500">
                    Collected by {detailRequest.pickupCondition.collectedBy} on{' '}
                    {formatDateTime(detailRequest.pickupCondition.collectedAt)}
                  </p>
                  {detailPhotos.pickupPhotos.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {detailPhotos.pickupPhotos.slice(0, 6).map((src, i) => (
                        <a key={i} href={src} target="_blank" rel="noreferrer" className="block">
                          <img src={src} alt={`Pickup photo ${i + 1}`} className="w-14 h-14 rounded-lg object-cover border border-line" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {detailRequest.review && (
                <div className="p-3 border border-line rounded-xl space-y-1">
                  <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Customer review</p>
                  <p className="text-slate-800">
                    <b>{detailRequest.review.rating} / 5</b>
                    {detailRequest.review.comment ? ` — ${detailRequest.review.comment}` : ''}
                  </p>
                </div>
              )}

              {/* Staff & status actions */}
              <div className="p-3 border border-line bg-paper rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-slate-800">
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">Assigned staff</span>
                    <span className="font-semibold">{detailRequest.assignedEmployeeName || 'Not assigned'}</span>
                  </p>
                  {isOpenRequest(detailRequest) && (
                    <Button
                      onClick={() => openAssign(detailRequest)}
                      variant="outline"
                      size="sm"
                      className="min-h-[40px]"
                      leftIcon={<UserCheck className="w-4 h-4" />}
                    >
                      {detailRequest.assignedEmployeeId ? 'Reassign' : 'Assign staff'}
                    </Button>
                  )}
                </div>

                <div className="border-t border-line pt-3 space-y-2">
                  <label htmlFor="status-override" className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                    Change status
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Staff normally move requests forward in the staff app. Use this to correct a status or cancel a request.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      id="status-override"
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value as RequestStatus | '')}
                      className={`${inputCls} sm:w-56`}
                    >
                      <option value="">Choose new status…</option>
                      {ALL_STATUSES.filter((s) => s !== detailRequest.status).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Note for the timeline (optional)"
                      aria-label="Status note"
                      className={`${inputCls} flex-1`}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      className="min-h-[40px]"
                      disabled={!statusDraft}
                      onClick={() => {
                        if (!statusDraft) return;
                        const target = statusDraft;
                        const reqId = detailRequest.id;
                        setConfirmState({
                          title: `Change ${reqId} to “${target}”?`,
                          message: (
                            <>
                              The customer and staff will be notified and the change is added to the request timeline.
                              {target === 'Completed' && detailRequest.paymentStatus !== 'Paid' && (
                                <> This request is still unpaid — payments are recorded by staff when collected.</>
                              )}
                            </>
                          ),
                          confirmLabel: 'Change status',
                          danger: target === 'Cancelled',
                          onConfirm: async () => {
                            const ok = await updateRequestStatus(reqId, target, actor, statusNote.trim() || undefined);
                            if (ok) {
                              setStatusDraft('');
                              setStatusNote('');
                            }
                          },
                        });
                      }}
                    >
                      Update
                    </Button>
                  </div>
                  {detailRequest.status === 'Submitted' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[40px] text-emerald-700 border-emerald-200"
                      onClick={() => updateRequestStatus(detailRequest.id, 'Accepted', actor, 'Accepted by admin')}
                    >
                      Accept request
                    </Button>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Timeline</p>
                {(detailRequest.timeline || []).length === 0 ? (
                  <p className="text-slate-500">No events yet.</p>
                ) : (
                  <ol className="space-y-2 border-l-2 border-line pl-4">
                    {[...(detailRequest.timeline || [])].reverse().map((ev, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-ink border-2 border-white" />
                        <p className="font-semibold text-slate-900">{ev.label || ev.status}</p>
                        <p className="text-[11px] text-slate-500">
                          {ev.timestamp}
                          {ev.actor ? ` · ${ev.actor}` : ''}
                        </p>
                        {ev.notes && <p className="text-[11px] text-slate-600">{ev.notes}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 sm:px-6 border-t border-line/70 shrink-0">
              <Button onClick={() => setDetailRequestId(null)} variant="primary" size="sm" className="min-h-[40px] px-6">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CONFIRM DIALOG                                                        */}
      {/* ==================================================================== */}
      {confirmState && (
        <div
          onClick={() => !isConfirming && setConfirmState(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95"
          >
            <h3 id="confirm-title" className="font-bold text-base text-slate-900 flex items-start gap-2">
              {confirmState.danger && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
              {confirmState.title}
            </h3>
            <div className="text-sm text-slate-600">{confirmState.message}</div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => setConfirmState(null)}
                variant="outline"
                className="flex-1 min-h-[40px]"
                size="sm"
                disabled={isConfirming}
              >
                Cancel
              </Button>
              <Button
                onClick={runConfirm}
                isLoading={isConfirming}
                variant="primary"
                size="sm"
                className={`flex-1 min-h-[40px] ${confirmState.danger ? 'bg-rose-600 hover:bg-rose-700' : ''}`}
              >
                {confirmState.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT GETTING PACKAGE */}
      {editingGettingItem && (
        <div
          onClick={() => setEditingGettingItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto flex flex-col max-h-[calc(100vh-2rem)] overflow-y-auto animate-in zoom-in-95"
          >
            <div className="flex justify-between items-center pb-2 border-b border-line/70 shrink-0">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-ink" />
                Edit stringing package
              </h3>
              <button
                onClick={() => setEditingGettingItem(null)}
                type="button"
                aria-label="Close"
                className="w-10 h-10 -mr-2 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs overflow-y-auto">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Package name *</label>
                <input
                  type="text"
                  value={getFormName}
                  onChange={(e) => setGetFormName(e.target.value)}
                  className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    value={getFormPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGetFormPrice(val === '' ? '' : parseInt(val, 10) || 0);
                    }}
                    placeholder="e.g. 450"
                    className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-sm font-black text-ink outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Turnaround shown to customers *</label>
                  <input
                    type="text"
                    value={getFormTurnaround}
                    onChange={(e) => setGetFormTurnaround(e.target.value)}
                    placeholder="e.g. 24 Hours / 24–48 Hours"
                    className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={getFormDesc}
                  onChange={(e) => setGetFormDesc(e.target.value)}
                  className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  What's included (comma-separated)
                </label>
                <input
                  type="text"
                  value={getFormFeatures}
                  onChange={(e) => setGetFormFeatures(e.target.value)}
                  placeholder="e.g. String included, grommet check"
                  className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-line/70 shrink-0">
              <Button onClick={() => setEditingGettingItem(null)} variant="outline" className="flex-1 min-h-[40px]" size="sm">
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  const feats = getFormFeatures
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const parsedPrice = typeof getFormPrice === 'number' ? getFormPrice : parseInt(getFormPrice, 10);
                  if (!getFormName.trim() || isNaN(parsedPrice) || parsedPrice <= 0) {
                    addToast('warning', 'Check the package', 'Enter a package name and a price greater than ₹0.');
                    return;
                  }
                  if (isSavingTier) return;
                  setIsSavingTier(true);
                  const ok = await updateGettingService(editingGettingItem.id, {
                    name: getFormName.trim(),
                    price: parsedPrice,
                    turnaround: getFormTurnaround.trim(),
                    description: getFormDesc.trim(),
                    features: feats,
                  });
                  setIsSavingTier(false);
                  if (ok) setEditingGettingItem(null);
                }}
                isLoading={isSavingTier}
                variant="primary"
                className="flex-1 font-bold min-h-[40px]"
                size="sm"
              >
                Save package
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD GETTING PACKAGE */}
      {addGettingModalOpen && (
        <div
          onClick={() => setAddGettingModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto flex flex-col max-h-[calc(100vh-2rem)] overflow-y-auto animate-in zoom-in-95"
          >
            <div className="flex justify-between items-center pb-2 border-b border-line/70 shrink-0">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                Add stringing package
              </h3>
              <button
                onClick={() => setAddGettingModalOpen(false)}
                type="button"
                aria-label="Close"
                className="w-10 h-10 -mr-2 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs overflow-y-auto">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Package name *</label>
                <input
                  type="text"
                  placeholder="e.g. Express Tournament Getting"
                  value={getFormName}
                  onChange={(e) => setGetFormName(e.target.value)}
                  className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 599"
                    value={getFormPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGetFormPrice(val === '' ? '' : parseInt(val, 10) || 0);
                    }}
                    className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-sm font-black text-ink outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Turnaround shown to customers *</label>
                  <input
                    type="text"
                    placeholder="e.g. 12 Hours Express"
                    value={getFormTurnaround}
                    onChange={(e) => setGetFormTurnaround(e.target.value)}
                    className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Who this package suits and which string is used"
                  value={getFormDesc}
                  onChange={(e) => setGetFormDesc(e.target.value)}
                  className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">What's included (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. String included, grommet check"
                  value={getFormFeatures}
                  onChange={(e) => setGetFormFeatures(e.target.value)}
                  className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-line/70 shrink-0">
              <Button onClick={() => setAddGettingModalOpen(false)} variant="outline" className="flex-1 min-h-[40px]" size="sm">
                Cancel
              </Button>
              <Button
                isLoading={isSavingTier}
                onClick={async () => {
                  if (isSavingTier) return;
                  const parsedPrice = typeof getFormPrice === 'number' ? getFormPrice : parseInt(getFormPrice, 10);
                  if (!getFormName.trim() || isNaN(parsedPrice) || parsedPrice <= 0) {
                    addToast('warning', 'Incomplete fields', 'Please enter a package name and a price greater than ₹0.');
                    return;
                  }
                  if (!getFormTurnaround.trim()) {
                    addToast('warning', 'Turnaround required', 'Enter the turnaround customers should expect, e.g. "24 hours".');
                    return;
                  }
                  const feats = getFormFeatures
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  setIsSavingTier(true);
                  const ok = await addGettingService({
                    name: getFormName.trim(),
                    price: parsedPrice,
                    turnaround: getFormTurnaround.trim(),
                    description: getFormDesc.trim(),
                    features: feats,
                  });
                  setIsSavingTier(false);
                  if (!ok) return;
                  setAddGettingModalOpen(false);
                  setGetFormName('');
                  setGetFormPrice(0);
                  setGetFormTurnaround('');
                  setGetFormDesc('');
                  setGetFormFeatures('');
                }}
                variant="primary"
                className="flex-1 font-bold min-h-[40px]"
                size="sm"
              >
                Add package
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT REPAIR CATEGORY */}
      {editingRepairItem && (
        <div
          onClick={() => setEditingRepairItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto flex flex-col max-h-[calc(100vh-2rem)] overflow-y-auto animate-in zoom-in-95"
          >
            <div className="flex justify-between items-center pb-2 border-b border-line/70 shrink-0">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-ink" />
                Edit repair category
              </h3>
              <button
                onClick={() => setEditingRepairItem(null)}
                type="button"
                aria-label="Close"
                className="w-10 h-10 -mr-2 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs overflow-y-auto">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Category name *</label>
                <input
                  type="text"
                  value={repFormName}
                  onChange={(e) => setRepFormName(e.target.value)}
                  className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Starting price (₹) *</label>
                  <input
                    type="number"
                    value={repFormBasePrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRepFormBasePrice(val === '' ? '' : parseInt(val, 10) || 0);
                    }}
                    placeholder="e.g. 300"
                    className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-sm font-black text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SLA (days) *</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={repFormSlaDays}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRepFormSlaDays(val === '' ? '' : parseInt(val, 10) || 7);
                    }}
                    className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-sm font-bold text-amber-700 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Turnaround shown to customers *</label>
                <input
                  type="text"
                  value={repFormTurnaround}
                  onChange={(e) => setRepFormTurnaround(e.target.value)}
                  placeholder="e.g. 5–7 Days"
                  className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={repFormDesc}
                  onChange={(e) => setRepFormDesc(e.target.value)}
                  className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-line/70 shrink-0">
              <Button onClick={() => setEditingRepairItem(null)} variant="outline" className="flex-1 min-h-[40px]" size="sm">
                Cancel
              </Button>
              <Button
                isLoading={isSavingTier}
                onClick={async () => {
                  if (isSavingTier) return;
                  const parsedBase = typeof repFormBasePrice === 'number' ? repFormBasePrice : parseInt(repFormBasePrice, 10);
                  const parsedSla = typeof repFormSlaDays === 'number' ? repFormSlaDays : parseInt(repFormSlaDays, 10);
                  if (!repFormName.trim() || isNaN(parsedBase) || parsedBase <= 0) {
                    addToast('warning', 'Check the category', 'Enter a category name and a starting price greater than ₹0.');
                    return;
                  }
                  if (isNaN(parsedSla) || parsedSla < 1 || parsedSla > 60) {
                    addToast('warning', 'Check the SLA', 'SLA days must be between 1 and 60.');
                    return;
                  }
                  setIsSavingTier(true);
                  const ok = await updateRepairCategory(editingRepairItem.id, {
                    name: repFormName.trim(),
                    basePrice: parsedBase,
                    slaDays: parsedSla,
                    turnaround: repFormTurnaround.trim(),
                    description: repFormDesc.trim(),
                  });
                  setIsSavingTier(false);
                  if (ok) setEditingRepairItem(null);
                }}
                variant="primary"
                className="flex-1 font-bold min-h-[40px]"
                size="sm"
              >
                Save category
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD REPAIR CATEGORY */}
      {addRepairModalOpen && (
        <div
          onClick={() => setAddRepairModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto flex flex-col max-h-[calc(100vh-2rem)] overflow-y-auto animate-in zoom-in-95"
          >
            <div className="flex justify-between items-center pb-2 border-b border-line/70 shrink-0">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                Add repair category
              </h3>
              <button
                onClick={() => setAddRepairModalOpen(false)}
                type="button"
                aria-label="Close"
                className="w-10 h-10 -mr-2 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs overflow-y-auto">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Category name *</label>
                <input
                  type="text"
                  placeholder="e.g. Cone Replacement & Shaft Balancing"
                  value={repFormName}
                  onChange={(e) => setRepFormName(e.target.value)}
                  className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-xs font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Starting price (₹) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 350"
                    value={repFormBasePrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRepFormBasePrice(val === '' ? '' : parseInt(val, 10) || 0);
                    }}
                    className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-sm font-black text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SLA (days) *</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={repFormSlaDays}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRepFormSlaDays(val === '' ? '' : parseInt(val, 10) || 7);
                    }}
                    className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-sm font-bold text-amber-700 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Turnaround shown to customers *</label>
                <input
                  type="text"
                  placeholder="e.g. 4–6 Days"
                  value={repFormTurnaround}
                  onChange={(e) => setRepFormTurnaround(e.target.value)}
                  className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="What this repair covers"
                  value={repFormDesc}
                  onChange={(e) => setRepFormDesc(e.target.value)}
                  className="w-full min-h-[40px] p-2.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-line/70 shrink-0">
              <Button onClick={() => setAddRepairModalOpen(false)} variant="outline" className="flex-1 min-h-[40px]" size="sm">
                Cancel
              </Button>
              <Button
                isLoading={isSavingTier}
                onClick={async () => {
                  if (isSavingTier) return;
                  const parsedBase = typeof repFormBasePrice === 'number' ? repFormBasePrice : parseInt(repFormBasePrice, 10);
                  const parsedSla = typeof repFormSlaDays === 'number' ? repFormSlaDays : parseInt(repFormSlaDays, 10);
                  if (!repFormName.trim() || isNaN(parsedBase) || parsedBase <= 0) {
                    addToast('warning', 'Incomplete fields', 'Enter a category name and a starting price greater than ₹0.');
                    return;
                  }
                  if (isNaN(parsedSla) || parsedSla < 1 || parsedSla > 60) {
                    addToast('warning', 'Check the SLA', 'SLA days must be between 1 and 60.');
                    return;
                  }
                  if (!repFormTurnaround.trim()) {
                    addToast('warning', 'Turnaround required', 'Enter the turnaround customers should expect, e.g. "4–6 days".');
                    return;
                  }
                  setIsSavingTier(true);
                  const ok = await addRepairCategory({
                    name: repFormName.trim(),
                    basePrice: parsedBase,
                    slaDays: parsedSla,
                    turnaround: repFormTurnaround.trim(),
                    description: repFormDesc.trim(),
                  });
                  setIsSavingTier(false);
                  if (!ok) return;
                  setAddRepairModalOpen(false);
                  setRepFormName('');
                  setRepFormBasePrice('');
                  setRepFormSlaDays(7);
                  setRepFormTurnaround('');
                  setRepFormDesc('');
                }}
                variant="primary"
                className="flex-1 font-bold min-h-[40px]"
                size="sm"
              >
                Add category
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
