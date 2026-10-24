import React from 'react';
import { Wrench, Grid3x3, Inbox, MapPin, PlusCircle } from 'lucide-react';
import { GettingServiceTier, RepairCategoryTier, ServiceRequest } from '../../types';
import { formatINR } from '../../utils/format';

/**
 * Display helpers shared by the customer screens (dashboard, My Requests, request detail).
 */

/** Statuses after which nothing more happens on a request. */
export const CLOSED_STATUSES = new Set(['Completed', 'Cancelled', 'Completed Without Repair']);
export const isOpenRequest = (r: ServiceRequest) => !CLOSED_STATUSES.has(r.status);
export const needsApproval = (r: ServiceRequest) => r.status === 'Awaiting Customer Approval';
export const canReview = (r: ServiceRequest) => r.status === 'Completed' && !r.review;

/**
 * The server fills `batPhotos` with a generic stock image when the customer attached none.
 * Only show photos the customer (or our staff) actually uploaded.
 */
export const realPhotos = (photos?: string[] | null): string[] =>
  (photos || []).filter((p) => !!p && !/images\.unsplash\.com/i.test(p));

/** Stored getting type may be a tier id ("tournament") or a tier name ("Tournament Getting"). */
export const gettingTierName = (r: ServiceRequest, tiers: GettingServiceTier[]): string => {
  const raw = (r.gettingType || '').trim();
  if (!raw) return 'Stringing';
  const tier = tiers.find((t) => t.id === raw || t.name.toLowerCase() === raw.toLowerCase());
  if (tier) return tier.name;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

/** Matches a request's repair issue to a configured repair category (same rule as the admin SLA monitor). */
export const repairCategoryFor = (issue: string | undefined, categories: RepairCategoryTier[]): RepairCategoryTier | undefined => {
  const needle = (issue || '').toLowerCase().trim();
  if (!needle) return undefined;
  const exact = categories.find((c) => c.name.toLowerCase().startsWith(needle));
  if (exact) return exact;
  const firstWord = needle.split(/\s+/)[0];
  return categories.find((c) => c.name.toLowerCase().split(/[\s/&()]+/).includes(firstWord));
};

/** One-line description of what was booked. */
export const serviceSummary = (r: ServiceRequest, tiers: GettingServiceTier[]): string => {
  if (r.serviceType === 'REPAIR') return `Repair: ${r.repairIssue || 'to be inspected'}`;
  const parts = [gettingTierName(r, tiers)];
  if (r.stringType) parts.push(r.stringType);
  if (r.stringTensionLbs) parts.push(`${r.stringTensionLbs} lbs`);
  return parts.join(' · ');
};

/** The wizard stores the chosen pickup slot as a line in the notes. */
const SLOT_LINE = /^Preferred pickup slot:\s*(.+)$/im;
export const splitNotes = (notes?: string | null): { slot: string | null; notes: string } => {
  const text = notes || '';
  const m = SLOT_LINE.exec(text);
  return {
    slot: m ? m[1].trim() : null,
    notes: text.replace(SLOT_LINE, '').trim(),
  };
};

/** Price shown in lists: repairs have no price until the estimate is ready. */
export const isRepairDeclined = (r: ServiceRequest) => r.status === 'Repair Declined' || r.status === 'Completed Without Repair';

/** Declined-repair fee the server fixed when the customer declined (0 = none / older requests). */
export const declinedRepairFeeOf = (r: ServiceRequest): number => {
  const fee = Number((r.repairEstimate as { declinedRepairFee?: number } | undefined)?.declinedRepairFee);
  return Number.isFinite(fee) && fee > 0 ? fee : 0;
};

export const priceLabel = (r: ServiceRequest): string => {
  // A declined repair isn't charged: only pickup & delivery plus the shop's declined-repair fee (if any).
  if (isRepairDeclined(r)) {
    const due = (r.pickupDeliveryCharge || 0) + declinedRepairFeeOf(r);
    return due > 0 ? formatINR(due) : 'No repair charge';
  }
  if (r.serviceType === 'REPAIR' && !r.repairEstimate) return 'Price after inspection';
  if (!r.totalAmount) return 'Price after inspection';
  return formatINR(r.totalAmount);
};

export const paymentLabel = (r: ServiceRequest): string => {
  if (r.paymentStatus === 'Paid') {
    const rec = r.paymentRecord;
    return rec ? `Paid ${formatINR(rec.amount)}${rec.method ? ` · ${rec.method}` : ''}` : 'Paid';
  }
  if (r.paymentStatus === 'Not Applicable' || r.status === 'Cancelled') return 'No payment due';
  return 'Pay after delivery';
};

/** Empty state used on the customer screens (large tap target, points to the next step). */
export const CustomerEmptyState: React.FC<{
  icon?: 'requests' | 'addresses';
  title: string;
  description: string;
  actionText: string;
  onAction: () => void;
}> = ({ icon = 'requests', title, description, actionText, onAction }) => (
  <div className="bg-white rounded-3xl border border-dashed border-slate-300 px-6 py-10 text-center flex flex-col items-center max-w-lg mx-auto">
    <span className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4 text-blue-600">
      {icon === 'addresses' ? <MapPin className="w-8 h-8" /> : <Inbox className="w-8 h-8" />}
    </span>
    <h3 className="text-base font-bold text-slate-900">{title}</h3>
    <p className="text-sm text-slate-500 mt-1.5 mb-5 max-w-sm leading-relaxed">{description}</p>
    <button
      type="button"
      onClick={onAction}
      className="inline-flex items-center gap-2 px-5 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm"
    >
      <PlusCircle className="w-4 h-4" /> {actionText}
    </button>
  </div>
);

/** Small square tile identifying the service type (replaces stock photos). */
export const ServiceTypeTile: React.FC<{ type: ServiceRequest['serviceType']; size?: 'sm' | 'md' }> = ({ type, size = 'md' }) => {
  const isRepair = type === 'REPAIR';
  const box = size === 'sm' ? 'w-11 h-11 rounded-xl' : 'w-12 h-12 rounded-2xl';
  return (
    <div
      className={`${box} shrink-0 flex items-center justify-center border ${
        isRepair ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-blue-50 border-blue-200 text-blue-700'
      }`}
      aria-hidden="true"
    >
      {isRepair ? <Wrench className="w-5 h-5" /> : <Grid3x3 className="w-5 h-5" />}
    </div>
  );
};

/** Server-written text contains raw amounts like "₹450.0" or "₹1836" — show "₹450" / "₹1,836". */
export const tidyRupees = (text: string): string => text.replace(/₹\s?(\d+(?:\.\d+)?)/g, (_m, n: string) => formatINR(n));
