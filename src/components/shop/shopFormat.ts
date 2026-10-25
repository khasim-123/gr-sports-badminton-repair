import type { ApparelCategory, ApparelProduct, ApparelVariant, OrderStatus, ShopOrder } from '../../types/shop';
import { safeHex, safeImageUrl } from '../public/home/format';

export { formatInr } from '../public/home/format';

export const CATEGORY_LABELS: Record<ApparelCategory, string> = {
  't-shirt': 'T-shirts',
  jersey: 'Jerseys',
  shorts: 'Shorts',
  track: 'Track',
  accessory: 'Accessories',
};
export const CATEGORY_ORDER: ApparelCategory[] = ['t-shirt', 'jersey', 'shorts', 'track', 'accessory'];

/** srcset for the bundled photos (name.webp + name-sm.webp); undefined for other images. */
export { siteSrcSet as photoSrcSet } from '../public/home/format';

export function productPhotos(p: Pick<ApparelProduct, 'images'>): string[] {
  const seen = new Set<string>();
  for (const url of Array.isArray(p.images) ? p.images : []) {
    const safe = safeImageUrl(url);
    if (safe) seen.add(safe);
  }
  return [...seen].slice(0, 6);
}

export function activeApparel(list: ApparelProduct[] | null | undefined): ApparelProduct[] {
  return (Array.isArray(list) ? list : [])
    .filter((p) => p && p.isActive !== false && (p.name || '').trim() && Number.isFinite(p.price))
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function sortedVariants(p: ApparelProduct): ApparelVariant[] {
  return [...(p.variants || [])].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Distinct sizes / colours (the server sends them; fall back to the variants). */
export function productSizes(p: ApparelProduct): string[] {
  if (Array.isArray(p.sizes) && p.sizes.length) return p.sizes;
  return [...new Set(sortedVariants(p).map((v) => v.size))];
}

export function productColours(p: ApparelProduct): { colour: string; colourHex?: string | null }[] {
  if (Array.isArray(p.colours) && p.colours.length) return p.colours;
  const seen = new Map<string, string | null | undefined>();
  sortedVariants(p).forEach((v) => {
    if (!seen.has(v.colour)) seen.set(v.colour, v.colourHex);
  });
  return [...seen.entries()].map(([colour, colourHex]) => ({ colour, colourHex }));
}

export function productInStock(p: ApparelProduct): boolean {
  if (typeof p.inStock === 'boolean') return p.inStock;
  return (p.variants || []).some((v) => v.stock > 0);
}

/** "Sizes S–XXL", "Sizes M, L", "Free size". */
export function sizesLabel(sizes: string[]): string {
  if (!sizes.length) return '';
  if (sizes.length === 1) return /free/i.test(sizes[0]) ? sizes[0] : `Size ${sizes[0]}`;
  if (sizes.length === 2) return `Sizes ${sizes.join(', ')}`;
  return `Sizes ${sizes[0]}–${sizes[sizes.length - 1]}`;
}

/** A CSS colour for a swatch: the admin's hex, else a guess from common colour names. */
const NAMED: Record<string, string> = {
  white: '#FFFFFF',
  black: '#111111',
  navy: '#1B2A4A',
  'navy blue': '#1B2A4A',
  blue: '#2457C5',
  'royal blue': '#2453B8',
  'sky blue': '#7DB7E8',
  red: '#C62828',
  maroon: '#6D1B2B',
  green: '#2E7D32',
  'bottle green': '#1F4D36',
  yellow: '#F2C200',
  orange: '#E8711C',
  grey: '#8A8F98',
  gray: '#8A8F98',
  charcoal: '#3A3F47',
  pink: '#E58FB0',
  purple: '#5E3A8C',
};
export function swatchColour(colour: string, hex?: string | null): string | null {
  return safeHex(hex) || NAMED[(colour || '').trim().toLowerCase()] || null;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  Placed: 'bg-paper-deep text-ink border-line',
  Confirmed: 'bg-sky-50 text-sky-900 border-sky-200',
  Packed: 'bg-sky-50 text-sky-900 border-sky-200',
  'Out for Delivery': 'bg-amber-50 text-amber-900 border-amber-200',
  'Ready for Pickup': 'bg-amber-50 text-amber-900 border-amber-200',
  Delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'Picked Up': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
};

export function canCustomerCancel(o: Pick<ShopOrder, 'status'>): boolean {
  return o.status === 'Placed' || o.status === 'Confirmed';
}

export function isOpenOrder(o: Pick<ShopOrder, 'status'>): boolean {
  return !['Delivered', 'Picked Up', 'Cancelled'].includes(o.status);
}

export function itemCount(o: Pick<ShopOrder, 'items'>): number {
  return (o.items || []).reduce((n, i) => n + (i.quantity || 0), 0);
}

export function orderDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** One line on what happens next, for the order screens. */
export function nextStepText(o: ShopOrder): string {
  const pay = o.paymentStatus === 'Paid' ? 'Paid' : 'Pay in cash or by UPI';
  switch (o.status) {
    case 'Placed':
      return o.fulfilment === 'delivery'
        ? `We'll check your order and call you before we deliver. ${pay} when it arrives.`
        : `We'll check your order and message you when it's ready at the shop. ${pay} when you collect it.`;
    case 'Confirmed':
    case 'Packed':
      return o.fulfilment === 'delivery' ? `Your order is being packed for delivery. ${pay} when it arrives.` : `Your order is being packed. We'll tell you when it's ready to collect.`;
    case 'Out for Delivery':
      return `On the way to you. ${pay} when it arrives.`;
    case 'Ready for Pickup':
      return `Ready at the shop. ${pay} when you collect it.`;
    case 'Delivered':
      return 'Delivered. Thank you for shopping with us.';
    case 'Picked Up':
      return 'Collected from the shop. Thank you.';
    case 'Cancelled':
      return o.cancelReason ? `Cancelled: ${o.cancelReason}` : 'This order was cancelled.';
    default:
      return '';
  }
}
