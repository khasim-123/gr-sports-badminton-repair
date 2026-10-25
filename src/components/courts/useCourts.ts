import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { courtService } from '../../services/courtService';
import type { CourtBooking, CourtVenue } from '../../types/courts';
import { activeVenues, splitBookings } from './courtFormat';

// ---------- Venues (public, shared by the homepage and /courts) ----------

export interface VenuesState {
  status: 'loading' | 'ready' | 'error';
  venues: CourtVenue[];
}

let venuesCache: CourtVenue[] | null = null;
let venuesFetchedAt = 0;
let venuesInFlight: Promise<CourtVenue[]> | null = null;
const VENUES_TTL_MS = 60_000;

function fetchVenues(force = false): Promise<CourtVenue[]> {
  if (!force && venuesCache && Date.now() - venuesFetchedAt < VENUES_TTL_MS) return Promise.resolve(venuesCache);
  if (!venuesInFlight) {
    venuesInFlight = courtService
      .getVenues()
      .then((list) => activeVenues(list))
      .catch((err) => {
        // No court booking on this server yet: same as no venues.
        if (err instanceof ApiError && err.status === 404) return [] as CourtVenue[];
        throw err;
      })
      .then((list) => {
        venuesCache = list;
        venuesFetchedAt = Date.now();
        return list;
      })
      .finally(() => {
        venuesInFlight = null;
      });
  }
  return venuesInFlight;
}

/** Active venues with their active courts (GET /api/courts/venues). Empty while court booking isn't set up. */
export function useCourtVenues() {
  const [state, setState] = useState<VenuesState>(() =>
    venuesCache ? { status: 'ready', venues: venuesCache } : { status: 'loading', venues: [] },
  );
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchVenues(nonce > 0)
      .then((venues) => !cancelled && setState({ status: 'ready', venues }))
      .catch(() => !cancelled && setState((s) => (s.venues.length ? s : { status: 'error', venues: [] })));
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => {
    setState((s) => (s.venues.length ? s : { status: 'loading', venues: [] }));
    setNonce((n) => n + 1);
  }, []);

  return { ...state, reload };
}

// ---------- The signed-in customer's bookings ----------

export interface MyCourtBookingsState {
  /** 'unsupported' = this server has no court booking yet (404). */
  status: 'loading' | 'ready' | 'error' | 'unsupported';
  bookings: CourtBooking[];
}

/** The signed-in customer's court bookings (GET /api/court-bookings). */
export function useMyCourtBookings(enabled = true) {
  const [state, setState] = useState<MyCourtBookingsState>({ status: 'loading', bookings: [] });

  const reload = useCallback(() => {
    setState((s) => ({ ...s, status: s.bookings.length ? s.status : 'loading' }));
    courtService
      .getBookings()
      .then((list) => setState({ status: 'ready', bookings: Array.isArray(list) ? list : [] }))
      .catch((err) =>
        setState({ status: err instanceof ApiError && err.status === 404 ? 'unsupported' : 'error', bookings: [] }),
      );
  }, []);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  const replace = useCallback((booking: CourtBooking) => {
    setState((s) => ({
      ...s,
      bookings: s.bookings.some((b) => b.id === booking.id) ? s.bookings.map((b) => (b.id === booking.id ? booking : b)) : [booking, ...s.bookings],
    }));
  }, []);

  return { ...state, ...splitBookings(state.bookings), reload, replace };
}
