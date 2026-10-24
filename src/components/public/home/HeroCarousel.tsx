import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, IndianRupee, MapPin, Pause, Play, Users } from 'lucide-react';
import { prefersReducedMotion, useShop } from './shop';
import { siteSrcSet } from './format';
import { btn, container, cx } from './ui';

export interface HeroAction {
  label: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
}

export interface HeroMeta {
  icon: 'date' | 'venue' | 'fee' | 'spots';
  text: string;
}

export interface HeroSlide {
  key: string;
  image: string;
  mobileImage?: string | null;
  /** CSS object-position for the photo (desktop / phone). */
  position?: string;
  mobilePosition?: string;
  alt: string;
  eyebrow?: string;
  title?: string;
  text?: string;
  /** Set false to hide `text` on phones (keeps more of the photo visible). */
  textOnPhone?: boolean;
  meta?: HeroMeta[];
  primary?: HeroAction;
  secondary?: HeroAction;
}

const AUTOPLAY_MS = 7000;

const META_ICON = { date: CalendarDays, venue: MapPin, fee: IndianRupee, spots: Users } as const;

function ActionButton({ action, variant }: { action: HeroAction; variant: 'accent' | 'onDark' }) {
  const className = cx(btn.base, variant === 'accent' ? btn.accent : btn.onDark, 'px-6');
  const content = (
    <>
      {action.label}
      {variant === 'accent' && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
    </>
  );
  if (action.href) {
    return (
      <a
        href={action.href}
        className={className}
        {...(action.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        onClick={action.onClick}
      >
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {content}
    </button>
  );
}

interface HeroCarouselProps {
  slides: HeroSlide[];
  /** While content loads: show only the first photo, no text (avoids a flash of default copy). */
  placeholder?: boolean;
}

/**
 * Full-width photo carousel. Crossfades (no layout shift: fixed height), autoplays only while
 * the visitor isn't hovering / focused inside / has paused it, the tab is visible and the hero
 * is on screen, and never under prefers-reduced-motion. Arrows, dots, a pause button and swipe.
 */
export const HeroCarousel: React.FC<HeroCarouselProps> = ({ slides, placeholder }) => {
  const SHOP = useShop();
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0]));
  const rootRef = useRef<HTMLElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const slideKeys = slides.map((s) => s.key).join('|');

  // Reset when the slide set changes (e.g. events arrive after loading).
  useEffect(() => {
    setIndex(0);
    setLoaded(new Set([0]));
  }, [slideKeys]);

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
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (count < 2) return;
      const i = ((next % count) + count) % count;
      setIndex(i);
      setLoaded((prev) => (prev.has(i) && prev.has((i + 1) % count) ? prev : new Set([...prev, i, (i + 1) % count])));
    },
    [count],
  );

  // Preload the next photo shortly after the first one shows.
  useEffect(() => {
    if (count < 2) return;
    const t = window.setTimeout(() => setLoaded((prev) => new Set([...prev, 1 % count])), 1200);
    return () => clearTimeout(t);
  }, [count, slideKeys]);

  const playing = count > 1 && !placeholder && !reduced && !userPaused && !hovering && !focusInside && visible && pageVisible;

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => goTo(index + 1), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [playing, index, goTo]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || count < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) goTo(index + (dx < 0 ? 1 : -1));
  };

  if (count === 0) return null;
  const autoplayAllowed = count > 1 && !reduced;

  return (
    <section
      ref={rootRef}
      aria-roledescription="carousel"
      aria-label={`Featured at ${SHOP.name}`}
      className="relative bg-ink"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setFocusInside(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusInside(false);
      }}
    >
      <div
        className="relative h-[clamp(480px,74vh,600px)] lg:h-[clamp(420px,72vh,600px)] overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-live={playing ? 'off' : 'polite'}
      >
        {slides.map((slide, i) => {
          const active = i === index;
          const showImage = loaded.has(i) || active;
          const hasText = !placeholder && !!(slide.title || slide.text || slide.eyebrow);
          return (
            <div
              key={slide.key}
              role="group"
              aria-roledescription="slide"
              aria-label={count > 1 ? `${i + 1} of ${count}${slide.title ? `: ${slide.title}` : ''}` : slide.title || slide.alt}
              aria-hidden={!active}
              ref={(el) => {
                if (el) (el as HTMLElement & { inert: boolean }).inert = !active;
              }}
              className={cx(
                'absolute inset-0',
                reduced ? '' : 'transition-opacity duration-700 ease-out',
                active ? 'opacity-100 z-10' : 'opacity-0 z-0',
              )}
            >
              {showImage && (
                <picture>
                  {slide.mobileImage && <source media="(max-width: 639px)" srcSet={slide.mobileImage} />}
                  <img
                    src={slide.image}
                    srcSet={siteSrcSet(slide.image)}
                    sizes="100vw"
                    alt={slide.alt}
                    width={1920}
                    height={1280}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    decoding={i === 0 ? 'sync' : 'async'}
                    className="absolute inset-0 h-full w-full object-cover [object-position:var(--hero-pos-sm)] sm:[object-position:var(--hero-pos)]"
                    style={
                      {
                        '--hero-pos': slide.position || 'center',
                        '--hero-pos-sm': slide.mobilePosition || slide.position || 'center',
                      } as React.CSSProperties
                    }
                  />
                </picture>
              )}
              {(hasText || slide.primary) && (
                <>
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 lg:hidden bg-[linear-gradient(0deg,rgba(9,18,30,0.92)_0%,rgba(9,18,30,0.72)_42%,rgba(9,18,30,0.15)_78%,rgba(9,18,30,0)_100%)]"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 hidden lg:block bg-[linear-gradient(90deg,rgba(9,18,30,0.86)_0%,rgba(9,18,30,0.66)_36%,rgba(9,18,30,0.16)_68%,rgba(9,18,30,0)_100%)]"
                  />
                </>
              )}
              {!placeholder && (hasText || slide.primary) && (
                <div className={cx(container, 'relative flex h-full items-end lg:items-center pb-[88px] lg:pb-[64px] lg:pt-4')}>
                  <div className="max-w-[640px] text-white">
                    {slide.eyebrow && <p className="text-[14px] font-semibold text-accent">{slide.eyebrow}</p>}
                    {slide.title && (
                      <h2 className="mt-2 font-display font-bold text-[40px] sm:text-[52px] lg:text-[60px] [@media(min-width:1024px)_and_(max-height:760px)]:text-[50px] leading-[0.98] tracking-[-0.005em] text-balance line-clamp-3">
                        {slide.title}
                      </h2>
                    )}
                    {slide.text && (
                      <p
                        className={cx(
                          'mt-3 max-w-[540px] text-[16px] sm:text-[17px] leading-relaxed text-white/85 text-pretty line-clamp-3',
                          slide.meta?.length && '[@media(min-width:1024px)_and_(max-height:760px)]:hidden',
                          slide.textOnPhone === false && 'hidden sm:block',
                        )}
                      >
                        {slide.text}
                      </p>
                    )}
                    {slide.meta && slide.meta.length > 0 && (
                      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[15px] text-white/90">
                        {slide.meta.map((m) => {
                          const Icon = META_ICON[m.icon];
                          return (
                            <li key={m.icon + m.text} className="inline-flex items-center gap-1.5">
                              <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                              {m.text}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {(slide.primary || slide.secondary) && (
                      <div className="mt-6 flex flex-wrap gap-3">
                        {slide.primary && <ActionButton action={slide.primary} variant="accent" />}
                        {slide.secondary && <ActionButton action={slide.secondary} variant="onDark" />}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {count > 1 && !placeholder && (
          <div className="absolute inset-x-0 bottom-0 z-20">
            <div className={cx(container, 'flex h-[72px] items-center justify-between gap-4')}>
              <div className="flex items-center" role="group" aria-label="Choose a slide">
                {slides.map((s, i) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Show slide ${i + 1}${s.title ? `: ${s.title}` : ''}`}
                    aria-current={i === index ? 'true' : undefined}
                    className="group inline-flex h-11 w-11 items-center justify-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <span
                      aria-hidden="true"
                      className={cx(
                        'block h-[3px] rounded-full transition-all',
                        i === index ? 'w-7 bg-accent' : 'w-4 bg-white/45 group-hover:bg-white/80',
                      )}
                    />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {autoplayAllowed && (
                  <button
                    type="button"
                    onClick={() => setUserPaused((p) => !p)}
                    aria-label={userPaused ? 'Play slideshow' : 'Pause slideshow'}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/85 hover:text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  >
                    {userPaused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => goTo(index - 1)}
                  aria-label="Previous slide"
                  className="hidden sm:inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/35 text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(index + 1)}
                  aria-label="Next slide"
                  className="hidden sm:inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/35 text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
