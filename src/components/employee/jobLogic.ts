/**
 * Staff portal: what a job needs next, which actions are valid for its status, and small
 * display helpers. Mirrors the server rules in backend/app/routers/requests.py
 * (_EMPLOYEE_MOVES, _PICKUP_STATUSES, _ESTIMATE_STATUSES, _REVISE_STATUSES, _PAYMENT_STATUSES).
 */
import { Address, RepairCategoryTier, RequestStatus, ServiceRequest } from '../../types';
import { calendarDaysBetween, formatDate, formatINR, parseDate } from '../../utils/format';
import { normalizeMobile } from '../../utils/phone';
import { repairCategoryFor } from '../customer/requestDisplay';

export type Stage = 'collect' | 'workshop' | 'approval' | 'deliver' | 'done';

export const STAGE_TITLES: Record<Stage, string> = {
  collect: 'To collect',
  workshop: 'In the workshop',
  approval: 'Waiting for customer approval',
  deliver: 'To deliver',
  done: 'Completed',
};

const NEW_STATUSES: RequestStatus[] = ['Submitted', 'Accepted'];
const COLLECT_STATUSES: RequestStatus[] = ['Submitted', 'Accepted', 'Employee Assigned', 'Pickup Scheduled'];
const DONE_STATUSES: RequestStatus[] = ['Completed', 'Completed Without Repair', 'Payment Collected', 'Cancelled'];
const DELIVER_STATUSES: RequestStatus[] = [
  'Getting Completed',
  'Repair Completed',
  'Repair Declined',
  'Out for Delivery',
  'Delivered',
  'Payment Pending',
];

export const stageOf = (r: ServiceRequest): Stage => {
  if (DONE_STATUSES.includes(r.status)) return 'done';
  if (COLLECT_STATUSES.includes(r.status)) return 'collect';
  if (r.status === 'Awaiting Customer Approval') return 'approval';
  if (DELIVER_STATUSES.includes(r.status)) return 'deliver';
  return 'workshop';
};

/** A new booking nobody has accepted yet. */
export const isNewRequest = (r: ServiceRequest) => !r.assignedEmployeeId && NEW_STATUSES.includes(r.status);

export const isOpen = (r: ServiceRequest) => stageOf(r) !== 'done';

export const wasDeclined = (r: ServiceRequest) =>
  r.status === 'Repair Declined' || (r.timeline || []).some((e) => e.status === 'Repair Declined');

/** Declined-repair fee fixed by the server when the customer declined (0 = none / older requests). */
export const declinedFee = (r: ServiceRequest): number => {
  const fee = Number((r.repairEstimate as { declinedRepairFee?: number } | undefined)?.declinedRepairFee);
  return Number.isFinite(fee) && fee > 0 ? fee : 0;
};

/** What the customer pays on delivery (a declined repair: pickup & delivery + the declined-repair fee). */
export const amountDue = (r: ServiceRequest): number =>
  wasDeclined(r) ? (r.pickupDeliveryCharge || 0) + declinedFee(r) : r.totalAmount || 0;

/** The pickup distance (and so the delivery charge) can be corrected until the customer has paid. */
export const canCorrectDistance = (r: ServiceRequest, mine: boolean): boolean =>
  mine && r.paymentStatus !== 'Paid' && !DONE_STATUSES.includes(r.status);

export type ActionKind =
  | 'accept'
  | 'pickup'
  | 'start_stringing'
  | 'finish_stringing'
  | 'estimate'
  | 'start_repair'
  | 'revise'
  | 'finish_repair'
  | 'dispatch'
  | 'payment'
  | 'return_done'
  | 'correct_distance';

export interface JobAction {
  kind: ActionKind;
  label: string;
  /** The main next step (one per job); others are secondary. */
  primary: boolean;
}

/** Actions the signed-in employee may take on a job right now. `mine` = assigned to them. */
export const actionsFor = (r: ServiceRequest, mine: boolean): JobAction[] => {
  const list = statusActions(r, mine);
  return canCorrectDistance(r, mine) ? [...list, { kind: 'correct_distance', label: 'Correct distance', primary: false }] : list;
};

const statusActions = (r: ServiceRequest, mine: boolean): JobAction[] => {
  if (!mine) return isNewRequest(r) ? [{ kind: 'accept', label: 'Accept job', primary: true }] : [];
  const isRepair = r.serviceType === 'REPAIR';
  switch (r.status) {
    case 'Submitted':
    case 'Accepted':
    case 'Employee Assigned':
    case 'Pickup Scheduled':
      return [{ kind: 'pickup', label: 'Record pickup', primary: true }];
    case 'Bat Picked Up':
      return isRepair
        ? [{ kind: 'estimate', label: 'Send repair estimate', primary: true }]
        : [{ kind: 'start_stringing', label: 'Start stringing', primary: true }];
    case 'Inspection':
    case 'Repair Estimate':
      return isRepair ? [{ kind: 'estimate', label: 'Send repair estimate', primary: true }] : [];
    case 'Getting in Progress':
      return [{ kind: 'finish_stringing', label: 'Stringing done', primary: true }];
    case 'Repair Approved':
      return [
        { kind: 'start_repair', label: 'Start repair', primary: true },
        { kind: 'revise', label: 'Revise estimate', primary: false },
      ];
    case 'Repair in Progress':
      return [
        { kind: 'finish_repair', label: 'Repair done', primary: true },
        { kind: 'revise', label: 'Revise estimate', primary: false },
      ];
    case 'Getting Completed':
    case 'Repair Completed':
      return [{ kind: 'dispatch', label: 'Out for delivery', primary: true }];
    case 'Repair Declined':
      return [{ kind: 'dispatch', label: 'Out for delivery (return)', primary: true }];
    case 'Out for Delivery':
    case 'Delivered':
    case 'Payment Pending':
      if (r.paymentStatus === 'Paid') return [];
      if (wasDeclined(r) && amountDue(r) <= 0) {
        return r.status === 'Out for Delivery' ? [{ kind: 'return_done', label: 'Returned to customer', primary: true }] : [];
      }
      return [{ kind: 'payment', label: 'Record payment', primary: true }];
    default:
      return [];
  }
};

/** One line telling the employee what this job needs next. */
export const nextStepText = (r: ServiceRequest, mine: boolean): string => {
  const due = formatINR(amountDue(r));
  const est = r.repairEstimate ? formatINR(r.repairEstimate.totalEstimate) : '';
  if (!mine && isNewRequest(r)) return 'New request — accept it to take the job';
  switch (r.status) {
    case 'Submitted':
    case 'Accepted':
    case 'Employee Assigned':
    case 'Pickup Scheduled':
      return 'Collect the racket from the customer';
    case 'Bat Picked Up':
      return r.serviceType === 'REPAIR' ? 'Inspect it and send the repair estimate' : 'String the racket';
    case 'Inspection':
    case 'Repair Estimate':
      return 'Inspect it and send the repair estimate';
    case 'Getting in Progress':
      return 'Stringing in progress';
    case 'Awaiting Customer Approval':
      return `Waiting for the customer to approve ${est || 'the estimate'}`;
    case 'Repair Approved':
      return `Customer approved ${est || 'the estimate'} — start the repair`;
    case 'Repair in Progress':
      return 'Repair in progress';
    case 'Getting Completed':
    case 'Repair Completed':
      return `Ready — deliver and collect ${due}`;
    case 'Repair Declined':
      return 'Customer declined the repair — return the racket';
    case 'Out for Delivery':
    case 'Delivered':
    case 'Payment Pending':
      if (r.paymentStatus === 'Paid') return 'Paid';
      if (wasDeclined(r)) {
        if (amountDue(r) <= 0) return 'Returning the racket — nothing to collect';
        return declinedFee(r) > 0
          ? `Returning — collect ${due} (pickup & delivery + declined-repair fee)`
          : `Returning — collect ${due} pickup charge`;
      }
      return `Out for delivery — collect ${due}`;
    case 'Cancelled':
      return 'Cancelled';
    case 'Completed Without Repair':
      return r.paymentRecord ? `Returned without repair · paid ${formatINR(r.paymentRecord.amount)} by ${r.paymentRecord.method}` : 'Returned without repair';
    default:
      return r.paymentRecord ? `Completed · paid ${formatINR(r.paymentRecord.amount)} by ${r.paymentRecord.method}` : 'Completed';
  }
};

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Days from today to the pickup date (negative = overdue), or null when no date was chosen. */
export const pickupDayOffset = (r: ServiceRequest, today = new Date()): number | null => {
  const d = parseDate(r.pickupDate);
  return d ? calendarDaysBetween(today, d) : null;
};

/** Pickups due today/overdue and runs already out for delivery come first. */
export const isForToday = (r: ServiceRequest, today = new Date()): boolean => {
  if (r.status === 'Out for Delivery') return true;
  if (stageOf(r) !== 'collect') return false;
  const off = pickupDayOffset(r, today);
  return off !== null && off <= 0;
};

export const pickupWhen = (r: ServiceRequest, slot: string | null, today = new Date()): string => {
  const off = pickupDayOffset(r, today);
  if (off === null) return slot ? `${slot}, date not chosen — call the customer` : 'Date not chosen — call the customer';
  const day = off === 0 ? 'Today' : off === 1 ? 'Tomorrow' : formatDate(r.pickupDate);
  return `${day}${slot ? `, ${slot}` : ''}`;
};

/**
 * When a repair should be ready: the estimate's expected date, otherwise the configured
 * turnaround (SLA days) of the matching repair category counted from pickup.
 */
export const repairDue = (
  r: ServiceRequest,
  categories: RepairCategoryTier[]
): { date: Date; source: 'estimate' | 'sla'; slaDays?: number } | null => {
  if (r.serviceType !== 'REPAIR') return null;
  const fromEstimate = parseDate(r.repairEstimate?.expectedCompletionDate);
  if (fromEstimate) return { date: fromEstimate, source: 'estimate' };
  const cat = repairCategoryFor(r.repairIssue, categories);
  if (!cat?.slaDays) return null;
  const start = parseDate(r.pickupCondition?.collectedAt) || parseDate(r.pickupDate) || parseDate(r.createdAt);
  if (!start) return null;
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + cat.slaDays);
  return { date: d, source: 'sla', slaDays: cat.slaDays };
};

// ---------------------------------------------------------------------------
// Address, maps, search
// ---------------------------------------------------------------------------

export const addressLine = (a?: Address | null): string =>
  a ? [a.houseFlat, a.street, a.area, a.city].map((s) => (s || '').trim()).filter(Boolean).join(', ') + (a.pincode ? ` – ${a.pincode}` : '') : '';

export const mapsUrl = (a?: Address | null): string | null => {
  if (!a) return null;
  const query =
    a.lat != null && a.lng != null
      ? `${a.lat},${a.lng}`
      : [a.houseFlat, a.street, a.area, a.city, a.pincode].map((s) => (s || '').trim()).filter(Boolean).join(', ');
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
};

export const serviceName = (r: ServiceRequest) => (r.serviceType === 'REPAIR' ? 'Repair' : 'Stringing');

export const matchesSearch = (r: ServiceRequest, raw: string): boolean => {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  const mobile = normalizeMobile(r.customerMobile) || r.customerMobile || '';
  const hay = [
    r.id,
    r.customerName,
    r.batBrand,
    r.batModel,
    r.pickupAddress?.area,
    r.pickupAddress?.street,
    r.pickupAddress?.pincode,
    r.repairIssue,
    r.gettingType,
    r.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (hay.includes(q)) return true;
  return digits.length >= 4 && mobile.replace(/\D/g, '').includes(digits);
};

/** Oldest first; pickups by pickup date. */
export const byUrgency = (a: ServiceRequest, b: ServiceRequest): number => {
  const pa = stageOf(a) === 'collect' ? parseDate(a.pickupDate)?.getTime() ?? Infinity : Infinity;
  const pb = stageOf(b) === 'collect' ? parseDate(b.pickupDate)?.getTime() ?? Infinity : Infinity;
  if (pa !== pb) return pa - pb;
  return (parseDate(a.createdAt)?.getTime() ?? 0) - (parseDate(b.createdAt)?.getTime() ?? 0);
};
