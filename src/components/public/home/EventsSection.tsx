import React from 'react';
import { CalendarDays, IndianRupee, MapPin } from 'lucide-react';
import type { SiteEvent } from '../../../types/content';
import {
  categoryLabel,
  eventAction,
  eventDateBlock,
  eventDateText,
  eventPhoto,
  feeText,
  registrationStatus,
  spotsText,
} from './events';
import { siteSrcSet } from './format';
import { Photo } from './Photo';
import { SECTION_IDS, useShop } from './shop';
import { SectionHeader, WhatsAppIcon, btn, container, cx } from './ui';

interface EventsSectionProps {
  events: SiteEvent[];
  status: 'loading' | 'ready' | 'error';
  onOpen: (event: SiteEvent, intent: 'details' | 'register') => void;
}

const UPDATES_MESSAGE = 'please tell me about upcoming tournaments and coaching camps.';

export const EventsSection: React.FC<EventsSectionProps> = ({ events, status, onOpen }) => {
  const SHOP = useShop();
  const single = events.length === 1;
  return (
    <section id={SECTION_IDS.events} aria-labelledby="events-title" className="scroll-mt-20 bg-paper py-16 sm:py-24">
      <div className={container}>
        <SectionHeader
          id="events-title"
          title="Tournaments and camps"
          intro="Upcoming events. Open one for the full details and how to register."
        />

        {status === 'loading' && (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[420px] animate-pulse rounded-xl bg-paper-deep" />
            ))}
          </div>
        )}

        {status !== 'loading' && events.length === 0 && (
          <div className="mt-10 grid overflow-hidden rounded-xl border border-line bg-white md:grid-cols-2">
            <Photo
              src="/images/site/kids-hall.webp"
              alt="Junior players on an indoor badminton court"
              sizes="(min-width: 768px) 600px, 100vw"
              aspect="aspect-[3/2] md:aspect-auto md:h-full"
            />
            <div className="flex flex-col justify-center p-6 sm:p-10">
              {status === 'error' ? (
                <>
                  <h3 className="font-display text-[28px] font-semibold leading-tight text-ink">Events aren't loading right now</h3>
                  <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">
                    Message us on WhatsApp to ask about upcoming tournaments and coaching camps.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-display text-[28px] font-semibold leading-tight text-ink">No events announced right now</h3>
                  <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">
                    When we announce a tournament or a coaching camp, it will be listed here. Message us on WhatsApp if you'd like to
                    hear about the next one.
                  </p>
                </>
              )}
              <div className="mt-6">
                <a href={SHOP.whatsAppLink(SHOP.greeting(UPDATES_MESSAGE))} target="_blank" rel="noopener noreferrer" className={cx(btn.base, btn.secondary)}>
                  <WhatsAppIcon className="h-5 w-5 text-[#128C4B]" />
                  {status === 'error' ? 'Ask on WhatsApp' : 'Follow us on WhatsApp for announcements'}
                </a>
              </div>
            </div>
          </div>
        )}

        {events.length > 0 && (
          <ul className={cx('mt-10 grid gap-6', single ? '' : events.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3')}>
            {events.map((e) => (
              <li key={e.id} className="flex">
                <EventCard event={e} horizontal={single} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

const EventCard: React.FC<{
  event: SiteEvent;
  horizontal: boolean;
  onOpen: (event: SiteEvent, intent: 'details' | 'register') => void;
}> = ({ event: e, horizontal, onOpen }) => {
  const SHOP = useShop();
  const photo = eventPhoto(e);
  const block = eventDateBlock(e);
  const action = eventAction(e, SHOP);
  const status = registrationStatus(e);
  const spots = spotsText(e);
  const ongoing = e.status === 'ongoing';
  const titleId = `event-${e.id}-title`;

  return (
    <article
      aria-labelledby={titleId}
      className={cx(
        'flex w-full flex-col overflow-hidden rounded-xl border border-line bg-white',
        horizontal && 'md:grid md:grid-cols-2',
      )}
    >
      <div className={cx('relative bg-paper-deep', horizontal ? 'aspect-[16/9] md:aspect-auto md:min-h-[340px]' : 'aspect-[16/9]')}>
        {photo.desktop && (
          <img
            src={photo.desktop}
            srcSet={siteSrcSet(photo.desktop)}
            sizes={horizontal ? '(min-width: 768px) 600px, 100vw' : '(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw'}
            alt=""
            width={1600}
            height={900}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute left-3 top-3 min-w-[60px] rounded-lg bg-white px-2.5 py-2 text-center shadow-sm" aria-hidden="true">
          <span className="block text-[13px] font-semibold leading-none text-[#9A6B00]">{block.month}</span>
          <span className="mt-1 block font-display text-[26px] font-bold leading-none text-ink">{block.day}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-[13px] font-semibold text-[#9A6B00]">
          {categoryLabel(e)}
          {ongoing && <span className="text-ink"> · On now</span>}
        </p>
        <h3 id={titleId} className="mt-1 font-display text-[26px] font-semibold leading-[1.1] text-ink text-balance">
          {e.title}
        </h3>
        {e.summary && <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-ink-soft">{e.summary}</p>}
        <ul className="mt-4 space-y-1.5 text-[15px] text-ink-soft">
          <li className="flex gap-2">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
            <span>
              {eventDateText(e)}
              {e.timeText ? `, ${e.timeText}` : ''}
            </span>
          </li>
          <li className="flex gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
            <span>{e.venue}</span>
          </li>
          <li className="flex gap-2">
            <IndianRupee className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
            <span>{feeText(e)}</span>
          </li>
        </ul>
        {(status || spots) && (
          <p className="mt-4 text-[14px] text-ink-muted">
            {[status, e.registrationOpen ? spots : null].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-2 pt-5">
          {action.kind === 'link' ? (
            <a
              href={action.href}
              className={cx(btn.base, btn.primary)}
              {...(action.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {e.registrationMode === 'whatsapp' && <WhatsAppIcon className="h-4 w-4" />}
              {action.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onOpen(e, action.kind === 'form' ? 'register' : 'details')}
              className={cx(btn.base, btn.primary)}
            >
              {action.label}
            </button>
          )}
          {action.kind !== 'details' && (
            <button type="button" onClick={() => onOpen(e, 'details')} className={btn.link} aria-label={`Details: ${e.title}`}>
              Details
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
