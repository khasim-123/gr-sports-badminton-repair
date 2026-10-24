import React from 'react';
import { CheckCircle2, Circle, Clock, CalendarDays, AlertTriangle, XCircle } from 'lucide-react';
import { GettingServiceTier, RepairCategoryTier, RequestStatus, ServiceRequest } from '../../types';
import { calendarDaysBetween, formatDate, parseDate, pluralDays } from '../../utils/format';
import { gettingTierName, isOpenRequest, repairCategoryFor, tidyRupees } from './requestDisplay';
import { phoneDisplay, telHref, useShopSettings } from '../../hooks/useShopSettings';

const GETTING_FLOW: RequestStatus[] = [
  'Submitted',
  'Accepted',
  'Employee Assigned',
  'Pickup Scheduled',
  'Bat Picked Up',
  'Getting in Progress',
  'Getting Completed',
  'Out for Delivery',
  'Delivered',
  'Payment Collected',
  'Completed',
];

const REPAIR_FLOW: RequestStatus[] = [
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
  'Repair Completed',
  'Out for Delivery',
  'Delivered',
  'Payment Collected',
  'Completed',
];

interface Milestone {
  label: string;
  /** First status at which this milestone counts as reached. */
  reachedAt: RequestStatus;
}

const GETTING_MILESTONES: Milestone[] = [
  { label: 'Booked', reachedAt: 'Submitted' },
  { label: 'Pickup scheduled', reachedAt: 'Pickup Scheduled' },
  { label: 'Racket picked up', reachedAt: 'Bat Picked Up' },
  { label: 'Stringing done', reachedAt: 'Getting Completed' },
  { label: 'Delivered to you', reachedAt: 'Delivered' },
  { label: 'Paid & completed', reachedAt: 'Completed' },
];

const REPAIR_MILESTONES: Milestone[] = [
  { label: 'Booked', reachedAt: 'Submitted' },
  { label: 'Pickup scheduled', reachedAt: 'Pickup Scheduled' },
  { label: 'Racket picked up', reachedAt: 'Bat Picked Up' },
  { label: 'Estimate sent to you', reachedAt: 'Awaiting Customer Approval' },
  { label: 'Estimate approved', reachedAt: 'Repair Approved' },
  { label: 'Repair done', reachedAt: 'Repair Completed' },
  { label: 'Delivered to you', reachedAt: 'Delivered' },
  { label: 'Paid & completed', reachedAt: 'Completed' },
];

const NOT_PICKED_UP = new Set<RequestStatus>(['Submitted', 'Accepted', 'Employee Assigned', 'Pickup Scheduled']);

interface Props {
  request: ServiceRequest;
  gettingServices: GettingServiceTier[];
  repairCategories: RepairCategoryTier[];
}

/** Customer-facing progress: milestones, the expected-ready date and the full status history. */
export const RequestProgress: React.FC<Props> = ({ request, gettingServices, repairCategories }) => {
  const shop = useShopSettings();
  const isRepair = request.serviceType === 'REPAIR';
  const flow = isRepair ? REPAIR_FLOW : GETTING_FLOW;
  const milestones = isRepair ? REPAIR_MILESTONES : GETTING_MILESTONES;
  const declined = request.status === 'Repair Declined' || request.status === 'Completed Without Repair';
  const cancelled = request.status === 'Cancelled';

  // Where are we in the flow? (Declined repairs stopped at the estimate.)
  let index = flow.indexOf(request.status);
  if (declined) index = flow.indexOf('Awaiting Customer Approval');
  if (index < 0) {
    // Unknown / off-flow status: use the furthest status found in the history.
    index = Math.max(0, ...request.timeline.map((e) => flow.indexOf(e.status)));
  }
  const reached = (m: Milestone) => {
    if (m.reachedAt === 'Completed') return request.status === 'Completed';
    return flow.indexOf(m.reachedAt) <= index;
  };
  const visibleMilestones = declined ? milestones.slice(0, 4) : milestones;
  const currentMilestone = visibleMilestones.findIndex((m) => !reached(m));

  // Expected-ready date (repairs: estimate date, else target date, else pickup + category SLA).
  const today = new Date();
  let readyBy: Date | null = null;
  let readyNote = '';
  if (isRepair) {
    const category = repairCategoryFor(request.repairIssue, repairCategories);
    readyBy = parseDate(request.repairEstimate?.expectedCompletionDate) || parseDate(request.targetDate);
    const pickedUp = !NOT_PICKED_UP.has(request.status);
    if (!readyBy && pickedUp && category?.slaDays) {
      const start = parseDate(request.pickupCondition?.collectedAt) || parseDate(request.pickupDate);
      if (start) {
        readyBy = new Date(start);
        readyBy.setDate(readyBy.getDate() + category.slaDays);
      }
    }
    if (!readyBy && category?.turnaround) readyNote = `Repairs like this usually take ${category.turnaround} after pickup.`;
  } else {
    const tier = gettingServices.find((t) => t.name === gettingTierName(request, gettingServices));
    if (tier?.turnaround) readyNote = `${tier.name} is usually ready ${tier.turnaround.toLowerCase().startsWith('within') ? '' : 'within '}${tier.turnaround} of pickup.`;
  }
  const open = isOpenRequest(request) && !declined;
  const daysLeft = readyBy ? calendarDaysBetween(today, readyBy) : null;
  const waitingForCustomer = request.status === 'Awaiting Customer Approval';
  const pastReadyDate = open && daysLeft !== null && daysLeft < 0 && !['Out for Delivery', 'Delivered', 'Payment Collected'].includes(request.status);

  return (
    <div className="space-y-5">
      {/* Milestones */}
      <ol className="space-y-0">
        {visibleMilestones.map((m, i) => {
          const done = reached(m);
          const current = !cancelled && i === currentMilestone;
          return (
            <li key={m.label} className="flex items-start gap-3 relative pb-3 last:pb-0">
              {i < visibleMilestones.length - 1 && (
                <span className={`absolute left-[11px] top-6 bottom-0 w-0.5 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} aria-hidden="true" />
              )}
              <span className="relative z-10 w-6 h-6 flex items-center justify-center shrink-0 bg-white">
                {done ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                ) : current ? (
                  <Clock className="w-6 h-6 text-blue-600" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300" />
                )}
              </span>
              <span className={`text-sm pt-0.5 ${done ? 'text-slate-900 font-semibold' : current ? 'text-blue-800 font-bold' : 'text-slate-400'}`}>
                {m.label}
                {current && waitingForCustomer && m.reachedAt === 'Repair Approved' && (
                  <span className="block text-[11px] font-semibold text-amber-700">Waiting for your approval</span>
                )}
              </span>
            </li>
          );
        })}
        {declined && (
          <li className="flex items-start gap-3 pt-1">
            <XCircle className="w-6 h-6 text-rose-500 shrink-0" />
            <span className="text-sm font-semibold text-slate-900 pt-0.5">
              Estimate declined
              <span className="block text-[11px] font-normal text-slate-500">
                {request.status === 'Completed Without Repair'
                  ? 'Your racket was returned without the repair.'
                  : 'We will return your racket without repairing it.'}
              </span>
            </span>
          </li>
        )}
        {cancelled && (
          <li className="flex items-start gap-3 pt-1">
            <XCircle className="w-6 h-6 text-rose-500 shrink-0" />
            <span className="text-sm font-semibold text-slate-900 pt-0.5">Request cancelled</span>
          </li>
        )}
      </ol>

      {/* Expected ready date */}
      {open && ((readyBy && (daysLeft! >= 0 || pastReadyDate)) || readyNote || waitingForCustomer) && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
            pastReadyDate && !waitingForCustomer ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <CalendarDays className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            {readyBy && daysLeft !== null && daysLeft >= 0 && (
              <p>
                Expected ready by <b>{formatDate(readyBy)}</b>
                {!waitingForCustomer && (
                  <span className="text-slate-500"> ({daysLeft === 0 ? 'today' : `in ${pluralDays(daysLeft)}`})</span>
                )}
              </p>
            )}
            {readyBy && pastReadyDate && !waitingForCustomer && (
              <p>
                Planned ready date was <b>{formatDate(readyBy)}</b>.
              </p>
            )}
            {waitingForCustomer && <p>The repair is on hold until you approve or decline the estimate.</p>}
            {pastReadyDate && !waitingForCustomer && (
              <p className="flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> This is taking longer than planned. Call us on{' '}
                <a href={telHref(shop.phone)} className="font-bold underline whitespace-nowrap">
                  {phoneDisplay(shop.phone)}
                </a>{' '}
                for an update.
              </p>
            )}
            {!readyBy && readyNote && <p>{readyNote}</p>}
          </div>
        </div>
      )}

      {/* History */}
      {request.timeline.length > 0 && (
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">History</h4>
          <ol className="space-y-2">
            {[...request.timeline].reverse().map((event, idx) => (
              <li key={`${event.timestamp}-${idx}`} className="p-3 rounded-xl border border-slate-200 bg-white text-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="font-bold text-slate-900">{tidyRupees(event.label)}</span>
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">{event.timestamp}</span>
                </div>
                {event.actor && !/^customer\b/i.test(event.actor) && (
                  <p className="text-[11px] text-slate-500 mt-0.5">By {event.actor}</p>
                )}
                {event.notes && <p className="text-slate-600 mt-1.5 leading-relaxed">{tidyRupees(event.notes)}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};
