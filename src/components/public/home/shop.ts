import { useMemo } from 'react';
import type { ShopSettings } from '../../../types/content';
import {
  addressLines,
  cityOf,
  getShopSettingsSnapshot,
  localityOf,
  mapsHref,
  phoneDisplay,
  telHref,
  useShopSettings,
  whatsappHref,
} from '../../../hooks/useShopSettings';

/** Shop details used across the public homepage, derived from the admin-editable settings. */
export interface ShopView {
  name: string;
  tagline: string;
  /** ["Beside Ramalayam Arch, Near Diamond Park", "Dondaparthy, Visakhapatnam 530016"] */
  addressLines: string[];
  addressLine: string;
  /** "Dondaparthy, Visakhapatnam" */
  area: string;
  /** "Dondaparthy" */
  locality: string;
  /** "Visakhapatnam" */
  city: string;
  phoneDisplay: string;
  phoneTel: string;
  whatsappDisplay: string;
  email: string | null;
  mapsUrl: string;
  openingHours: string;
  /** wa.me link to the shop's WhatsApp, optionally with a pre-filled message. */
  whatsAppLink: (message?: string) => string;
  /** "Hi GR Sports, " + text — the opening of a pre-filled WhatsApp message. */
  greeting: (text: string) => string;
  /** All four social networks, always shown in the footer; `url` is null until the shop adds an https link. */
  socials: { key: SocialKey; label: string; url: string | null }[];
  /** Up to 3 short promises shown in the footer. */
  footerHighlights: string[];
}

export type SocialKey = 'instagram' | 'facebook' | 'x' | 'youtube';

const SOCIALS: { key: SocialKey; label: string; field: 'instagramUrl' | 'facebookUrl' | 'xUrl' | 'youtubeUrl' }[] = [
  { key: 'instagram', label: 'Instagram', field: 'instagramUrl' },
  { key: 'facebook', label: 'Facebook', field: 'facebookUrl' },
  { key: 'x', label: 'X', field: 'xUrl' },
  { key: 'youtube', label: 'YouTube', field: 'youtubeUrl' },
];

export function shopView(s: ShopSettings): ShopView {
  return {
    name: s.name,
    tagline: s.tagline,
    addressLines: addressLines(s),
    addressLine: s.addressLine,
    area: s.area,
    locality: localityOf(s),
    city: cityOf(s),
    phoneDisplay: phoneDisplay(s.phone),
    phoneTel: telHref(s.phone),
    whatsappDisplay: phoneDisplay(s.whatsapp),
    email: s.email || null,
    mapsUrl: mapsHref(s),
    openingHours: s.openingHours,
    whatsAppLink: (message?: string) => whatsappHref(s.whatsapp, message),
    greeting: (text: string) => `Hi ${s.name}, ${text}`,
    socials: SOCIALS.map(({ key, label, field }) => {
      const url = (s[field] || '').trim();
      return { key, label, url: /^https:\/\/\S+$/i.test(url) ? url : null };
    }),
    footerHighlights: (s.footerHighlights || []).map((h) => (h || '').trim()).filter(Boolean).slice(0, 3),
  };
}

/** Live shop details for homepage components (defaults until GET /api/config/shop answers). */
export function useShop(): ShopView {
  const settings = useShopSettings();
  return useMemo(() => shopView(settings), [settings]);
}

/** Non-hook access for plain helpers (current cached values). */
export function currentShop(): ShopView {
  return shopView(getShopSettingsSnapshot());
}

/** Section ids on the homepage (also the targets of src/utils/storeNavigation.ts). */
export const SECTION_IDS = {
  book: 'book',
  events: 'events',
  strings: 'strings',
  rackets: 'rackets',
  reviews: 'reviews',
  faq: 'faq',
  contact: 'contact',
  offers: 'offers',
  shop: 'shop',
} as const;

export type SectionId = (typeof SECTION_IDS)[keyof typeof SECTION_IDS];

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Smooth-scrolls to a homepage section (its scroll-margin keeps it clear of the sticky header). */
export function scrollToSection(id: string, opts: { focus?: boolean } = {}): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  if (opts.focus) {
    const target = el.querySelector<HTMLElement>('[data-section-heading]') || el;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
  return true;
}
