/**
 * Opens the public GR Sports homepage (the 'landing' view) and, optionally, scrolls to one of
 * its sections. Old section names used by the navbar / footer links are mapped onto the
 * homepage's section ids ('courts' has no section of its own: it goes to Contact). 'tshirts' opens the
 * separate T-shirt store view ('apparel', URL /tshirts) instead of the homepage.
 *
 * The homepage picks the request up when it mounts (takePendingStoreSection) or, if it is
 * already showing, through subscribeStoreSection; it scrolls once its content has loaded.
 */

const SECTION_ALIASES: Record<string, string> = {
  home: '',
  rackets: 'rackets',
  strings: 'strings',
  stringing: 'stringing',
  repair: 'repairs',
  repairs: 'repairs',
  book: 'book',
  booking: 'book',
  events: 'events',
  tournaments: 'events',
  reviews: 'reviews',
  faq: 'faq',
  contact: 'contact',
  courts: 'contact',
};

let pendingSection: string | null = null;
const listeners = new Set<() => void>();

/** View id of the T-shirt store (synced with the /tshirts URL in AppContext). */
export const APPAREL_VIEW = 'apparel';

export function openStoreSection(setActiveView: (view: string) => void, section?: string): void {
  if (section === 'tshirts' || section === 'apparel') {
    setActiveView(APPAREL_VIEW);
    window.scrollTo({ top: 0 });
    return;
  }
  setActiveView('landing');
  window.scrollTo({ top: 0 });
  const id = section ? SECTION_ALIASES[section] ?? section : '';
  if (!id) return;
  pendingSection = id;
  listeners.forEach((listener) => listener());
}

/** The section requested by openStoreSection, if any (without clearing it). */
export function peekPendingStoreSection(): string | null {
  return pendingSection;
}

/** Returns (and clears) the section requested by openStoreSection, if any. */
export function takePendingStoreSection(): string | null {
  const id = pendingSection;
  pendingSection = null;
  return id;
}

/** Notifies the mounted homepage of new requests. Returns an unsubscribe function. */
export function subscribeStoreSection(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
