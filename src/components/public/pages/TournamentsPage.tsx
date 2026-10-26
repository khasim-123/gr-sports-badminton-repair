import React, { useState } from 'react';
import { ArrowRight, CirclePlus, CupSoda, Flag, Shirt, Trophy } from 'lucide-react';
import type { TournamentDepartment } from '../../../types/content';
import { EnquiryDialog } from '../enquiry/EnquiryDialog';
import { EventsHero } from '../home/EventsHero';
import type { HeroSlide } from '../home/HeroCarousel';
import { ReviewsSection } from '../home/ReviewsSection';
import { scrollToSection, useShop } from '../home/shop';
import { SectionHeader, container, cx } from '../home/ui';
import { useHomeContent } from '../home/useHomeContent';
import { PublicLayout, useNavItem } from '../layout/PublicLayout';

const LIST_ID = 'tournament-departments';

/** "Shop by departments" (GR website map). */
const DEPARTMENTS: { key: TournamentDepartment; label: string; text: string; icon: React.ElementType }[] = [
  { key: 'umpire', label: 'Umpire', text: 'Umpires for your matches', icon: Flag },
  { key: 'dress', label: 'Tournament dress', text: 'T-shirts for players and organisers', icon: Shirt },
  { key: 'trophies', label: 'Trophies', text: 'Trophies and medals for the winners', icon: Trophy },
  { key: 'refreshments', label: 'Refreshments', text: 'Drinks and snacks on match day', icon: CupSoda },
  { key: 'other', label: 'Others', text: 'Anything else your tournament needs', icon: CirclePlus },
];

const FALLBACK: HeroSlide = {
  key: 'tournaments-default',
  image: '/images/site/events/tournament.webp',
  alt: 'A badminton player celebrating a point under the hall lights',
  eyebrow: 'Tournament organizing',
  title: 'Organizing a tournament?',
  text: 'Umpires, dress, trophies and refreshments: tell us what you need and we call you back.',
  primary: { label: 'Choose what you need', onClick: () => scrollToSection(LIST_ID, { focus: true }) },
};

/**
 * Tournament organizing page (GR website map): navigator (near by courts, events, academies),
 * the events banner, the departments (each opens a request form) and reviews.
 */
export const TournamentsPage: React.FC = () => {
  const SHOP = useShop();
  const navItem = useNavItem();
  const { status, content } = useHomeContent();
  const [department, setDepartment] = useState<(typeof DEPARTMENTS)[number] | null>(null);

  return (
    <PublicLayout
      page="tournaments"
      navigator={{
        label: 'Tournament organizing',
        items: [
          navItem('courts', 'Near by courts', 'courts'),
          navItem('events', 'Events', 'events'),
          navItem('academies', 'Academies', 'academies'),
        ],
      }}
    >
      <h1 className="sr-only">Tournament organizing at {SHOP.name}</h1>
      <EventsHero fallback={FALLBACK} />

      <section aria-labelledby={LIST_ID} className="bg-paper py-10 sm:py-14">
        <div className={container}>
          <SectionHeader
            id={LIST_ID}
            title="What do you need?"
            intro="Choose one and send a request with your date and venue. We call you back to talk through numbers and prices."
          />
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            {DEPARTMENTS.map((d, i) => {
              const Icon = d.icon;
              return (
                <li key={d.key} className={cx('flex', i === DEPARTMENTS.length - 1 && 'col-span-2 lg:col-span-1')}>
                  <button
                    type="button"
                    onClick={() => setDepartment(d)}
                    className="group flex w-full flex-col items-start rounded-2xl border border-line bg-white p-4 text-left transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue sm:p-5"
                  >
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-ink text-accent">
                      <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="mt-4 font-display text-[22px] font-semibold leading-tight text-ink sm:text-[24px]">{d.label}</span>
                    <span className="mt-1 text-[14px] leading-snug text-ink-soft sm:text-[15px]">{d.text}</span>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[14px] font-semibold text-sportsBlue">
                      Request
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <ReviewsSection data={content?.reviews} status={status} />

      <EnquiryDialog
        open={!!department}
        onClose={() => setDepartment(null)}
        title={department?.label || ''}
        description="For your tournament. Tell us where and when, and what you need."
        kind="tournament"
        fixed={{ department: department?.key }}
        submitLabel="Send request"
        nextStep="We'll go through what you need and give you a price."
      />
    </PublicLayout>
  );
};
