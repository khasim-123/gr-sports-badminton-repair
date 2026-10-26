import React from 'react';
import { container, cx } from '../home/ui';

export interface PageNavItem {
  key: string;
  label: string;
  href: string;
  onSelect: () => void;
}

/**
 * A page's own navigator under the site header (GR website map), e.g. Rackets · Strings · Services
 * on the homepage or Near by courts · Events · Tournament organizers on the Academies page.
 * Phones: equal tabs across the screen. Laptops: a slim row aligned with the logo.
 */
export const PageNavigator: React.FC<{ label: string; items: PageNavItem[] }> = ({ label, items }) => {
  if (items.length === 0) return null;
  return (
    <nav aria-label={label} className="border-b border-line bg-white">
      <div className={container}>
        <ul
          className="-mx-4 grid divide-x divide-line sm:mx-0 sm:flex sm:gap-9 sm:divide-x-0"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => (
            <li key={item.key}>
              <a
                href={item.href}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  item.onSelect();
                }}
                className={cx(
                  'group flex h-12 items-center justify-center px-2 text-center text-[14px] font-semibold leading-tight text-ink-soft transition-colors duration-150 hover:text-ink sm:justify-start sm:px-0 sm:text-[15px]',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sportsBlue',
                )}
              >
                <span className="relative">
                  {item.label}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[14px] hidden h-[3px] origin-left scale-x-0 rounded-full bg-accent transition-transform duration-200 ease-out group-hover:scale-x-100 motion-reduce:transition-none sm:block"
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
