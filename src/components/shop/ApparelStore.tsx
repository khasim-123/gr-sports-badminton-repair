import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, MapPin, Phone, Ruler, Store, Truck, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ApiError } from '../../services/apiClient';
import { shopService } from '../../services/shopService';
import type { ApparelCategory, ApparelProduct } from '../../types/shop';
import { EnquiryForm } from '../public/enquiry/EnquiryForm';
import { beyondFreeText, formatKm } from '../public/home/format';
import { HeroCarousel, type HeroSlide } from '../public/home/HeroCarousel';
import { Photo } from '../public/home/Photo';
import { PriceTag } from '../public/home/PriceTag';
import { scrollToSection, useShop } from '../public/home/shop';
import { WhatsAppIcon, btn, container, cx } from '../public/home/ui';
import { usePageIntent, useRevealIntent } from '../public/layout/PageIntro';
import { PublicLayout } from '../public/layout/PublicLayout';
import { ApparelProductDialog } from './ApparelProductDialog';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  activeApparel,
  photoSrcSet,
  productColours,
  productInStock,
  productPhotos,
  productSizes,
  sizesLabel,
  swatchColour,
} from './shopFormat';

type LoadState = { status: 'loading' | 'ready' | 'error'; products: ApparelProduct[] };
const ALL = 'all';
const SUBLINE = 'T-shirts & team wear';

/**
 * T-shirts page (the 'apparel' view, URL /tshirts; GR website map: hero banner, T-shirt grid,
 * custom T-shirt form). Products come from GET /api/shop/apparel (admin-managed); an empty list
 * shows a "coming soon" note with a WhatsApp link for team orders.
 */
export const ApparelStore: React.FC = () => {
  const SHOP = useShop();
  const app = useApp();
  const { distanceConfig } = app;
  const [state, setState] = useState<LoadState>({ status: 'loading', products: [] });
  const [category, setCategory] = useState<string>(ALL);
  const [openId, setOpenId] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [customForm, setCustomForm] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    const previous = document.title;
    document.title = `${SUBLINE} — ${SHOP.name}`;
    return () => {
      document.title = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading' }));
    shopService
      .getApparel()
      .then((list) => !cancelled && setState({ status: 'ready', products: activeApparel(list) }))
      .catch((err) => {
        if (cancelled) return;
        // No catalogue on this server yet: same as an empty shop.
        if (err instanceof ApiError && err.status === 404) setState({ status: 'ready', products: [] });
        else setState({ status: 'error', products: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const categories = useMemo(() => {
    const counts = new Map<ApparelCategory, number>();
    state.products.forEach((p) => counts.set(p.category, (counts.get(p.category) || 0) + 1));
    return CATEGORY_ORDER.filter((c) => counts.has(c)).map((c) => [c, counts.get(c) as number] as const);
  }, [state.products]);
  const shown = category === ALL ? state.products : state.products.filter((p) => p.category === category);
  const openProduct = state.products.find((p) => p.id === openId) || null;
  const hasProducts = state.status === 'ready' && state.products.length > 0;

  // Site search: a product opens its dialog; "Custom T-shirts" goes to the request form.
  const intent = usePageIntent('tshirts');
  const openedFor = useRef<object | null>(null);
  useEffect(() => {
    if (!intent?.item || openedFor.current === intent || !state.products.some((p) => p.id === intent.item)) return;
    openedFor.current = intent; // once per search, not on every reload
    setOpenId(intent.item);
  }, [intent, state.products]);
  useRevealIntent(intent, state.status !== 'loading', (i) => (i.section ? { id: i.section } : null));

  const free = distanceConfig.freeRadiusKm;
  const showShopLink = hasProducts || state.status === 'loading';

  const teamMessage = SHOP.greeting(
    [
      "I'd like T-shirts / jerseys for our team.",
      'Team or club name: ',
      'How many pieces: ',
      'Sizes (how many S / M / L / XL / XXL): ',
      'Colours: ',
      'Names and numbers printed (yes / no): ',
      'Needed by (date): ',
    ].join('\n'),
  );

  const hero = useMemo<HeroSlide[]>(
    () => [
      {
        key: 'tshirts',
        image: '/images/apparel/hero.webp',
        alt: 'Rows of plain T-shirts in red, orange, yellow and green on hangers',
        eyebrow: `${SHOP.name} · ${SHOP.locality}`,
        title: SUBLINE,
        // Non-breaking hyphens: 'T-' never ends a line.
        text: 'T‑shirts and sportswear from the shop, and custom printed T‑shirts and jerseys for teams. We deliver, or you collect from the shop.',
        primary: showShopLink
          ? { label: "See what's in the shop", onClick: () => scrollToSection('products', { focus: true }) }
          : { label: 'Custom T-shirts', onClick: () => scrollToSection('custom', { focus: true }) },
        secondary: showShopLink ? { label: 'Custom T-shirts', onClick: () => scrollToSection('custom', { focus: true }) } : undefined,
      },
    ],
    [SHOP, showShopLink],
  );

  return (
    <PublicLayout page="tshirts">
      <h1 className="sr-only">
        {SUBLINE} at {SHOP.name}
      </h1>
      <HeroCarousel slides={hero} label={SUBLINE} />

      {/* Products */}
      <section id="products" aria-labelledby="products-title" className="scroll-mt-24 py-6 sm:py-8">
        <div className={container}>
          {state.status === 'loading' && (
            <>
              <h2 id="products-title" className="sr-only">
                Products
              </h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i}>
                    <div className="aspect-[4/5] animate-pulse rounded-xl bg-paper-deep motion-reduce:animate-none" />
                    <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-paper-deep motion-reduce:animate-none" />
                    <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-paper-deep motion-reduce:animate-none" />
                    <div className="mt-3 h-3.5 w-1/2 animate-pulse rounded bg-paper-deep motion-reduce:animate-none" />
                  </div>
                ))}
              </div>
              <p className="sr-only" role="status">
                Loading the T-shirts…
              </p>
            </>
          )}

          {state.status === 'error' && (
            <div className="rounded-xl border border-line bg-paper px-5 py-5">
              <h2 id="products-title" className="font-display text-[26px] font-semibold">
                The list isn't loading right now
              </h2>
              <p className="mt-1 text-[15px] text-ink-soft">
                Call{' '}
                <a href={SHOP.phoneTel} className="font-semibold text-sportsBlue underline underline-offset-2">
                  {SHOP.phoneDisplay}
                </a>{' '}
                or message us on WhatsApp for what we have in stock.
              </p>
              <button type="button" onClick={() => setNonce((n) => n + 1)} className={cx(btn.base, btn.secondary, 'mt-4')}>
                Try again
              </button>
            </div>
          )}

          {state.status === 'ready' && state.products.length === 0 && (
            <div className="grid items-center gap-8 rounded-xl border border-line bg-white p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <h2 id="products-title" className="font-display text-[34px] font-semibold leading-[1.02] text-balance">
                  New T-shirts coming soon — message us for team orders
                </h2>
                <p className="mt-3 max-w-md text-[16px] leading-relaxed text-ink-soft">
                  We're putting the shop's T-shirts online. Until then, call or message us for what's in the shop, or for printed
                  T-shirts for your team.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a href={SHOP.whatsAppLink(teamMessage)} target="_blank" rel="noopener noreferrer" className={cx(btn.base, btn.primary)}>
                    <WhatsAppIcon className="h-4 w-4" />
                    Message us on WhatsApp
                  </a>
                  <a href={SHOP.phoneTel} className={cx(btn.base, btn.secondary)}>
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Call {SHOP.phoneDisplay}
                  </a>
                </div>
              </div>
              <Photo
                src="/images/apparel/tees-folded.webp"
                alt="Folded T-shirts in black, grey and white"
                sizes="(min-width: 768px) 520px, 100vw"
                aspect="aspect-[4/3]"
                className="rounded-lg"
              />
            </div>
          )}

          {hasProducts && (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id="products-title" data-section-heading className="font-display text-[34px] font-semibold leading-none outline-none sm:text-[42px]">
                    In the shop
                  </h2>
                  <p className="mt-2 text-[15px] text-ink-soft">Tap an item to choose your colour and size.</p>
                </div>
                {categories.length > 1 && (
                  <div role="group" aria-label="Filter by category" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                    {[[ALL, state.products.length] as const, ...categories].map(([c, n]) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={category === c}
                        onClick={() => setCategory(c)}
                        className={cx(
                          'inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border px-4 text-[15px] font-medium transition-colors',
                          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue',
                          category === c ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink/40',
                        )}
                      >
                        {c === ALL ? 'All' : CATEGORY_LABELS[c as ApparelCategory]}
                        <span className={category === c ? 'text-white/60' : 'text-ink-muted'}>{n}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="sr-only" aria-live="polite">
                {shown.length} items shown
              </p>
              <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
                {shown.map((p) => (
                  <li key={p.id} className="flex">
                    <ProductCard product={p} onOpen={() => setOpenId(p.id)} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* Custom T-shirts (GR website map: "customized option form") */}
      <section id="custom" aria-labelledby="custom-title" className="scroll-mt-24 border-t border-line bg-paper py-6 sm:py-8">
        <div className={cx(container, 'grid items-start gap-8 lg:grid-cols-12')}>
          <div className="lg:col-span-5">
            <h2 id="custom-title" data-section-heading className="font-display text-[34px] font-semibold leading-[1.02] outline-none sm:text-[42px]">
              Custom T-shirts &amp; jerseys
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
              For clubs, academies, schools and office teams: T-shirts or jerseys printed with your team name, and player names and
              numbers if you want them. Send the details and we call you back with the price and when they'll be ready.
            </p>
            <div className="mt-6 hidden grid-cols-5 gap-3 lg:grid">
              <Photo
                src="/images/apparel/printing.webp"
                alt="Logos being screen printed onto black T-shirts on a long print table"
                sizes="280px"
                aspect="aspect-[4/5]"
                className="col-span-3 rounded-xl"
              />
              <div className="col-span-2 flex flex-col gap-3">
                <Photo src="/images/apparel/team.webp" alt="Players in matching printed red jerseys" sizes="180px" aspect="aspect-[4/5]" className="rounded-xl" />
                <Photo src="/images/apparel/colours.webp" alt="A stack of folded T-shirts in different colours" sizes="180px" aspect="aspect-square" className="rounded-xl" />
              </div>
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-line bg-white p-5 sm:p-7">
              <EnquiryForm
                key={customForm}
                kind="custom_tshirt"
                submitLabel="Send request"
                nextStep="We'll go through the design and sizes with you and give you a price."
                onDone={() => setCustomForm((n) => n + 1)}
              />
            </div>
            <p className="mt-4 text-[14px] text-ink-muted">
              Prefer WhatsApp?{' '}
              <a href={SHOP.whatsAppLink(teamMessage)} target="_blank" rel="noopener noreferrer" className="font-semibold text-sportsBlue underline underline-offset-2">
                Send the details there
              </a>{' '}
              or call{' '}
              <a href={SHOP.phoneTel} className="whitespace-nowrap font-semibold text-ink underline underline-offset-2">
                {SHOP.phoneDisplay}
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Delivery, pickup, payment, sizes */}
      <section id="delivery" aria-labelledby="delivery-title" className="scroll-mt-24 border-t border-line py-6 sm:py-8">
        <div className={container}>
          <h2 id="delivery-title" data-section-heading className="font-display text-[30px] font-semibold leading-none outline-none sm:text-[36px]">
            Delivery, pickup and payment
          </h2>
          <div className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            <InfoBlock icon={<Truck className="h-5 w-5" aria-hidden="true" />} title="Delivery">
              {free > 0 ? `Free within ${formatKm(free)} of the shop. ` : ''}
              {beyondFreeText(distanceConfig)} The exact charge is shown at checkout.
            </InfoBlock>
            <InfoBlock icon={<Store className="h-5 w-5" aria-hidden="true" />} title="Collect from the shop">
              <span className="block">{SHOP.addressLines.join(', ')}</span>
              {SHOP.openingHours && (
                <span className="mt-1 flex items-start gap-1.5">
                  <Clock className="mt-[3px] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {SHOP.openingHours}
                </span>
              )}
              <a href={SHOP.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-[36px] items-center gap-1 font-semibold text-sportsBlue underline underline-offset-2">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                Directions
              </a>
            </InfoBlock>
            <InfoBlock icon={<Wallet className="h-5 w-5" aria-hidden="true" />} title="Payment">
              Pay when it's delivered or at the shop — cash or UPI. Nothing is paid online.
            </InfoBlock>
            <InfoBlock icon={<Ruler className="h-5 w-5" aria-hidden="true" />} title="Sizes">
              Not sure of your size?{' '}
              <a
                href={SHOP.whatsAppLink(SHOP.greeting('which T-shirt size should I take? My chest size is: '))}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-sportsBlue underline underline-offset-2"
              >
                Message us your chest size
              </a>{' '}
              and we'll tell you which size to take.
            </InfoBlock>
          </div>
        </div>
      </section>
      <ApparelProductDialog product={openProduct} onClose={() => setOpenId(null)} />
    </PublicLayout>
  );
};

const InfoBlock: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div>
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-paper text-ink">{icon}</span>
    <h3 className="mt-3 text-[16px] font-semibold text-ink">{title}</h3>
    <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{children}</p>
  </div>
);

const ProductCard: React.FC<{ product: ApparelProduct; onOpen: () => void }> = ({ product: p, onOpen }) => {
  const photos = productPhotos(p);
  const photo = photos[0];
  const [broken, setBroken] = useState(false);
  const inStock = productInStock(p);
  const colours = productColours(p);
  const sizes = sizesLabel(productSizes(p));
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className="group flex w-full flex-col rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sportsBlue"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-paper-deep">
        {photo && !broken ? (
          <img
            src={photo}
            srcSet={photoSrcSet(photo)}
            sizes="(min-width: 1024px) 280px, (min-width: 768px) 33vw, 50vw"
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className={cx('absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]', !inStock && 'opacity-60 grayscale')}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[13px] text-ink-muted">No photo yet</span>
        )}
        {!inStock && (
          <span className="absolute left-2 top-2 rounded-md bg-white px-2 py-1 text-[12px] font-semibold text-flameRed">Out of stock</span>
        )}
      </div>
      <span className="mt-3 block text-[15px] font-semibold leading-snug text-ink group-hover:underline group-hover:underline-offset-4">{p.name}</span>
      <span className="mt-0.5 block">
        <PriceTag price={p.price} mrp={p.mrp} />
      </span>
      <span className="mt-2 flex items-center gap-2 text-[13px] text-ink-muted">
        {colours.length > 0 && (
          <span className="flex items-center gap-1" aria-label={`Colours: ${colours.map((c) => c.colour).join(', ')}`}>
            {colours.slice(0, 5).map((c) => {
              const sw = swatchColour(c.colour, c.colourHex);
              return (
                <span
                  key={c.colour}
                  aria-hidden="true"
                  title={c.colour}
                  className="h-3.5 w-3.5 rounded-full border border-black/20"
                  style={sw ? { backgroundColor: sw } : undefined}
                />
              );
            })}
            {colours.length > 5 && <span aria-hidden="true">+{colours.length - 5}</span>}
          </span>
        )}
        {sizes && <span className="truncate">{sizes}</span>}
      </span>
    </button>
  );
};
