import React from 'react';
import { CalendarClock, Clock, IndianRupee } from 'lucide-react';
import { hoursText, priceText, venuePhotos } from '../../courts/courtFormat';
import { useCourtVenues } from '../../courts/useCourts';
import { Photo } from './Photo';
import { btn, container, cx } from './ui';

/** Homepage band linking to court booking (/courts). Shown only once a venue is set up. */
export const CourtsSection: React.FC<{ onOpenCourts: () => void }> = ({ onOpenCourts }) => {
  const { status, venues } = useCourtVenues();
  if (status !== 'ready' || venues.length === 0) return null;
  const venue = venues[0];
  const photo = venuePhotos(venue)[0];
  const courtCount = venues.reduce((n, v) => n + v.courts.length, 0);

  return (
    <section id="courts" aria-labelledby="courts-title" className="scroll-mt-20 border-t border-line bg-white py-16 sm:py-24">
      <div className={cx(container, 'grid items-center gap-8 md:grid-cols-12 lg:gap-12')}>
        <div className="md:col-span-6 lg:col-span-7">
          {photo ? (
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-paper-deep">
              <img src={photo} alt={venue.name} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            </div>
          ) : (
            <Photo
              src="/images/site/court-empty.webp"
              alt="An empty indoor badminton hall with blue court mats and nets"
              sizes="(min-width: 1024px) 680px, (min-width: 768px) 50vw, 100vw"
              aspect="aspect-[16/10]"
              className="rounded-xl"
            />
          )}
        </div>
        <div className="md:col-span-6 lg:col-span-5">
          <p className="text-[13px] font-semibold tracking-wide text-[#9A6B00]">Courts</p>
          <h2 id="courts-title" data-section-heading tabIndex={-1} className="mt-1 font-display text-[34px] font-semibold leading-[1.02] text-ink outline-none sm:text-[42px]">
            Book a badminton court
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
            {venues.length > 1 ? `${courtCount} courts at ${venues.length} venues` : `${venue.name}`}: choose a day and time online, and pay at the venue.
          </p>
          <ul className="mt-4 space-y-1.5 text-[15px] text-ink-soft">
            <li className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              Open {hoursText(venue)}
            </li>
            <li className="flex items-start gap-2.5">
              <IndianRupee className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              {priceText(venue)}
            </li>
          </ul>
          <a
            href="/courts"
            onClick={(e) => {
              e.preventDefault();
              onOpenCourts();
            }}
            className={cx(btn.base, btn.primary, 'mt-6')}
          >
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            See free times
          </a>
        </div>
      </div>
    </section>
  );
};
