import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, ChevronRight, Clock, MapPin, ShoppingBag, Store, Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ApiError } from '../../services/apiClient';
import { shopService } from '../../services/shopService';
import type { ShopOrder } from '../../types/shop';
import { useShop } from '../public/home/shop';
import { btn, cx, fieldControl } from '../public/home/ui';
import { itemDetail } from './CartDrawer';
import { ORDER_STATUS_STYLE, canCustomerCancel, formatInr, itemCount, nextStepText, orderDate } from './shopFormat';
import { ItemThumb } from './shopUi';
import { useMyOrders } from './useMyOrders';

const card = 'bg-white rounded-2xl border border-line shadow-2xs';

export const OrderStatusPill: React.FC<{ status: ShopOrder['status'] }> = ({ status }) => (
  <span className={cx('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap', ORDER_STATUS_STYLE[status] || ORDER_STATUS_STYLE.Placed)}>
    {status}
  </span>
);

const paymentText = (o: ShopOrder) =>
  o.paymentStatus === 'Paid'
    ? `Paid${o.paymentMethod ? ` by ${o.paymentMethod === 'Other' ? 'other' : o.paymentMethod}` : ''}`
    : o.status === 'Cancelled'
      ? 'Nothing to pay'
      : o.fulfilment === 'delivery'
        ? 'Pay on delivery'
        : 'Pay at pickup';

/** Customer sub-view 'orders': list of shop orders, and one order's details. */
export const MyOrders: React.FC = () => {
  const { selectedRequestId, setSelectedRequestId, setActiveView } = useApp();
  const orders = useMyOrders();
  const [openId, setOpenId] = useState<string | null>(() => (selectedRequestId && selectedRequestId.startsWith('ORD-') ? selectedRequestId : null));

  // Opened from a notification / the confirmation screen.
  useEffect(() => {
    if (selectedRequestId && selectedRequestId.startsWith('ORD-')) {
      setOpenId(selectedRequestId);
      setSelectedRequestId(null);
      window.scrollTo({ top: 0 });
    }
  }, [selectedRequestId, setSelectedRequestId]);

  if (openId) {
    return (
      <OrderDetail
        id={openId}
        known={orders.orders.find((o) => o.id === openId) || null}
        onBack={() => {
          setOpenId(null);
          window.scrollTo({ top: 0 });
        }}
        onChange={orders.replace}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6 lg:p-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display tracking-[0.01em] text-3xl font-bold text-slate-900">My orders</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">T-shirts, rackets and strings you've ordered from the shop.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setActiveView('apparel');
            window.scrollTo({ top: 0 });
          }}
          className={cx(btn.base, btn.secondary, 'shrink-0')}
        >
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          Shop T-shirts
        </button>
      </div>

      {orders.status === 'loading' && (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white border border-line" />
          ))}
        </div>
      )}
      {orders.status === 'error' && (
        <div className={cx(card, 'p-5 text-[15px] text-ink-soft')}>
          Your orders couldn't be loaded.{' '}
          <button type="button" onClick={orders.reload} className="font-semibold text-sportsBlue underline underline-offset-4">
            Try again
          </button>
        </div>
      )}
      {(orders.status === 'unsupported' || (orders.status === 'ready' && orders.orders.length === 0)) && (
        <div className={cx(card, 'p-6 sm:p-8 text-center')}>
          <p className="font-display text-2xl font-semibold text-ink">No orders yet</p>
          <p className="mt-1 text-[15px] text-ink-soft">When you order T-shirts, a racket or a string set, it shows up here.</p>
        </div>
      )}
      {orders.status === 'ready' && orders.orders.length > 0 && (
        <ul className="space-y-3">
          {orders.orders.map((o) => {
            const first = o.items[0];
            const n = itemCount(o);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(o.id);
                    window.scrollTo({ top: 0 });
                  }}
                  className={cx(card, 'flex w-full items-center gap-3 p-3 sm:p-4 text-left transition-colors hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sportsBlue')}
                >
                  <ItemThumb src={first?.image} kind={first?.kind} className="h-16 w-16" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[15px] font-semibold text-ink">{o.id}</span>
                      <OrderStatusPill status={o.status} />
                    </div>
                    <p className="mt-0.5 truncate text-[14px] text-ink-soft">
                      {first ? first.name : ''}
                      {o.items.length > 1 ? ` and ${o.items.length - 1} more` : ''}
                    </p>
                    <p className="text-[13px] text-ink-muted">
                      {orderDate(o.createdAt)} · {n} item{n === 1 ? '' : 's'} · {paymentText(o)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[16px] font-semibold tabular-nums text-ink">{formatInr(o.total)}</p>
                    <ChevronRight className="ml-auto mt-1 h-4 w-4 text-ink-muted" aria-hidden="true" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const CANCEL_REASONS = ['Ordered by mistake', 'Wrong size or colour', 'Need it sooner', 'Other'];

const OrderDetail: React.FC<{ id: string; known: ShopOrder | null; onBack: () => void; onChange: (o: ShopOrder) => void }> = ({
  id,
  known,
  onBack,
  onChange,
}) => {
  const SHOP = useShop();
  const { addToast } = useApp();
  const [order, setOrder] = useState<ShopOrder | null>(known);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [other, setOther] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    shopService
      .getOrder(id)
      .then((o) => {
        if (cancelled) return;
        setOrder(o);
        onChange(o);
      })
      .catch((err) => {
        if (cancelled) return;
        if (!known) setLoadError(err instanceof ApiError && err.status === 404 ? 'We couldn’t find this order.' : 'This order couldn’t be loaded. Please try again.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const doCancel = async () => {
    const text = reason === 'Other' ? other.trim() : reason;
    if (!text) {
      setCancelError('Please tell us why you are cancelling.');
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await shopService.cancelOrder(id, text);
      setOrder(updated);
      onChange(updated);
      setCancelOpen(false);
      addToast('info', 'Order cancelled', `${id} has been cancelled.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setCancelError(err instanceof Error && err.message ? err.message : 'The order could not be cancelled. Please call the shop.');
    } finally {
      setCancelling(false);
    }
  };

  const back = (
    <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-semibold text-ink hover:underline underline-offset-4">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      All orders
    </button>
  );

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6 lg:p-8 space-y-4">
        {back}
        {loadError ? (
          <p className={cx(card, 'p-5 text-[15px] text-ink-soft')}>{loadError}</p>
        ) : (
          <div className="h-64 animate-pulse rounded-2xl border border-line bg-white" aria-label="Loading order" />
        )}
      </div>
    );
  }

  const delivery = order.fulfilment === 'delivery';
  const a = order.address;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6 lg:p-8 space-y-4">
      {back}
      <section className={cx(card, 'p-4 sm:p-6')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display tracking-[0.01em] text-3xl font-bold text-slate-900">Order {order.id}</h1>
            <p className="text-[14px] text-ink-muted">Placed {orderDate(order.createdAt)}</p>
          </div>
          <OrderStatusPill status={order.status} />
        </div>
        <p className="mt-3 rounded-xl bg-paper p-3 text-[15px] text-ink-soft">{nextStepText(order)}</p>

        <ul className="mt-4 divide-y divide-line">
          {order.items.map((l, i) => (
            <li key={`${l.productId}-${l.variantId || ''}-${i}`} className="flex gap-3 py-3">
              <ItemThumb src={l.image} kind={l.kind} className="h-16 w-16" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-ink">{l.name}</p>
                <p className="text-[13px] text-ink-muted">
                  {[itemDetail(l), `${l.quantity} × ${formatInr(l.unitPrice)}`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <p className="shrink-0 text-[15px] font-semibold tabular-nums">{formatInr(l.lineTotal)}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-2 space-y-1.5 border-t border-line pt-3 text-[15px]">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Items</dt>
            <dd className="tabular-nums">{formatInr(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">{delivery ? 'Delivery' : 'Collect from the shop'}</dt>
            <dd className="tabular-nums">{order.deliveryCharge > 0 ? formatInr(order.deliveryCharge) : 'Free'}</dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="font-semibold">Total</dt>
            <dd className="font-display text-[26px] font-semibold tabular-nums">{formatInr(order.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Payment</dt>
            <dd>{paymentText(order)}{order.paymentStatus !== 'Paid' && order.status !== 'Cancelled' ? ' — cash or UPI' : ''}</dd>
          </div>
        </dl>
      </section>

      <section className={cx(card, 'p-4 sm:p-6')}>
        <h2 className="flex items-center gap-2 text-[16px] font-semibold text-ink">
          {delivery ? <Truck className="h-4 w-4" aria-hidden="true" /> : <Store className="h-4 w-4" aria-hidden="true" />}
          {delivery ? 'Delivery address' : 'Collect from'}
        </h2>
        <p className="mt-1.5 flex items-start gap-2 text-[15px] text-ink-soft">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {delivery && a
              ? [a.houseFlat, a.street, a.area, a.city].filter(Boolean).join(', ') + (a.pincode ? ` – ${a.pincode}` : '')
              : `${SHOP.name}, ${SHOP.addressLines.join(', ')}`}
            {delivery && typeof order.distanceKm === 'number' ? ` (about ${order.distanceKm} km)` : ''}
          </span>
        </p>
        {!delivery && SHOP.openingHours && (
          <p className="mt-1 flex items-start gap-2 text-[14px] text-ink-muted">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {SHOP.openingHours}
          </p>
        )}
        {order.notes && <p className="mt-3 text-[14px] text-ink-soft">Your note: {order.notes}</p>}
      </section>

      {order.timeline && order.timeline.length > 0 && (
        <section className={cx(card, 'p-4 sm:p-6')} aria-labelledby="order-timeline">
          <h2 id="order-timeline" className="text-[16px] font-semibold text-ink">
            Updates
          </h2>
          <ol className="mt-3 space-y-0">
            {order.timeline.map((t, i) => (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                <span aria-hidden="true" className="relative flex w-3 justify-center">
                  <span className={cx('mt-1.5 h-2.5 w-2.5 rounded-full', i === order.timeline.length - 1 ? 'bg-ink' : 'bg-line')} />
                  {i < order.timeline.length - 1 && <span className="absolute top-4 bottom-[-6px] w-px bg-line" />}
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-ink">{t.label || t.status}</p>
                  <p className="text-[13px] text-ink-muted">{t.timestamp}</p>
                  {t.notes && <p className="text-[13px] text-ink-soft">{t.notes}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {canCustomerCancel(order) && (
        <section className={cx(card, 'p-4 sm:p-6')}>
          {!cancelOpen ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[14px] text-ink-soft">You can cancel until the order is packed.</p>
              <button type="button" onClick={() => setCancelOpen(true)} className={cx(btn.base, 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50')}>
                Cancel order
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-[16px] font-semibold text-ink">Cancel this order?</h2>
              <div role="radiogroup" aria-label="Reason" className="flex flex-wrap gap-2">
                {CANCEL_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={reason === r}
                    onClick={() => setReason(r)}
                    className={cx(
                      'min-h-[44px] rounded-xl border px-3 text-[14px] font-medium',
                      reason === r ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink/40',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {reason === 'Other' && (
                <label className="block">
                  <span className="sr-only">Reason</span>
                  <input type="text" value={other} onChange={(e) => setOther(e.target.value.slice(0, 200))} placeholder="Tell us why" className={fieldControl} />
                </label>
              )}
              {cancelError && (
                <p className="flex items-start gap-2 text-[14px] text-rose-700" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {cancelError}
                </p>
              )}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setCancelOpen(false)} className={cx(btn.base, btn.secondary)}>
                  Keep my order
                </button>
                <button type="button" onClick={doCancel} disabled={cancelling} className={cx(btn.base, 'bg-rose-700 text-white hover:bg-rose-800')}>
                  {cancelling ? 'Cancelling…' : 'Yes, cancel order'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

/** Dashboard block: shown only when the customer has shop orders. */
export const YourOrdersBlock: React.FC = () => {
  const { setCustomerSubView, setSelectedRequestId } = useApp();
  const orders = useMyOrders();
  if (orders.status !== 'ready' || orders.orders.length === 0) return null;
  const latest = orders.orders[0];
  const n = itemCount(latest);
  return (
    <section className={cx(card, 'p-4 sm:p-5')} aria-labelledby="dash-orders">
      <div className="flex items-center justify-between gap-3">
        <h2 id="dash-orders" className="font-display text-2xl font-bold text-slate-900">
          Your orders
        </h2>
        <button type="button" onClick={() => setCustomerSubView('orders')} className="min-h-[44px] text-[14px] font-semibold text-ink underline underline-offset-4">
          All orders ({orders.orders.length})
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          setSelectedRequestId(latest.id);
          setCustomerSubView('orders');
        }}
        className="mt-2 flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-ink/30"
      >
        <ItemThumb src={latest.items[0]?.image} kind={latest.items[0]?.kind} className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-ink">{latest.id}</span>
            <OrderStatusPill status={latest.status} />
          </div>
          <p className="truncate text-[13px] text-ink-muted">
            {orderDate(latest.createdAt)} · {n} item{n === 1 ? '' : 's'} · {formatInr(latest.total)} · {paymentText(latest)}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
      </button>
    </section>
  );
};
