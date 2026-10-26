import React, { useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { StringProduct, StringVariant } from '../../../types/content';
import { useCart } from '../../../context/CartContext';
import { formatInr, hasPrice, inStockCount, productLabel, safeHex, safeImageUrl, sortedVariants } from './format';
import { SECTION_IDS, useShop } from './shop';
import { SectionHeader, btn, container, cx, fieldControl } from './ui';

const FEATURED_COUNT = 4;
const ALL = 'All';

interface StringsSectionProps {
  strings: StringProduct[];
  status: 'loading' | 'ready' | 'error';
  /** 'home': featured strings and a "See all" button; 'page': the full catalogue with brand filter and search. */
  mode?: 'home' | 'page';
  /** Home: what "See all" does (opens the Strings page). */
  onSeeAll?: () => void;
  /** Page: start filtered to this brand (when it has strings here). */
  initialBrand?: string;
  /** False on the Strings page, where the page title and intro sit above. */
  showHeader?: boolean;
  onUseString: (product: StringProduct, colour?: string) => void;
}

/** Featured strings (home) or the full catalogue with brand filter + search (Strings page). */
export const StringsSection: React.FC<StringsSectionProps> = ({ strings, status, mode = 'home', onSeeAll, initialBrand, showHeader = true, onUseString }) => {
  const SHOP = useShop();
  const uid = useId();
  const expanded = mode === 'page';
  const [brand, setBrand] = useState(() => (initialBrand && strings.some((p) => p.brand === initialBrand) ? initialBrand : ALL));
  const [query, setQuery] = useState('');

  const brands = useMemo(() => {
    const counts = new Map<string, number>();
    strings.forEach((p) => counts.set(p.brand, (counts.get(p.brand) || 0) + 1));
    return [...counts.entries()];
  }, [strings]);

  const featured = useMemo(() => {
    const f = strings.filter((p) => p.isFeatured && inStockCount(p) > 0);
    return (f.length ? f : strings).slice(0, FEATURED_COUNT);
  }, [strings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return strings.filter(
      (p) =>
        (brand === ALL || p.brand === brand) &&
        (!q || `${productLabel(p)} ${p.code || ''} ${p.gauge || ''}`.toLowerCase().includes(q)),
    );
  }, [strings, brand, query]);

  const shown = expanded ? filtered : featured;
  const brandNames = brands.map(([b]) => b);

  return (
    <section id={SECTION_IDS.strings} aria-labelledby={showHeader ? 'strings-title' : 'page-title'} className="scroll-mt-20 border-t border-line bg-white py-16 sm:py-24">
      <div className={container}>
        {showHeader && (
        <SectionHeader
          id="strings-title"
          title="Strings we stock"
          intro={
            strings.length
              ? `${strings.length} strings from ${listText(brandNames)}, with the colours we have right now. Tap a colour to see the pack, then book with it.`
              : 'The strings and colours we have in the shop right now.'
          }
          action={
            !expanded && onSeeAll && strings.length > FEATURED_COUNT ? (
              <button type="button" onClick={onSeeAll} className={cx(btn.base, btn.secondary, 'hidden sm:inline-flex')}>
                See all {strings.length} strings
              </button>
            ) : undefined
          }
        />
        )}

        {status === 'loading' && (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[440px] animate-pulse rounded-xl bg-paper-deep motion-reduce:animate-none" />
            ))}
          </div>
        )}

        {status === 'error' && (
          <p className="mt-10 rounded-xl border border-line bg-paper px-5 py-4 text-[15px] text-ink-soft">
            The strings list isn't loading right now. Call{' '}
            <a href={SHOP.phoneTel} className="font-semibold text-sportsBlue underline underline-offset-2">
              {SHOP.phoneDisplay}
            </a>{' '}
            or{' '}
            <a href={SHOP.whatsAppLink(SHOP.greeting('which strings and colours do you have right now?'))} target="_blank" rel="noopener noreferrer" className="font-semibold text-sportsBlue underline underline-offset-2">
              ask on WhatsApp
            </a>{' '}
            for what's in stock.
          </p>
        )}

        {status === 'ready' && strings.length === 0 && (
          <p className="mt-10 rounded-xl border border-line bg-paper px-5 py-4 text-[15px] text-ink-soft">
            No strings are listed right now. Call {SHOP.phoneDisplay} for what we have in stock.
          </p>
        )}

        {status === 'ready' && strings.length > 0 && (
          <>
            {expanded && (
              <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                {brands.length > 1 && (
                  <div role="group" aria-label="Filter by brand" className="flex flex-wrap gap-2">
                    {[[ALL, strings.length] as [string, number], ...brands].map(([b, n]) => (
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
                <div className="relative w-full lg:w-[280px]">
                  <label htmlFor={`${uid}-search`} className="sr-only">
                    Search strings
                  </label>
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                  <input
                    id={`${uid}-search`}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search, e.g. BG80 or 0.66"
                    className={cx(fieldControl, 'pl-10')}
                  />
                </div>
              </div>
            )}

            <p className="sr-only" aria-live="polite">
              {expanded ? `${filtered.length} strings shown` : ''}
            </p>

            <ul id={`${uid}-grid`} className={cx('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', expanded ? 'mt-6' : 'mt-10')}>
              {shown.map((p) => (
                <li key={p.id} className="flex">
                  <StringCard product={p} onUse={onUseString} />
                </li>
              ))}
            </ul>

            {expanded && filtered.length === 0 && (
              <p className="mt-6 text-[15px] text-ink-soft">
                No strings match{query ? ` “${query}”` : ''}.{' '}
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setBrand(ALL);
                  }}
                  className="font-semibold text-sportsBlue underline underline-offset-4"
                >
                  Show all strings
                </button>
              </p>
            )}

            {!expanded && onSeeAll && strings.length > FEATURED_COUNT && (
              <div className="mt-6 sm:hidden">
                <button type="button" onClick={onSeeAll} className={cx(btn.base, btn.secondary, 'w-full')}>
                  See all {strings.length} strings
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

function listText(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

const StringCard: React.FC<{ product: StringProduct; onUse: (product: StringProduct, colour?: string) => void }> = ({ product: p, onUse }) => {
  const cart = useCart();
  const label = productLabel(p);
  const variants = sortedVariants(p);
  const available = variants.filter((v) => v.inStock);
  const stock = inStockCount(p);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => (available.find((v) => safeImageUrl(v.imageUrl)) || available[0])?.id,
  );
  const selected = variants.find((v) => v.id === selectedId);
  const imageVariant = selected && safeImageUrl(selected.imageUrl) ? selected : variants.find((v) => safeImageUrl(v.imageUrl));
  const image = imageVariant ? safeImageUrl(imageVariant.imageUrl) : null;
  const [broken, setBroken] = useState<string | null>(null);

  const cycle = () => {
    if (available.length < 2) return;
    const i = available.findIndex((v) => v.id === selectedId);
    setSelectedId(available[(i + 1) % available.length].id);
  };

  return (
    <article className="flex w-full flex-col rounded-xl border border-line bg-white p-4 transition-colors hover:border-ink/25">
      <div className="grid grid-cols-[104px_1fr] gap-4 sm:block">
        <button
          type="button"
          onClick={cycle}
          disabled={available.length < 2}
          className="relative block aspect-[5/6] w-full overflow-hidden rounded-lg bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue disabled:cursor-default"
          aria-label={available.length > 1 ? `${label}: show the next colour` : `${label} pack photo`}
        >
          {image && broken !== image ? (
            <img
              src={image}
              alt={`${label}${imageVariant ? `, ${imageVariant.colour}` : ''} string pack`}
              width={420}
              height={504}
              loading="lazy"
              decoding="async"
              onError={() => setBroken(image)}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center bg-paper px-2 text-center text-[13px] text-ink-muted">
              No photo yet
            </span>
          )}
        </button>

        <div className="min-w-0 sm:mt-4">
          <p className="text-[13px] text-ink-muted">
            {p.brand}
            {p.gauge ? ` · ${p.gauge}` : ''}
          </p>
          <h3 className="font-display text-[22px] font-semibold leading-tight text-ink">{p.name}</h3>
          <p className={cx('mt-1 text-[14px]', stock ? 'text-ink-soft' : 'font-medium text-flameRed')}>
            {stock ? (variants.length ? `${stock} of ${variants.length} colours in stock` : 'In stock') : 'Out of stock'}
          </p>
        </div>
      </div>

      {variants.length > 0 && (
        <div className="mt-3">
          <div role="group" aria-label={`${label} colours`} className="-ml-2 flex flex-wrap sm:ml-0 sm:gap-1.5">
            {variants.map((v) => (
              <Swatch key={v.id} variant={v} selected={v.id === selectedId} onSelect={() => setSelectedId(v.id)} />
            ))}
          </div>
          {selected && <p className="mt-1.5 text-[14px] text-ink-soft">Colour: {selected.colour}</p>}
        </div>
      )}

      <div className="mt-auto pt-4">
        {hasPrice(p.price) && <p className="mb-2 text-[15px] font-semibold text-ink">{formatInr(p.price)}</p>}
        {hasPrice(p.price) && selected?.inStock && (
          <button
            type="button"
            onClick={() =>
              cart.add({
                kind: 'string',
                productId: p.id,
                variantId: selected.id,
                name: label,
                detail: selected.colour,
                unitPrice: p.price as number,
                image: safeImageUrl(selected.imageUrl) || image,
              })
            }
            className={cx(btn.base, btn.primary, 'mb-2 w-full px-4 text-[14px]')}
            aria-label={`Add a ${label} string set in ${selected.colour} to the cart`}
          >
            Add string set to cart
          </button>
        )}
        <button
          type="button"
          disabled={!stock}
          onClick={() => onUse(p, selected?.inStock ? selected.colour : undefined)}
          className={cx(btn.base, stock ? btn.secondary : 'border border-line bg-paper text-ink-muted', 'w-full px-4 text-[14px]')}
          aria-label={stock ? `Book stringing with ${label}${selected ? `, ${selected.colour}` : ''}` : `${label} is out of stock`}
        >
          {stock ? 'Book with this string' : 'Out of stock'}
        </button>
      </div>
    </article>
  );
};

export const Swatch: React.FC<{ variant: StringVariant; selected: boolean; onSelect: () => void }> = ({ variant: v, selected, onSelect }) => {
  const hex = safeHex(v.colourHex);
  const img = safeImageUrl(v.imageUrl);
  const status = v.inStock ? 'in stock' : 'out of stock';
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!v.inStock}
      aria-pressed={v.inStock ? selected : undefined}
      aria-label={`${v.colour} (${status})`}
      title={`${v.colour}, ${status}`}
      className="group inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue disabled:cursor-not-allowed sm:h-8 sm:w-8"
    >
      <span
        aria-hidden="true"
        className={cx(
          'relative block h-7 w-7 overflow-hidden rounded-full border border-black/15 sm:h-6 sm:w-6',
          selected && 'ring-2 ring-ink ring-offset-2',
          !v.inStock && 'opacity-40',
          v.inStock && !selected && 'group-hover:ring-2 group-hover:ring-ink/30 group-hover:ring-offset-1',
        )}
        style={hex ? { backgroundColor: hex } : undefined}
      >
        {!hex && img && <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />}
        {!v.inStock && <span className="absolute left-[-20%] top-1/2 h-0.5 w-[140%] -rotate-45 bg-flameRed" />}
      </span>
    </button>
  );
};
