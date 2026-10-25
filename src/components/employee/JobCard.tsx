import React from 'react';
import { ChevronRight, Clock, Grid3x3, MapPin, Phone, Wrench } from 'lucide-react';
import { GettingServiceTier, RepairCategoryTier, ServiceRequest } from '../../types';
import { StatusBadge } from '../common/Badge';
import { calendarDaysBetween, formatDate, formatDateTime } from '../../utils/format';
import { mobileTelHref } from '../../utils/phone';
import { gettingTierName, splitNotes } from '../customer/requestDisplay';
import {
  ActionKind,
  actionsFor,
  cardAmount,
  isNewRequest,
  mapsUrl,
  nextStepTitle,
  pickupDayOffset,
  pickupWhen,
  repairDue,
  serviceName,
  stageOf,
} from './jobLogic';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
export const actionBtnCls = `inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl text-[15px] font-bold transition-colors duration-150 ease-out ${focusRing}`;
export const primaryBtnCls = `${actionBtnCls} bg-ink hover:bg-ink-hover text-white`;
export const successBtnCls = `${actionBtnCls} bg-emerald-600 hover:bg-emerald-700 text-white`;
export const secondaryBtnCls = `${actionBtnCls} border border-line bg-white text-ink hover:bg-paper`;

/** Payment and "returned" steps are green; everything else ink. */
export const actionClass = (kind: ActionKind) =>
  kind === 'payment' || kind === 'return_done' ? successBtnCls : primaryBtnCls;


/** String name plus colour, without repeating a colour the name already contains. */
export const stringWithColour = (r: ServiceRequest): string => {
  const name = (r.stringType || r.stringPreference || '').trim();
  const colour = (r.colour || '').trim();
  if (!colour || name.toLowerCase().includes(colour.toLowerCase())) return name;
  return name ? `${name} (${colour})` : colour;
};

/** One-line description of what was booked. */
export const serviceDetail = (r: ServiceRequest, tiers: GettingServiceTier[]): string => {
  if (r.serviceType === 'REPAIR') return r.repairIssue || 'Repair — issue not specified';
  return [gettingTierName(r, tiers), stringWithColour(r), r.stringTensionLbs ? `${r.stringTensionLbs} lbs` : '']
    .filter(Boolean)
    .join(' · ');
};

type Tone = 'overdue' | 'soon' | 'today' | 'normal';
const TONE_CLS: Record<Tone, string> = {
  overdue: 'text-rose-700',
  soon: 'text-amber-800',
  today: 'text-ink',
  normal: 'text-slate-600',
};

/** When the job is due: pickup timing, or the repair's ready-by date. */
export const timingOf = (
  request: ServiceRequest,
  repairCategories: RepairCategoryTier[]
): { text: string; tone: Tone } | null => {
  const stage = stageOf(request);
  if (stage === 'collect') {
    const off = pickupDayOffset(request);
    const { slot } = splitNotes(request.additionalNotes);
    if (off !== null && off < 0) {
      return { text: `Pickup overdue — was due ${formatDate(request.pickupDate)}${slot ? `, ${slot}` : ''}`, tone: 'overdue' };
    }
    return { text: `Pickup ${pickupWhen(request, slot).replace(/^(Today|Tomorrow|Date)/, (d) => d.toLowerCase())}`, tone: off === 0 ? 'today' : 'normal' };
  }
  if ((stage === 'workshop' || stage === 'approval') && request.serviceType === 'REPAIR') {
    const due = repairDue(request, repairCategories);
    if (!due) return null;
    const left = calendarDaysBetween(new Date(), due.date);
    return {
      text: `${left < 0 ? `Overdue — was due ${formatDate(due.date)}` : `Ready by ${formatDate(due.date)}`}${
        due.source === 'sla' ? ` (${due.slaDays}-day turnaround)` : ''
      }`,
      tone: left < 0 ? 'overdue' : left <= 1 ? 'soon' : 'normal',
    };
  }
  return null;
};

/** Small coloured note under a job: pickup timing or repair due date. */
export const TimingNote: React.FC<{ request: ServiceRequest; repairCategories: RepairCategoryTier[]; className?: string }> = ({
  request,
  repairCategories,
  className = 'text-sm',
}) => {
  const t = timingOf(request, repairCategories);
  if (!t) return null;
  return (
    <p className={`flex items-start gap-1.5 font-semibold ${TONE_CLS[t.tone]} ${className}`}>
      <Clock className="w-4 h-4 mt-[2px] shrink-0" aria-hidden="true" />
      <span>{t.text}</span>
    </p>
  );
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
  const amount = cardAmount(r);
  const timing = timingOf(r, repairCategories);
  const where = [r.customerName, r.pickupAddress?.area, typeof r.distanceKm === 'number' ? `${r.distanceKm} km` : '']
    .filter(Boolean)
    .join(' · ');
  const TypeIcon = r.serviceType === 'REPAIR' ? Wrench : Grid3x3;

  return (
    <article className="bg-white rounded-2xl border border-line flex flex-col">
      <button
        type="button"
        onClick={() => onOpen(r.id)}
        className={`group w-full text-left px-4 pt-3.5 pb-3 rounded-t-2xl transition-colors duration-150 ease-out hover:bg-paper/60 ${focusRing} ${
          done ? 'rounded-b-2xl' : ''
        }`}
        aria-label={`Open ${r.id}: ${r.batBrand} ${r.batModel}, ${r.customerName}`}
      >
        {/* ID, service and status */}
        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-slate-500">
            <TypeIcon className={`w-4 h-4 shrink-0 ${r.serviceType === 'REPAIR' ? 'text-amber-700' : 'text-ink'}`} aria-hidden="true" />
            <span className="font-mono font-semibold text-slate-700">{r.id}</span>
            <span aria-hidden="true">·</span>
            <span>{serviceName(r)}</span>
          </span>
          <span className="shrink-0">
            <StatusBadge status={r.status} size="sm" />
          </span>
        </span>

        {/* What to do next, and how much */}
        <span className="mt-2 flex items-start justify-between gap-3">
          <span className="font-display tracking-[0.01em] text-[22px] leading-[1.15] font-bold text-ink">
            {nextStepTitle(r, mine)}
          </span>
          {amount && (
            <span className="shrink-0 text-right -mt-0.5">
              <span className="block text-xs font-semibold text-slate-500">{amount.label}</span>
              <span
                className={`block font-display tabular-nums leading-tight font-bold ${
                  amount.strong ? 'text-[26px] text-ink' : 'text-[20px] text-slate-700'
                }`}
              >
                {amount.value}
              </span>
            </span>
          )}
        </span>

        {/* When and where */}
        <span className="mt-2 block space-y-1">
          {timing && (
            <span className={`flex items-start gap-1.5 text-sm font-semibold ${TONE_CLS[timing.tone]}`}>
              <Clock className="w-4 h-4 mt-[2px] shrink-0" aria-hidden="true" />
              <span>{timing.text}</span>
            </span>
          )}
          {done && r.paymentRecord && (
            <span className="flex items-start gap-1.5 text-sm text-slate-600">
              <Clock className="w-4 h-4 mt-[2px] shrink-0 text-slate-400" aria-hidden="true" />
              <span>Paid {formatDateTime(r.paymentRecord.collectedAt)}</span>
            </span>
          )}
          <span className="flex items-start gap-1.5 text-sm text-slate-800">
            <MapPin className="w-4 h-4 mt-[2px] shrink-0 text-slate-400" aria-hidden="true" />
            <span className="break-words">{where}</span>
          </span>
        </span>

        {/* The racket */}
        <span className="mt-2.5 pt-2.5 border-t border-line/70 flex items-center gap-2">
          <span className="min-w-0 flex-1 text-[13px] text-slate-600 break-words">
            <span className="font-semibold text-slate-900">
              {r.batBrand} {r.batModel}
            </span>
            {' · '}
            {serviceDetail(r, gettingServices)}
          </span>
          <ChevronRight
            className="w-5 h-5 text-slate-300 shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </button>

      {!done && (primary || tel || map) && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-2 mt-auto">
          {primary && (
            <button
              type="button"
              onClick={() => onAction(primary.kind, r)}
              className={`${actionClass(primary.kind)} col-span-2 min-h-[48px]`}
            >
              {primary.label}
            </button>
          )}
          {tel && (
            <a href={tel} className={`${secondaryBtnCls} ${map ? '' : 'col-span-2'}`} aria-label={`Call ${r.customerName}`}>
              <Phone className="w-4 h-4 text-slate-500" aria-hidden="true" /> Call
            </a>
          )}
          {map && (
            <a
              href={map}
              target="_blank"
              rel="noreferrer"
              className={`${secondaryBtnCls} ${tel ? '' : 'col-span-2'}`}
              aria-label={`Open ${r.customerName}'s address in Google Maps`}
            >
              <MapPin className="w-4 h-4 text-slate-500" aria-hidden="true" /> Map
            </a>
          )}
        </div>
      )}
    </article>
  );
};
