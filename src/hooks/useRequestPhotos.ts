import { useEffect, useState } from 'react';
import type { ServiceRequest } from '../types';
import { requestService } from '../services/requestService';
import { realPhotos } from '../components/customer/requestDisplay';
import { isSafePhotoSrc } from '../utils/photos';

interface RequestPhotos {
  batPhotos: string[];
  pickupPhotos: string[];
  loading: boolean;
}

// Request lists come without photo data (it can be many MB), so a detail screen fetches the
// full request once per version: the key changes when a pickup is recorded or the history grows.
const cache = new Map<string, { batPhotos: string[]; pickupPhotos: string[] }>();

const keyOf = (r: ServiceRequest) =>
  `${r.id}|${r.pickupCondition?.collectedAt || ''}|${(r.timeline || []).length}`;

const clean = (photos?: string[] | null) => realPhotos(photos).filter(isSafePhotoSrc);

/** Customer and pickup photos for a request, loading them on demand. */
export function useRequestPhotos(request: ServiceRequest | null | undefined): RequestPhotos {
  const key = request ? keyOf(request) : '';
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!request || cache.has(key)) return;
    let active = true;
    requestService
      .getRequestById(request.id)
      .then((full) => {
        if (!full) return;
        cache.set(key, { batPhotos: clean(full.batPhotos), pickupPhotos: clean(full.pickupCondition?.photos) });
        if (active) setVersion((v) => v + 1);
      })
      .catch(() => {
        // Photos are a nice-to-have on this screen; the rest of the request is already shown.
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!request) return { batPhotos: [], pickupPhotos: [], loading: false };
  const cached = cache.get(key);
  if (cached) return { ...cached, loading: false };
  // Until the full request arrives, show any photo links the list did include (non-embedded URLs).
  return { batPhotos: clean(request.batPhotos), pickupPhotos: clean(request.pickupCondition?.photos), loading: true };
}
