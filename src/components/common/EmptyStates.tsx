import React from 'react';
import { Button } from './Button';
import {
  Inbox,
  Clock,
  CheckCircle2,
  MapPin,
  Truck,
  Wrench,
  DollarSign,
  Users,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';

interface EmptyStateProps {
  type?:
    | 'no_requests'
    | 'no_active'
    | 'no_completed'
    | 'no_addresses'
    | 'no_pickups'
    | 'no_getting'
    | 'no_repair'
    | 'no_deliveries'
    | 'no_payments'
    | 'no_customers'
    | 'generic';
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'generic',
  title,
  description,
  actionText,
  onAction,
}) => {
  let defaultIcon = <Inbox className="w-10 h-10 text-slate-400" />;
  let defaultTitle = 'No Items Found';
  let defaultDesc = 'There is currently no data or activity to display in this view.';
  let defaultBtn = 'Refresh';

  switch (type) {
    case 'no_requests':
      defaultIcon = <Inbox className="w-12 h-12 text-blue-500" />;
      defaultTitle = 'No Service Requests Yet';
      defaultDesc = 'Book a professional badminton bat stringing or composite structural repair in just 2 minutes!';
      defaultBtn = 'Book New Service';
      break;
    case 'no_active':
      defaultIcon = <Clock className="w-12 h-12 text-amber-500" />;
      defaultTitle = 'No Active Ongoing Requests';
      defaultDesc = 'All your previous badminton racket services have been safely completed and delivered.';
      defaultBtn = 'Book New Service';
      break;
    case 'no_completed':
      defaultIcon = <CheckCircle2 className="w-12 h-12 text-emerald-500" />;
      defaultTitle = 'No Completed Requests';
      defaultDesc = 'Once your serviced bats are delivered and payment is recorded, they will appear here.';
      defaultBtn = 'Track Active Requests';
      break;
    case 'no_addresses':
      defaultIcon = <MapPin className="w-12 h-12 text-purple-500" />;
      defaultTitle = 'No Saved Addresses';
      defaultDesc = 'Add your home court or residential address for rapid 1-click doorstep pickups.';
      defaultBtn = 'Add New Address';
      break;
    case 'no_pickups':
      defaultIcon = <Truck className="w-12 h-12 text-indigo-500" />;
      defaultTitle = 'No Pickup Tasks Assigned';
      defaultDesc = 'All doorstep bat pickups for today have been completed or none are scheduled.';
      defaultBtn = 'Check Dashboard';
      break;
    case 'no_getting':
      defaultIcon = <Wrench className="w-12 h-12 text-teal-500" />;
      defaultTitle = 'No Bat Getting Jobs Pending';
      defaultDesc = 'Stringing queue is currently clear. Great job keeping turnaround fast!';
      defaultBtn = 'Refresh Queue';
      break;
    case 'no_repair':
      defaultIcon = <Wrench className="w-12 h-12 text-orange-500" />;
      defaultTitle = 'No Pending Repair Inspections';
      defaultDesc = 'No rackets awaiting technical assessment or carbon bonding currently.';
      defaultBtn = 'Check All Jobs';
      break;
    case 'no_deliveries':
      defaultIcon = <Truck className="w-12 h-12 text-emerald-500" />;
      defaultTitle = 'No Pending Deliveries';
      defaultDesc = 'All serviced bats have been safely dispatched and delivered back to players.';
      defaultBtn = 'Refresh Deliveries';
      break;
    case 'no_payments':
      defaultIcon = <DollarSign className="w-12 h-12 text-yellow-500" />;
      defaultTitle = 'No Pending Payment Collections';
      defaultDesc = 'Zero outstanding dues. All doorstep payments have been reconciled.';
      defaultBtn = 'View Payment Logs';
      break;
    case 'no_customers':
      defaultIcon = <Users className="w-12 h-12 text-slate-400" />;
      defaultTitle = 'No Registered Customers';
      defaultDesc = 'Customer accounts will populate as players book badminton services.';
      defaultBtn = 'Invite Customer';
      break;
  }

  return (
    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center flex flex-col items-center justify-center max-w-md mx-auto my-6 shadow-2xs">
      <div className="w-20 h-20 rounded-2xl bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
        {defaultIcon}
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-1.5">{title || defaultTitle}</h3>
      <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed max-w-sm">
        {description || defaultDesc}
      </p>
      {onAction && (
        <Button
          onClick={onAction}
          variant="primary"
          size="sm"
          leftIcon={<PlusCircle className="w-4 h-4" />}
        >
          {actionText || defaultBtn}
        </Button>
      )}
    </div>
  );
};
