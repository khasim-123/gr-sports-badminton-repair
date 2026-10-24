import React from 'react';
import type { DistancePricingConfig } from '../../../types';
import type { AvailabilitySettings } from '../../../types/content';
import { beyondFreeShort, describePickupHours, formatKm, formatSlot } from './format';
import { SECTION_IDS } from './shop';
import { SectionHeader, container, cx } from './ui';

interface HowItWorksProps {
  distanceConfig: DistancePricingConfig;
  availability: AvailabilitySettings | null | undefined;
}

const STEPS = [
  {
    title: 'Book',
    text: 'Choose stringing or a repair and a pickup day, here on the website or on WhatsApp.',
  },
  {
    title: 'We pick it up',
    text: 'We collect the racket from your door in the slot you chose. You can follow each step in your account.',
  },
  {
    title: 'We string or repair it',
    text: 'Stringing is done with your string and tension. Repairs are inspected first; you get an estimate and we start once you approve.',
  },
  {
    title: 'Delivered, then you pay',
    text: 'We bring the racket back to your door. Pay in cash or by UPI when you receive it.',
  },
];

/** Dark band: the four steps + the live pickup rules (free radius, charge beyond it, furthest distance). */
export const HowItWorksSection: React.FC<HowItWorksProps> = ({ distanceConfig, availability }) => {
  const beyond = beyondFreeShort(distanceConfig);
  const { days } = describePickupHours(availability);
  const slots = (availability?.pickupSlots || []).map(formatSlot).filter(Boolean);
  const facts = [
    { value: formatKm(distanceConfig.freeRadiusKm), label: 'free pickup and delivery from the shop' },
    beyond ? { value: beyond.value, label: beyond.label } : null,
    distanceConfig.maxServiceDistanceKm > 0 ? { value: formatKm(distanceConfig.maxServiceDistanceKm), label: 'the furthest we pick up from' } : null,
    days
      ? {
          value: days,
          label: slots.length ? (
            <>
              pickups,{' '}
              {slots.map((s, i) => (
                <React.Fragment key={s}>
                  {i > 0 && (i === slots.length - 1 ? ' and ' : ', ')}
                  <span className="whitespace-nowrap">{s}</span>
                </React.Fragment>
              ))}
            </>
          ) : (
            'pickup days'
          ),
        }
      : null,
  ].filter(Boolean) as { value: string; label: React.ReactNode }[];

  return (
    <section id={SECTION_IDS.pickup} aria-labelledby="how-title" className="scroll-mt-20 bg-ink py-16 text-white sm:py-24">
      <div className={container}>
        <SectionHeader
          id="how-title"
          tone="dark"
          eyebrow="Pickup and delivery"
          title="How it works"
          intro="You don't need to come to the shop. Book online, hand over your racket at the door and pay when it comes back."
        />
        <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="border-t border-white/15 pt-5">
              <span className="font-display text-[44px] font-bold leading-none text-accent tabular-nums" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-3 font-display text-[26px] font-semibold leading-tight">
                <span className="sr-only">Step {i + 1}: </span>
                {step.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-white/75">{step.text}</p>
            </li>
          ))}
        </ol>

        {facts.length > 0 && (
          <dl className={cx('mt-14 grid gap-px overflow-hidden rounded-xl bg-white/15 sm:grid-cols-2', facts.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
            {facts.map((f) => (
              <div key={f.value} className="flex flex-col bg-ink px-5 py-5 sm:odd:last:col-span-2 lg:odd:last:col-span-1">
                <dt className="order-2 mt-1.5 text-[14px] leading-snug text-white/70">{f.label}</dt>
                <dd className="order-1 font-display text-[32px] font-semibold leading-none text-white">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
};
