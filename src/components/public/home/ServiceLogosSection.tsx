import React from 'react';
import { SectionHeader, container, cx } from './ui';

export interface ServiceLogo {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string;
  onOpen: () => void;
}

/** "Our services in the form of logos" (GR website map): one round icon per service, each opening its page. */
export const ServiceLogosSection: React.FC<{ services: ServiceLogo[] }> = ({ services }) => (
  <section id="services-logos" aria-labelledby="services-logos-title" className="scroll-mt-20 border-t border-line bg-white py-6 sm:py-8">
    <div className={container}>
      <SectionHeader id="services-logos-title" title="Our services" />
      <ul className={cx('mt-6 grid grid-cols-3 gap-x-2 gap-y-6 sm:grid-cols-4 lg:gap-x-4', services.length > 6 ? 'lg:grid-cols-7' : 'lg:grid-cols-6')}>
        {services.map((s) => {
          const Icon = s.icon;
          return (
            <li key={s.key}>
              <a
                href={s.href}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  s.onOpen();
                }}
                className="group flex flex-col items-center gap-3 rounded-2xl px-1 py-2 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue"
              >
                <span className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-full bg-ink text-accent ring-4 ring-paper transition-transform duration-200 ease-out group-hover:-translate-y-0.5 motion-reduce:transition-none sm:h-20 sm:w-20">
                  <Icon className="h-8 w-8 sm:h-9 sm:w-9" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="text-[14px] font-semibold leading-snug text-ink sm:text-[15px]">{s.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  </section>
);
