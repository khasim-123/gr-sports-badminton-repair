import React from 'react';
import { Plus } from 'lucide-react';
import type { DistancePricingConfig, GettingServiceTier } from '../../../types';
import { beyondFreeText, formatKm, turnaroundRange } from './format';
import { SECTION_IDS, useShop } from './shop';
import { SectionHeader, WhatsAppIcon, btn, container, cx } from './ui';

interface FaqSectionProps {
  distanceConfig: DistancePricingConfig;
  gettingServices: GettingServiceTier[];
}

/** Answers are written from the live rules (pickup radius, charges, turnaround), not marketing claims. */
export const FaqSection: React.FC<FaqSectionProps> = ({ distanceConfig, gettingServices }) => {
  const SHOP = useShop();
  const range = turnaroundRange(gettingServices.filter((t) => t.isActive !== false));
  const free = formatKm(distanceConfig.freeRadiusKm);
  const max = distanceConfig.maxServiceDistanceKm > 0 ? formatKm(distanceConfig.maxServiceDistanceKm) : null;

  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: 'How long does stringing take?',
      a: range
        ? `Usually ${range} from pickup, depending on the package you choose. Each package shows its time in the stringing price list above.`
        : 'It depends on the package you choose. Each package shows its usual time in the stringing price list above.',
    },
    {
      q: 'Can my broken racket be repaired?',
      a: "Often, but not always. We inspect the racket first and send you an estimate with the price and the date it will be ready. Nothing is repaired until you approve the estimate. If we find more damage during the repair, we ask you before the price changes. If you decline, we don't repair it and the racket comes back to you.",
    },
    {
      q: 'Where do you pick up from?',
      a: (
        <>
          {max ? `Anywhere within ${max} of our shop in ${SHOP.locality}. ` : `From homes around our shop in ${SHOP.locality}. `}
          Pickup and delivery are free within {free}. {beyondFreeText(distanceConfig)} You see the exact charge for your address before
          you confirm a booking.
          {max && (
            <>
              {' '}Further away? Call{' '}
              <a href={SHOP.phoneTel} className="font-medium text-ink underline underline-offset-2">
                {SHOP.phoneDisplay}
              </a>{' '}
              or bring the racket to the shop.
            </>
          )}
        </>
      ),
    },
    {
      q: 'When and how do I pay?',
      a: 'When your racket comes back. Pay the person who delivers it, in cash or by UPI. For repairs you pay the amount in the estimate you approved.',
    },
    {
      q: 'What tension should I choose?',
      a: "If you're not sure, choose “Not sure, advise me” and we'll suggest one. Higher tension gives more control but a smaller sweet spot and is harder on your arm and the string. Never go above the maximum tension printed on your racket.",
    },
    {
      q: 'Can I bring my racket to the shop instead?',
      a: (
        <>
          Yes. Our shop is at {SHOP.addressLines.join(', ')}.{SHOP.openingHours ? ` Open ${SHOP.openingHours}.` : ''} Please call{' '}
          <a href={SHOP.phoneTel} className="font-medium text-ink underline underline-offset-2">
            {SHOP.phoneDisplay}
          </a>{' '}
          before you come, so someone is there to take it.
        </>
      ),
    },
    {
      q: 'How do I register for an event?',
      a: 'Open the event in the Events section. Some take entries on this website; others on WhatsApp, by phone or on an outside link. The event page tells you which, and the entry fee if there is one.',
    },
  ];

  return (
    <section id={SECTION_IDS.faq} aria-labelledby="faq-title" className="scroll-mt-20 bg-white py-10 sm:py-14">
      <div className={cx(container, 'grid gap-8 lg:grid-cols-12 lg:gap-12')}>
        <div className="lg:col-span-4">
          <SectionHeader id="faq-title" title="Common questions" />
          <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">
            Something else? Message us on WhatsApp or call{' '}
            <a href={SHOP.phoneTel} className="font-medium text-ink underline underline-offset-2">
              {SHOP.phoneDisplay}
            </a>
            .
          </p>
          <a
            href={SHOP.whatsAppLink(SHOP.greeting('I have a question.'))}
            target="_blank"
            rel="noopener noreferrer"
            className={cx(btn.base, btn.secondary, 'mt-6')}
          >
            <WhatsAppIcon className="h-5 w-5 text-[#128C4B]" />
            Ask on WhatsApp
          </a>
        </div>
        <div className="lg:col-span-8">
          <div className="divide-y divide-line border-y border-line">
            {faqs.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-6 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue [&::-webkit-details-marker]:hidden">
                  <span className="font-display text-[22px] font-semibold leading-snug text-ink">{f.q}</span>
                  <Plus className="h-5 w-5 shrink-0 text-ink transition-transform group-open:rotate-45" aria-hidden="true" />
                </summary>
                <div className="max-w-2xl pb-6 text-[16px] leading-relaxed text-ink-soft">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
