import React from 'react';
import { ServiceRequest, RequestStatus } from '../../types';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  Wrench,
  DollarSign,
  UserCheck,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { StatusBadge } from './Badge';

interface TimelineProps {
  request: ServiceRequest;
  compact?: boolean;
}

const GETTING_STEPS: RequestStatus[] = [
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

const REPAIR_STEPS: RequestStatus[] = [
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

export const Timeline: React.FC<TimelineProps> = ({ request, compact = false }) => {
  const isRepair = request.serviceType === 'REPAIR';
  const steps = isRepair ? REPAIR_STEPS : GETTING_STEPS;

  const currentStatusIndex = steps.indexOf(request.status);
  const isDeclined = request.status === 'Repair Declined' || request.status === 'Completed Without Repair';

  // Calculate 7-day SLA if repair
  const calculateSla = () => {
    if (!isRepair || !request.pickupDate) return null;
    const pickup = new Date(request.pickupDate);
    const target = new Date(request.targetDate || new Date(pickup.getTime() + 7 * 24 * 60 * 60 * 1000));
    const now = new Date();
    const diffDays = Math.max(1, Math.ceil((now.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)));
    const remainingDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let slaStatus: 'Normal' | 'Approaching Deadline' | 'Delayed' = 'Normal';
    if (diffDays >= 7 || remainingDays < 0) {
      slaStatus = 'Delayed';
    } else if (diffDays >= 5 || remainingDays <= 2) {
      slaStatus = 'Approaching Deadline';
    }

    return {
      pickupDateStr: pickup.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      targetDateStr: target.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      currentDay: diffDays,
      remainingDays: Math.max(0, remainingDays),
      slaStatus,
    };
  };

  const sla = calculateSla();

  return (
    <div className="space-y-6">
      {/* 7-Day Target SLA Banner (Figma Item 30 & 76) */}
      {isRepair && sla && (
        <div className={`p-4 rounded-2xl border ${
          sla.slaStatus === 'Delayed'
            ? 'bg-rose-50/70 border-rose-200'
            : sla.slaStatus === 'Approaching Deadline'
            ? 'bg-amber-50/70 border-amber-200'
            : 'bg-emerald-50/70 border-emerald-200'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Calendar className={`w-4 h-4 ${
                sla.slaStatus === 'Delayed' ? 'text-rose-600' : sla.slaStatus === 'Approaching Deadline' ? 'text-amber-600' : 'text-emerald-600'
              }`} />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Repair SLA Guarantee: Within 7 Days
              </span>
            </div>
            <StatusBadge
              variant={
                sla.slaStatus === 'Delayed' ? 'error' : sla.slaStatus === 'Approaching Deadline' ? 'warning' : 'success'
              }
            >
              {sla.slaStatus === 'Delayed' ? 'Delayed (SLA Breach)' : sla.slaStatus === 'Approaching Deadline' ? 'Approaching Deadline' : 'Normal / On Track'}
            </StatusBadge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
              <p className="text-[11px] text-slate-500 font-medium">Pickup Date</p>
              <p className="text-xs font-bold text-slate-900 mt-0.5">{sla.pickupDateStr}</p>
            </div>
            <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
              <p className="text-[11px] text-slate-500 font-medium">Target Delivery</p>
              <p className="text-xs font-bold text-slate-900 mt-0.5">{sla.targetDateStr}</p>
            </div>
            <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
              <p className="text-[11px] text-slate-500 font-medium">Turnaround Elapsed</p>
              <p className="text-xs font-bold text-slate-900 mt-0.5">Day {sla.currentDay} of 7</p>
            </div>
            <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
              <p className="text-[11px] text-slate-500 font-medium">Days Remaining</p>
              <p className={`text-xs font-bold mt-0.5 ${
                sla.remainingDays <= 1 ? 'text-rose-600 font-extrabold' : 'text-slate-900'
              }`}>
                {sla.remainingDays} Days Left
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Vertical Stepper & Timeline with history */}
      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {request.timeline.map((event, idx) => {
          const isLatest = idx === request.timeline.length - 1;
          return (
            <div key={idx} className="relative group">
              {/* Node Icon */}
              <div
                className={`absolute -left-6 sm:-left-8 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-white ring-4 ring-white ${
                  isLatest
                    ? 'bg-blue-600 ring-blue-100 shadow-md animate-bounce-subtle'
                    : 'bg-emerald-500 ring-emerald-50'
                }`}
              >
                {isLatest ? (
                  <Clock className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
              </div>

              {/* Event Content */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{event.label}</span>
                    <StatusBadge status={event.status} size="sm" dot={false} />
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">{event.timestamp}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                  <span className="font-semibold text-slate-700">By:</span>
                  <span>{event.actor}</span>
                </div>
                {event.notes && (
                  <p className="text-xs text-slate-600 mt-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100 italic">
                    "{event.notes}"
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Up Next / Pending Stages Preview */}
      {!isDeclined && request.status !== 'Completed' && (
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
            Upcoming Steps In Workflow
          </p>
          <div className="flex flex-wrap gap-2">
            {steps
              .slice(Math.max(0, currentStatusIndex + 1))
              .map((st, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  {st}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
