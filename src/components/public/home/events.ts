/** Display helpers for SiteEvent (dates, fee, spots, registration call-to-action). */
import type { SiteEvent, SiteEventCategory } from '../../../types/content';
import { formatInr, formatDay, parseIsoDate, safeImageUrl, safeUrl } from './format';
import { currentShop, type ShopView } from './shop';

export const CATEGORY_LABEL: Record<SiteEventCategory, string> = {
  tournament: 'Tournament',
  coaching_camp: 'Coaching camp',
  clinic: 'Clinic',
  store_event: 'At the shop',
  other: 'Event',
};

export function categoryLabel(e: SiteEvent): string {
  return CATEGORY_LABEL[e.category] || 'Event';
}

const MONTH = (d: Date) => d.toLocaleDateString('en-IN', { month: 'short' });

/**
 * Single day: "Sat 14 Nov" (year added when it isn't this year).
 * Range: "14–15 Nov", "30 Nov – 2 Dec", "30 Dec 2026 – 2 Jan 2027".
 */
export function eventDateText(e: Pick<SiteEvent, 'startDate' | 'endDate'>): string {
  const start = parseIsoDate(e.startDate);
  const end = parseIsoDate(e.endDate);
  if (!start) return e.startDate;
  const thisYear = new Date().getFullYear();
  if (!end || e.endDate === e.startDate || end < start) {
    const wd = start.toLocaleDateString('en-IN', { weekday: 'short' });
    return `${wd} ${start.getDate()} ${MONTH(start)}${start.getFullYear() !== thisYear ? ` ${start.getFullYear()}` : ''}`;
  }
  const yearSuffix = (d: Date) => (d.getFullYear() !== thisYear ? ` ${d.getFullYear()}` : '');
  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.getDate()} ${MONTH(start)} ${start.getFullYear()} – ${end.getDate()} ${MONTH(end)} ${end.getFullYear()}`;
  }
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTH(end)}${yearSuffix(end)}`;
  }
  return `${start.getDate()} ${MONTH(start)} – ${end.getDate()} ${MONTH(end)}${yearSuffix(end)}`;
}

/** Long form for the details dialog: "Saturday, 14 November 2026" or a range. */
export function eventDateLong(e: Pick<SiteEvent, 'startDate' | 'endDate'>): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const start = parseIsoDate(e.startDate);
  const end = parseIsoDate(e.endDate);
  if (!start) return e.startDate;
  if (!end || e.endDate === e.startDate || end < start) return start.toLocaleDateString('en-IN', opts);
  const wd = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'long' });
  const month = (d: Date) => d.toLocaleDateString('en-IN', { month: 'long' });
  if (start.getFullYear() === end.getFullYear()) {
    const startPart = start.getMonth() === end.getMonth() ? `${wd(start)} ${start.getDate()}` : `${wd(start)} ${start.getDate()} ${month(start)}`;
    return `${startPart} to ${wd(end)} ${end.getDate()} ${month(end)} ${end.getFullYear()}`;
  }
  return `${start.toLocaleDateString('en-IN', opts)} to ${end.toLocaleDateString('en-IN', opts)}`;
}

/** Date block on cards: { month: "Nov", day: "14" | "14–15" }. Month of the start date. */
export function eventDateBlock(e: Pick<SiteEvent, 'startDate' | 'endDate'>): { month: string; day: string } {
  const start = parseIsoDate(e.startDate);
  const end = parseIsoDate(e.endDate);
  if (!start) return { month: '', day: e.startDate };
  // Same-month ranges show "14–15"; ranges across months show the start day (the full range is in the text).
  const sameMonth = !!end && end > start && end.getMonth() === start.getMonth() && end.getFullYear() === start.getFullYear();
  return { month: MONTH(start), day: sameMonth ? `${start.getDate()}–${end!.getDate()}` : String(start.getDate()) };
}

export function hasFee(e: SiteEvent): boolean {
  return typeof e.entryFee === 'number' && Number.isFinite(e.entryFee) && e.entryFee > 0;
}

/** "₹600 per pair" / "Free entry". */
export function feeText(e: SiteEvent): string {
  if (!hasFee(e)) return 'Free entry';
  const note = (e.feeNote || '').trim();
  return `${formatInr(e.entryFee as number)}${note ? ` ${note}` : ''}`;
}

/** "12 spots left" / "Full" / null when there's no capacity. */
export function spotsText(e: SiteEvent): string | null {
  if (e.registrationMode !== 'form' || typeof e.spotsLeft !== 'number') return null;
  if (e.spotsLeft <= 0) return 'Full';
  return `${e.spotsLeft} ${e.spotsLeft === 1 ? 'spot' : 'spots'} left`;
}

/** Short registration status for cards and the dialog. */
export function registrationStatus(e: SiteEvent): string | null {
  if (e.registrationMode === 'none') return null;
  if (!e.registrationOpen) {
    if (e.registrationMode === 'form' && typeof e.spotsLeft === 'number' && e.spotsLeft <= 0) return 'Registrations full';
    return 'Registration closed';
  }
  if (e.registrationDeadline) return `Register by ${formatDay(e.registrationDeadline)}`;
  return 'Registration open';
}

export function eventPhoto(e: SiteEvent): { desktop: string | null; mobile: string | null } {
  return { desktop: safeImageUrl(e.bannerImageUrl), mobile: safeImageUrl(e.mobileImageUrl) };
}

export type EventAction =
  | { kind: 'form'; label: string }
  | { kind: 'details'; label: string }
  | { kind: 'link'; label: string; href: string; external: boolean };

/** The main call-to-action for an event (banner slide, card, dialog). Pass `shop` from useShop() in components. */
export function eventAction(e: SiteEvent, shop: ShopView = currentShop()): EventAction {
  if (e.registrationMode === 'none' || !e.registrationOpen) return { kind: 'details', label: 'View details' };
  switch (e.registrationMode) {
    case 'form':
      return { kind: 'form', label: 'Register' };
    case 'whatsapp':
      return {
        kind: 'link',
        label: 'Register on WhatsApp',
        href: shop.whatsAppLink(shop.greeting(`I'd like to register for ${e.title} (${eventDateText(e)}).`)),
        external: true,
      };
    case 'phone':
      return { kind: 'link', label: 'Call to register', href: shop.phoneTel, external: false };
    case 'url': {
      const href = safeUrl(e.registrationUrl);
      return href ? { kind: 'link', label: 'Register', href, external: true } : { kind: 'details', label: 'View details' };
    }
    default:
      return { kind: 'details', label: 'View details' };
  }
}

/** Events that may appear on the homepage, soonest first (server already filters, this is a safety net). */
export function visibleEvents(events: SiteEvent[] | undefined): SiteEvent[] {
  return (events || [])
    .filter((e) => e && e.isActive !== false && e.status !== 'past' && (e.title || '').trim())
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.sortOrder - b.sortOrder);
}

/** Doubles / mixed categories take a partner's name. */
export function needsPartner(category: string | undefined): boolean {
  return !!category && /doubles|mixed|pair/i.test(category);
}
