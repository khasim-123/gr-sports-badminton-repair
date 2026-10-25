/** Test data builders shaped like the API responses (src/types). Override any field per test. */
import type { ServiceRequest } from '../types';
import type { AvailabilityDay, PublicAvailability, SiteEvent, StringProduct, StringVariant } from '../types/content';
import type { ApparelProduct, ShopOrder } from '../types/shop';

export function makeEvent(overrides: Partial<SiteEvent> = {}): SiteEvent {
  return {
    id: 'evt-1',
    title: 'GR Sports Doubles Open 2026',
    category: 'tournament',
    summary: 'Two days of doubles for every level.',
    description: 'Shuttles provided.\nReport 30 minutes before your first match.',
    startDate: '2026-11-14',
    endDate: null,
    timeText: '7:00 AM onwards',
    venue: 'S3 Badminton Arena, MVP Colony',
    venueMapUrl: 'https://maps.google.com/?q=S3+Badminton+Arena',
    entryFee: 600,
    feeNote: 'per pair',
    categories: ["Men's Doubles", 'U-15 Singles', 'Mixed Doubles'],
    registrationMode: 'form',
    registrationUrl: null,
    registrationDeadline: null,
    capacity: 32,
    bannerImageUrl: '/images/site/tournament.webp',
    mobileImageUrl: null,
    showAsBanner: true,
    isActive: true,
    sortOrder: 0,
    createdAt: '2026-10-01T10:00:00Z',
    status: 'upcoming',
    registrationOpen: true,
    registrationCount: 20,
    spotsLeft: 12,
    ...overrides,
  };
}

export function makeVariant(overrides: Partial<StringVariant> & Pick<StringVariant, 'id' | 'colour'>): StringVariant {
  return { productId: 'str-bg65', colourHex: null, imageUrl: null, inStock: true, sortOrder: 0, ...overrides };
}

/** Yonex BG 65 Titanium in White / Black (in stock) and Red (out of stock). */
export function makeStringProduct(overrides: Partial<StringProduct> = {}): StringProduct {
  return {
    id: 'str-bg65',
    brand: 'Yonex',
    code: 'BG65TI',
    name: 'BG 65 Titanium',
    gauge: '0.70 mm',
    price: 650,
    description: null,
    isFeatured: true,
    isActive: true,
    sortOrder: 0,
    variants: [
      makeVariant({ id: 'v-white', colour: 'White', colourHex: '#FFFFFF', sortOrder: 0 }),
      makeVariant({ id: 'v-black', colour: 'Black', colourHex: '#111111', sortOrder: 1 }),
      makeVariant({ id: 'v-red', colour: 'Red', colourHex: '#C62828', inStock: false, sortOrder: 2 }),
    ],
    inStockCount: 2,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function makeAvailability(days: AvailabilityDay[], settings: Partial<PublicAvailability['settings']> = {}): PublicAvailability {
  return {
    settings: {
      openWeekdays: [0, 1, 2, 3, 4, 5],
      dailyPickupCapacity: 10,
      leadTimeDays: 0,
      bookingWindowDays: 14,
      pickupSlots: ['10:00 - 13:00', '16:00 - 19:00'],
      closedDates: [],
      notice: null,
      ...settings,
    },
    days,
  };
}

export function makeRequest(overrides: Partial<ServiceRequest> = {}): ServiceRequest {
  return {
    id: 'GET-00025',
    serviceType: 'GETTING',
    customerName: 'Anil Kumar',
    customerMobile: '+919876543210',
    createdAt: '2026-10-20T09:00:00+05:30',
    status: 'Submitted',
    batBrand: 'Yonex',
    batModel: 'Astrox 88D Pro',
    batType: 'Even Balance (All-Round)',
    batPhotos: [],
    pickupAddress: {
      id: 'addr-1',
      label: 'Home',
      houseFlat: 'Flat 302, Sai Residency',
      street: 'Beach Road',
      area: 'MVP Colony',
      city: 'Visakhapatnam',
      state: 'Andhra Pradesh',
      pincode: '530017',
      distanceKm: 4,
    },
    distanceKm: 4,
    pickupDeliveryCharge: 0,
    isFreeDelivery: true,
    serviceCharge: 450,
    discount: 0,
    totalAmount: 450,
    paymentStatus: 'Pending',
    timeline: [],
    ...overrides,
  };
}

export function makeOrder(overrides: Partial<ShopOrder> = {}): ShopOrder {
  return {
    id: 'ORD-48213',
    customerName: 'Anil Kumar',
    customerMobile: '+919876543210',
    createdAt: '2026-10-25T10:30:00+05:30',
    status: 'Placed',
    fulfilment: 'delivery',
    address: null,
    items: [{ kind: 'apparel', productId: 'tee-1', variantId: 'tee-1-m-navy', name: 'Dry-fit T-shirt', detail: 'M · Navy', unitPrice: 499, quantity: 2, lineTotal: 998 }],
    subtotal: 998,
    deliveryCharge: 0,
    total: 998,
    paymentStatus: 'Pending',
    timeline: [],
    ...overrides,
  };
}

export function makeApparel(overrides: Partial<ApparelProduct> = {}): ApparelProduct {
  return {
    id: 'tee-1',
    name: 'Dry-fit T-shirt',
    category: 't-shirt',
    price: 499,
    images: ['/images/apparel/tee/navy.webp'],
    customisable: false,
    isFeatured: false,
    isActive: true,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00Z',
    variants: [
      { id: 'tee-1-m-navy', productId: 'tee-1', size: 'M', colour: 'Navy', colourHex: '#1B2A4A', stock: 4, sortOrder: 1 },
      { id: 'tee-1-l-navy', productId: 'tee-1', size: 'L', colour: 'Navy', colourHex: '#1B2A4A', stock: 0, sortOrder: 2 },
      { id: 'tee-1-m-white', productId: 'tee-1', size: 'M', colour: 'White', stock: 2, sortOrder: 0 },
    ],
    inStock: true,
    sizes: ['M', 'L'],
    colours: [{ colour: 'Navy', colourHex: '#1B2A4A' }, { colour: 'White' }],
    ...overrides,
  };
}
