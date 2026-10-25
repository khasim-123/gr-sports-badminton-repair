import React from 'react';
import { RequestStatus } from '../../types';

interface BadgeProps {
  status?: RequestStatus | string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
  dot?: boolean;
}

/**
 * One small palette for every status pill in the app:
 * - ink/paper: booked or in progress (nothing needed from anyone but us)
 * - amber: waiting for someone (customer approval, payment)
 * - emerald: done / paid
 * - rose: declined / cancelled
 * - slate: neutral
 */
const TONES = {
  progress: { pill: 'bg-paper text-ink border-line', dot: 'bg-ink' },
  attention: { pill: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  done: { pill: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-600' },
  stopped: { pill: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  neutral: { pill: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
} as const;

type Tone = keyof typeof TONES;

const VARIANT_TONE: Record<NonNullable<BadgeProps['variant']>, Tone> = {
  default: 'neutral',
  success: 'done',
  warning: 'attention',
  error: 'stopped',
  info: 'progress',
  purple: 'progress',
  neutral: 'neutral',
};

const statusTone = (status: string): Tone => {
  switch (status) {
    case 'Inspection':
    case 'Repair Estimate':
    case 'Repair Estimate Sent':
    case 'Awaiting Customer Approval':
    case 'Payment Pending':
      return 'attention';
    case 'Delivered':
    case 'Payment Collected':
    case 'Completed':
      return 'done';
    case 'Repair Declined':
    case 'Cancelled':
    case 'Completed Without Repair':
      return 'stopped';
    case 'Submitted':
    case 'Accepted':
    case 'Employee Assigned':
    case 'Pickup Scheduled':
    case 'Bat Picked Up':
    case 'Getting in Progress':
    case 'Repair in Progress':
    case 'Repair Approved':
    case 'Getting Completed':
    case 'Repair Completed':
    case 'Out for Delivery':
      return 'progress';
    default:
      return 'neutral';
  }
};

/**
 * Friendly wording for request statuses. Only the displayed text changes — the status values
 * sent to and from the server stay as they are. Wording works for customers, staff and admins.
 */
const STATUS_LABELS: Record<string, string> = {
  Submitted: 'Booked',
  Accepted: 'Accepted',
  'Employee Assigned': 'Assigned',
  'Pickup Scheduled': 'Pickup scheduled',
  'Bat Picked Up': 'Racket picked up',
  Inspection: 'Being inspected',
  'Getting in Progress': 'Stringing in progress',
  'Getting Completed': 'Stringing done',
  'Repair Estimate': 'Waiting for approval',
  'Repair Estimate Sent': 'Waiting for approval',
  'Awaiting Customer Approval': 'Waiting for approval',
  'Repair Approved': 'Repair approved',
  'Repair in Progress': 'Repair in progress',
  'Repair Completed': 'Repair done',
  'Repair Declined': 'Repair declined',
  'Out for Delivery': 'Out for delivery',
  Delivered: 'Delivered',
  'Payment Pending': 'Payment due',
  'Payment Collected': 'Paid',
  Completed: 'Completed',
  'Completed Without Repair': 'Returned without repair',
  Cancelled: 'Cancelled',
};

/** Display text for a request status (unknown values are shown as they are). */
export const statusLabel = (status?: string | null): string => (status ? STATUS_LABELS[status] || status : '');

export const StatusBadge: React.FC<BadgeProps> = ({ status, variant, size = 'md', children, dot = true }) => {
  const tone = TONES[variant ? VARIANT_TONE[variant] : status ? statusTone(status) : 'neutral'];
  const text = children || statusLabel(status);

  const sizeClasses =
    size === 'sm'
      ? 'text-xs px-2 py-0.5 font-medium'
      : size === 'lg'
      ? 'text-sm px-3 py-1 font-semibold'
      : 'text-xs px-2.5 py-1 font-semibold';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border whitespace-nowrap leading-4 ${sizeClasses} ${tone.pill}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.dot}`} aria-hidden="true" />}
      {text}
    </span>
  );
};
