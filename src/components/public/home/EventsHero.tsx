import React, { useCallback, useMemo, useState } from 'react';
import type { SiteEvent } from '../../../types/content';
import { EventDialog } from './EventDialog';
import { categoryLabel, eventAction, eventDateText, eventPhoto, feeText, registrationStatus, spotsText, visibleEvents } from './events';
import { HeroCarousel, type HeroSlide } from './HeroCarousel';
import { useShop, type ShopView } from './shop';
import { useHomeContent } from './useHomeContent';

export type ShowEvent = (event: SiteEvent, intent: 'details' | 'register') => void;

/**
 * Slides for events with a photo, soonest first: by default only those marked "Show in homepage
 * banner"; `allEvents` includes the rest too.
 */
export function eventSlides(events: SiteEvent[], shop: ShopView, showEvent: ShowEvent, { allEvents = false } = {}): HeroSlide[] {
  const out: HeroSlide[] = [];
  for (const e of events) {
    const photo = eventPhoto(e);
    if ((!allEvents && !e.showAsBanner) || !photo.desktop) continue;
    const action = eventAction(e, shop);
    const reg = registrationStatus(e);
    const spots = e.registrationOpen ? spotsText(e) : null;
    out.push({
      key: `event-${e.id}`,
      image: photo.desktop,
      mobileImage: photo.mobile,
      alt: '',
      eyebrow: [categoryLabel(e), e.status === 'ongoing' ? 'On now' : reg].filter(Boolean).join(' · '),
      title: e.title,
      text: e.summary || undefined,
      textOnPhone: false,
      meta: [
        { icon: 'date', text: `${eventDateText(e)}${e.timeText ? `, ${e.timeText}` : ''}` },
        { icon: 'venue', text: e.venue },
        { icon: 'fee', text: feeText(e) },
        ...(spots ? [{ icon: 'spots' as const, text: spots }] : []),
      ],
      primary:
        action.kind === 'link'
          ? { label: action.label, href: action.href, external: action.external }
          : { label: action.label, onClick: () => showEvent(e, action.kind === 'form' ? 'register' : 'details') },
      secondary: action.kind === 'details' ? undefined : { label: 'Event details', onClick: () => showEvent(e, 'details') },
    });
  }
  return out;
}

/**
 * The upcoming events and their details / registration dialog, for any public page.
 * Render `dialog` once in the page; call `showEvent` from cards, banners and buttons.
 */
export function useEventDialog(onShow?: (event: SiteEvent) => void) {
  const { status, content, refreshEvents, patchEvent } = useHomeContent();
  const events = useMemo(() => visibleEvents(content?.events), [content]);
  const [openEvent, setOpenEvent] = useState<{ id: string; intent: 'details' | 'register' } | null>(null);
  const dialogEvent = openEvent ? events.find((e) => e.id === openEvent.id) || null : null;

  const showEvent = useCallback<ShowEvent>(
    (event, intent) => {
      setOpenEvent({ id: event.id, intent });
      onShow?.(event);
    },
    [onShow],
  );

  const onRegistered = (event: SiteEvent) => {
    // Optimistic count; the refresh replaces it with the server's numbers when it can.
    patchEvent(event.id, {
      registrationCount: event.registrationCount + 1,
      spotsLeft: typeof event.spotsLeft === 'number' ? Math.max(event.spotsLeft - 1, 0) : event.spotsLeft,
    });
    refreshEvents();
  };

  const dialog = (
    <EventDialog event={dialogEvent} intent={openEvent?.intent || 'details'} onClose={() => setOpenEvent(null)} onRegistered={onRegistered} />
  );

  return { status, events, showEvent, dialog };
}

interface EventsHeroProps {
  /** 'hero': full width at the top of a page (default); 'inset': a rounded running banner inside the page. */
  variant?: 'hero' | 'inset';
  label?: string;
  /** The page's own slide, shown first; the banner events follow it. */
  lead?: HeroSlide;
  /** Shown when no event is marked for the banner (e.g. a photo with the page's title). Omit to show nothing. */
  fallback?: HeroSlide;
}

/**
 * "Events hero banner — same as the homepage" (GR website map): a slideshow of the banner events,
 * optionally after the page's own slide so each page opens on its own banner.
 */
export const EventsHero: React.FC<EventsHeroProps> = ({ variant = 'hero', label = 'Upcoming events', lead, fallback }) => {
  const SHOP = useShop();
  const { status, events, showEvent, dialog } = useEventDialog();
  const slides = useMemo(() => {
    const fromEvents = eventSlides(events, SHOP, showEvent);
    const out = lead ? [lead, ...fromEvents] : fromEvents;
    return out.length ? out : fallback ? [fallback] : [];
  }, [events, SHOP, showEvent, lead, fallback]);
  return (
    <>
      {slides.length > 0 && (
        <HeroCarousel slides={slides} variant={variant} label={label} placeholder={status === 'loading' && !lead && !!fallback} />
      )}
      {dialog}
    </>
  );
};
