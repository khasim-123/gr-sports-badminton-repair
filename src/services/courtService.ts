/**
 * Court booking: venues & courts, availability, bookings.
 */
import { apiClient } from './apiClient';
import type {
  Court,
  CourtBlock,
  CourtBlockInput,
  CourtBooking,
  CourtBookingInput,
  CourtBookingStatus,
  CourtInput,
  CourtVenue,
  CourtVenueInput,
  VenueAvailability,
} from '../types/courts';

export const courtService = {
  // ---------- Public ----------

  /** Active venues with their active courts. */
  getVenues(): Promise<CourtVenue[]> {
    return apiClient.get<CourtVenue[]>('/courts/venues');
  },

  getAvailability(venueId: string, date: string): Promise<VenueAvailability> {
    return apiClient.get<VenueAvailability>(`/courts/availability?venueId=${encodeURIComponent(venueId)}&date=${date}`);
  },

  // ---------- Customer (and admin) ----------

  /** Customers book for themselves; the admin may book for a walk-in / phone customer. */
  book(input: CourtBookingInput): Promise<CourtBooking> {
    return apiClient.post<CourtBooking>('/court-bookings', input);
  },

  /** Customers get their own bookings; the admin gets bookings between `from` and `to` (default: today onwards). */
  getBookings(params: { from?: string; to?: string; venueId?: string } = {}): Promise<CourtBooking[]> {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => !!v) as [string, string][]).toString();
    return apiClient.get<CourtBooking[]>(`/court-bookings${q ? `?${q}` : ''}`);
  },

  getBooking(id: string): Promise<CourtBooking> {
    return apiClient.get<CourtBooking>(`/court-bookings/${id}`);
  },

  cancelBooking(id: string, reason: string): Promise<CourtBooking> {
    return apiClient.post<CourtBooking>(`/court-bookings/${id}/cancel`, { reason });
  },

  // ---------- Admin ----------

  /** 'Completed' or 'No-show' once the slot has started. */
  updateBookingStatus(id: string, status: Extract<CourtBookingStatus, 'Completed' | 'No-show'>, notes?: string): Promise<CourtBooking> {
    return apiClient.patch<CourtBooking>(`/court-bookings/${id}/status`, { status, notes });
  },

  /** Amount must equal the booking price (a different amount needs a note). */
  recordBookingPayment(id: string, amount: number, method: 'Cash' | 'UPI' | 'Other', notes?: string): Promise<CourtBooking> {
    return apiClient.post<CourtBooking>(`/court-bookings/${id}/payment`, { amount, method, notes });
  },

  listVenuesAdmin(): Promise<CourtVenue[]> {
    return apiClient.get<CourtVenue[]>('/courts/admin/venues');
  },
  createVenue(input: CourtVenueInput): Promise<CourtVenue> {
    return apiClient.post<CourtVenue>('/courts/admin/venues', input);
  },
  updateVenue(id: string, input: Partial<CourtVenueInput>): Promise<CourtVenue> {
    return apiClient.put<CourtVenue>(`/courts/admin/venues/${id}`, input);
  },
  deleteVenue(id: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/courts/admin/venues/${id}`);
  },
  addCourt(venueId: string, input: CourtInput): Promise<Court> {
    return apiClient.post<Court>(`/courts/admin/venues/${venueId}/courts`, input);
  },
  updateCourt(courtId: string, input: Partial<CourtInput>): Promise<Court> {
    return apiClient.put<Court>(`/courts/admin/courts/${courtId}`, input);
  },
  deleteCourt(courtId: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/courts/admin/courts/${courtId}`);
  },
  listBlocks(venueId: string): Promise<CourtBlock[]> {
    return apiClient.get<CourtBlock[]>(`/courts/admin/venues/${venueId}/blocks`);
  },
  createBlock(input: CourtBlockInput): Promise<CourtBlock> {
    return apiClient.post<CourtBlock>('/courts/admin/blocks', input);
  },
  deleteBlock(blockId: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/courts/admin/blocks/${blockId}`);
  },
};
