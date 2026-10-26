/**
 * Opens the public website at a section. With no section it opens the main page (the 'landing'
 * view, "/"); 'badminton' opens the Badminton page ('badminton' view, /badminton). Section names
 * used by older menus, footers and addresses are mapped onto section ids: the booking form,
 * strings, rackets, FAQs and the rest live on the Badminton page; "contact" is on the main page.
 * 'tshirts', 'courts' and 'events' open their own pages instead.
 *
 * The page picks the request up when it mounts (takePendingStoreSection) or, if it is already
 * showing, through subscribeStoreSection; it scrolls once its content has loaded.
 */

const SECTION_ALIASES: Record<string, string> = {
  home: '',
  badminton: '',
  rackets: 'rackets',
  strings: 'strings',
  stringing: 'stringing', // opens the booking form on Stringing (the Badminton page handles it)
  repair: 'repairs', // opens the booking form on Repair
  repairs: 'repairs',
  book: 'book',
  booking: 'book',
  events: 'events',
  tournaments: 'events',
  reviews: 'reviews',
  faq: 'faq',
  contact: 'contact',
  offers: 'offers',
  shop: 'shop',
  brands: 'brands',
};

/** A section name openStoreSection knows (e.g. from an old "/#book" address). */
export function isSectionName(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(SECTION_ALIASES, name) && !!SECTION_ALIASES[name];
}

/** Views of the two pages that scroll to sections. */
export const HOME_VIEW = 'landing';
export const BADMINTON_VIEW = 'badminton';
export type SectionPage = typeof HOME_VIEW | typeof BADMINTON_VIEW;

/** Sections on the main page; every other section id belongs to the Badminton page. */
const HOME_SECTIONS = new Set(['contact']);

let pending: { view: SectionPage; id: string } | null = null;
const listeners = new Set<() => void>();

/** View id of the T-shirt store (synced with the /tshirts URL in AppContext). */
export const APPAREL_VIEW = 'apparel';
/** View id of court booking (synced with the /courts URL in AppContext). */
export const COURTS_VIEW = 'courts';

/** The page that has this section (after alias mapping). */
export function pageForSection(id: string): SectionPage {
  return HOME_SECTIONS.has(id) ? HOME_VIEW : BADMINTON_VIEW;
}

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
  const id = section ? SECTION_ALIASES[section] ?? section : '';
  const view: SectionPage = section === 'badminton' ? BADMINTON_VIEW : id ? pageForSection(id) : HOME_VIEW;
  setActiveView(view);
  window.scrollTo({ top: 0 });
  if (!id) return;
  pending = { view, id };
  listeners.forEach((listener) => listener());
}

/** The section requested for `view`, if any (without clearing it). */
export function peekPendingStoreSection(view: SectionPage): string | null {
  return pending && pending.view === view ? pending.id : null;
}

/** Returns (and clears) the section requested for `view`, if any. */
export function takePendingStoreSection(view: SectionPage): string | null {
  const id = peekPendingStoreSection(view);
  if (id) pending = null;
  return id;
}

/** Notifies a mounted page of new requests. Returns an unsubscribe function. */
export function subscribeStoreSection(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
