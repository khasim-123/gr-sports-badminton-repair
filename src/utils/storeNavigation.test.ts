import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openPublicPage } from './publicPages';
import { BADMINTON_VIEW, HOME_VIEW, openStoreSection, takePendingStoreSection } from './storeNavigation';

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  // Clear anything a previous test left waiting.
  takePendingStoreSection(HOME_VIEW);
  takePendingStoreSection(BADMINTON_VIEW);
});

describe('openStoreSection', () => {
  it('opens the main page with no section, and the Badminton page by name', () => {
    const setView = vi.fn();
    openStoreSection(setView);
    openStoreSection(setView, 'home');
    openStoreSection(setView, 'badminton');
    expect(setView.mock.calls.map((c) => c[0])).toEqual(['landing', 'landing', 'badminton']);
    expect(takePendingStoreSection(BADMINTON_VIEW)).toBeNull();
  });

  it('sends the booking form, strings and FAQs to the Badminton page', () => {
    for (const [name, id] of [
      ['book', 'book'],
      ['booking', 'book'],
      ['strings', 'strings'],
      ['repair', 'repairs'],
      ['faq', 'faq'],
    ]) {
      const setView = vi.fn();
      openStoreSection(setView, name);
      expect(setView).toHaveBeenCalledWith('badminton');
      expect(takePendingStoreSection(HOME_VIEW)).toBeNull(); // not for the main page
      expect(takePendingStoreSection(BADMINTON_VIEW)).toBe(id);
    }
  });

  it('keeps "contact" on the main page, and opens the T-shirts, courts and events pages', () => {
    const setView = vi.fn();
    openStoreSection(setView, 'contact');
    expect(setView).toHaveBeenLastCalledWith('landing');
    expect(takePendingStoreSection(BADMINTON_VIEW)).toBeNull();
    expect(takePendingStoreSection(HOME_VIEW)).toBe('contact');

    openStoreSection(setView, 'tshirts');
    openStoreSection(setView, 'courts');
    openStoreSection(setView, 'tournaments');
    expect(setView.mock.calls.slice(1).map((c) => c[0])).toEqual(['apparel', 'courts', 'events']);
  });
});

describe('openPublicPage', () => {
  it('opens the Badminton page at a section (e.g. the footer FAQ link)', () => {
    const setView = vi.fn();
    openPublicPage(setView, 'badminton', { section: 'faq' });
    expect(setView).toHaveBeenCalledWith('badminton');
    expect(takePendingStoreSection(BADMINTON_VIEW)).toBe('faq');

    openPublicPage(setView, 'home');
    expect(setView).toHaveBeenLastCalledWith('landing');
  });
});
