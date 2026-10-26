import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { siteSrcSet } from './format';
import { SECTION_IDS, prefersReducedMotion } from './shop';
import { SectionHeader, container, cx } from './ui';

export interface ProductCategory {
  key: string;
  name: string;
  /** Short line under the name, from live data (e.g. "8 rackets"). */
  detail: string;
  image: string;
  onOpen: () => void;
}

interface ShopByProductSectionProps {
  /** Only the catalogues the shop has; empty = the section is not shown. */
  categories: ProductCategory[];
  id?: string;
  title?: string;
  intro?: string;
  /** 'grid' (default): every tile at once. 'slider': a sliding row (arrows, swipe, slides on its own). */
  layout?: 'grid' | 'slider';
}

/**
 * "Shop by product": one tile per catalogue (rackets, strings, T-shirts), each opening it. The
 * main page uses the same tiles for its sections (badminton, T-shirts, academies, …), as a slider.
 */
export const ShopByProductSection: React.FC<ShopByProductSectionProps> = ({
  categories,
  id = SECTION_IDS.shop,
  title = 'Shop by product',
  intro,
  layout = 'grid',
}) => {
  if (categories.length === 0) return null;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t border-line bg-paper py-10 sm:py-14">
      <div className={container}>
        {layout === 'slider' ? (
          <TileSlider id={id} title={title} intro={intro} categories={categories} />
        ) : (
          <>
            <SectionHeader id={`${id}-title`} title={title} intro={intro} />
            <ul
              className={cx(
                'mt-6 grid gap-3 sm:gap-6',
                categories.length === 1 ? 'max-w-md' : categories.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3',
              )}
            >
              {categories.map((c) => (
                <li key={c.key}>
                  <Tile category={c} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
};

/** A tile. Grid on phones: a compact row (photo, name, arrow); otherwise a photo card. */
const Tile: React.FC<{ category: ProductCategory; card?: boolean }> = ({ category: c, card = false }) => (
  <button
    type="button"
    onClick={c.onOpen}
    className={cx(
      'group flex w-full rounded-2xl border border-line bg-white text-left transition-colors duration-150 hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue',
      card ? 'h-full flex-col overflow-hidden' : 'items-center gap-4 p-3 sm:flex-col sm:items-stretch sm:gap-0 sm:overflow-hidden sm:p-0',
    )}
  >
    <span
      className={cx(
        'relative block shrink-0 overflow-hidden bg-paper-deep',
        card ? 'aspect-[16/10] w-full' : 'aspect-square w-20 rounded-xl sm:aspect-[16/10] sm:w-full sm:rounded-none',
      )}
    >
      <img
        src={c.image}
        srcSet={siteSrcSet(c.image)}
        sizes={card ? '(min-width: 1024px) 380px, (min-width: 640px) 50vw, 85vw' : '(min-width: 640px) 400px, 80px'}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
    </span>
    <span className={cx('flex min-w-0 flex-1 items-center justify-between gap-3', card ? 'px-5 py-4' : 'sm:px-5 sm:py-4')}>
      <span className="min-w-0">
        <span className={cx('block font-display font-semibold leading-tight text-ink', card ? 'text-[24px] sm:text-[26px]' : 'text-[22px] sm:text-[26px]')}>
          {c.name}
        </span>
        <span className="mt-0.5 block text-[14px] text-ink-muted">{c.detail}</span>
      </span>
      <ArrowRight
        className="h-5 w-5 shrink-0 text-ink transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </span>
  </button>
);

/** Time each position stays before the row slides on (when sliding on its own). */
const SLIDE_MS = 4500;

const controlClass =
  'inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:border-ink/40 disabled:cursor-default disabled:opacity-40 disabled:hover:border-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue';

/**
 * A sliding row of tiles: three across on laptops, two on tablets, one (with the next peeking in)
 * on phones. Arrows and swipe move it; it also slides on its own, stopping while the pointer or
 * keyboard focus is on it, when it's off screen, once someone moves it themselves, or with the
 * pause button. Never slides on its own with "reduce motion".
 */
const TileSlider: React.FC<{ id: string; title: string; intro?: string; categories: ProductCategory[] }> = ({ id, title, intro, categories }) => {
  const uid = useId();
  const trackRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [paused, setPaused] = useState(false); // pause button, or the visitor moved it themselves
  const [hovering, setHovering] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const [reduced, setReduced] = useState(prefersReducedMotion);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    setOverflowing(el.scrollWidth > el.clientWidth + 4);
  }, []);

  useEffect(() => {
    measure();
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, categories.length]);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    const onVis = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /** Moves one tile along; past the last one it goes back to the first. */
  const move = useCallback(
    (dir: 1 | -1, { wrap = false } = {}) => {
      const el = trackRef.current;
      if (!el) return;
      const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
      const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      if (dir === 1 && end && wrap) {
        el.scrollTo({ left: 0, behavior });
        return;
      }
      const first = el.querySelector('li');
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const stepPx = first ? first.getBoundingClientRect().width + gap : el.clientWidth;
      el.scrollBy({ left: dir * stepPx, behavior });
    },
    [reduced],
  );

  const sliding = overflowing && !reduced && !paused && !hovering && !focusInside && visible && pageVisible;
  useEffect(() => {
    if (!sliding) return;
    const t = window.setInterval(() => move(1, { wrap: true }), SLIDE_MS);
    return () => window.clearInterval(t);
  }, [sliding, move]);

  const controls = overflowing ? (
    <div className="flex items-center gap-2">
      {!reduced && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className={controlClass}
          aria-label={paused ? 'Start sliding' : 'Stop sliding'}
          title={paused ? 'Start sliding' : 'Stop sliding'}
        >
          {paused ? (
            <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
          ) : (
            <Pause className="h-4 w-4" fill="currentColor" aria-hidden="true" />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setPaused(true);
          move(-1);
        }}
        disabled={atStart}
        className={controlClass}
        aria-label="Previous"
        aria-controls={`${uid}-track`}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => {
          setPaused(true);
          move(1);
        }}
        disabled={atEnd}
        className={controlClass}
        aria-label="Next"
        aria-controls={`${uid}-track`}
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  ) : undefined;

  return (
    <>
      <SectionHeader id={`${id}-title`} title={title} intro={intro} action={controls} />
      <div
        className="relative mt-6"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocusCapture={() => setFocusInside(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusInside(false);
        }}
      >
        <ul
          id={`${uid}-track`}
          ref={trackRef}
          onScroll={measure}
          // A swipe or drag means the visitor is in charge now: stop sliding on its own.
          onPointerDown={() => setPaused(true)}
          onWheel={(e) => Math.abs(e.deltaX) > Math.abs(e.deltaY) && setPaused(true)}
          // Phones: the row runs to the screen edges (the next card peeks in); wider: within the page column.
          className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto overscroll-x-contain px-4 py-1 sm:-mx-1 sm:scroll-px-1 sm:gap-5 sm:px-1 lg:gap-6"
        >
          {categories.map((c) => (
            <li
              key={c.key}
              className="w-[82%] shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-3rem)/3)]"
            >
              <Tile category={c} card />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};
