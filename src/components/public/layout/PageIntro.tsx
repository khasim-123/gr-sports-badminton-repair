import React, { useEffect, useRef, useState } from 'react';
import { peekPageIntent, subscribePageIntent, takePageIntent, type PageIntent, type PublicPageId } from '../../../utils/publicPages';
import { container, cx } from '../home/ui';

/** Title band at the top of a public page (pages without a photo banner). */
export const PageIntro: React.FC<{ title: string; intro?: React.ReactNode; children?: React.ReactNode; tone?: 'paper' | 'white' }> = ({
  title,
  intro,
  children,
  tone = 'paper',
}) => (
  <section aria-labelledby="page-title" className={cx('border-b border-line py-7 sm:py-9', tone === 'paper' ? 'bg-paper' : 'bg-white')}>
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
 * Scrolls an element into view and focuses it; `highlight` adds a short accent outline (an item a
 * search result pointed at). Returns false when the element isn't on the page.
 */
export function revealElement(id: string, { highlight = false } = {}): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: highlight ? 'center' : 'start', behavior: reduced ? 'auto' : 'smooth' });
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
  if (highlight) {
    el.classList.add('search-hit');
    window.setTimeout(() => el.classList.remove('search-hit'), 2600);
  }
  return true;
}

/**
 * Once the page is `ready`, shows what an intent asked for: `target` maps the intent to an element
 * id (and whether to highlight it). Runs again for every new intent.
 */
export function useRevealIntent(
  intent: PageIntent | null,
  ready: boolean,
  target: (intent: PageIntent) => { id: string; highlight?: boolean } | null,
): void {
  const targetRef = useRef(target);
  targetRef.current = target;
  useEffect(() => {
    if (!intent || !ready) return;
    const t = targetRef.current(intent);
    if (!t) return;
    const raf = requestAnimationFrame(() => revealElement(t.id, { highlight: t.highlight }));
    return () => cancelAnimationFrame(raf);
  }, [intent, ready]);
}

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
