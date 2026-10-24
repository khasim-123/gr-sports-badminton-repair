/**
 * Customers (admin only): booking counts, open jobs and payments per customer,
 * computed by the server from service requests by mobile number.
 */
import { apiClient } from './apiClient';

export interface CustomerSummary {
  id: string;
  name: string;
  phone: string; // +91XXXXXXXXXX
  address?: string | null;
  createdAt: string;
  bookings: number;
  openBookings: number;
  lastBookingAt?: string | null;
  totalPaid: number;
}

export interface CustomerRequestSummary {
  id: string;
  serviceType: 'GETTING' | 'REPAIR';
  status: string;
  paymentStatus?: string | null;
  totalAmount: number;
  createdAt: string;
  batBrand?: string | null;
  batModel?: string | null;
}

export interface CustomerDetail {
  customer: CustomerSummary;
  requests: CustomerRequestSummary[];
}

export const customerService = {
  /** GET /api/customers?search= — most recent booking first. */
  listCustomers(search?: string): Promise<CustomerSummary[]> {
    const q = (search || '').trim();
    return apiClient.get<CustomerSummary[]>(q ? `/customers?search=${encodeURIComponent(q)}` : '/customers');
  },

  /** GET /api/customers/:id — the customer and their booking history (newest first). */
  getCustomer(id: string): Promise<CustomerDetail> {
    return apiClient.get<CustomerDetail>(`/customers/${encodeURIComponent(id)}`);
  },
};
