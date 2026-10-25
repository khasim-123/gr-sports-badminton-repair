import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, LocateFixed, MapPin, Store, Truck, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useCart } from '../../context/CartContext';
import { ApiError } from '../../services/apiClient';
import { shopService } from '../../services/shopService';
import type { Address } from '../../types';
import type { FulfilmentMethod, OrderQuote, ShopOrder } from '../../types/shop';
import { getCurrentLocation, hasCoords, roadDistanceKm } from '../../utils/distance';
import { formatMobile } from '../../utils/phone';
import { useShop } from '../public/home/shop';
import { btn, cx, fieldControl, fieldLabel } from '../public/home/ui';
import { itemDetail } from './CartDrawer';
import { formatInr, nextStepText } from './shopFormat';
import { ItemThumb } from './shopUi';
import { lineKey, useQuote } from './useQuote';

const NEW = 'NEW';
const card = 'bg-white rounded-2xl border border-line shadow-2xs p-4 sm:p-6';
const h2 = 'font-display text-[24px] font-semibold leading-tight text-ink';

const formatAddress = (a: Pick<Address, 'houseFlat' | 'street' | 'area' | 'city' | 'pincode'>) =>
  [a.houseFlat, a.street, a.area, a.city].filter((p) => p && p.trim()).join(', ') + (a.pincode ? ` – ${a.pincode}` : '');

interface AddressForm {
  houseFlat: string;
  street: string;
  area: string;
  city: string;
  pincode: string;
  landmark: string;
  distanceKm: number;
  lat?: number;
  lng?: number;
}

/** Checkout (customer sub-view 'checkout'): items, delivery or pickup, note, place order. */
export const Checkout: React.FC = () => {
  const app = useApp();
  const cart = useCart();
  const SHOP = useShop();
  const { savedAddresses, distanceConfig, addNewAddress, setCustomerSubView, setActiveView, setSelectedRequestId, userMobile } = app;

  const [fulfilment, setFulfilment] = useState<FulfilmentMethod>('delivery');
  const defaultAddr = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
  const [choice, setChoice] = useState<string>(defaultAddr ? defaultAddr.id : NEW);
  const [form, setForm] = useState<AddressForm>({ houseFlat: '', street: '', area: '', city: 'Visakhapatnam', pincode: '', landmark: '', distanceKm: 3 });
  const [saveAddress, setSaveAddress] = useState(true);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<{ kind: 'unavailable' | 'outside' | 'profile' | 'other'; message: string } | null>(null);
  /** Lines the server refused when placing the order (409 `unavailable`), kept until the cart changes. */
  const [refused, setRefused] = useState<{ lines: string; list: OrderQuote['unavailable'] }>({ lines: '', list: [] });
  const [placed, setPlaced] = useState<ShopOrder | null>(null);

  const shopHasCoords = hasCoords({ lat: distanceConfig.shopLat, lng: distanceConfig.shopLng });
  const formCoords = hasCoords(form) ? { lat: form.lat as number, lng: form.lng as number } : null;
  const formDistance = formCoords && shopHasCoords ? roadDistanceKm(distanceConfig.shopLat, distanceConfig.shopLng, formCoords.lat, formCoords.lng) : form.distanceKm;
  const maxKm = distanceConfig.maxServiceDistanceKm || 0;
  const sliderMax = Math.max(Math.ceil(maxKm || 35), distanceConfig.freeRadiusKm + 5);

  const newAddress: Address = {
    id: NEW,
    label: 'Home',
    houseFlat: form.houseFlat.trim(),
    street: form.street.trim(),
    area: form.area.trim(),
    city: form.city.trim() || 'Visakhapatnam',
    state: 'Andhra Pradesh',
    pincode: form.pincode.trim(),
    landmark: form.landmark.trim() || undefined,
    distanceKm: formDistance,
    lat: formCoords?.lat,
    lng: formCoords?.lng,
  };
  const newAddressReady = !!newAddress.houseFlat && !!newAddress.area;
  const deliveryAddress: Address | null =
    fulfilment !== 'delivery' ? null : choice === NEW ? (newAddressReady ? newAddress : null) : savedAddresses.find((a) => a.id === choice) || null;

  // The server's price check: current prices, stock and the delivery charge for this address.
  const quoteInput = useMemo(
    () =>
      cart.items.length && !placed
        ? { items: cart.lines, fulfilment: deliveryAddress ? ('delivery' as const) : ('pickup' as const), address: deliveryAddress }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cart.lines, placed, JSON.stringify(deliveryAddress)],
  );
  const q = useQuote(quoteInput);
  const quote = q.quote;
  const linesSig = JSON.stringify(cart.lines);
  const unavailable = useMemo(() => {
    const list = [...(quote?.unavailable || [])];
    if (refused.lines === linesSig) {
      refused.list.forEach((u) => {
        if (!list.some((x) => lineKey(x) === lineKey(u))) list.push(u);
      });
    }
    return list.filter((u) => cart.items.some((i) => i.key === lineKey(u)));
  }, [quote, refused, linesSig, cart.items]);
  const outside = fulfilment === 'delivery' && !!deliveryAddress && !!quote?.outsideDeliveryArea;

  // Removing items clears the "no longer available" message from the last attempt.
  useEffect(() => {
    setServerError((e) => (e && e.kind === 'unavailable' ? null : e));
  }, [linesSig]);

  const useMyLocation = async () => {
    setLocating(true);
    setLocError(null);
    try {
      const pos = await getCurrentLocation(15000);
      setForm((f) => ({ ...f, lat: pos.lat, lng: pos.lng }));
      setChoice(NEW);
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Could not get your location.');
    } finally {
      setLocating(false);
    }
  };

  const goOrders = (id?: string) => {
    if (id) setSelectedRequestId(id);
    setActiveView('customer_portal');
    setCustomerSubView('orders');
  };
  const goShop = () => {
    setActiveView('apparel');
    window.scrollTo({ top: 0 });
  };

  const placeOrder = async () => {
    setFormError(null);
    setServerError(null);
    if (fulfilment === 'delivery') {
      if (choice === NEW) {
        if (!newAddress.houseFlat || !newAddress.area) return setFormError('Please enter your house / flat and area for delivery.');
        if (!/^\d{6}$/.test(newAddress.pincode)) return setFormError('Please enter a valid 6-digit pincode.');
      } else if (!deliveryAddress) return setFormError('Please choose a delivery address.');
    }
    if (unavailable.length) return setServerError({ kind: 'unavailable', message: 'Some items are no longer available. Remove them to continue.' });
    if (outside) return;
    setPlacing(true);
    try {
      const order = await shopService.placeOrder({
        items: cart.lines,
        fulfilment,
        address: fulfilment === 'delivery' ? deliveryAddress : null,
        notes: notes.trim() || undefined,
      });
      if (fulfilment === 'delivery' && choice === NEW && saveAddress) {
        const { id: _id, ...rest } = newAddress;
        addNewAddress({ ...rest, isDefault: savedAddresses.length === 0 });
      }
      cart.clear();
      setPlaced(order);
      window.scrollTo({ top: 0 });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : -1;
      const message = err instanceof Error && err.message ? err.message : 'Your order could not be placed. Please try again.';
      if (status === 401) return; // session expired: handled globally
      if (status === 409) {
        const list = err instanceof ApiError && Array.isArray(err.data?.unavailable) ? (err.data.unavailable as OrderQuote['unavailable']) : [];
        setRefused({ lines: linesSig, list });
        setServerError({ kind: 'unavailable', message });
      } else if (status === 422) setServerError({ kind: 'outside', message });
      else if (status === 403) setServerError({ kind: 'profile', message });
      else setServerError({ kind: 'other', message });
      q.refresh();
    } finally {
      setPlacing(false);
    }
  };

  // ------------------------------------------------------------------ confirmation
  if (placed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 sm:p-6 lg:p-8 space-y-5">
        <section className={cx(card, 'space-y-4')} aria-labelledby="placed-title">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden="true" />
          <div>
            <h1 id="placed-title" className="font-display tracking-[0.01em] text-3xl font-bold text-slate-900">
              Order placed
            </h1>
            <p className="mt-1 text-[15px] text-ink-soft">
              Your order number is <span className="font-semibold text-ink">{placed.id}</span>.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-paper p-4 text-[14px]">
            <div>
              <dt className="text-ink-muted">Total to pay</dt>
              <dd className="font-display text-[24px] font-semibold text-ink">{formatInr(placed.total)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">{placed.fulfilment === 'delivery' ? 'Delivery to' : 'Collect from'}</dt>
              <dd className="text-ink">{placed.fulfilment === 'delivery' && placed.address ? formatAddress(placed.address) : SHOP.addressLines.join(', ')}</dd>
            </div>
          </dl>
          <div>
            <h2 className="text-[15px] font-semibold text-ink">What happens next</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{nextStepText(placed)}</p>
            <p className="mt-2 text-[14px] text-ink-muted">
              We'll contact you on {formatMobile(placed.customerMobile || userMobile)}. You'll see updates under Orders.
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <button type="button" onClick={() => goOrders(placed.id)} className={cx(btn.base, btn.primary)}>
              View my order
            </button>
            <button type="button" onClick={goShop} className={cx(btn.base, btn.secondary)}>
              Continue shopping
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ------------------------------------------------------------------ empty cart
  if (cart.items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 sm:p-6 lg:p-8">
        <section className={cx(card, 'text-center space-y-3 py-10')}>
          <h1 className="font-display text-3xl font-bold text-slate-900">Your cart is empty</h1>
          <p className="text-[15px] text-ink-soft">Add T-shirts, or a racket or string set with a price, then come back to check out.</p>
          <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
            <button type="button" onClick={goShop} className={cx(btn.base, btn.primary)}>
              Shop T-shirts
            </button>
            <button type="button" onClick={() => goOrders()} className={cx(btn.base, btn.secondary)}>
              My orders
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ------------------------------------------------------------------ checkout
  const lines = quote ? quote.items : null;
  const subtotal = quote ? quote.subtotal : cart.subtotal;
  const deliveryCharge = quote && fulfilment === 'delivery' && deliveryAddress ? quote.deliveryCharge : null;
  const total = quote ? (fulfilment === 'delivery' && !deliveryAddress ? quote.subtotal : quote.total) : cart.subtotal;
  const canPlace = !placing && !outside && unavailable.length === 0 && q.status !== 'loading';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:p-6 lg:p-8 space-y-5">
      <div>
        <h1 className="font-display tracking-[0.01em] text-3xl font-bold text-slate-900">Checkout</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Pay when it's delivered or at the shop — cash or UPI.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
        <div className="space-y-5 lg:col-span-7">
          {/* 1. Items */}
          <section className={card} aria-labelledby="co-items">
            <h2 id="co-items" className={h2}>
              Your items
            </h2>
            {q.status === 'error' && (
              <p className="mt-2 text-[13px] text-ink-muted">We couldn't check today's prices just now; they are checked again when you place the order.</p>
            )}
            <ul className="mt-3 divide-y divide-line">
              {(lines || cart.items).map((l) => {
                const key = lineKey(l);
                const qty = l.quantity;
                const price = l.unitPrice;
                return (
                  <li key={key} className="flex gap-3 py-3">
                    <ItemThumb src={l.image} kind={l.kind} className="h-16 w-16" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold leading-snug text-ink">{l.name}</p>
                      <p className="text-[13px] text-ink-muted">
                        {[itemDetail(l), `Qty ${qty}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <p className="shrink-0 text-[15px] font-semibold tabular-nums">{formatInr(price * qty)}</p>
                  </li>
                );
              })}
            </ul>
            {unavailable.length > 0 && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3" role="alert">
                <p className="text-[14px] font-semibold text-rose-800">No longer available</p>
                <ul className="mt-1 space-y-1">
                  {unavailable.map((u) => {
                    const key = lineKey(u);
                    const item = cart.items.find((i) => i.key === key);
                    return (
                      <li key={key} className="flex flex-wrap items-center justify-between gap-2 text-[14px] text-rose-900">
                        <span>
                          {u.name || item?.name || 'An item'}
                          {item?.detail ? ` (${item.detail})` : ''}: {u.reason}
                        </span>
                        <button type="button" onClick={() => cart.remove(key)} className="min-h-[40px] px-2 font-semibold underline underline-offset-4">
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <button type="button" onClick={cart.openCart} className="mt-2 min-h-[40px] text-[14px] font-semibold text-sportsBlue underline underline-offset-4">
              Change quantities
            </button>
          </section>

          {/* 2. Delivery or pickup */}
          <section className={card} aria-labelledby="co-fulfil">
            <h2 id="co-fulfil" className={h2}>
              Delivery or pickup
            </h2>
            <div role="radiogroup" aria-labelledby="co-fulfil" className="mt-3 grid gap-3 sm:grid-cols-2">
              {([
                ['delivery', 'Deliver to me', distanceConfig.freeRadiusKm > 0 ? `Free within ${distanceConfig.freeRadiusKm} km` : 'Charge by distance', Truck],
                ['pickup', 'Collect from the shop', SHOP.locality, Store],
              ] as const).map(([id, label, hint, Icon]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={fulfilment === id}
                  onClick={() => setFulfilment(id)}
                  className={cx(
                    'flex min-h-[64px] items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue',
                    fulfilment === id ? 'border-ink bg-paper ring-1 ring-ink' : 'border-line bg-white hover:border-ink/40',
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
                  <span>
                    <span className="block text-[15px] font-semibold text-ink">{label}</span>
                    <span className="block text-[13px] text-ink-muted">{hint}</span>
                  </span>
                </button>
              ))}
            </div>

            {fulfilment === 'pickup' ? (
              <div className="mt-4 rounded-xl bg-paper p-4 text-[14px] text-ink-soft">
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-ink">{SHOP.name}</span>, {SHOP.addressLines.join(', ')}
                  </span>
                </p>
                {SHOP.openingHours && (
                  <p className="mt-1.5 flex items-start gap-2">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
                    {SHOP.openingHours}
                  </p>
                )}
                <p className="mt-2">We'll let you know when your order is ready to collect.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {savedAddresses.length > 0 && (
                  <div role="radiogroup" aria-label="Delivery address" className="grid gap-2">
                    {savedAddresses.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        role="radio"
                        aria-checked={choice === a.id}
                        onClick={() => setChoice(a.id)}
                        className={cx(
                          'rounded-xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue',
                          choice === a.id ? 'border-ink bg-paper ring-1 ring-ink' : 'border-line hover:border-ink/40',
                        )}
                      >
                        <span className="text-[12px] font-bold uppercase tracking-wider text-ink">{a.label}</span>
                        <span className="block text-[14px] text-slate-800">{formatAddress(a)}</span>
                        <span className="block text-[12px] text-ink-muted">About {a.distanceKm} km from the shop</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={choice === NEW}
                      onClick={() => setChoice(NEW)}
                      className={cx(
                        'min-h-[48px] rounded-xl border p-3 text-left text-[14px] font-semibold transition-colors',
                        choice === NEW ? 'border-ink bg-paper ring-1 ring-ink' : 'border-dashed border-line hover:border-ink/40',
                      )}
                    >
                      + A different address
                    </button>
                  </div>
                )}

                {choice === NEW && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-line p-3">
                      {formCoords ? (
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-emerald-800">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          Location added{shopHasCoords ? ` — about ${formDistance} km from the shop` : ''}
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, lat: undefined, lng: undefined }))}
                            className="min-h-[36px] text-ink-muted underline underline-offset-4"
                          >
                            Remove
                          </button>
                        </p>
                      ) : (
                        <button type="button" onClick={useMyLocation} disabled={locating} className={cx(btn.base, btn.secondary, 'w-full sm:w-auto')}>
                          <LocateFixed className="h-4 w-4" aria-hidden="true" />
                          {locating ? 'Finding your location…' : 'Use my current location'}
                        </button>
                      )}
                      {locError && <p className="mt-2 text-[13px] text-rose-700">{locError}</p>}
                      {!formCoords && (
                        <p className="mt-2 text-[13px] text-ink-muted">Your phone's location gives us the exact distance for the delivery charge.</p>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Flat / house / building *" value={form.houseFlat} onChange={(v) => setForm((f) => ({ ...f, houseFlat: v }))} placeholder="e.g. Flat 302, Sai Residency" autoComplete="address-line1" />
                      <Field label="Street / road" value={form.street} onChange={(v) => setForm((f) => ({ ...f, street: v }))} placeholder="e.g. Beach Road" autoComplete="address-line2" />
                      <Field label="Area / locality *" value={form.area} onChange={(v) => setForm((f) => ({ ...f, area: v }))} placeholder="e.g. MVP Colony" />
                      <Field
                        label="Pincode *"
                        value={form.pincode}
                        onChange={(v) => setForm((f) => ({ ...f, pincode: v.replace(/\D/g, '').slice(0, 6) }))}
                        placeholder="e.g. 530017"
                        inputMode="numeric"
                        autoComplete="postal-code"
                      />
                      <Field label="City" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} autoComplete="address-level2" />
                      <Field label="Landmark" value={form.landmark} onChange={(v) => setForm((f) => ({ ...f, landmark: v }))} placeholder="Optional" />
                    </div>
                    {!formCoords && (
                      <div className="rounded-xl bg-paper p-3">
                        <div className="flex items-center justify-between text-[14px]">
                          <label htmlFor="co-distance" className="font-medium text-ink">
                            About how far from the shop?
                          </label>
                          <span className="font-semibold tabular-nums">{form.distanceKm} km</span>
                        </div>
                        <input
                          id="co-distance"
                          type="range"
                          min={1}
                          max={sliderMax}
                          step={0.5}
                          value={form.distanceKm}
                          onChange={(e) => setForm((f) => ({ ...f, distanceKm: parseFloat(e.target.value) }))}
                          className="h-8 w-full accent-ink"
                        />
                      </div>
                    )}
                    <label className="flex min-h-[44px] items-center gap-2 text-[14px] text-ink-soft">
                      <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="h-4 w-4 accent-ink" />
                      Save this address on this device
                    </label>
                  </div>
                )}

                {outside && (
                  <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[14px] text-amber-900" role="alert">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      This address is outside our delivery area{quote?.distanceKm ? ` (about ${quote.distanceKm} km)` : ''}. Choose “Collect from the shop”, or call us on{' '}
                      <a href={SHOP.phoneTel} className="font-semibold underline">
                        {SHOP.phoneDisplay}
                      </a>
                      .
                    </span>
                  </p>
                )}
              </div>
            )}
          </section>

          {/* 3. Note */}
          <section className={card} aria-labelledby="co-note">
            <h2 id="co-note" className={h2}>
              Note for the shop
            </h2>
            <label htmlFor="co-notes" className="sr-only">
              Note
            </label>
            <textarea
              id="co-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Optional — e.g. a time that suits you, or a landmark"
              className={cx(fieldControl, 'mt-3 py-2.5')}
            />
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:col-span-5 lg:sticky lg:top-24" aria-labelledby="co-summary">
          <section className={cx(card, 'space-y-3')}>
            <h2 id="co-summary" className={h2}>
              Order summary
            </h2>
            <dl className="space-y-2 text-[15px]">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Items ({cart.count})</dt>
                <dd className="tabular-nums">{formatInr(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">{fulfilment === 'delivery' ? 'Delivery' : 'Collect from the shop'}</dt>
                <dd className="text-right tabular-nums">
                  {fulfilment === 'pickup'
                    ? 'Free'
                    : deliveryCharge === null
                      ? <span className="text-ink-muted">Add your address</span>
                      : deliveryCharge === 0
                        ? 'Free'
                        : formatInr(deliveryCharge)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-semibold">Total</dt>
                <dd className={cx('font-display text-[30px] font-semibold tabular-nums', q.status === 'loading' && 'opacity-60')}>{formatInr(total)}</dd>
              </div>
            </dl>
            <p className="flex items-start gap-2 rounded-xl bg-paper p-3 text-[14px] text-ink-soft">
              <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
              {fulfilment === 'delivery' ? "Pay when it's delivered — cash or UPI." : 'Pay at the shop when you collect it — cash or UPI.'}
            </p>
            {formError && (
              <p className="flex items-start gap-2 text-[14px] text-rose-700" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {formError}
              </p>
            )}
            {serverError && (
              <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-[14px] text-rose-800" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {serverError.message}
                  {serverError.kind === 'unavailable' && ' Remove the items marked “No longer available” and try again.'}
                  {serverError.kind === 'outside' && ' You can choose “Collect from the shop” instead.'}
                  {serverError.kind === 'profile' && (
                    <>
                      {' '}
                      <button type="button" onClick={() => setCustomerSubView('profile')} className="font-semibold underline underline-offset-2">
                        Add your name in Profile
                      </button>
                    </>
                  )}
                </span>
              </p>
            )}
            <button type="button" onClick={placeOrder} disabled={!canPlace} className={cx(btn.base, btn.primary, 'w-full')}>
              {placing ? 'Placing your order…' : `Place order · ${formatInr(total)}`}
            </button>
            <p className="text-[13px] text-ink-muted">
              We'll confirm your order and keep you updated here and by phone on {formatMobile(userMobile)}.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
}> = ({ label, value, onChange, placeholder, inputMode, autoComplete }) => (
  <label className="block">
    <span className={fieldLabel}>{label}</span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      autoComplete={autoComplete}
      className={fieldControl}
    />
  </label>
);
