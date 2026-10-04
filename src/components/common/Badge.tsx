import React from 'react';
import { RequestStatus } from '../../types';

interface BadgeProps {
  status?: RequestStatus | string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
  dot?: boolean;
}

export const StatusBadge: React.FC<BadgeProps> = ({
  status,
  variant,
  size = 'md',
  children,
  dot = true,
}) => {
  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';

  const text = children || status;

  if (variant) {
    switch (variant) {
      case 'success':
        colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        dotColor = 'bg-emerald-500';
        break;
      case 'warning':
        colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
        dotColor = 'bg-amber-500';
        break;
      case 'error':
        colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
        dotColor = 'bg-rose-500';
        break;
      case 'info':
        colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
        dotColor = 'bg-blue-500';
        break;
      case 'purple':
        colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
        dotColor = 'bg-purple-500';
        break;
      case 'neutral':
        colorClasses = 'bg-slate-100 text-slate-600 border-slate-200';
        dotColor = 'bg-slate-400';
        break;
    }
  } else if (status) {
    switch (status) {
      case 'Submitted':
        colorClasses = 'bg-sky-50 text-sky-700 border-sky-200';
        dotColor = 'bg-sky-500';
        break;
      case 'Accepted':
        colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
        dotColor = 'bg-blue-500';
        break;
      case 'Employee Assigned':
      case 'Pickup Scheduled':
        colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
        dotColor = 'bg-indigo-500';
        break;
      case 'Bat Picked Up':
        colorClasses = 'bg-cyan-50 text-cyan-700 border-cyan-200';
        dotColor = 'bg-cyan-500';
        break;
      case 'Inspection':
        colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
        dotColor = 'bg-amber-500';
        break;
      case 'Repair Estimate':
      case 'Awaiting Customer Approval':
        colorClasses = 'bg-orange-50 text-orange-800 border-orange-300 animate-pulse';
        dotColor = 'bg-orange-500';
        break;
      case 'Repair Approved':
        colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        dotColor = 'bg-emerald-500';
        break;
      case 'Getting in Progress':
      case 'Repair in Progress':
        colorClasses = 'bg-violet-50 text-violet-700 border-violet-200';
        dotColor = 'bg-violet-500';
        break;
      case 'Getting Completed':
      case 'Repair Completed':
        colorClasses = 'bg-teal-50 text-teal-700 border-teal-200';
        dotColor = 'bg-teal-500';
        break;
      case 'Out for Delivery':
        colorClasses = 'bg-blue-50 text-blue-800 border-blue-300';
        dotColor = 'bg-blue-600';
        break;
      case 'Delivered':
        colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-300';
        dotColor = 'bg-emerald-600';
        break;
      case 'Payment Pending':
        colorClasses = 'bg-yellow-50 text-yellow-800 border-yellow-300';
        dotColor = 'bg-yellow-500';
        break;
      case 'Payment Collected':
      case 'Completed':
        colorClasses = 'bg-green-100 text-green-800 border-green-300 font-semibold';
        dotColor = 'bg-green-600';
        break;
      case 'Repair Declined':
      case 'Cancelled':
      case 'Completed Without Repair':
        colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
        dotColor = 'bg-rose-500';
        break;
      default:
        colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
        dotColor = 'bg-slate-400';
    }
  }

  const sizeClasses =
    size === 'sm'
      ? 'text-xs px-2 py-0.5 font-medium'
      : size === 'lg'
      ? 'text-sm px-3.5 py-1.5 font-semibold'
      : 'text-xs px-2.5 py-1 font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border shadow-2xs whitespace-nowrap ${sizeClasses} ${colorClasses}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
      {text}
    </span>
  );
};
