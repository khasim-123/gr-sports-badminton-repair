import React, { useEffect, useState } from 'react';
import { peekPageIntent, subscribePageIntent, takePageIntent, type PageIntent, type PublicPageId } from '../../../utils/publicPages';
import { container, cx } from '../home/ui';

/** Title band at the top of a public page (pages without a photo banner). */
export const PageIntro: React.FC<{ title: string; intro?: React.ReactNode; children?: React.ReactNode; tone?: 'paper' | 'white' }> = ({
  title,
  intro,
  children,
  tone = 'paper',
}) => (
  <section aria-labelledby="page-title" className={cx('border-b border-line py-10 sm:py-14', tone === 'paper' ? 'bg-paper' : 'bg-white')}>
    <div className={container}>
      <h1 id="page-title" className="font-display text-[36px] font-semibold leading-[1.05] tracking-[0.01em] text-ink sm:text-[48px]">
        {title}
      </h1>
      {intro && <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ink-soft sm:text-[17px]">{intro}</p>}
      {children}
    </div>
  </section>
);

/**
 * What this page was asked to show first (e.g. the Services page with Repair selected), whether it
 * was opened with the request or was already showing. Returns a new object for every request.
 */
export function usePageIntent(page: PublicPageId): PageIntent | null {
  // Read while rendering, clear after mounting: React may run the initializer twice (StrictMode).
  const [intent, setIntent] = useState<PageIntent | null>(() => peekPageIntent(page));
  useEffect(() => {
    takePageIntent(page);
    return subscribePageIntent(() => {
      const next = takePageIntent(page);
      if (next) setIntent({ ...next });
    });
  }, [page]);
  return intent;
}
