import React, { useId, useMemo, useState } from 'react';
import type { Racket } from '../../../types/content';
import { useCart } from '../../../context/CartContext';
import { hasPrice, productLabel, safeImageUrl } from './format';
import { PriceTag } from './PriceTag';
import { SECTION_IDS, useShop } from './shop';
import { SectionHeader, WhatsAppIcon, btn, container, cx } from './ui';

const FEATURED_COUNT = 4;
const ALL = 'All';
const MAX_PHOTOS = 6;

export function activeRackets(rackets: Racket[] | undefined): Racket[] {
  return (rackets || [])
    .filter((r) => r && r.isActive !== false && (r.name || '').trim())
    .sort((a, b) => a.sortOrder - b.sortOrder || productLabel(a).localeCompare(productLabel(b)));
}

function racketPhotos(r: Racket): string[] {
  const seen = new Set<string>();
  for (const url of Array.isArray(r.images) ? r.images : []) {
    const safe = safeImageUrl(url);
    if (safe) seen.add(safe);
  }
  return [...seen].slice(0, MAX_PHOTOS);
}

interface RacketsSectionProps {
  rackets: Racket[];
  /** 'home': a few featured rackets and a "See all" button; 'page': every racket with a brand filter. */
  mode?: 'home' | 'page';
  /** Home: what "See all" does (opens the Rackets page). */
  onSeeAll?: () => void;
  id?: string;
  title?: string;
  intro?: string;
  /** Page: start filtered to this brand (when it has rackets here). */
  initialBrand?: string;
  /** Background of the section. */
  tone?: 'white' | 'paper';
}


/** Shown only when there are active rackets (the caller hides it otherwise). */
export const RacketsSection: React.FC<RacketsSectionProps> = ({
  rackets,
  mode = 'home',
  onSeeAll,
  id = SECTION_IDS.rackets,
  title = 'Rackets at the shop',
  intro = 'A selection of the rackets we keep. Stock changes, so message us to check a model or a price before you visit.',
  initialBrand,
  tone = 'white',
}) => {
  const uid = useId();
  const expanded = mode === 'page';
  const [brand, setBrand] = useState(() =>
    initialBrand && rackets.some((r) => ((r.brand || '').trim() || 'Other') === initialBrand) ? initialBrand : ALL,
  );

  const brands = useMemo(() => {
    const counts = new Map<string, number>();
    rackets.forEach((r) => {
      const b = (r.brand || '').trim() || 'Other';
      counts.set(b, (counts.get(b) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rackets]);

  const featured = useMemo(() => {
    const f = rackets.filter((r) => r.isFeatured);
    return (f.length ? f : rackets).slice(0, FEATURED_COUNT);
  }, [rackets]);
  const canSeeAll = !expanded && !!onSeeAll && rackets.length > featured.length;
  const shown = expanded ? rackets.filter((r) => brand === ALL || ((r.brand || '').trim() || 'Other') === brand) : featured;

  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cx('scroll-mt-20 border-t border-line py-10 sm:py-14', tone === 'paper' ? 'bg-paper' : 'bg-white')}>
      <div className={container}>
        <SectionHeader
          id={`${id}-title`}
          title={title}
          intro={intro}
          action={
            canSeeAll ? (
              <button type="button" onClick={onSeeAll} className={cx(btn.base, btn.secondary)}>
                See all {rackets.length} rackets
              </button>
            ) : undefined
          }
        />

        {expanded && brands.length > 1 && (
          <div role="group" aria-label="Filter by brand" className="mt-6 flex flex-wrap gap-2">
            {[[ALL, rackets.length] as [string, number], ...brands].map(([b, n]) => (
              <button
                key={b}
                type="button"
                aria-pressed={brand === b}
                onClick={() => setBrand(b)}
                className={cx(
                  'inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-[15px] font-medium transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue',
                  brand === b ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink/40',
                )}
              >
                {b === ALL ? 'All brands' : b}
                <span className={brand === b ? 'text-white/60' : 'text-ink-muted'}>{n}</span>
              </button>
            ))}
          </div>
        )}

        <ul id={`${uid}-grid`} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((r) => (
            <li key={r.id} id={`racket-${r.id}`} className="flex scroll-mt-28 rounded-xl">
              <RacketCard racket={r} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

const RacketCard: React.FC<{ racket: Racket }> = ({ racket: r }) => {
  const SHOP = useShop();
  const cart = useCart();
  const label = productLabel(r);
  const photos = racketPhotos(r);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const inStock = r.inStock !== false;
  const tag = (r.tag || '').trim();
  const priced = hasPrice(r.price);
  const photo = photos[photoIndex];
  const showPhoto = !!photo && !failed.has(photo);

  const specs = (
    [
      ['Balance', r.balance],
      ['Shaft', r.flex],
      ['Weight', r.weight],
      ['Max tension', r.maxTension],
    ] as [string, string | null | undefined][]
  )
    .map(([k, v]) => [k, (v || '').trim()] as [string, string])
    .filter(([, v]) => v);

  const message = inStock
    ? SHOP.greeting(`I'm interested in the ${label} racket. Is it available${priced ? '' : ', and what is the price'}?`)
    : SHOP.greeting(`is the ${label} racket back in stock?`);

  return (
    <article className={cx('flex w-full flex-col overflow-hidden rounded-xl border border-line', inStock ? 'bg-white' : 'bg-paper')}>
      {showPhoto && (
        <div className="border-b border-line bg-white">
          <div className="relative aspect-square">
            <img
              src={photo}
              alt={photos.length > 1 ? `${label}, photo ${photoIndex + 1} of ${photos.length}` : label}
              loading="lazy"
              decoding="async"
              onError={() => setFailed((prev) => new Set(prev).add(photo))}
              className={cx('absolute inset-0 h-full w-full object-contain p-4', !inStock && 'opacity-60 grayscale')}
            />
          </div>
          {photos.length > 1 && (
            <div role="group" aria-label={`${label} photos`} className="flex justify-center pb-1">
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPhotoIndex(i)}
                  aria-pressed={i === photoIndex}
                  aria-label={`Show photo ${i + 1} of ${photos.length}`}
                  className="inline-flex h-11 w-8 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue"
                >
                  <span aria-hidden="true" className={cx('block h-2 w-2 rounded-full', i === photoIndex ? 'bg-ink' : 'bg-line')} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <p className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className="font-semibold text-ink-soft">{r.brand}</span>
          {tag && <span className="truncate text-ink-muted">{tag}</span>}
        </p>
        <h3 className="mt-1 font-display text-[26px] font-semibold leading-[1.08] text-ink">{r.name}</h3>
        {specs.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
            {specs.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[13px] text-ink-muted">{k}</dt>
                <dd className="text-[15px] leading-snug text-ink break-words">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {r.description && <p className="mt-4 line-clamp-3 text-[14px] leading-relaxed text-ink-soft">{r.description}</p>}

        <div className="mt-auto pt-5">
          <p className="flex items-baseline justify-between gap-3">
            {priced ? (
              <PriceTag price={r.price as number} mrp={r.mrp} size="display" />
            ) : (
              <span className="text-[15px] text-ink-muted">Ask for price</span>
            )}
            {!inStock && <span className="text-[14px] font-medium text-flameRed">Out of stock</span>}
          </p>
          {priced && inStock ? (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  cart.add({
                    kind: 'racket',
                    productId: r.id,
                    variantId: null,
                    name: label,
                    detail: null,
                    unitPrice: r.price as number,
                    image: photos[0] || null,
                  })
                }
                className={cx(btn.base, btn.primary, 'flex-1 px-3 text-[14px]')}
                aria-label={`Add the ${label} to the cart`}
              >
                Add to cart
              </button>
              <a
                href={SHOP.whatsAppLink(message)}
                target="_blank"
                rel="noopener noreferrer"
                className={cx(btn.base, btn.secondary, 'w-11 shrink-0 !px-0')}
                aria-label={`Ask about the ${label} on WhatsApp`}
                title="Ask on WhatsApp"
              >
                <WhatsAppIcon className="h-5 w-5 text-[#128C4B]" />
              </a>
            </div>
          ) : (
            <a
              href={SHOP.whatsAppLink(message)}
              target="_blank"
              rel="noopener noreferrer"
              className={cx(btn.base, btn.secondary, 'mt-3 w-full text-[14px]')}
              aria-label={`Ask about the ${label} on WhatsApp`}
            >
              <WhatsAppIcon className="h-4 w-4 text-[#128C4B]" />
              {inStock ? 'Ask on WhatsApp' : 'Ask when it’s back'}
            </a>
          )}
        </div>
      </div>
    </article>
  );
};
