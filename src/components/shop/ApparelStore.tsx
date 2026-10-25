import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, Clock, MapPin, Phone, Ruler, Store, Truck, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ApiError } from '../../services/apiClient';
import { shopService } from '../../services/shopService';
import type { ApparelCategory, ApparelProduct } from '../../types/shop';
import { openStoreSection } from '../../utils/storeNavigation';
import { beyondFreeText, formatKm } from '../public/home/format';
import { Photo } from '../public/home/Photo';
import { scrollToSection, useShop } from '../public/home/shop';
import { WhatsAppIcon, Wordmark, btn, container, cx } from '../public/home/ui';
import { ApparelProductDialog } from './ApparelProductDialog';
import { CartButton } from './CartButton';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  activeApparel,
  formatInr,
  photoSrcSet,
  productColours,
  productInStock,
  productPhotos,
  productSizes,
  sizesLabel,
  swatchColour,
} from './shopFormat';
import { AccountButton } from '../public/home/AccountButton';

type LoadState = { status: 'loading' | 'ready' | 'error'; products: ApparelProduct[] };
const ALL = 'all';
const SUBLINE = 'T-shirts & team wear';

/**
 * GR Sports clothing shop (the 'apparel' view, URL /tshirts): T-shirts, jerseys and team wear.
 * Products come from GET /api/shop/apparel (admin-managed); an empty list shows a "coming soon"
 * note with a WhatsApp link for team orders.
 */
export const ApparelStore: React.FC = () => {
  const SHOP = useShop();
  const app = useApp();
  const { distanceConfig, isLoggedIn, currentRole, setActiveView, setCustomerSubView, openAuthModal } = app;
  const [state, setState] = useState<LoadState>({ status: 'loading', products: [] });
  const [category, setCategory] = useState<string>(ALL);
  const [openId, setOpenId] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

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

  const goHome = (e?: React.MouseEvent) => {
    e?.preventDefault();
    setActiveView('landing');
    window.scrollTo({ top: 0 });
  };
  const onAccount = () => {
    if (!isLoggedIn) {
      openAuthModal('CUSTOMER');
      return;
    }
    if (currentRole === 'CUSTOMER') {
      setActiveView('customer_portal');
      setCustomerSubView('orders');
    } else setActiveView(currentRole === 'ADMIN' ? 'admin_portal' : 'employee_portal');
    window.scrollTo({ top: 0 });
  };
  const accountLabel = !isLoggedIn ? 'Log in' : currentRole === 'CUSTOMER' ? 'My orders' : 'Dashboard';
  const free = distanceConfig.freeRadiusKm;

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

  return (
    <div id="top" className="w-full bg-white font-sans text-ink selection:bg-accent selection:text-ink">
      {/* Top bar: back to the badminton shop + contact */}
      <div className="bg-ink text-[13px] text-white/80">
        <div className={cx(container, 'flex min-h-[40px] items-center justify-between gap-4')}>
          <a href="/" onClick={goHome} className="inline-flex min-h-[40px] items-center gap-1.5 hover:text-white">
            <ArrowLeft className="h-4 w-4 text-accent" aria-hidden="true" />
            <span className="sm:hidden">Badminton shop</span>
            <span className="hidden sm:inline">{SHOP.name} badminton: stringing, repairs, rackets</span>
          </a>
          <div className="flex items-center gap-4">
            <a href={SHOP.phoneTel} className="inline-flex min-h-[40px] items-center gap-1.5 hover:text-white" aria-label={`Call ${SHOP.phoneDisplay}`}>
              <Phone className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <span className="hidden sm:inline">{SHOP.phoneDisplay}</span>
              <span className="sm:hidden">Call</span>
            </a>
            <a
              href={SHOP.whatsAppLink(SHOP.greeting('I have a question about your T-shirts.'))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] items-center gap-1.5 hover:text-white"
            >
              <WhatsAppIcon className="h-3.5 w-3.5 text-accent" />
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className={cx(container, 'flex h-[68px] items-center justify-between gap-3')}>
          <a
            href="/tshirts"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex min-h-[44px] min-w-0 items-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sportsBlue"
            aria-label={`${SHOP.name} ${SUBLINE}, back to top`}
          >
            <Wordmark sublineText={SUBLINE} />
          </a>

          <nav aria-label="T-shirt shop" className="hidden md:block">
            <ul className="flex items-center gap-0.5 text-[15px] font-medium">
              {[
                hasProducts ? { id: 'products', label: 'Shop' } : null,
                { id: 'team', label: 'Team orders' },
                { id: 'delivery', label: 'Delivery & payment' },
              ]
                .filter(Boolean)
                .map((item) => (
                  <li key={item!.id}>
                    <a
                      href={`#${item!.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        scrollToSection(item!.id, { focus: true });
                      }}
                      className="inline-flex h-11 items-center rounded-lg px-3 text-ink-soft hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue"
                    >
                      {item!.label}
                    </a>
                  </li>
                ))}
              <li>
                <a href="/" onClick={goHome} className="inline-flex h-11 items-center rounded-lg px-3 text-ink-soft hover:text-ink">
                  Badminton
                </a>
              </li>
              <li>
                <a
                  href="/courts"
                  onClick={(e) => {
                    e.preventDefault();
                    openStoreSection(setActiveView, 'courts');
                  }}
                  className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-ink-soft hover:text-ink"
                >
                  <CalendarClock className="h-[18px] w-[18px]" aria-hidden="true" />
                  Courts
                </a>
              </li>
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <CartButton />
            <AccountButton label={accountLabel} onClick={onAccount} />
          </div>
        </div>
      </header>

      <main id="content">
        {/* Hero */}
        <section className="border-b border-line bg-paper">
          <div className={cx(container, 'grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-12 lg:gap-12 lg:py-16')}>
            <div className="lg:col-span-5">
              <p className="text-[13px] font-semibold tracking-wide text-[#9A6B00]">
                {SHOP.name} · {SHOP.locality}
              </p>
              <h1 className="mt-1 font-display text-[44px] font-semibold leading-[0.98] text-ink text-balance sm:text-[56px]">
                T-shirts &amp; team wear
              </h1>
              <p className="mt-4 max-w-md text-[17px] leading-relaxed text-ink-soft text-pretty">
                T-shirts and sportswear from our shop in {SHOP.locality}, and printed T-shirts and jerseys for teams. Choose your size
                and colour here; we deliver, or you collect from the shop.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {hasProducts ? (
                  <a
                    href="#products"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection('products', { focus: true });
                    }}
                    className={cx(btn.base, btn.primary)}
                  >
                    See what's in the shop
                  </a>
                ) : null}
                <a
                  href="#team"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection('team', { focus: true });
                  }}
                  className={cx(btn.base, hasProducts ? btn.secondary : btn.primary)}
                >
                  Team T-shirts
                </a>
              </div>
              <ul className="mt-6 space-y-1.5 text-[14px] text-ink-soft">
                {free > 0 && (
                  <li className="flex items-center gap-2">
                    <Truck className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                    Free delivery within {formatKm(free)} of the shop
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  Pay when it's delivered or at the shop — cash or UPI
                </li>
              </ul>
            </div>
            <div className="lg:col-span-7">
              <Photo
                src="/images/apparel/hero.webp"
                alt="Rows of plain T-shirts in red, orange, yellow and green on hangers"
                sizes="(min-width: 1024px) 680px, 100vw"
                aspect="aspect-[4/3]"
                className="rounded-xl"
                eager
              />
            </div>
          </div>
        </section>

        {/* Products */}
        <section id="products" aria-labelledby="products-title" className="scroll-mt-24 py-12 sm:py-16">
          <div className={container}>
            {state.status === 'loading' && (
              <>
                <h2 id="products-title" className="sr-only">
                  Products
                </h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i}>
                      <div className="aspect-[4/5] animate-pulse rounded-xl bg-paper" />
                      <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-paper" />
                      <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-paper" />
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
                <ul className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
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

        {/* Team orders */}
        <section id="team" aria-labelledby="team-title" className="scroll-mt-24 border-t border-line bg-paper py-14 sm:py-20">
          <div className={cx(container, 'grid items-center gap-10 lg:grid-cols-12')}>
            <div className="grid grid-cols-5 gap-3 lg:col-span-7">
              <Photo
                src="/images/apparel/printing.webp"
                alt="Logos being screen printed onto black T-shirts on a long print table"
                sizes="(min-width: 1024px) 420px, 60vw"
                aspect="aspect-[4/5]"
                className="col-span-3 rounded-xl"
              />
              <div className="col-span-2 flex flex-col gap-3">
                <Photo
                  src="/images/apparel/team.webp"
                  alt="Players in matching printed red jerseys"
                  sizes="(min-width: 1024px) 280px, 40vw"
                  aspect="aspect-[4/5]"
                  className="rounded-xl"
                />
                <Photo
                  src="/images/apparel/colours.webp"
                  alt="A stack of folded T-shirts in different colours"
                  sizes="(min-width: 1024px) 280px, 40vw"
                  aspect="aspect-square"
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="lg:col-span-5">
              <h2 id="team-title" data-section-heading className="font-display text-[34px] font-semibold leading-[1.02] outline-none sm:text-[42px]">
                Team T-shirts &amp; jerseys
              </h2>
              <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
                For clubs, academies, schools and office teams: T-shirts or jerseys printed with your team name, and player names and
                numbers if you want them. Send us the details on WhatsApp and we'll reply with the price and when they'll be ready.
              </p>
              <h3 className="mt-6 text-[15px] font-semibold text-ink">What to send us</h3>
              <ul className="mt-2 space-y-1.5 text-[15px] text-ink-soft">
                {[
                  'How many pieces, and how many of each size',
                  'Colours, and your logo if you have one',
                  'Names and numbers to print',
                  'The date you need them by',
                ].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={SHOP.whatsAppLink(teamMessage)} target="_blank" rel="noopener noreferrer" className={cx(btn.base, btn.primary)}>
                  <WhatsAppIcon className="h-4 w-4" />
                  Ask about team T-shirts
                </a>
                <a href={SHOP.phoneTel} className={cx(btn.base, btn.secondary)}>
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Call us
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Delivery, pickup, payment, sizes */}
        <section id="delivery" aria-labelledby="delivery-title" className="scroll-mt-24 border-t border-line py-14 sm:py-16">
          <div className={container}>
            <h2 id="delivery-title" data-section-heading className="font-display text-[30px] font-semibold leading-none outline-none sm:text-[36px]">
              Delivery, pickup and payment
            </h2>
            <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
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
      </main>

      <footer className="bg-ink text-white">
        <div className={cx(container, 'grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-12')}>
          <div className="lg:col-span-5">
            <Wordmark tone="dark" sublineText={SUBLINE} />
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/70">
              Part of {SHOP.name}, the badminton shop in {SHOP.locality}: racket stringing, repairs, rackets and strings.
            </p>
          </div>
          <nav aria-label="Footer" className="lg:col-span-3">
            <h2 className="text-[14px] font-semibold">Also at {SHOP.name}</h2>
            <ul className="mt-2 text-[15px]">
              {[
                { label: 'Badminton home page', go: () => goHome() },
                { label: 'Book racket stringing', go: () => openStoreSection(setActiveView, 'book') },
                { label: 'Strings and rackets', go: () => openStoreSection(setActiveView, 'strings') },
                { label: accountLabel === 'Log in' ? 'Log in to see your orders' : accountLabel, go: onAccount },
              ].map((l) => (
                <li key={l.label}>
                  <button type="button" onClick={l.go} className="inline-flex min-h-[44px] items-center text-white/75 hover:text-white">
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="lg:col-span-4">
            <h2 className="text-[14px] font-semibold">Contact</h2>
            <address className="mt-2 text-[15px] not-italic leading-relaxed text-white/75">
              {SHOP.addressLines.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
              {SHOP.openingHours && <span className="mt-1 block">{SHOP.openingHours}</span>}
              <a href={SHOP.phoneTel} className="mt-2 inline-flex min-h-[44px] items-center gap-2 hover:text-white">
                <Phone className="h-4 w-4 text-accent" aria-hidden="true" />
                {SHOP.phoneDisplay}
              </a>
            </address>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className={cx(container, 'py-5 text-[13px] text-white/50')}>
            © {new Date().getFullYear()} {SHOP.name}, {SHOP.area}
          </p>
        </div>
      </footer>

      <ApparelProductDialog product={openProduct} onClose={() => setOpenId(null)} />
    </div>
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
      <span className="mt-0.5 block text-[15px] tabular-nums text-ink">{formatInr(p.price)}</span>
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
