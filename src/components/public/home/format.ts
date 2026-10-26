/**
 * Formatting + URL-safety helpers for the public homepage.
 * API text is always rendered by React (escaped); URLs from the API go through safeUrl / safeImageUrl.
 */
import type { DistancePricingConfig, GettingServiceTier } from '../../../types';
import type { AvailabilitySettings, StringProduct, StringVariant } from '../../../types/content';

/**
 * Only allow http(s) and same-origin relative URLs (e.g. "/images/strings/x.webp", "/uploads/..").
 * Returns null for anything else (javascript:, data:, protocol-relative "//host", ...).
 */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * Stricter rule for photos (matches the backend): https:// links, same-origin paths,
 * or http://localhost during local development.
 */
export function safeImageUrl(url: string | null | undefined): string | null {
  const safe = safeUrl(url);
  if (!safe) return null;
  return safe.startsWith('/') || safe.startsWith('https:') || /^http:\/\/(localhost|127\.0\.0\.1)[:/]/i.test(safe) ? safe : null;
}

/** Accept only #rgb / #rgba / #rrggbb / #rrggbbaa colour values. */
export function safeHex(value: string | null | undefined): string | null {
  return value && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim()) ? value.trim() : null;
}

/**
 * The bundled site photos ship as `name.webp` (1920 px) + `name-sm.webp` (800 px).
 * Returns a srcset for those; undefined for any other image.
 */
export function siteSrcSet(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const m = /^(\/images\/(site|apparel)\/.+?)(-sm)?\.webp$/.exec(url);
  if (!m) return undefined;
  // Site photos are 1920 px wide, the apparel photos 1600 px.
  return `${m[1]}-sm.webp 800w, ${m[1]}.webp ${m[2] === 'site' ? 1920 : 1600}w`;
}

/** ₹ with Indian digit grouping, e.g. ₹1,49,990. */
export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function hasPrice(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** "+91 98765 43210" from any 10-digit input. */
export function displayMobile(digits: string): string {
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/** Accepts "98765 43210", "+91 98765-43210", "09876543210" … → 10 digits, or null. */
export function normaliseMobile(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** Local YYYY-MM-DD (not UTC). */
export function localIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Mon, 26 Oct" (adds the year when it isn't this year). */
export function formatDay(iso: string, opts: { weekday?: boolean } = {}): string {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-IN', {
    weekday: opts.weekday === false ? undefined : 'short',
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
}

/** openWeekdays uses Monday = 0 … Sunday = 6 (backend convention). */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** [0..5] -> "Mon–Sat"; [0,2,4] -> "Mon, Wed, Fri"; all -> "Every day". */
export function describeWeekdays(days: number[] | undefined): string {
  const sorted = Array.from(new Set((days || []).filter((d) => d >= 0 && d <= 6))).sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  if (sorted.length === 7) return 'Every day';
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (contiguous && sorted.length > 2) return `${WEEKDAYS[sorted[0]]}–${WEEKDAYS[sorted[sorted.length - 1]]}`;
  return sorted.map((d) => WEEKDAYS[d]).join(', ');
}

/** "10:00 - 13:00" -> "10:00–13:00" (word joiners keep a slot from breaking across lines). */
export function formatSlot(slot: string): string {
  return slot.trim().replace(/\s*-\s*/, '⁠–⁠');
}

/** "Mon–Sat, 10:00–13:00 and 16:00–19:00" (either part may be missing). */
export function describePickupHours(settings: AvailabilitySettings | undefined | null): { days: string; slots: string } {
  if (!settings) return { days: '', slots: '' };
  const slots = (settings.pickupSlots || []).map(formatSlot).filter(Boolean);
  const slotText = slots.length <= 1 ? slots.join('') : `${slots.slice(0, -1).join(', ')} and ${slots[slots.length - 1]}`;
  return { days: describeWeekdays(settings.openWeekdays), slots: slotText };
}

const rtf =
  typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;

/** "2 days ago", "last week", ... Falls back to a plain date. */
export function relativeDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  if (rtf) {
    for (const [unit, seconds] of units) {
      if (Math.abs(diffSec) >= seconds) return rtf.format(Math.round(diffSec / seconds), unit);
    }
    return 'just now';
  }
  return date.toLocaleDateString('en-IN');
}

// ---------------------------------------------------------------------------
// Strings catalogue
// ---------------------------------------------------------------------------

/** "Hundred 66X Boost" (no doubled brand when the name already starts with it). */
export function productLabel(p: { brand?: string | null; name?: string | null }): string {
  const brand = (p.brand || '').trim();
  const name = (p.name || '').trim();
  if (!brand || name.toLowerCase().startsWith(brand.toLowerCase())) return name;
  return `${brand} ${name}`;
}

export function sortedVariants(p: StringProduct): StringVariant[] {
  return [...(p.variants || [])].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function inStockCount(p: StringProduct): number {
  return p.variants && p.variants.length ? p.variants.filter((v) => v.inStock).length : p.inStockCount || 0;
}

export function activeStrings(products: StringProduct[]): StringProduct[] {
  return products
    .filter((p) => p.isActive !== false && (p.name || '').trim())
    .sort((a, b) => a.sortOrder - b.sortOrder || productLabel(a).localeCompare(productLabel(b)));
}

// ---------------------------------------------------------------------------
// Pickup pricing / service text derived from the live configuration
// ---------------------------------------------------------------------------

export function formatKm(km: number): string {
  return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
}

/** One sentence on what pickup costs beyond the free radius, from the live distance config. */
export function beyondFreeText(config: DistancePricingConfig): string {
  if (config.pricingMethod === 'SLAB') {
    const slabs = (config.slabs || []).filter((s) => s.price > 0).sort((a, b) => a.minKm - b.minKm);
    if (slabs.length) {
      return `Beyond that, a flat charge by distance: ${slabs
        .map((s) => `${formatInr(s.price)} up to ${formatKm(s.maxKm)}`)
        .join(', ')}.`;
    }
  }
  if (config.perKmRateBeyondFree > 0) {
    return `Beyond that it's ${formatInr(config.perKmRateBeyondFree)} per km.`;
  }
  return '';
}

/** Short label for the "beyond free" fact tile. */
export function beyondFreeShort(config: DistancePricingConfig): { value: string; label: string } | null {
  if (config.pricingMethod === 'SLAB') {
    const slabs = (config.slabs || []).filter((s) => s.price > 0).sort((a, b) => a.price - b.price);
    if (slabs.length) return { value: `from ${formatInr(slabs[0].price)}`, label: `beyond ${formatKm(config.freeRadiusKm)}, by distance` };
  }
  if (config.perKmRateBeyondFree > 0) {
    return { value: `${formatInr(config.perKmRateBeyondFree)}/km`, label: `beyond ${formatKm(config.freeRadiusKm)}` };
  }
  return null;
}

/** "between 24 and 48 hours" from tier turnaround texts like "24 Hours", "24–36 Hours". */
export function turnaroundRange(tiers: GettingServiceTier[]): string | null {
  const hours: number[] = [];
  for (const t of tiers) {
    const text = (t.turnaround || '').toLowerCase();
    if (!/hour/.test(text)) return null;
    const nums = (text.match(/\d+/g) || []).map(Number).filter((n) => n > 0);
    if (!nums.length) return null;
    hours.push(Math.min(...nums), Math.max(...nums));
  }
  if (!hours.length) return null;
  const min = Math.min(...hours);
  const max = Math.max(...hours);
  return min === max ? `about ${min} hours` : `between ${min} and ${max} hours`;
}
