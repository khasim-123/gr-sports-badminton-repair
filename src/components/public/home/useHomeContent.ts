import { useCallback, useEffect, useState } from 'react';
import { contentService } from '../../../services/contentService';
import { primeShopSettings } from '../../../hooks/useShopSettings';
import type { PublicSiteContent, SiteEvent } from '../../../types/content';

export type ContentStatus = 'loading' | 'ready' | 'error';

/**
 * Loads everything the homepage shows (GET /api/content/site) once per mount.
 * `events` is optional in the contract (older servers don't send it) and is normalised to [].
 */
export function useHomeContent() {
  const [status, setStatus] = useState<ContentStatus>('loading');
  const [content, setContent] = useState<PublicSiteContent | null>(null);

  useEffect(() => {
    let cancelled = false;
    contentService
      .getPublicSite()
      .then((data) => {
        // Newer servers include the shop details here; seed the shared cache so the header,
        // contact section and footer don't wait for GET /api/config/shop.
        if (data && data.shop) primeShopSettings(data.shop);
        if (cancelled) return;
        setContent({ ...data, events: Array.isArray(data.events) ? data.events : [] });
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('Could not load website content:', err);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Re-fetch the event list (e.g. after a registration changed the spots left). Failures are ignored. */
  const refreshEvents = useCallback(() => {
    contentService
      .getPublicEvents()
      .then((events) => {
        if (!Array.isArray(events)) return;
        setContent((prev) => (prev ? { ...prev, events } : prev));
      })
      .catch(() => undefined);
  }, []);

  /** Patch one event locally (used when a refresh isn't possible). */
  const patchEvent = useCallback((id: string, patch: Partial<SiteEvent>) => {
    setContent((prev) =>
      prev ? { ...prev, events: (prev.events || []).map((e) => (e.id === id ? { ...e, ...patch } : e)) } : prev,
    );
  }, []);

  return { status, content, refreshEvents, patchEvent };
}
