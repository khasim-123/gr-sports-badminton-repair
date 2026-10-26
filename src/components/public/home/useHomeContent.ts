import { useCallback, useEffect, useState } from 'react';
import { contentService } from '../../../services/contentService';
import { primeShopSettings } from '../../../hooks/useShopSettings';
import type { PublicSiteContent, SiteEvent } from '../../../types/content';

export type ContentStatus = 'loading' | 'ready' | 'error';

interface ContentState {
  status: ContentStatus;
  content: PublicSiteContent | null;
}

/** Re-fetch in the background when the cached copy is older than this. */
const STALE_MS = 60_000;

// One copy for the whole public site, so moving between pages doesn't reload everything.
let state: ContentState = { status: 'loading', content: null };
let loadedAt = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<(s: ContentState) => void>();

function setState(next: ContentState) {
  state = next;
  listeners.forEach((listener) => listener(state));
}

function load(): Promise<void> {
  if (inflight) return inflight;
  inflight = contentService
    .getPublicSite()
    .then((data) => {
      // Newer servers include the shop details here; seed the shared cache so the header,
      // contact details and footer don't wait for GET /api/config/shop.
      if (data && data.shop) primeShopSettings(data.shop);
      loadedAt = Date.now();
      setState({
        status: 'ready',
        content: {
          ...data,
          events: Array.isArray(data.events) ? data.events : [],
          academies: Array.isArray(data.academies) ? data.academies : [],
          pages: Array.isArray(data.pages) ? data.pages : [],
        },
      });
    })
    .catch((err) => {
      console.warn('Could not load website content:', err);
      // Keep showing what we had, if anything.
      if (!state.content) setState({ status: 'error', content: null });
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** For tests: forget the shared copy. */
export function resetSiteContentCache(): void {
  state = { status: 'loading', content: null };
  loadedAt = 0;
  inflight = null;
}

/**
 * Everything the public pages show (GET /api/content/site): loaded once and shared by every page;
 * refreshed in the background when a page mounts and the copy is over a minute old.
 * `events`, `academies` and `pages` are optional in the contract and are normalised to [].
 */
export function useHomeContent() {
  const [current, setCurrent] = useState<ContentState>(state);

  useEffect(() => {
    listeners.add(setCurrent);
    setCurrent(state);
    if (!state.content || Date.now() - loadedAt > STALE_MS) load();
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);

  /** Re-fetch the event list (e.g. after a registration changed the spots left). Failures are ignored. */
  const refreshEvents = useCallback(() => {
    contentService
      .getPublicEvents()
      .then((events) => {
        if (!Array.isArray(events) || !state.content) return;
        setState({ ...state, content: { ...state.content, events } });
      })
      .catch(() => undefined);
  }, []);

  /** Patch one event locally (used when a refresh isn't possible). */
  const patchEvent = useCallback((id: string, patch: Partial<SiteEvent>) => {
    if (!state.content) return;
    setState({
      ...state,
      content: { ...state.content, events: (state.content.events || []).map((e) => (e.id === id ? { ...e, ...patch } : e)) },
    });
  }, []);

  return { status: current.status, content: current.content, refreshEvents, patchEvent };
}
