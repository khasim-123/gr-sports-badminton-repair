/**
 * GR Sports Platform - Website Content Types
 * Admin-managed storefront content: banners, string catalogue & colour stock,
 * customer reviews, downloadable documents, and pickup availability.
 * Mirrors the FastAPI schemas in backend/app/schemas.py.
 */

export type BannerCtaTarget =
  | 'stringing'
  | 'repair'
  | 'strings'
  | 'rackets'
  | 'tshirts'
  | 'courts'
  | 'tournaments'
  | 'url'
  | 'none';

/**
 * Where a banner shows on the homepage: the top slideshow, a running promo banner, or an
 * announcement card. 'promo' / 'announcement' sit after the strings; 'promo2' / 'announcement2'
 * further down, after "Shop by product" (GR website map).
 */
export type BannerPlacement = 'hero' | 'promo' | 'announcement' | 'promo2' | 'announcement2';

export interface Banner {
  id: string;
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  ctaLabel?: string | null;
  ctaTarget: BannerCtaTarget;
  ctaUrl?: string | null;
  /** Required for 'hero' and 'promo'; empty for an announcement without a photo. */
  desktopImageUrl?: string | null;
  mobileImageUrl?: string | null;
  /** Missing on banners saved before placements existed: treat as 'hero'. */
  placement?: BannerPlacement;
  isActive: boolean;
  sortOrder: number;
  startsAt?: string | null; // YYYY-MM-DD, inclusive
  endsAt?: string | null; // YYYY-MM-DD, inclusive
  createdAt: string;
}

export type BannerInput = Omit<Banner, 'id' | 'createdAt' | 'sortOrder'> & { sortOrder?: number };

export interface StringVariant {
  id: string;
  productId: string;
  colour: string;
  colourHex?: string | null;
  imageUrl?: string | null;
  inStock: boolean;
  sortOrder: number;
}

export type StringVariantInput = Omit<StringVariant, 'id' | 'productId' | 'sortOrder'> & { sortOrder?: number };

export interface StringProduct {
  id: string;
  brand: string;
  code?: string | null;
  name: string;
  gauge?: string | null;
  price?: number | null; // null = "Price on request"
  description?: string | null;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  variants: StringVariant[];
  inStockCount: number;
  createdAt: string;
}

export type StringProductInput = Omit<StringProduct, 'id' | 'variants' | 'inStockCount' | 'createdAt' | 'sortOrder'> & {
  sortOrder?: number;
};

export interface Racket {
  id: string;
  brand: string; // e.g. "Yonex"
  name: string; // model, e.g. "Astrox 88D Pro"
  price?: number | null; // null = "Price on request"
  tag?: string | null; // short badge, e.g. "Bestseller"
  weight?: string | null; // e.g. "3U / 4U"
  balance?: string | null; // e.g. "Head Heavy"
  flex?: string | null; // e.g. "Stiff"
  maxTension?: string | null; // e.g. "Up to 28 lbs"
  description?: string | null;
  images: string[]; // photo URLs; the first is the main photo (max 6)
  /** 'used' = a second-hand racket the shop re-sells (shown under "Re-sell"). Missing = 'new'. */
  condition?: RacketCondition;
  inStock: boolean;
  isFeatured: boolean; // shown in the homepage rackets row
  isActive: boolean; // false = hidden from the website
  sortOrder: number;
  createdAt: string;
}

export type RacketCondition = 'new' | 'used';

export type RacketInput = Omit<Racket, 'id' | 'createdAt' | 'sortOrder'> & { sortOrder?: number };

// ---------------------------------------------------------------------------
// Academies (admin-managed list; visitors request a slot)
// ---------------------------------------------------------------------------

export interface Academy {
  id: string;
  name: string;
  area: string; // locality, e.g. "MVP Colony, Visakhapatnam"
  address?: string | null;
  mapsUrl?: string | null; // https Google Maps link
  phone?: string | null; // the academy's own number, shown on the page (optional)
  photoUrl?: string | null;
  description?: string | null;
  ageGroups?: string | null; // free text, e.g. "Ages 6–16 and adults"
  fee?: string | null; // free text, e.g. "₹2,000 a month"
  batches: string[]; // slot options visitors choose from, e.g. "Mon–Fri 6:00–7:30 AM"
  isActive: boolean; // false = hidden from the website
  sortOrder: number;
  createdAt: string;
}

export type AcademyInput = Omit<Academy, 'id' | 'createdAt' | 'sortOrder'> & { sortOrder?: number };

// ---------------------------------------------------------------------------
// Enquiries: academy slot bookings, tournament organizing requests, custom T-shirt requests.
// Visitors send them without logging in; the admin follows up by phone.
// ---------------------------------------------------------------------------

export type EnquiryKind = 'academy' | 'tournament' | 'custom_tshirt';
export type EnquiryStatus = 'new' | 'contacted' | 'closed';
/** Tournament organizing departments (GR website map). */
export type TournamentDepartment = 'umpire' | 'dress' | 'trophies' | 'refreshments' | 'other';

export interface EnquiryInput {
  kind: EnquiryKind;
  name: string;
  mobile: string; // 10-digit Indian mobile, or +91…; the server normalises it
  academyId?: string | null; // kind 'academy'
  batch?: string | null; // kind 'academy': one of the academy's batches
  department?: TournamentDepartment | null; // kind 'tournament'
  location?: string | null; // kind 'tournament': where the tournament is
  date?: string | null; // YYYY-MM-DD: academy start date / tournament date / T-shirts needed by
  quantity?: number | null; // kind 'custom_tshirt'
  notes?: string | null;
}

export interface Enquiry extends EnquiryInput {
  id: string; // ENQ-…
  /** Human label for the admin list, set by the server: academy name, department name or "Custom T-shirts". */
  subject: string;
  status: EnquiryStatus;
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnquiryUpdate {
  status?: EnquiryStatus;
  adminNote?: string | null;
}

// ---------------------------------------------------------------------------
// Footer pages written by the shop (About us, Shipping, …). A page with no text isn't linked.
// ---------------------------------------------------------------------------

export type SitePageSlug =
  | 'about'
  | 'promise'
  | 'local-pickup'
  | 'express-stringing'
  | 'shuttlers-talk'
  | 'shipping'
  | 'returns'
  | 'terms'
  | 'payments'
  | 'stringing-guide';

export interface SitePage {
  slug: SitePageSlug;
  title: string;
  body: string; // plain text; blank lines separate paragraphs
  updatedAt?: string | null;
}

export type ReviewStatus = 'pending' | 'approved' | 'hidden';

export interface CustomerReview {
  id: string;
  authorName: string;
  rating: number; // 1-5
  comment: string;
  serviceType?: string | null;
  location?: string | null;
  status: ReviewStatus;
  isFeatured: boolean;
  isVerified: boolean; // true when tied to a real completed service request
  requestId?: string | null;
  adminReply?: string | null;
  createdAt: string;
}

export interface ReviewSummary {
  average: number;
  count: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface PublicReviewsResponse {
  summary: ReviewSummary;
  reviews: CustomerReview[];
}

export interface ReviewSubmission {
  authorName: string;
  rating: number;
  comment: string;
  serviceType?: string;
  location?: string;
}

export interface ReviewModerationUpdate {
  status?: ReviewStatus;
  isFeatured?: boolean;
  adminReply?: string | null;
}

export type DocumentCategory =
  | 'Price List'
  | 'Terms & Conditions'
  | 'Warranty'
  | 'Policy'
  | 'Guide'
  | 'Internal'
  | 'Other';

export interface SiteDocument {
  id: string;
  title: string;
  description?: string | null;
  category: DocumentCategory;
  fileUrl: string;
  fileName?: string | null;
  contentType?: string | null;
  isPublic: boolean; // false = staff-only
  sortOrder: number;
  createdAt: string;
}

export type SiteDocumentInput = Omit<SiteDocument, 'id' | 'createdAt' | 'sortOrder'> & { sortOrder?: number };

export interface ClosedDate {
  date: string; // YYYY-MM-DD
  reason?: string | null;
}

export interface AvailabilitySettings {
  openWeekdays: number[]; // 0 = Monday ... 6 = Sunday
  dailyPickupCapacity: number; // 0 = unlimited
  leadTimeDays: number; // earliest bookable day = today + leadTimeDays
  bookingWindowDays: number; // how far ahead customers may book
  pickupSlots: string[]; // e.g. ["10:00 - 13:00", "16:00 - 19:00"]
  closedDates: ClosedDate[];
  notice?: string | null; // banner text shown to customers, e.g. "Closed for Diwali"
}

export interface AvailabilityDay {
  date: string; // YYYY-MM-DD
  available: boolean;
  reason?: string | null;
  remaining?: number | null; // null = unlimited
}

export interface PublicAvailability {
  settings: AvailabilitySettings;
  days: AvailabilityDay[];
}

export interface UploadedMedia {
  id: string;
  url: string; // absolute URL served by the backend
  contentType: string;
  size: number;
  fileName?: string | null;
}

/** Everything the public landing page needs, in one request. */
// ---------- Events (tournaments, coaching camps, clinics, store events) ----------

export type SiteEventCategory = 'tournament' | 'coaching_camp' | 'clinic' | 'store_event' | 'other';

/** How people sign up: on this website, via WhatsApp / phone call to the shop, an external link, or not needed. */
export type EventRegistrationMode = 'form' | 'whatsapp' | 'phone' | 'url' | 'none';

export interface SiteEvent {
  id: string;
  title: string; // e.g. "GR Sports Doubles Open 2026"
  category: SiteEventCategory;
  summary?: string | null; // one or two lines shown on the banner
  description?: string | null; // full details (plain text, line breaks kept)
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD, inclusive; null = single day
  timeText?: string | null; // free text, e.g. "7:00 AM onwards"
  venue: string; // e.g. "S3 Badminton Arena, MVP Colony"
  venueMapUrl?: string | null; // https link to Google Maps
  entryFee?: number | null; // rupees; null/0 = free
  feeNote?: string | null; // e.g. "per pair"
  categories: string[]; // play categories, e.g. ["Men's Doubles", "U-15 Singles"]; may be empty
  registrationMode: EventRegistrationMode;
  registrationUrl?: string | null; // when mode = 'url'
  registrationDeadline?: string | null; // YYYY-MM-DD inclusive; null = until the start date
  capacity?: number | null; // max registrations for mode 'form'; null = unlimited
  bannerImageUrl: string; // wide photo (approx. 16:6), shown in the homepage hero
  mobileImageUrl?: string | null; // optional portrait/square crop for phones
  showAsBanner: boolean; // include in the homepage hero carousel
  isActive: boolean; // false = draft / hidden from the website
  sortOrder: number;
  createdAt: string;
  // Computed by the server:
  status: 'upcoming' | 'ongoing' | 'past';
  registrationOpen: boolean;
  registrationCount: number;
  spotsLeft?: number | null; // null when no capacity is set
}

export type SiteEventInput = Omit<
  SiteEvent,
  'id' | 'createdAt' | 'sortOrder' | 'status' | 'registrationOpen' | 'registrationCount' | 'spotsLeft'
> & { sortOrder?: number };

export interface EventRegistration {
  id: string;
  eventId: string;
  name: string;
  mobile: string; // +91XXXXXXXXXX
  partnerName?: string | null;
  playCategory?: string | null; // one of the event's categories
  notes?: string | null;
  status: 'registered' | 'cancelled';
  createdAt: string;
}

export interface EventRegistrationInput {
  name: string;
  mobile: string; // 10-digit Indian mobile, any common format
  partnerName?: string;
  playCategory?: string;
  notes?: string;
}

// ---------- Shop details (admin-editable; GET /api/config/shop, PUT /api/config/shop) ----------

export interface ShopSettings {
  name: string; // "GR Sports"
  tagline: string; // short line under the logo, e.g. "Badminton · Dondaparthy, Vizag"
  phone: string; // +91XXXXXXXXXX — calls
  whatsapp: string; // +91XXXXXXXXXX — WhatsApp
  email?: string | null;
  addressLine: string; // "Beside Ramalayam Arch, Near Diamond Park"
  area: string; // "Dondaparthy, Visakhapatnam"
  pincode?: string | null;
  mapsUrl?: string | null; // https Google Maps link to the shop
  openingHours: string; // free text, e.g. "Mon–Sat 10:00 AM – 8:00 PM · Sunday closed"
  declinedRepairFee: number; // ₹ charged (besides pickup & delivery) when a repair estimate is declined; 0 = none
  /** Social media pages (https links); an empty one isn't shown in the footer. */
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  xUrl?: string | null;
  youtubeUrl?: string | null;
  /** Up to 3 short lines the footer highlights (the shop's own promises). */
  footerHighlights?: string[];
}

export interface PublicSiteContent {
  shop?: ShopSettings; // optional: older servers don't send it
  events?: SiteEvent[]; // upcoming + ongoing, active only (optional: older servers don't send it)
  banners: Banner[];
  strings: StringProduct[];
  rackets: Racket[];
  reviews: PublicReviewsResponse;
  documents: SiteDocument[];
  availability: PublicAvailability;
  academies?: Academy[]; // active only (optional: older servers don't send it)
  pages?: SitePage[]; // footer pages with text only (optional: older servers don't send it)
}
