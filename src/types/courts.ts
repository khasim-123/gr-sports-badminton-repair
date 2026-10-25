/**
 * GR Sports court booking — venues, courts, availability and bookings.
 * Mirrors the FastAPI schemas in backend/app/schemas.py (courts section).
 *
 * Times are local India time, "HH:MM" 24-hour; dates are "YYYY-MM-DD".
 * Courts are paid for at the venue (Cash / UPI); online payment can be added later.
 */

// ---------- Venue & courts (admin-managed) ----------

export interface CourtVenue {
  id: string;
  name: string; // e.g. "GR Sports Courts, Dondaparthy"
  address: string;
  area?: string | null;
  mapsUrl?: string | null; // https Google Maps link
  description?: string | null;
  photos: string[]; // up to 6
  amenities: string[]; // e.g. ["Wooden floor", "Parking", "Drinking water"]
  rules?: string | null; // e.g. "Non-marking shoes only"
  openTime: string; // "06:00"
  closeTime: string; // "22:00" (last slot ends here)
  slotMinutes: 30 | 60;
  pricePerHour: number; // ₹ base price for one court for one hour
  peakPricePerHour?: number | null; // optional, applies every day between peakStart and peakEnd
  peakStart?: string | null; // "17:00"
  peakEnd?: string | null; // "21:00"
  weekendPricePerHour?: number | null; // optional, applies all day Sat & Sun (takes precedence over peak)
  advanceDays: number; // how many days ahead customers can book (e.g. 14)
  maxSlotsPerBooking: number; // consecutive slots one booking may take (e.g. 4)
  cancellationHours: number; // customers can cancel until this many hours before the start (e.g. 12)
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  courts: Court[]; // sorted by sortOrder
}

export type CourtVenueInput = Omit<CourtVenue, 'id' | 'createdAt' | 'sortOrder' | 'courts'> & { sortOrder?: number };

export interface Court {
  id: string;
  venueId: string;
  name: string; // "Court 1"
  surface?: string | null; // "Wooden", "Synthetic mat"
  isActive: boolean;
  sortOrder: number;
}

export type CourtInput = Omit<Court, 'id' | 'venueId' | 'sortOrder'> & { sortOrder?: number };

/**
 * Blocked time (coaching batch, tournament, maintenance). Either a single `date`, or a weekly
 * pattern (`weekdays` 0=Mon … 6=Sun) between `fromDate` and optional `toDate`.
 * `courtId` null = every court at the venue.
 */
export interface CourtBlock {
  id: string;
  venueId: string;
  courtId?: string | null;
  date?: string | null;
  weekdays?: number[] | null;
  fromDate?: string | null;
  toDate?: string | null;
  startTime: string;
  endTime: string;
  reason: string; // shown to the admin; customers just see "Not available"
  createdAt: string;
}

export type CourtBlockInput = Omit<CourtBlock, 'id' | 'createdAt'>;

// ---------- Availability (public) ----------

export type SlotState = 'free' | 'booked' | 'blocked' | 'past';

export interface AvailabilityCell {
  start: string; // "18:00"
  end: string; // "19:00"
  state: SlotState;
  price: number; // ₹ for this slot on this court (slot length × hourly rate)
}

export interface CourtAvailability {
  courtId: string;
  courtName: string;
  surface?: string | null;
  cells: AvailabilityCell[]; // same order/length for every court
}

export interface VenueAvailability {
  venueId: string;
  date: string;
  slotMinutes: number;
  bookable: boolean; // false when the date is outside the booking window or the venue is closed
  message?: string | null; // why not bookable, in plain words
  courts: CourtAvailability[];
}

// ---------- Bookings ----------

export type CourtBookingStatus = 'Confirmed' | 'Completed' | 'No-show' | 'Cancelled';

export interface CourtBooking {
  id: string; // "CRT-48213"
  venueId: string;
  venueName: string;
  courtId: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  slots: number;
  price: number; // ₹ total, computed by the server
  customerName: string;
  customerMobile: string; // +91XXXXXXXXXX
  players?: number | null;
  notes?: string | null;
  status: CourtBookingStatus;
  paymentStatus: 'Pending' | 'Paid';
  paymentMethod?: 'Cash' | 'UPI' | 'Other' | null;
  paidAt?: string | null;
  bookedBy: 'customer' | 'admin'; // admin = walk-in / phone booking
  cancelReason?: string | null;
  canCancel: boolean; // computed for the current user (customer: before the cut-off)
  createdAt: string;
  timeline: { status: string; label: string; timestamp: string; actor: string; notes?: string | null }[];
}

export interface CourtBookingInput {
  venueId: string;
  courtId: string;
  date: string;
  startTime: string;
  slots: number; // consecutive slots from startTime (1 … maxSlotsPerBooking)
  players?: number;
  notes?: string;
  // Admin walk-in / phone bookings only:
  customerName?: string;
  customerMobile?: string;
}
