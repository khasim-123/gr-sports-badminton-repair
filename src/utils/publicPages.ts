/**
 * The public website's pages (GR website map). The main page is the 'landing' view at "/"; the
 * Badminton page, the T-shirts page and every other page have their own view id and address,
 * kept in step with the browser by AppContext.
 *
 * openPublicPage() switches page and can pass an "intent" — what the page should show first,
 * e.g. the Services page with Repair selected. The page reads it with takePageIntent() when it
 * mounts, or through subscribePageIntent() if it is already showing.
 */
import { openStoreSection } from './storeNavigation';

export type PublicPageId =
  | 'home'
  | 'badminton'
  | 'tshirts'
  | 'courts'
  | 'academies'
  | 'tournaments'
  | 'events'
  | 'rackets'
  | 'strings'
  | 'services';

export const PUBLIC_PAGES: Record<PublicPageId, { view: string; path: string; title: string }> = {
  home: { view: 'landing', path: '/', title: 'Home' },
  badminton: { view: 'badminton', path: '/badminton', title: 'Badminton' },
  tshirts: { view: 'apparel', path: '/tshirts', title: 'T-shirts' },
  courts: { view: 'courts', path: '/courts', title: 'Courts' },
  academies: { view: 'academies', path: '/academies', title: 'Academies' },
  tournaments: { view: 'tournaments', path: '/tournament-organizing', title: 'Tournament organizing' },
  events: { view: 'events', path: '/events', title: 'Events' },
  rackets: { view: 'rackets', path: '/rackets', title: 'Rackets' },
  strings: { view: 'strings', path: '/strings', title: 'Strings' },
  services: { view: 'services', path: '/services', title: 'Services' },
};

/** View id → address for every public page except the homepage. */
export const PATH_VIEWS: Record<string, string> = Object.fromEntries(
  Object.values(PUBLIC_PAGES)
    .filter((p) => p.view !== 'landing')
    .map((p) => [p.view, p.path]),
);

/** Views that render the public site (shared header and footer). */
export const PUBLIC_VIEWS: string[] = Object.values(PUBLIC_PAGES).map((p) => p.view);

export function pageForView(view: string): PublicPageId | null {
  const entry = (Object.keys(PUBLIC_PAGES) as PublicPageId[]).find((id) => PUBLIC_PAGES[id].view === view);
  return entry || null;
}

/** What a page should show first when opened from somewhere else. */
export interface PageIntent {
  /** Services page: open the booking form on this service. */
  service?: 'stringing' | 'repair';
  /** Rackets / Strings page: start filtered to this brand. */
  brand?: string;
  /** Rackets page: jump to new or second-hand rackets. */
  condition?: 'new' | 'used';
  /** Element id on the page to scroll to. */
  section?: string;
}

let pending: { page: PublicPageId; intent: PageIntent } | null = null;
const listeners = new Set<() => void>();

export function openPublicPage(setActiveView: (view: string) => void, page: PublicPageId, intent?: PageIntent): void {
  // The main page and the Badminton page scroll to a section through storeNavigation.
  if (page === 'home' || page === 'badminton') {
    openStoreSection(setActiveView, intent?.section || (page === 'badminton' ? 'badminton' : undefined));
    return;
  }
  pending = intent ? { page, intent } : null;
  setActiveView(PUBLIC_PAGES[page].view);
  if (!intent?.section) window.scrollTo({ top: 0 });
  listeners.forEach((listener) => listener());
}

/** The intent waiting for `page`, if any, without clearing it (safe to call while rendering). */
export function peekPageIntent(page: PublicPageId): PageIntent | null {
  return pending && pending.page === page ? pending.intent : null;
}

/** Returns (and clears) the intent waiting for `page`, if any. */
export function takePageIntent(page: PublicPageId): PageIntent | null {
  const intent = peekPageIntent(page);
  if (intent) pending = null;
  return intent;
}

/** Notifies a page that is already showing of a new intent. Returns an unsubscribe function. */
export function subscribePageIntent(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
