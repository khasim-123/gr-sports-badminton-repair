import React from 'react';
import { ArrowRight } from 'lucide-react';
import { usePublicNav } from '../layout/PublicLayout';
import { btn, container, cx } from '../home/ui';

/** Closing band on the catalogue pages: book stringing (opens the Services page on Stringing). */
export const ServiceCta: React.FC<{ title: string; text: string }> = ({ title, text }) => {
  const go = usePublicNav();
  return (
    <section aria-labelledby="service-cta-title" className="border-t border-line bg-paper py-6 sm:py-8">
      <div className={cx(container, 'flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between')}>
        <div className="max-w-2xl">
          <h2 id="service-cta-title" className="font-display text-[28px] font-semibold leading-tight text-ink sm:text-[32px]">
            {title}
          </h2>
          <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">{text}</p>
        </div>
        <a
          href="/services"
          onClick={(e) => {
            e.preventDefault();
            go('services', { service: 'stringing' });
          }}
          className={cx(btn.base, btn.primary, 'shrink-0 px-6')}
        >
          Book stringing
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
};
