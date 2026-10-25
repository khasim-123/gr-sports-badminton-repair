import React from 'react';
import { Button } from './Button';
import {
  Inbox,
  Clock,
  CheckCircle2,
  MapPin,
  Truck,
  Wrench,
  IndianRupee,
  Users,
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
  const iconClass = 'w-7 h-7 text-ink-muted';
  let defaultIcon = <Inbox className={iconClass} />;
  let defaultTitle = 'Nothing here yet';
  let defaultDesc = 'There is nothing to show in this view right now.';
  let defaultBtn = 'Refresh';

  switch (type) {
    case 'no_requests':
      defaultTitle = 'No bookings yet';
      defaultDesc = 'Book racket stringing or a repair and it will show up here.';
      defaultBtn = 'Book a service';
      break;
    case 'no_active':
      defaultIcon = <Clock className={iconClass} />;
      defaultTitle = 'Nothing in progress';
      defaultDesc = 'You have no open requests right now.';
      defaultBtn = 'Book a service';
      break;
    case 'no_completed':
      defaultIcon = <CheckCircle2 className={iconClass} />;
      defaultTitle = 'No completed requests';
      defaultDesc = 'Requests appear here once they are delivered and paid.';
      defaultBtn = 'See open requests';
      break;
    case 'no_addresses':
      defaultIcon = <MapPin className={iconClass} />;
      defaultTitle = 'No saved addresses';
      defaultDesc = 'Save the address we should collect your racket from.';
      defaultBtn = 'Add address';
      break;
    case 'no_pickups':
      defaultIcon = <Truck className={iconClass} />;
      defaultTitle = 'No pickups assigned';
      defaultDesc = 'There are no pickups for you right now.';
      defaultBtn = 'Refresh';
      break;
    case 'no_getting':
      defaultIcon = <Wrench className={iconClass} />;
      defaultTitle = 'No stringing jobs waiting';
      defaultDesc = 'The stringing queue is empty.';
      defaultBtn = 'Refresh';
      break;
    case 'no_repair':
      defaultIcon = <Wrench className={iconClass} />;
      defaultTitle = 'No repairs waiting for inspection';
      defaultDesc = 'There are no rackets waiting to be inspected.';
      defaultBtn = 'Refresh';
      break;
    case 'no_deliveries':
      defaultIcon = <Truck className={iconClass} />;
      defaultTitle = 'No deliveries waiting';
      defaultDesc = 'There are no rackets waiting to go back to customers.';
      defaultBtn = 'Refresh';
      break;
    case 'no_payments':
      defaultIcon = <IndianRupee className={iconClass} />;
      defaultTitle = 'No payments to collect';
      defaultDesc = 'There are no payments waiting to be collected.';
      defaultBtn = 'Refresh';
      break;
    case 'no_customers':
      defaultIcon = <Users className={iconClass} />;
      defaultTitle = 'No customers yet';
      defaultDesc = 'Customers appear here after they sign in and book.';
      defaultBtn = 'Refresh';
      break;
  }

  return (
    <div className="bg-white rounded-2xl border border-dashed border-line p-8 sm:p-10 text-center flex flex-col items-center justify-center max-w-md mx-auto my-6">
      <div className="w-14 h-14 rounded-2xl bg-paper flex items-center justify-center mb-4 border border-line" aria-hidden="true">
        {defaultIcon}
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">{title || defaultTitle}</h3>
      <p className="text-sm text-slate-600 mb-5 leading-relaxed max-w-sm">
        {description || defaultDesc}
      </p>
      {onAction && (
        <Button
          onClick={onAction}
          variant="primary"
          size="md"
          className="min-h-[44px]"
          leftIcon={<PlusCircle className="w-4 h-4" />}
        >
          {actionText || defaultBtn}
        </Button>
      )}
    </div>
  );
};
