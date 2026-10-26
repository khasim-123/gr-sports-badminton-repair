/**
 * Opens the public GR Sports homepage (the 'landing' view) and, optionally, scrolls to one of
 * its sections. Old section names used by the navbar / footer links are mapped onto the
 * homepage's section ids. 'tshirts' opens the separate T-shirt store view ('apparel', URL /tshirts)
 * and 'courts' the court booking view ('courts', URL /courts) instead of the homepage.
 *
 * The homepage picks the request up when it mounts (takePendingStoreSection) or, if it is
 * already showing, through subscribeStoreSection; it scrolls once its content has loaded.
 */

const SECTION_ALIASES: Record<string, string> = {
  home: '',
  rackets: 'rackets',
  strings: 'strings',
  stringing: 'stringing', // opens the booking form on Stringing (the homepage handles it)
  repair: 'repairs', // opens the booking form on Repair
  repairs: 'repairs',
  book: 'book',
  booking: 'book',
  events: 'events',
  tournaments: 'events',
  reviews: 'reviews',
  faq: 'faq',
  contact: 'contact',
};

let pendingSection: string | null = null;
const listeners = new Set<() => void>();

/** View id of the T-shirt store (synced with the /tshirts URL in AppContext). */
export const APPAREL_VIEW = 'apparel';
/** View id of court booking (synced with the /courts URL in AppContext). */
export const COURTS_VIEW = 'courts';

export function openStoreSection(setActiveView: (view: string) => void, section?: string): void {
  if (section === 'tshirts' || section === 'apparel') {
    setActiveView(APPAREL_VIEW);
    window.scrollTo({ top: 0 });
    return;
  }
  if (section === 'courts' || section === 'court-booking') {
    setActiveView(COURTS_VIEW);
    window.scrollTo({ top: 0 });
    return;
  }
  // Events have their own page now (GR website map).
  if (section === 'events' || section === 'tournaments') {
    setActiveView('events');
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
