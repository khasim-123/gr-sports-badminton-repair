import React, { useMemo } from 'react';
import { EventsSection } from '../home/EventsSection';
import { eventSlides, useEventDialog } from '../home/EventsHero';
import { HeroCarousel, type HeroSlide } from '../home/HeroCarousel';
import { useShop } from '../home/shop';
import { PublicLayout, useNavItem } from '../layout/PublicLayout';

/**
 * Events page (GR website map): navigator (near by courts, tournament organizers, academies),
 * the events banner and the list of events, each opening its details / registration form.
 */
export const EventsPage: React.FC = () => {
  const SHOP = useShop();
  const navItem = useNavItem();
  const { status, events, showEvent, dialog } = useEventDialog();

  const slides = useMemo<HeroSlide[]>(() => {
    const fromEvents = eventSlides(events, SHOP, showEvent);
    if (fromEvents.length) return fromEvents;
    return [
      {
        key: 'events-default',
        image: '/images/site/events/tournament.webp',
        alt: 'A badminton player celebrating a point under the hall lights',
        eyebrow: SHOP.name,
        title: 'Tournaments, camps and events',
        text: 'Everything we run or host, with how to register.',
      },
    ];
  }, [events, SHOP, showEvent]);

  return (
    <PublicLayout
      page="events"
      navigator={{
        label: 'Events',
        items: [
          navItem('courts', 'Near by courts', 'courts'),
          navItem('tournaments', 'Tournament organizers', 'tournaments'),
          navItem('academies', 'Academies', 'academies'),
        ],
      }}
    >
      <h1 className="sr-only">Events at {SHOP.name}</h1>
      <HeroCarousel slides={slides} label="Upcoming events" placeholder={status === 'loading'} />
      <EventsSection events={events} status={status} onOpen={showEvent} />
      {dialog}
    </PublicLayout>
  );
};
