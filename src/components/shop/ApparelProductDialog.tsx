import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, X } from 'lucide-react';
import { MAX_CART_QTY, useCart } from '../../context/CartContext';
import type { ApparelProduct } from '../../types/shop';
import { useModalBehavior } from '../public/home/Dialog';
import { PriceTag } from '../public/home/PriceTag';
import { useShop } from '../public/home/shop';
import { WhatsAppIcon, btn, cx } from '../public/home/ui';
import {
  CATEGORY_LABELS,
  formatInr,
  photoSrcSet,
  productColours,
  productPhotos,
  productSizes,
  sortedVariants,
  swatchColour,
} from './shopFormat';
import { QtyStepper } from './shopUi';

interface Props {
  product: ApparelProduct | null;
  onClose: () => void;
}

/** Product details with colour + size selection (per-variant stock) and Add to cart. */
export const ApparelProductDialog: React.FC<Props> = ({ product, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalBehavior(!!product, panelRef, onClose, closeRef);
  if (!product) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-ink/60" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex min-h-full items-end justify-center sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <ProductPanel key={product.id} product={product} onClose={onClose} panelRef={panelRef} closeRef={closeRef} />
      </div>
    </div>,
    document.body,
  );
};

const ProductPanel: React.FC<{
  product: ApparelProduct;
  onClose: () => void;
  panelRef: React.RefObject<HTMLDivElement>;
  closeRef: React.RefObject<HTMLButtonElement>;
}> = ({ product: p, onClose, panelRef, closeRef }) => {
  const SHOP = useShop();
  const cart = useCart();
  const uid = useId();
  const photos = productPhotos(p);
  const variants = useMemo(() => sortedVariants(p), [p]);
  const sizes = productSizes(p);
  const colours = productColours(p);

  const colourHasStock = (c: string) => variants.some((v) => v.colour === c && v.stock > 0);
  const [colour, setColour] = useState<string>(() => (colours.find((c) => colourHasStock(c.colour)) || colours[0])?.colour || '');
  const [size, setSize] = useState<string>(() => {
    const own = variants.filter((v) => v.colour === colour && v.stock > 0);
    return sizes.length === 1 && own.length ? own[0].size : '';
  });
  const [qty, setQty] = useState(1);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [added, setAdded] = useState(false);
  const [tried, setTried] = useState(false);

  const variant = variants.find((v) => v.colour === colour && v.size === size) || null;
  const stockFor = (s: string) => variants.find((v) => v.colour === colour && v.size === s)?.stock ?? -1;
  const maxQty = Math.max(1, Math.min(MAX_CART_QTY, variant?.stock || MAX_CART_QTY));
  const anyStock = variants.some((v) => v.stock > 0);

  // A size that isn't available in the newly chosen colour is cleared.
  useEffect(() => {
    if (size && stockFor(size) <= 0) setSize('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colour]);
  useEffect(() => {
    if (qty > maxQty) setQty(maxQty);
  }, [qty, maxQty]);

  const addToCart = () => {
    setTried(true);
    if (!variant || variant.stock <= 0) return;
    cart.add(
      {
        kind: 'apparel',
        productId: p.id,
        variantId: variant.id,
        name: p.name,
        detail: [variant.size, variant.colour].filter(Boolean).join(' · '),
        unitPrice: p.price,
        image: photos[0] || null,
        quantity: qty,
      },
      { silent: true },
    );
    setAdded(true);
  };

  const photo = photos[photoIndex];
  const facts = ([
    ['Fabric', p.fabric],
    ['Fit', p.fit],
  ] as [string, string | null | undefined][]).filter(([, v]) => (v || '').trim());

  const sizeMessage = SHOP.greeting(`I'd like the ${p.name}${colour ? ` in ${colour}` : ''}. My chest size is: `);
  const printMessage = SHOP.greeting(`I'd like the ${p.name} with name / number printing. Quantity and sizes: `);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${uid}-title`}
      tabIndex={-1}
      className="relative w-full max-w-4xl overflow-clip rounded-t-2xl bg-white text-ink shadow-2xl outline-none sm:rounded-xl"
    >
      <div className="sticky top-0 z-10 flex h-0 justify-end">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mr-3 mt-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-ink shadow-sm ring-1 ring-black/5 hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue"
          aria-label="Close"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid md:grid-cols-2">
        {/* Photos */}
        <div className="bg-paper-deep">
          <div className="relative aspect-[4/5] sm:aspect-square md:aspect-[4/5]">
            {photo ? (
              <img
                src={photo}
                srcSet={photoSrcSet(photo)}
                sizes="(min-width: 768px) 450px, 100vw"
                alt={photos.length > 1 ? `${p.name}, photo ${photoIndex + 1} of ${photos.length}` : p.name}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-[14px] text-ink-muted">No photo yet</span>
            )}
          </div>
          {photos.length > 1 && (
            <div role="group" aria-label="Photos" className="flex gap-2 overflow-x-auto p-3">
              {photos.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setPhotoIndex(i)}
                  aria-pressed={i === photoIndex}
                  aria-label={`Show photo ${i + 1} of ${photos.length}`}
                  className={cx(
                    'relative h-16 w-14 shrink-0 overflow-hidden rounded-md bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue',
                    i === photoIndex ? 'ring-2 ring-ink' : 'ring-1 ring-line hover:ring-ink/40',
                  )}
                >
                  <img src={src} srcSet={photoSrcSet(src)} sizes="64px" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="px-5 pb-6 pt-5 sm:px-7 sm:pb-7 sm:pt-7">
          <p className="text-[13px] font-semibold text-[#9A6B00]">{CATEGORY_LABELS[p.category] || 'Clothing'}</p>
          <h2 id={`${uid}-title`} className="mt-1 pr-12 font-display text-[30px] font-semibold leading-[1.05] text-balance">
            {p.name}
          </h2>
          <p className="mt-2">
            <PriceTag price={p.price} mrp={p.mrp} size="large" />
          </p>
          {p.description && <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{p.description}</p>}

          {facts.length > 0 && (
            <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-line pt-4 sm:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[13px] text-ink-muted">{k}</dt>
                  <dd className="text-[15px] text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {!anyStock ? (
            <div className="mt-5 rounded-xl border border-line bg-paper px-4 py-3">
              <p className="text-[15px] font-medium text-flameRed">Out of stock</p>
              <a
                href={SHOP.whatsAppLink(SHOP.greeting(`is the ${p.name} back in stock?`))}
                target="_blank"
                rel="noopener noreferrer"
                className={cx(btn.link, 'min-h-[40px]')}
              >
                <WhatsAppIcon className="h-4 w-4 text-[#128C4B]" />
                Ask when it's back
              </a>
            </div>
          ) : (
            <>
              {colours.length > 0 && (
                <fieldset className="mt-5">
                  <legend className="text-[14px] font-medium text-ink">
                    Colour{colour ? <span className="font-normal text-ink-soft">: {colour}</span> : null}
                  </legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {colours.map((c) => {
                      const ok = colourHasStock(c.colour);
                      const swatch = swatchColour(c.colour, c.colourHex);
                      const selected = c.colour === colour;
                      return (
                        <button
                          key={c.colour}
                          type="button"
                          onClick={() => setColour(c.colour)}
                          disabled={!ok}
                          aria-pressed={selected}
                          aria-label={`${c.colour}${ok ? '' : ', out of stock'}`}
                          className={cx(
                            'inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-[14px] font-medium transition-colors',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue',
                            selected ? 'border-ink bg-white ring-1 ring-ink' : 'border-line bg-white hover:border-ink/40',
                            !ok && 'cursor-not-allowed text-ink-muted line-through opacity-60',
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className="h-5 w-5 shrink-0 rounded-full border border-black/15"
                            style={swatch ? { backgroundColor: swatch } : undefined}
                          />
                          {c.colour}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {sizes.length > 0 && (
                <fieldset className="mt-5">
                  <legend className="text-[14px] font-medium text-ink">
                    Size{size ? <span className="font-normal text-ink-soft">: {size}</span> : null}
                  </legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sizes.map((s) => {
                      const stock = stockFor(s);
                      const ok = stock > 0;
                      const selected = s === size;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSize(s)}
                          disabled={!ok}
                          aria-pressed={selected}
                          aria-label={`${s}${ok ? '' : stock === 0 ? ', out of stock' : `, not made in ${colour}`}`}
                          className={cx(
                            'inline-flex min-h-[44px] min-w-[52px] items-center justify-center rounded-xl border px-3 text-[15px] font-semibold transition-colors',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue',
                            selected ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink/40',
                            !ok && 'cursor-not-allowed border-dashed bg-paper text-ink-muted/60 line-through hover:border-line',
                          )}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                  <p className={cx('mt-2 text-[14px]', tried && !variant ? 'font-medium text-flameRed' : 'text-ink-muted')} aria-live="polite">
                    {variant
                      ? `${variant.size} in ${variant.colour}: ${variant.stock} in stock`
                      : tried
                        ? 'Please choose a size.'
                        : 'Crossed-out sizes are out of stock in this colour.'}
                  </p>
                </fieldset>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <QtyStepper value={qty} onChange={(n) => setQty(Math.max(1, Math.min(maxQty, n)))} max={maxQty} label="Quantity" size="md" />
                <button type="button" onClick={addToCart} className={cx(btn.base, btn.primary, 'flex-1 min-w-[180px]')}>
                  Add to cart · {formatInr(p.price * qty)}
                </button>
              </div>

              {added && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-emerald-50 px-4 py-2.5 text-[14px] text-emerald-900" role="status">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="font-medium">Added to your cart</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      window.setTimeout(cart.openCart, 0);
                    }}
                    className="ml-auto min-h-[36px] font-semibold underline underline-offset-4"
                  >
                    View cart
                  </button>
                </div>
              )}
            </>
          )}

          <div className="mt-6 space-y-3 border-t border-line pt-4 text-[14px] leading-relaxed text-ink-soft">
            {p.customisable && (
              <p>
                <span className="font-semibold text-ink">Customisable:</span> name &amp; number printing —{' '}
                <a href={SHOP.whatsAppLink(printMessage)} target="_blank" rel="noopener noreferrer" className="font-semibold text-sportsBlue underline underline-offset-2">
                  ask us on WhatsApp
                </a>
                .
              </p>
            )}
            <p>
              Not sure of your size?{' '}
              <a href={SHOP.whatsAppLink(sizeMessage)} target="_blank" rel="noopener noreferrer" className="font-semibold text-sportsBlue underline underline-offset-2">
                Message us your chest size
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
