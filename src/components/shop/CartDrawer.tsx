import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Shirt, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useCart } from '../../context/CartContext';
import type { CartItem } from '../../types/shop';
import { useModalBehavior } from '../public/home/Dialog';
import { btn, cx } from '../public/home/ui';
import { formatInr } from './shopFormat';
import { ItemThumb, QtyStepper } from './shopUi';
import { lineKey, useQuote } from './useQuote';
import { useMyOrders } from './useMyOrders';

/** "String set · Black", "M · Navy", "Racket". */
export function itemDetail(i: Pick<CartItem, 'kind' | 'detail'>): string {
  const detail = (i.detail || '').trim();
  if (i.kind === 'string') return detail ? `String set · ${detail}` : 'String set';
  if (i.kind === 'racket') return detail ? `Racket · ${detail}` : 'Racket';
  return detail;
}

/**
 * Cart drawer (portal into document.body): right-hand panel on wide screens, full-screen sheet
 * on phones. Prices and stock are re-checked with the server each time it opens or changes.
 */
export const CartDrawer: React.FC = () => {
  const cart = useCart();
  const { distanceConfig, setActiveView, setCustomerSubView, isLoggedIn, currentRole } = useApp();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useModalBehavior(cart.isOpen, panelRef, cart.closeCart, closeRef);

  const q = useQuote(cart.isOpen && cart.items.length ? { items: cart.lines, fulfilment: 'pickup' } : null);
  // Placing an order empties the cart; point customers to where their orders went.
  const myOrders = useMyOrders(cart.isOpen && cart.items.length === 0 && isLoggedIn && currentRole === 'CUSTOMER');
  const latestOrder = myOrders.orders[0];

  // Prices that changed since the item was added: key -> the old price (kept while the drawer is open).
  const [was, setWas] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!cart.isOpen) setWas({});
  }, [cart.isOpen]);

  const { syncPrices, items } = cart;
  useEffect(() => {
    if (q.status !== 'ready' || !q.quote) return;
    const prices: Record<string, number> = {};
    const old: Record<string, number> = {};
    q.quote.items.forEach((l) => {
      const k = lineKey(l);
      prices[k] = l.unitPrice;
      const item = items.find((i) => i.key === k);
      if (item && item.unitPrice !== l.unitPrice) old[k] = item.unitPrice;
    });
    if (Object.keys(old).length) setWas((prev) => ({ ...old, ...prev }));
    syncPrices(prices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.quote]);

  const unavailable = useMemo(() => {
    const map: Record<string, string> = {};
    (q.quote?.unavailable || []).forEach((u) => {
      map[lineKey(u)] = u.reason || 'No longer available';
    });
    return map;
  }, [q.quote]);
  const unavailableCount = cart.items.filter((i) => unavailable[i.key]).length;

  if (!cart.isOpen) return null;

  const quoteReady = q.status === 'ready' && !!q.quote;
  const subtotal = quoteReady ? (q.quote as NonNullable<typeof q.quote>).subtotal : cart.subtotal;
  const staff = isLoggedIn && currentRole !== 'CUSTOMER';
  const free = distanceConfig.freeRadiusKm;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-ink/50" onMouseDown={(e) => e.target === e.currentTarget && cart.closeCart()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="ml-auto flex h-full w-full flex-col bg-white text-ink shadow-2xl outline-none sm:max-w-[440px] animate-in slide-in-from-right-4"
      >
        <div className="flex h-[68px] shrink-0 items-center justify-between gap-3 border-b border-line px-4 sm:px-5">
          <h2 id={titleId} className="font-display text-[28px] font-semibold leading-none">
            Your cart{cart.count > 0 && <span className="ml-2 text-[18px] font-medium text-ink-muted">{cart.count} item{cart.count === 1 ? '' : 's'}</span>}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={cart.closeCart}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            {latestOrder && (
              <div className="w-full max-w-xs rounded-xl border border-line bg-paper p-4 text-left">
                <p className="text-[15px] font-semibold text-ink">Looking for something you ordered?</p>
                <p className="mt-1 text-[14px] text-ink-soft">
                  Ordered items move from the cart to <b>My orders</b>. Latest: {latestOrder.id} · {latestOrder.status}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    cart.closeCart();
                    setActiveView('customer_portal');
                    setCustomerSubView('orders');
                    window.scrollTo({ top: 0 });
                  }}
                  className={cx(btn.base, btn.secondary, 'mt-3 w-full')}
                >
                  View my orders ({myOrders.orders.length})
                </button>
              </div>
            )}
            <p className="font-display text-[26px] font-semibold">Your cart is empty</p>
            <p className="max-w-xs text-[15px] text-ink-soft">
              T-shirts and team wear are in our clothing shop. Rackets and string sets with a price can be added from the badminton page.
            </p>
            <button
              type="button"
              onClick={() => {
                cart.closeCart();
                setActiveView('apparel');
                window.scrollTo({ top: 0 });
              }}
              className={cx(btn.base, btn.primary)}
            >
              <Shirt className="h-4 w-4" aria-hidden="true" />
              Shop T-shirts
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5">
              <ul className="divide-y divide-line">
                {cart.items.map((item) => {
                  const reason = unavailable[item.key];
                  const old = was[item.key];
                  return (
                    <li key={item.key} className="flex gap-3 py-4">
                      <ItemThumb src={item.image} alt="" kind={item.kind} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[15px] font-semibold leading-snug text-ink">{item.name}</p>
                          {!reason && <p className="shrink-0 text-[15px] font-semibold tabular-nums">{formatInr(item.unitPrice * item.quantity)}</p>}
                        </div>
                        {itemDetail(item) && <p className="mt-0.5 text-[14px] text-ink-muted">{itemDetail(item)}</p>}
                        {!reason && item.quantity > 1 && (
                          <p className="text-[13px] text-ink-muted">{formatInr(item.unitPrice)} each</p>
                        )}
                        {!reason && typeof old === 'number' && (
                          <p className="mt-1 text-[13px] font-medium text-amber-800">
                            Price is now {formatInr(item.unitPrice)} (was {formatInr(old)})
                          </p>
                        )}
                        {reason ? (
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p className="flex items-center gap-1.5 text-[14px] font-medium text-rose-700">
                              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                              {reason}
                            </p>
                            <button
                              type="button"
                              onClick={() => cart.remove(item.key)}
                              className="min-h-[40px] text-[14px] font-semibold text-ink underline underline-offset-4"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <QtyStepper value={item.quantity} onChange={(n) => cart.setQuantity(item.key, n)} label={`Quantity of ${item.name}`} />
                            <button
                              type="button"
                              onClick={() => cart.remove(item.key)}
                              className="min-h-[40px] px-1 text-[14px] text-ink-muted underline underline-offset-4 hover:text-ink"
                              aria-label={`Remove ${item.name} from the cart`}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="shrink-0 space-y-3 border-t border-line bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5">
              <p className="sr-only" aria-live="polite">
                {q.status === 'loading' ? 'Checking prices' : quoteReady ? 'Prices checked' : ''}
              </p>
              {unavailableCount > 0 && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-[14px] text-rose-800" role="status">
                  {unavailableCount === 1 ? 'One item is' : `${unavailableCount} items are`} no longer available. Remove {unavailableCount === 1 ? 'it' : 'them'} to check out.
                </p>
              )}
              {q.status === 'error' && (
                <p className="text-[13px] text-ink-muted">We couldn't check today's prices just now. They are confirmed again at checkout.</p>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] text-ink-soft">Subtotal</span>
                <span className={cx('font-display text-[26px] font-semibold tabular-nums', q.status === 'loading' && 'opacity-60')}>{formatInr(subtotal)}</span>
              </div>
              <p className="text-[13px] leading-relaxed text-ink-muted">
                Delivery {free > 0 ? `is free within ${free} km of the shop` : 'charge depends on your address'}, or collect from the shop. Pay when it's delivered or at the
                shop — cash or UPI.
              </p>
              <button
                type="button"
                onClick={cart.checkout}
                disabled={unavailableCount > 0 || staff}
                className={cx(btn.base, btn.primary, 'w-full')}
              >
                Checkout
              </button>
              {staff && <p className="text-[13px] text-ink-muted">Orders are placed from a customer account.</p>}
              {!isLoggedIn && <p className="text-center text-[13px] text-ink-muted">You'll log in with your mobile number first.</p>}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

/** "Added to cart — View cart" notice at the bottom of the screen (doesn't take focus). */
export const CartAddedNotice: React.FC = () => {
  const { lastAdded, dismissAdded, openCart, isOpen } = useCart();
  useEffect(() => {
    if (!lastAdded) return;
    const t = window.setTimeout(dismissAdded, 5000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAdded?.nonce]);

  return createPortal(
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {lastAdded && !isOpen && (
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-white shadow-xl animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[14px] leading-snug">
            <span className="font-semibold">Added</span>
            <span className="text-white/75"> — {lastAdded.name}</span>
          </p>
          <button
            type="button"
            onClick={openCart}
            className="min-h-[40px] shrink-0 rounded-lg px-2 text-[14px] font-semibold text-accent underline underline-offset-4 hover:text-white"
          >
            View cart
          </button>
          <button type="button" onClick={dismissAdded} aria-label="Dismiss" className="-mr-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/70 hover:text-white">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
};
