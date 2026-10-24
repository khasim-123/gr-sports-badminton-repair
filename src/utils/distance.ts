/**
 * Pickup distance helpers. Mirrors backend/app/services/pricing_service.py (road_distance_km):
 * straight-line (haversine) distance × ROAD_FACTOR ≈ typical city road distance, rounded to 0.1 km.
 * The server recalculates from the same lat/lng, so the customer sees the number they'll be charged for.
 */
import type { Address } from '../types';

/** Straight line → typical city road distance. Keep in sync with ROAD_FACTOR on the server. */
export const ROAD_FACTOR = 1.3;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km (unrounded). */
export function straightLineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Approximate road distance from the shop, rounded to 0.1 km. */
export function roadDistanceKm(shopLat: number, shopLng: number, lat: number, lng: number): number {
  return Math.round(straightLineKm(shopLat, shopLng, lat, lng) * ROAD_FACTOR * 10) / 10;
}

export function hasCoords(a?: { lat?: number | null; lng?: number | null } | null): a is { lat: number; lng: number } {
  return !!a && typeof a.lat === 'number' && typeof a.lng === 'number' && Number.isFinite(a.lat) && Number.isFinite(a.lng);
}

export type LocationErrorKind = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export class LocationError extends Error {
  constructor(public kind: LocationErrorKind, message: string) {
    super(message);
  }
}

const MESSAGES: Record<LocationErrorKind, string> = {
  unsupported: "This browser can't share your location. Enter the distance from the shop below instead.",
  denied:
    'Location permission is turned off for this site. Allow location in your browser settings and try again, or enter the distance below.',
  unavailable: "We couldn't find your location (GPS or network unavailable). Try again outdoors, or enter the distance below.",
  timeout: 'Finding your location took too long. Try again, or enter the distance below.',
};

/** Asks the browser for the current position (high accuracy, ~15 s). Rejects with a LocationError. */
export function getCurrentLocation(timeoutMs = 15000): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new LocationError('unsupported', MESSAGES.unsupported));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        const kind: LocationErrorKind =
          err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable';
        reject(new LocationError(kind, MESSAGES[kind]));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}

/** How the distance on a request was found, for staff screens. */
export function distanceSourceInfo(address?: Pick<Address, 'distanceSource' | 'lat' | 'lng'> | null): {
  label: string;
  needsCheck: boolean;
} {
  const source = address?.distanceSource ?? (hasCoords(address) ? 'location' : 'customer');
  if (source === 'location') return { label: "from customer's location", needsCheck: false };
  if (source === 'staff') return { label: 'corrected by staff', needsCheck: false };
  return { label: 'entered by customer — check at pickup', needsCheck: true };
}
