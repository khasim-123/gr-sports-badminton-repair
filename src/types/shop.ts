/**
 * GR Sports shop — T-shirts & apparel catalogue, cart and orders.
 * Mirrors the FastAPI schemas in backend/app/schemas.py (shop section).
 *
 * Payment: orders are paid on delivery or at the shop on pickup (Cash / UPI), like service
 * bookings. Online payment can be added later without changing these shapes.
 */
import type { Address } from './index';

// ---------- Apparel catalogue (admin-managed) ----------

export type ApparelCategory = 't-shirt' | 'jersey' | 'shorts' | 'track' | 'accessory';

export interface ApparelVariant {
  id: string;
  productId: string;
  size: string; // "S", "M", "L", "XL", "XXL", "Kids 10-12", "Free size"…
  colour: string; // "Navy", "White"…
  colourHex?: string | null;
  stock: number; // units on hand; 0 = out of stock
  sku?: string | null;
  sortOrder: number;
}

export type ApparelVariantInput = Omit<ApparelVariant, 'id' | 'productId' | 'sortOrder'> & { sortOrder?: number };

export interface ApparelProduct {
  id: string;
  name: string; // "Dry-fit round neck T-shirt"
  category: ApparelCategory;
  description?: string | null;
  fabric?: string | null; // "100% polyester dry-fit, 160 GSM"
  fit?: string | null; // "Regular fit"
  price: number; // ₹ per piece (required for apparel)
  images: string[]; // photo URLs; the first is the main photo (max 6)
  customisable: boolean; // name/number/team printing available on request
  isFeatured: boolean;
  isActive: boolean; // false = hidden from the website
  sortOrder: number;
  createdAt: string;
  variants: ApparelVariant[];
  // Computed by the server:
  inStock: boolean; // any variant with stock > 0
  sizes: string[]; // distinct sizes in variant order
  colours: { colour: string; colourHex?: string | null }[]; // distinct colours in variant order
}

export type ApparelProductInput = Omit<
  ApparelProduct,
  'id' | 'createdAt' | 'sortOrder' | 'variants' | 'inStock' | 'sizes' | 'colours'
> & { sortOrder?: number };

// ---------- Cart (kept in the browser; prices are re-checked by the server) ----------

/** What can be bought online: apparel (size + colour variant), rackets, and string sets (colour variant). */
export type CartItemKind = 'apparel' | 'racket' | 'string';

export interface CartLineInput {
  kind: CartItemKind;
  productId: string;
  variantId?: string | null; // apparel: required; string: the colour variant; racket: none
  quantity: number; // 1–10
}

export interface CartItem extends CartLineInput {
  key: string; // `${kind}:${productId}:${variantId || ''}`
  name: string; // "Yonex Astrox 88D Pro" / "Dry-fit round neck T-shirt"
  detail?: string | null; // "M · Navy" / "Black"
  unitPrice: number; // price shown when added (the server's quote is what counts)
  image?: string | null;
}

// ---------- Orders ----------

export type FulfilmentMethod = 'delivery' | 'pickup';

export type OrderStatus =
  | 'Placed'
  | 'Confirmed'
  | 'Packed'
  | 'Out for Delivery'
  | 'Ready for Pickup'
  | 'Delivered'
  | 'Picked Up'
  | 'Cancelled';

export interface OrderLine {
  kind: CartItemKind;
  productId: string;
  variantId?: string | null;
  name: string;
  detail?: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  image?: string | null;
}

export interface OrderTimelineEntry {
  status: OrderStatus | string;
  label: string;
  timestamp: string; // display text, e.g. "25 Oct 2026, 04:30 PM"
  actor: string;
  notes?: string | null;
}

export interface ShopOrder {
  id: string; // "ORD-48213"
  customerName: string;
  customerMobile: string; // +91XXXXXXXXXX
  createdAt: string; // ISO
  status: OrderStatus;
  fulfilment: FulfilmentMethod;
  address?: Address | null; // delivery only (distanceKm / distanceSource set by the server)
  distanceKm?: number | null;
  items: OrderLine[];
  subtotal: number;
  deliveryCharge: number;
  total: number;
  paymentStatus: 'Pending' | 'Paid';
  paymentMethod?: 'Cash' | 'UPI' | 'Other' | null;
  paidAt?: string | null;
  notes?: string | null; // customer's note
  cancelReason?: string | null;
  timeline: OrderTimelineEntry[];
}

export interface PlaceOrderInput {
  items: CartLineInput[];
  fulfilment: FulfilmentMethod;
  address?: Address | null; // required for delivery; lat/lng (phone location) lets the server compute the distance
  notes?: string;
}

/** Server-side price check of a cart (no login needed): current prices, stock and delivery charge. */
export interface OrderQuote {
  items: OrderLine[]; // only the lines that can be ordered
  unavailable: { kind: CartItemKind; productId: string; variantId?: string | null; name?: string | null; reason: string }[];
  subtotal: number;
  deliveryCharge: number; // 0 for pickup
  distanceKm?: number | null;
  total: number;
  outsideDeliveryArea: boolean; // delivery address beyond the max service distance
}

export interface QuoteInput {
  items: CartLineInput[];
  fulfilment: FulfilmentMethod;
  address?: Address | null;
}
