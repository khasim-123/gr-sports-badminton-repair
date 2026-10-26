import React, { useEffect, useMemo } from 'react';
import { RacketsSection, activeRackets } from '../home/RacketsSection';
import { scrollToSection, useShop } from '../home/shop';
import { WhatsAppIcon, btn, container, cx } from '../home/ui';
import { useHomeContent } from '../home/useHomeContent';
import { PageIntro, usePageIntent, useRevealIntent } from '../layout/PageIntro';
import { PublicLayout } from '../layout/PublicLayout';
import { ServiceCta } from './ServiceCta';

const USED_ID = 'used-rackets';

/**
 * Rackets page (GR website map): every racket the shop lists, with a brand filter, and the
 * second-hand rackets the shop re-sells ("Re-sell" in the homepage services).
 */
export const RacketsPage: React.FC = () => {
  const SHOP = useShop();
  const { status, content } = useHomeContent();
  const intent = usePageIntent('rackets');
  const rackets = useMemo(() => activeRackets(content?.rackets), [content]);
  const newRackets = useMemo(() => rackets.filter((r) => r.condition !== 'used'), [rackets]);
  const usedRackets = useMemo(() => rackets.filter((r) => r.condition === 'used'), [rackets]);

  // "Re-sell" opens the page on the second-hand rackets.
  useEffect(() => {
    if (intent?.condition !== 'used' || intent.item || status === 'loading') return;
    const raf = requestAnimationFrame(() => scrollToSection(USED_ID, { focus: true }));
    return () => cancelAnimationFrame(raf);
  }, [intent, status]);
  // A racket picked in the site search.
  useRevealIntent(intent, status !== 'loading', (i) => (i.item ? { id: `racket-${i.item}`, highlight: true } : null));

  return (
    <PublicLayout page="rackets">
      <PageIntro
        title="Rackets"
        intro="New and second-hand rackets at the shop. Stock changes, so message us to check a model or a price before you visit."
      />

      {status === 'loading' && (
        <div className={cx(container, 'grid gap-4 py-10 sm:grid-cols-2 lg:grid-cols-4')} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[420px] animate-pulse rounded-xl bg-paper-deep motion-reduce:animate-none" />
          ))}
        </div>
      )}

      {status !== 'loading' && newRackets.length > 0 && (
        <RacketsSection
          // A brand chosen elsewhere (e.g. the homepage brand grid) starts the list filtered to it.
          key={intent?.brand || 'all'}
          mode="page"
          rackets={newRackets}
          title="New rackets"
          intro="Rackets we keep in the shop."
          initialBrand={intent?.brand}
        />
      )}

      {status !== 'loading' &&
        (usedRackets.length > 0 ? (
          <RacketsSection
            id={USED_ID}
            mode="page"
            rackets={usedRackets}
            title="Second-hand rackets"
            intro="Used rackets the shop is selling. Message us to ask about a racket's condition before you visit."
          />
        ) : (
          <section id={USED_ID} aria-labelledby={`${USED_ID}-title`} className="scroll-mt-20 border-t border-line bg-white py-6 sm:py-8">
            <div className={container}>
              <h2 id={`${USED_ID}-title`} className="font-display text-[28px] font-semibold leading-tight text-ink sm:text-[32px]">
                Second-hand rackets
              </h2>
              <p className="mt-2 max-w-2xl text-[16px] leading-relaxed text-ink-soft">
                No second-hand rackets are listed right now. Message us to ask what's available.
              </p>
              <a
                href={SHOP.whatsAppLink(SHOP.greeting('do you have any second-hand rackets for sale?'))}
                target="_blank"
                rel="noopener noreferrer"
                className={cx(btn.base, btn.secondary, 'mt-5')}
              >
                <WhatsAppIcon className="h-5 w-5 text-[#128C4B]" />
                Ask on WhatsApp
              </a>
            </div>
          </section>
        ))}

      {status === 'error' && (
        <p className={cx(container, 'py-10 text-[15px] text-ink-soft')}>
          The rackets list isn't loading right now. Call{' '}
          <a href={SHOP.phoneTel} className="font-semibold text-sportsBlue underline underline-offset-2">
            {SHOP.phoneDisplay}
          </a>{' '}
          to ask about a racket.
        </p>
      )}

      <ServiceCta title="New racket? Get it strung." text="Book a pickup: we collect your racket, string it with your choice of string and tension, and bring it back." />
    </PublicLayout>
  );
};
