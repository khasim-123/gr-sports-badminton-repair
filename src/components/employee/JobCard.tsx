import React from 'react';
import { ChevronRight, MapPin, Phone } from 'lucide-react';
import { GettingServiceTier, RepairCategoryTier, ServiceRequest } from '../../types';
import { StatusBadge } from '../common/Badge';
import { calendarDaysBetween, formatDate, formatDateTime, formatINR } from '../../utils/format';
import { mobileTelHref } from '../../utils/phone';
import { ServiceTypeTile, gettingTierName, splitNotes } from '../customer/requestDisplay';
import {
  ActionKind,
  actionsFor,
  isNewRequest,
  mapsUrl,
  nextStepText,
  pickupDayOffset,
  pickupWhen,
  repairDue,
  serviceName,
  stageOf,
} from './jobLogic';

export const actionBtnCls =
  'inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl text-sm font-bold transition-colors';
export const primaryBtnCls = `${actionBtnCls} bg-blue-600 hover:bg-blue-700 text-white`;
export const successBtnCls = `${actionBtnCls} bg-emerald-600 hover:bg-emerald-700 text-white`;
export const secondaryBtnCls = `${actionBtnCls} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;

/** Payment and "returned" steps are green; everything else blue. */
export const actionClass = (kind: ActionKind) =>
  kind === 'payment' || kind === 'return_done' ? successBtnCls : primaryBtnCls;

/** One-line description of what was booked. */
export const serviceDetail = (r: ServiceRequest, tiers: GettingServiceTier[]): string => {
  if (r.serviceType === 'REPAIR') return r.repairIssue || 'Repair — issue not specified';
  return [gettingTierName(r, tiers), r.stringType || r.stringPreference, r.stringTensionLbs ? `${r.stringTensionLbs} lbs` : '', r.colour]
    .filter(Boolean)
    .join(' · ');
};

/** Small coloured note under a job: pickup timing or repair due date. */
export const TimingNote: React.FC<{ request: ServiceRequest; repairCategories: RepairCategoryTier[] }> = ({
  request,
  repairCategories,
}) => {
  const stage = stageOf(request);
  if (stage === 'collect') {
    const off = pickupDayOffset(request);
    const { slot } = splitNotes(request.additionalNotes);
    const overdue = off !== null && off < 0;
    return (
      <p className={`text-xs font-semibold ${overdue ? 'text-rose-700' : off === 0 ? 'text-blue-800' : 'text-slate-600'}`}>
        {overdue ? `Pickup overdue — was due ${formatDate(request.pickupDate)}${slot ? `, ${slot}` : ''}` : `Pickup: ${pickupWhen(request, slot)}`}
      </p>
    );
  }
  if ((stage === 'workshop' || stage === 'approval') && request.serviceType === 'REPAIR') {
    const due = repairDue(request, repairCategories);
    if (!due) return null;
    const left = calendarDaysBetween(new Date(), due.date);
    return (
      <p className={`text-xs font-semibold ${left < 0 ? 'text-rose-700' : left <= 1 ? 'text-amber-700' : 'text-slate-600'}`}>
        {left < 0 ? `Overdue — was due ${formatDate(due.date)}` : `Ready by ${formatDate(due.date)}`}
        {due.source === 'sla' ? ` (${due.slaDays}-day turnaround)` : ''}
      </p>
    );
  }
  return null;
};

interface JobCardProps {
  request: ServiceRequest;
  mine: boolean;
  gettingServices: GettingServiceTier[];
  repairCategories: RepairCategoryTier[];
  onOpen: (id: string) => void;
  onAction: (kind: ActionKind, request: ServiceRequest) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ request: r, mine, gettingServices, repairCategories, onOpen, onAction }) => {
  const stage = stageOf(r);
  const primary = actionsFor(r, mine).find((a) => a.primary);
  const tel = mobileTelHref(r.customerMobile);
  const map = stage === 'collect' || stage === 'deliver' || isNewRequest(r) ? mapsUrl(r.pickupAddress) : null;
  const done = stage === 'done';

  return (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col">
      <button
        type="button"
        onClick={() => onOpen(r.id)}
        className="w-full text-left p-4 pb-3 flex gap-3 rounded-t-2xl hover:bg-slate-50/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        aria-label={`Open ${r.id}: ${r.batBrand} ${r.batModel}, ${r.customerName}`}
      >
        <ServiceTypeTile type={r.serviceType} size="sm" />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs text-slate-500">
              <span className="font-mono font-bold text-slate-700">{r.id}</span> · {serviceName(r)}
            </span>
            <StatusBadge status={r.status} size="sm" />
          </span>
          <span className="block text-base font-bold text-slate-900 leading-snug break-words">
            {r.batBrand} {r.batModel}
          </span>
          <span className="block text-xs text-slate-600 break-words">{serviceDetail(r, gettingServices)}</span>
          <span className="block text-sm text-slate-700 break-words">
            {r.customerName}
            {r.pickupAddress?.area ? ` · ${r.pickupAddress.area}` : ''}
            {typeof r.distanceKm === 'number' ? ` · ${r.distanceKm} KM` : ''}
          </span>
          <TimingNote request={r} repairCategories={repairCategories} />
          <span className="block text-sm font-semibold text-slate-900">
            {done && r.paymentRecord
              ? `Paid ${formatINR(r.paymentRecord.amount)} by ${r.paymentRecord.method} · ${formatDateTime(r.paymentRecord.collectedAt)}`
              : nextStepText(r, mine)}
          </span>
        </span>
        <ChevronRight className="w-5 h-5 text-slate-300 shrink-0 self-center hidden sm:block" aria-hidden="true" />
      </button>

      {!done && (primary || tel || map) && (
        <div className="px-4 pb-4 pt-1 flex flex-wrap gap-2 mt-auto">
          {primary && (
            <button type="button" onClick={() => onAction(primary.kind, r)} className={`${actionClass(primary.kind)} flex-1 basis-full sm:basis-auto`}>
              {primary.label}
            </button>
          )}
          {tel && (
            <a href={tel} className={`${secondaryBtnCls} flex-1 sm:flex-none`} aria-label={`Call ${r.customerName}`}>
              <Phone className="w-4 h-4 text-slate-500" /> Call
            </a>
          )}
          {map && (
            <a href={map} target="_blank" rel="noreferrer" className={`${secondaryBtnCls} flex-1 sm:flex-none`}>
              <MapPin className="w-4 h-4 text-slate-500" /> Map
            </a>
          )}
        </div>
      )}
    </article>
  );
};
