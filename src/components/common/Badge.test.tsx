import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RequestStatus } from '../../types';
import { StatusBadge, statusLabel } from './Badge';

const ALL_STATUSES: RequestStatus[] = [
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
  'Getting in Progress',
  'Getting Completed',
  'Repair Completed',
  'Out for Delivery',
  'Delivered',
  'Payment Pending',
  'Payment Collected',
  'Completed',
  'Repair Declined',
  'Completed Without Repair',
  'Cancelled',
];

describe('statusLabel', () => {
  it.each([
    ['Submitted', 'Booked'],
    ['Employee Assigned', 'Assigned'],
    ['Bat Picked Up', 'Racket picked up'],
    ['Inspection', 'Being inspected'],
    ['Getting in Progress', 'Stringing in progress'],
    ['Getting Completed', 'Stringing done'],
    ['Repair Estimate', 'Waiting for approval'],
    ['Repair Estimate Sent', 'Waiting for approval'],
    ['Awaiting Customer Approval', 'Waiting for approval'],
    ['Payment Pending', 'Payment due'],
    ['Payment Collected', 'Paid'],
    ['Completed Without Repair', 'Returned without repair'],
  ])('%s -> %s', (status, label) => {
    expect(statusLabel(status)).toBe(label);
  });

  it('shows unknown statuses as they are, and nothing for no status', () => {
    expect(statusLabel('On Hold')).toBe('On Hold');
    expect(statusLabel('')).toBe('');
    expect(statusLabel(null)).toBe('');
    expect(statusLabel(undefined)).toBe('');
  });

  it('never shows the internal "Getting" / "Bat" wording for any request status', () => {
    for (const status of ALL_STATUSES) {
      const label = statusLabel(status);
      expect(label, status).not.toBe('');
      expect(label, status).not.toMatch(/\bgetting\b|\bbat\b/i);
    }
  });
});

describe('StatusBadge', () => {
  it('shows the friendly wording for a status', () => {
    render(<StatusBadge status="Bat Picked Up" />);
    expect(screen.getByText('Racket picked up')).toBeInTheDocument();
    expect(screen.queryByText('Bat Picked Up')).not.toBeInTheDocument();
  });

  it('shows custom text when given', () => {
    render(
      <StatusBadge variant="success" size="sm">
        Paid by UPI
      </StatusBadge>,
    );
    expect(screen.getByText('Paid by UPI')).toBeInTheDocument();
  });
});
