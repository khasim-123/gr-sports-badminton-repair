import { useEffect, useState } from 'react';
import { contentService } from '../services/contentService';
import type { ShopSettings } from '../types/content';

/**
 * Admin-editable shop details (name, phone, WhatsApp, email, address, opening hours).
 *
 * Loaded once per page from GET /api/config/shop and shared through a module-level cache, so
 * every component that calls `useShopSettings()` re-renders together when the values arrive.
 * Until then (or if the request fails / the server is older and has no such endpoint) the
 * defaults below are used — they mirror backend/app/services/shop_settings.py DEFAULTS.
 */
export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  name: 'GR Sports',
  tagline: 'Badminton · Dondaparthy, Vizag',
  phone: '+917675831496',
  whatsapp: '+917675831496',
  email: 'grsportshub@gmail.com',
  addressLine: 'Beside Ramalayam Arch, Near Diamond Park',
  area: 'Dondaparthy, Visakhapatnam',
  pincode: '530016',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=GR+Sports+Dondaparthy+Visakhapatnam',
  openingHours: 'Mon–Sat 10:00 AM – 8:00 PM · Sunday closed',
  declinedRepairFee: 0,
};

let current: ShopSettings = DEFAULT_SHOP_SETTINGS;
let loaded = false;
let inFlight: Promise<ShopSettings> | null = null;
const listeners = new Set<(s: ShopSettings) => void>();

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Merges server values over the defaults; blank / missing / wrong-typed fields keep the default. */
function normalize(raw: Partial<ShopSettings> | null | undefined): ShopSettings {
  const d = DEFAULT_SHOP_SETTINGS;
  if (!raw || typeof raw !== 'object') return d;
  const fee = Number(raw.declinedRepairFee);
  return {
    name: str(raw.name) ?? d.name,
    tagline: str(raw.tagline) ?? d.tagline,
    phone: str(raw.phone) ?? d.phone,
    whatsapp: str(raw.whatsapp) ?? str(raw.phone) ?? d.whatsapp,
    email: raw.email === null || raw.email === '' ? null : str(raw.email) ?? d.email,
    addressLine: str(raw.addressLine) ?? d.addressLine,
    area: str(raw.area) ?? d.area,
    pincode: raw.pincode === null || raw.pincode === '' ? null : str(raw.pincode) ?? d.pincode,
    mapsUrl: str(raw.mapsUrl) ?? d.mapsUrl,
    openingHours: str(raw.openingHours) ?? d.openingHours,
    declinedRepairFee: Number.isFinite(fee) && fee >= 0 ? fee : d.declinedRepairFee,
  };
}

function publish(next: ShopSettings) {
  current = next;
  listeners.forEach((fn) => fn(next));
}

/** Seeds the cache (e.g. from `PublicSiteContent.shop`, which the homepage already loads). */
export function primeShopSettings(s: Partial<ShopSettings> | null | undefined): void {
  if (!s || typeof s !== 'object') return;
  loaded = true;
  publish(normalize(s));
}

/** Fetches the settings once per page load (concurrent callers share one request). Never rejects. */
export function loadShopSettings(): Promise<ShopSettings> {
  if (loaded) return Promise.resolve(current);
  if (!inFlight) {
    inFlight = contentService
      .getShopSettings()
      .then((data) => {
        loaded = true;
        publish(normalize(data));
        return current;
      })
      .catch(() => {
        // Endpoint missing (older server) or offline: keep the defaults, and don't re-request on
        // every component mount for the rest of this page load.
        loaded = true;
        return current;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Re-fetches after the admin saved new details (optional; the next page load picks them up anyway). */
export function refreshShopSettings(): Promise<ShopSettings> {
  loaded = false;
  return loadShopSettings();
}

/** Current settings without subscribing (defaults until loaded). */
export function getShopSettingsSnapshot(): ShopSettings {
  return current;
}

/** Shop details for rendering. Returns the defaults until the server values arrive. */
export function useShopSettings(): ShopSettings {
  const [settings, setSettings] = useState<ShopSettings>(current);
  useEffect(() => {
    listeners.add(setSettings);
    if (settings !== current) setSettings(current);
    void loadShopSettings();
    return () => {
      listeners.delete(setSettings);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return settings;
}

// ---------- Formatting helpers ----------

const digitsOf = (v: string | null | undefined) => String(v || '').replace(/\D/g, '');

/** "+917675831496" -> "+91 76758 31496". Other formats are returned unchanged. */
export function phoneDisplay(e164: string | null | undefined): string {
  const digits = digitsOf(e164);
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return String(e164 || '').trim();
}

/** "+917675831496" -> "tel:+917675831496". */
export function telHref(e164: string | null | undefined): string {
  const raw = String(e164 || '').trim();
  const digits = digitsOf(raw);
  if (digits.length === 10) return `tel:+91${digits}`;
  return `tel:${raw.startsWith('+') ? '+' : ''}${digits}`;
}

/** "+917675831496", "Hi" -> "https://wa.me/917675831496?text=Hi". */
export function whatsappHref(e164: string | null | undefined, text?: string): string {
  let digits = digitsOf(e164);
  if (digits.length === 10) digits = `91${digits}`;
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Address lines: ["Beside Ramalayam Arch, Near Diamond Park", "Dondaparthy, Visakhapatnam 530016"]. */
export function addressLines(s: ShopSettings): string[] {
  const area = [s.area, s.pincode].filter(Boolean).join(' ').trim();
  return [s.addressLine, area].map((l) => (l || '').trim()).filter(Boolean);
}

/** "Beside Ramalayam Arch, Near Diamond Park, Dondaparthy, Visakhapatnam 530016". */
export function fullAddress(s: ShopSettings): string {
  return addressLines(s).join(', ');
}

/** Google Maps link: the admin's link when set, else a search for the shop name + area. */
export function mapsHref(s: ShopSettings): string {
  if (s.mapsUrl && /^https?:\/\//i.test(s.mapsUrl)) return s.mapsUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name} ${s.area}`)}`;
}

/** Short locality for "in Dondaparthy"-style copy: the first part of `area` ("Dondaparthy"). */
export function localityOf(s: ShopSettings): string {
  return (s.area || '').split(',')[0].trim() || s.area;
}

/** City for "in Visakhapatnam"-style copy: the last part of `area`. */
export function cityOf(s: ShopSettings): string {
  const parts = (s.area || '').split(',').map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] || s.area;
}
