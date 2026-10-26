import React from 'react';
import { container } from './ui';

export interface SectionNavItem {
  /** Homepage section id the link scrolls to. */
  id: string;
  label: string;
}

/**
 * The homepage's own navigator under the site header (Rackets · Strings · Services).
 * Plain #links: LandingPage turns them into smooth scrolls below the sticky header.
 */
export const SectionNav: React.FC<{ items: SectionNavItem[] }> = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Badminton" className="border-b border-line bg-white">
      <div className={container}>
        <ul className="-mx-4 grid divide-x divide-line sm:mx-0 sm:flex sm:gap-9 sm:divide-x-0" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="group flex h-12 items-center justify-center text-[15px] font-semibold text-ink-soft transition-colors duration-150 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sportsBlue sm:justify-start"
              >
                <span className="relative">
                  {item.label}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[14px] h-[3px] origin-left scale-x-0 rounded-full bg-accent transition-transform duration-200 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
                  />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};
