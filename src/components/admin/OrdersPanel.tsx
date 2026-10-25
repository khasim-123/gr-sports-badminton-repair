/**
 * Admin → Orders: online shop orders (T-shirts & apparel, rackets, string sets).
 * Customers pay on delivery or at pickup (Cash / UPI). Every action waits for the server; the
 * server decides which status changes are allowed and answers 409 with a plain `detail` message,
 * which is shown inline.
 *
 * `useAdminOrders` is owned by AdminPortal (sidebar badge + dashboard card) and passed in here,
 * so there is one list of orders for the whole console.
 */
import { PageHeader } from './PageHeader';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Ban, CheckCircle2, ChevronRight, Download, ExternalLink, Eye, HandCoins, MapPin, Package, PackageCheck, Phone, RefreshCw, Search, ShoppingBag, Store, Truck, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { shopService } from '../../services/shopService';
import type { FulfilmentMethod, OrderLine, OrderStatus, ShopOrder } from '../../types/shop';
import { Button } from '../common/Button';
import { csvRow, downloadCsv, formatDate, formatDateTime, formatINR } from '../../utils/format';
import { formatMobile, mobileTelHref } from '../../utils/phone';

// ---------------------------------------------------------------------------
// Order rules (mirror the server; the server has the final say)
// ---------------------------------------------------------------------------
export const ORDER_STATUSES: OrderStatus[] = [
  'Placed',
  'Confirmed',
  'Packed',
  'Out for Delivery',
  'Ready for Pickup',
  'Delivered',
  'Picked Up',
  'Cancelled',
];

const CLOSED_ORDER_STATUSES = new Set<OrderStatus>(['Delivered', 'Picked Up', 'Cancelled']);
export const isOpenOrder = (o: ShopOrder) => !CLOSED_ORDER_STATUSES.has(o.status);
const isUnpaid = (o: ShopOrder) => o.paymentStatus !== 'Paid' && o.status !== 'Cancelled';

/** Open orders by stage + what is still to be collected. */
export const orderSummary = (orders: ShopOrder[]) => {
  const count = (s: OrderStatus) => orders.filter((o) => o.status === s).length;
  const unpaid = orders.filter(isUnpaid);
  return {
    open: orders.filter(isOpenOrder).length,
    placed: count('Placed'),
    confirmed: count('Confirmed'),
    packed: count('Packed'),
    outForDelivery: count('Out for Delivery'),
    readyForPickup: count('Ready for Pickup'),
    unpaidCount: unpaid.length,
    unpaidTotal: unpaid.reduce((acc, o) => acc + (o.total || 0), 0),
  };
};

const STATUS_STYLE: Record<OrderStatus, { pill: string; dot: string }> = {
  Placed: { pill: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  Confirmed: { pill: 'bg-paper text-ink border-line', dot: 'bg-ink' },
  Packed: { pill: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  'Out for Delivery': { pill: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  'Ready for Pickup': { pill: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  Delivered: { pill: 'bg-emerald-50 text-emerald-800 border-emerald-300', dot: 'bg-emerald-600' },
  'Picked Up': { pill: 'bg-emerald-50 text-emerald-800 border-emerald-300', dot: 'bg-emerald-600' },
  Cancelled: { pill: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
};

export const OrderStatusPill: React.FC<{ status: OrderStatus | string }> = ({ status }) => {
  const s = STATUS_STYLE[status as OrderStatus] || { pill: 'bg-slate-100 text-slate-700 border-line', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border text-xs px-2 py-0.5 font-medium whitespace-nowrap ${s.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {status}
    </span>
  );
};

const KIND_LABEL: Record<string, string> = { apparel: 'Apparel', racket: 'Racket', string: 'String set' };
const FULFILMENT_LABEL: Record<FulfilmentMethod, string> = { delivery: 'Home delivery', pickup: 'Pickup at shop' };

const DISTANCE_SOURCE_TEXT: Record<string, string> = {
  location: "from the customer's phone location",
  customer: 'entered by the customer',
  staff: 'corrected by staff',
};

const itemCount = (o: ShopOrder) => (o.items || []).reduce((acc, l) => acc + (l.quantity || 0), 0);

const lineText = (l: OrderLine) => `${l.quantity} × ${l.name}${l.detail ? ` (${l.detail})` : ''}`;

const itemsSummary = (o: ShopOrder) => {
  const items = o.items || [];
  if (items.length === 0) return 'No items';
  const first = lineText(items[0]);
  return items.length > 1 ? `${first} + ${items.length - 1} more` : first;
};

const addressText = (o: ShopOrder) => {
  const a = o.address;
  if (!a) return '';
  return [a.houseFlat, a.street, a.area, a.city, a.pincode].map((p) => (p || '').trim()).filter(Boolean).join(', ');
};

const mapsHref = (o: ShopOrder): string | null => {
  const a = o.address;
  if (!a) return null;
  const query =
    typeof a.lat === 'number' && typeof a.lng === 'number' && Number.isFinite(a.lat) && Number.isFinite(a.lng)
      ? `${a.lat},${a.lng}`
      : addressText(o);
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
};

const paymentLabel = (o: ShopOrder) => {
  if (o.paymentStatus === 'Paid') return o.paymentMethod ? `Paid · ${o.paymentMethod}` : 'Paid';
  if (o.status === 'Cancelled') return 'Not due';
  return o.fulfilment === 'pickup' ? 'Unpaid · pay at pickup' : 'Unpaid · pay on delivery';
};

const errText = (err: unknown, fallback: string) => {
  const m = (err as { message?: unknown })?.message;
  return typeof m === 'string' && m.trim() ? m : fallback;
};

const sortOrders = (list: ShopOrder[]) =>
  [...list].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));

// ---------------------------------------------------------------------------
// Data hook (used by AdminPortal)
// ---------------------------------------------------------------------------
export interface AdminOrdersState {
  orders: ShopOrder[];
  /** True once the first load finished (successfully or not). */
  loaded: boolean;
  loading: boolean;
  error: string | null;
  /** The server has no orders endpoint yet (404). */
  unavailable: boolean;
  reload: () => Promise<void>;
  /** Puts a fresh copy of one order (from an action's response) into the list. */
  upsert: (order: ShopOrder) => void;
}

export function useAdminOrders(enabled = true, pollMs = 60_000): AdminOrdersState {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const list = await shopService.getOrders();
      if (mine !== seq.current) return;
      setOrders(sortOrders(Array.isArray(list) ? list : []));
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (mine !== seq.current) return;
      const status = (err as { status?: number })?.status;
      setUnavailable(status === 404);
      setError(errText(err, 'Could not load the orders.'));
    } finally {
      if (mine === seq.current) {
        setLoading(false);
        setLoaded(true);
      }
    }
  }, []);

  const upsert = useCallback((order: ShopOrder) => {
    if (!order || !order.id) return;
    setOrders((list) =>
      sortOrders(list.some((o) => o.id === order.id) ? list.map((o) => (o.id === order.id ? order : o)) : [order, ...list])
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;
    reload();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, pollMs);
    return () => window.clearInterval(t);
  }, [enabled, pollMs, reload]);

  return { orders, loaded, loading, error, unavailable, reload, upsert };
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------
const inputCls =
  'w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-ink/40 bg-white';
const cardCls = 'bg-white rounded-2xl border border-line shadow-xs';
const thCls = 'py-3 px-3 whitespace-nowrap';
const tdCls = 'py-3 px-3 align-top';
const sectionLabel = 'font-bold text-slate-500 uppercase tracking-wider text-xs';

const TelLink: React.FC<{ phone: string; className?: string }> = ({ phone, className = '' }) => {
  const href = mobileTelHref(phone);
  return href ? (
    <a
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 text-ink font-semibold hover:underline whitespace-nowrap ${className}`}
    >
      <Phone className="w-3.5 h-3.5" /> {formatMobile(phone)}
    </a>
  ) : (
    <span className="text-slate-500">{formatMobile(phone) || '—'}</span>
  );
};

const LineThumb: React.FC<{ line: OrderLine; size?: string }> = ({ line, size = 'w-14 h-14' }) => {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`${size} rounded-xl bg-white border border-line shrink-0 overflow-hidden flex items-center justify-center`}>
      {line.image && !broken ? (
        <img src={line.image} alt={line.name} loading="lazy" onError={() => setBroken(true)} className="w-full h-full object-contain p-1" />
      ) : (
        <ShoppingBag className="w-5 h-5 text-slate-300" aria-hidden="true" />
      )}
    </div>
  );
};

const FulfilmentTag: React.FC<{ order: ShopOrder }> = ({ order }) =>
  order.fulfilment === 'pickup' ? (
    <span className="inline-flex items-center gap-1 text-slate-700 font-semibold whitespace-nowrap">
      <Store className="w-3.5 h-3.5 text-slate-500" /> Pickup
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-slate-700 font-semibold whitespace-nowrap">
      <Truck className="w-3.5 h-3.5 text-slate-500" /> Delivery
      {typeof order.distanceKm === 'number' && <span className="text-slate-500 font-normal">· {order.distanceKm} km</span>}
    </span>
  );

const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  typeof document === 'undefined' ? null : createPortal(children, document.body);

interface ConfirmState {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<unknown> | void;
}

// ---------------------------------------------------------------------------
// Order detail dialog
// ---------------------------------------------------------------------------
type ActionId = 'Confirmed' | 'Packed' | 'Out for Delivery' | 'Ready for Pickup' | 'Delivered' | 'Picked Up';

/** The one forward step the admin can take from a status (payment completes the order). */
const nextStep = (o: ShopOrder): { status: ActionId; label: string; icon: React.ElementType; hint: string } | null => {
  switch (o.status) {
    case 'Placed':
      return { status: 'Confirmed', label: 'Confirm order', icon: CheckCircle2, hint: 'Tell the customer the order is accepted.' };
    case 'Confirmed':
      return { status: 'Packed', label: 'Mark packed', icon: Package, hint: 'Items are picked and packed.' };
    case 'Packed':
      return o.fulfilment === 'pickup'
        ? { status: 'Ready for Pickup', label: 'Ready for pickup', icon: Store, hint: 'The customer is told to collect it from the shop.' }
        : { status: 'Out for Delivery', label: 'Out for delivery', icon: Truck, hint: 'The order has left the shop.' };
    case 'Out for Delivery':
      // Normally completed by recording the payment; only offered directly when already paid.
      return o.paymentStatus === 'Paid'
        ? { status: 'Delivered', label: 'Mark delivered', icon: PackageCheck, hint: 'Already paid.' }
        : null;
    case 'Ready for Pickup':
      return o.paymentStatus === 'Paid'
        ? { status: 'Picked Up', label: 'Mark picked up', icon: PackageCheck, hint: 'Already paid.' }
        : null;
    default:
      return null;
  }
};

/** The server accepts a payment at any status except Cancelled; at Out for Delivery / Ready for Pickup it also completes the order. */
const canRecordPayment = (o: ShopOrder) => o.paymentStatus !== 'Paid' && o.status !== 'Cancelled';
const paymentCompletes = (o: ShopOrder) => o.status === 'Out for Delivery' || o.status === 'Ready for Pickup';
const paymentActionLabel = (o: ShopOrder) =>
  paymentCompletes(o) ? `Record payment & mark ${o.fulfilment === 'pickup' ? 'picked up' : 'delivered'}` : 'Record payment (paid in advance)';

const canCancel = (o: ShopOrder) => isOpenOrder(o);

const OrderDetailDialog: React.FC<{
  orderId: string;
  fallback: ShopOrder | null;
  onClose: () => void;
  onChanged: (order: ShopOrder) => void;
  reloadList: () => Promise<void>;
}> = ({ orderId, fallback, onClose, onChanged, reloadList }) => {
  const { addToast } = useApp();
  const [order, setOrder] = useState<ShopOrder | null>(fallback);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [stepNote, setStepNote] = useState('');
  const [payment, setPayment] = useState<{ amount: string; method: 'Cash' | 'UPI' | 'Other'; notes: string } | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirming, setConfirming] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoadError(null);
    try {
      const fresh = await shopService.getOrder(orderId);
      if (fresh && fresh.id) {
        setOrder(fresh);
        onChanged(fresh);
      }
    } catch (err) {
      setLoadError(errText(err, 'Could not load this order.'));
    }
    // onChanged is stable (from the hook)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Escape closes the top-most layer (never while a save is in flight).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirm) {
        if (!confirming) setConfirm(null);
      } else if (!busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm, confirming, busy, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const applied = (fresh: ShopOrder, title: string, message: string) => {
    if (fresh && fresh.id) {
      setOrder(fresh);
      onChanged(fresh);
    }
    addToast('success', title, message);
    reloadList();
  };

  /** After a refused action the order may have moved on elsewhere: show the latest. */
  const afterFailure = () => {
    fetchOrder();
    reloadList();
  };

  const runStep = async (status: ActionId) => {
    if (!order || busy) return;
    setBusy(status);
    setActionError(null);
    try {
      const fresh = await shopService.updateOrderStatus(order.id, status, stepNote.trim() || undefined);
      setStepNote('');
      applied(fresh, `${order.id}: ${status}`, `${order.customerName} is notified.`);
    } catch (err) {
      setActionError(errText(err, 'The status could not be changed. Please try again.'));
      afterFailure();
    } finally {
      setBusy(null);
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !payment || busy) return;
    const amount = Number(payment.amount);
    if (payment.amount.trim() === '' || !Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Enter the amount received in rupees.');
      return;
    }
    const differs = Math.abs(amount - order.total) > 0.005;
    if (differs && payment.notes.trim().length < 3) {
      setPaymentError(`The order total is ${formatINR(order.total)}. Add a note explaining the different amount.`);
      return;
    }
    setBusy('payment');
    setPaymentError(null);
    try {
      const fresh = await shopService.recordOrderPayment(order.id, amount, payment.method, payment.notes.trim() || undefined);
      setPayment(null);
      applied(
        fresh,
        `${order.id} paid`,
        paymentCompletes(order)
          ? `${formatINR(amount)} by ${payment.method} · order ${order.fulfilment === 'pickup' ? 'picked up' : 'delivered'}.`
          : `${formatINR(amount)} by ${payment.method}. The order stays at “${order.status}”.`
      );
    } catch (err) {
      setPaymentError(errText(err, 'The payment could not be recorded. Please try again.'));
      afterFailure();
    } finally {
      setBusy(null);
    }
  };

  const askCancel = () => {
    if (!order || cancelReason === null) return;
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      setCancelError('Give a short reason — the customer sees it.');
      return;
    }
    setCancelError(null);
    const id = order.id;
    setConfirm({
      title: `Cancel ${id}?`,
      message: (
        <>
          {order.customerName} is told the order is cancelled (“{reason}”) and the items go back into stock. This can't be undone.
        </>
      ),
      confirmLabel: 'Cancel order',
      danger: true,
      onConfirm: async () => {
        setBusy('cancel');
        try {
          const fresh = await shopService.cancelOrder(id, reason);
          setCancelReason(null);
          applied(fresh, `${id} cancelled`, 'Stock has been restored.');
        } catch (err) {
          setCancelError(errText(err, 'The order could not be cancelled. Please try again.'));
          afterFailure();
        } finally {
          setBusy(null);
        }
      },
    });
  };

  const runConfirm = async () => {
    if (!confirm || confirming) return;
    setConfirming(true);
    try {
      await confirm.onConfirm();
    } finally {
      setConfirming(false);
      setConfirm(null);
    }
  };

  const step = order ? nextStep(order) : null;
  const showPayment = order ? canRecordPayment(order) : false;
  const showCancel = order ? canCancel(order) : false;
  const hasActions = !!step || showPayment || showCancel;
  const href = order ? mapsHref(order) : null;
  const km = order ? order.distanceKm ?? order.address?.distanceKm : null;
  const amountDiffers =
    !!order && !!payment && payment.amount.trim() !== '' && Math.abs(Number(payment.amount) - order.total) > 0.005;

  return (
    <Portal>
      <div
        onClick={() => !busy && onClose()}
        className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-detail-title"
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl my-auto flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] animate-in zoom-in-95"
        >
          <div className="flex justify-between items-start gap-3 p-4 sm:p-6 pb-3 border-b border-line/70 shrink-0">
            <div className="min-w-0">
              <h3 id="order-detail-title" className="text-lg font-semibold text-ink flex flex-wrap items-center gap-2">
                <span className="font-mono">{orderId}</span>
                {order && <OrderStatusPill status={order.status} />}
              </h3>
              {order && (
                <p className="text-[13px] text-slate-500 mt-0.5">
                  {FULFILMENT_LABEL[order.fulfilment] || order.fulfilment} · {itemCount(order)}{' '}
                  {itemCount(order) === 1 ? 'item' : 'items'} · Placed {formatDateTime(order.createdAt)}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              disabled={!!busy}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 text-[13px]">
            {loadError && (
              <div role="alert" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-between gap-2">
                <span className="flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {order ? `Showing the last loaded copy. ${loadError}` : loadError}
                </span>
                <Button type="button" size="sm" variant="outline" onClick={fetchOrder} className="min-h-[36px] shrink-0">
                  Retry
                </Button>
              </div>
            )}

            {!order ? (
              !loadError && (
                <div className="py-10 text-center text-slate-500 flex items-center justify-center gap-2" role="status">
                  <span className="w-3 h-3 border-2 border-ink border-t-transparent rounded-full animate-spin" /> Loading the order…
                </div>
              )
            ) : (
              <>
                {/* Items */}
                <div className="border border-line rounded-xl">
                  <p className={`${sectionLabel} px-3 pt-3`}>Items</p>
                  <ul className="divide-y divide-line/70">
                    {(order.items || []).map((line, i) => (
                      <li key={`${line.kind}-${line.productId}-${line.variantId || ''}-${i}`} className="flex gap-3 p-3">
                        <LineThumb line={line} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 text-sm break-words">{line.name}</p>
                          <p className="text-slate-500">
                            {KIND_LABEL[line.kind] || line.kind}
                            {line.detail ? ` · ${line.detail}` : ''}
                          </p>
                          <p className="text-slate-600 mt-0.5">
                            {formatINR(line.unitPrice)} × {line.quantity}
                          </p>
                        </div>
                        <p className="font-bold text-slate-900 text-sm whitespace-nowrap">{formatINR(line.lineTotal)}</p>
                      </li>
                    ))}
                  </ul>
                  <dl className="grid grid-cols-[1fr,auto] gap-x-3 gap-y-1 p-3 border-t border-line/70 bg-paper/60 rounded-b-xl">
                    <dt className="text-slate-500">Subtotal</dt>
                    <dd className="text-right text-slate-800">{formatINR(order.subtotal)}</dd>
                    <dt className="text-slate-500">{order.fulfilment === 'pickup' ? 'Pickup at shop' : 'Delivery'}</dt>
                    <dd className="text-right text-slate-800">
                      {order.fulfilment === 'pickup' ? 'No charge' : order.deliveryCharge > 0 ? formatINR(order.deliveryCharge) : 'Free'}
                    </dd>
                    <dt className="font-bold text-slate-900 border-t border-line/70 pt-1 text-sm">Total</dt>
                    <dd className="text-right font-bold text-slate-900 border-t border-line/70 pt-1 text-sm">{formatINR(order.total)}</dd>
                    <dt className="text-slate-500">Payment</dt>
                    <dd className={`text-right font-semibold ${order.paymentStatus === 'Paid' ? 'text-emerald-700' : order.status === 'Cancelled' ? 'text-slate-500' : 'text-amber-700'}`}>
                      {paymentLabel(order)}
                    </dd>
                    {order.paymentStatus === 'Paid' && order.paidAt && (
                      <>
                        <dt className="text-slate-500">Paid at</dt>
                        <dd className="text-right text-slate-800">{formatDateTime(order.paidAt)}</dd>
                      </>
                    )}
                  </dl>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-paper rounded-xl space-y-1">
                    <p className={sectionLabel}>Customer</p>
                    <p className="font-bold text-slate-900 text-sm break-words">{order.customerName}</p>
                    <TelLink phone={order.customerMobile} className="min-h-[40px]" />
                    {order.notes && (
                      <p className="text-slate-700 pt-1 break-words">
                        <b>Customer note:</b> {order.notes}
                      </p>
                    )}
                  </div>

                  <div className="p-3 bg-paper rounded-xl space-y-1">
                    <p className={sectionLabel}>{order.fulfilment === 'pickup' ? 'Pickup' : 'Delivery address'}</p>
                    {order.fulfilment === 'pickup' ? (
                      <p className="text-slate-800">The customer collects the order from the shop and pays there.</p>
                    ) : order.address ? (
                      <>
                        <p className="text-slate-800 break-words">{addressText(order) || '—'}</p>
                        {order.address.landmark && <p className="text-slate-500 break-words">Landmark: {order.address.landmark}</p>}
                        {typeof km === 'number' && (
                          <p className="font-semibold text-slate-700">
                            {km} km from the shop
                            {order.address.distanceSource && (
                              <span className="font-normal text-slate-500">
                                {' '}
                                · {DISTANCE_SOURCE_TEXT[order.address.distanceSource] || order.address.distanceSource}
                              </span>
                            )}
                          </p>
                        )}
                        {href && (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-100"
                          >
                            <MapPin className="w-3.5 h-3.5" /> Open in Google Maps <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </>
                    ) : (
                      <p className="text-slate-500">No address on this order.</p>
                    )}
                  </div>
                </div>

                {order.status === 'Cancelled' && order.cancelReason && (
                  <div className="p-3 border border-rose-200 bg-rose-50/60 rounded-xl text-rose-800 break-words">
                    <b>Cancelled:</b> {order.cancelReason}
                  </div>
                )}

                {/* Actions — only what the current status allows */}
                {hasActions && (
                  <div className="p-3 border border-line bg-paper rounded-xl space-y-3">
                    <p className={sectionLabel}>Next step</p>
                    {actionError && (
                      <p role="alert" className="text-xs text-rose-700 flex items-start gap-1 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {actionError} {step ? '' : 'The order has been refreshed — check its status above.'}
                        </span>
                      </p>
                    )}

                    {step && (
                      <div className="space-y-2">
                        <p className="text-slate-600">{step.hint}</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={stepNote}
                            maxLength={200}
                            onChange={(e) => setStepNote(e.target.value)}
                            placeholder="Note for the timeline (optional)"
                            aria-label="Note for the timeline"
                            className={`${inputCls} flex-1`}
                            disabled={!!busy}
                          />
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            className="min-h-[40px] sm:min-w-[11rem]"
                            isLoading={busy === step.status}
                            disabled={!!busy && busy !== step.status}
                            leftIcon={<step.icon className="w-4 h-4" />}
                            onClick={() => runStep(step.status)}
                          >
                            {step.label}
                          </Button>
                        </div>
                      </div>
                    )}

                    {showPayment &&
                      (payment ? (
                        <form className="space-y-2 bg-white border border-emerald-200 rounded-xl p-3" onSubmit={submitPayment} noValidate>
                          <p className="font-bold text-slate-900 text-sm">{paymentActionLabel(order)}</p>
                          <p className="text-xs text-slate-500">
                            Order total {formatINR(order.total)}.{' '}
                            {paymentCompletes(order) ? 'Saving completes the order.' : 'The order keeps its current status.'}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs font-bold text-slate-600">
                              Amount received (₹)
                              <input
                                type="number"
                                inputMode="decimal"
                                min="1"
                                step="any"
                                value={payment.amount}
                                onChange={(e) => {
                                  setPayment({ ...payment, amount: e.target.value });
                                  setPaymentError(null);
                                }}
                                className={`mt-1 ${inputCls} font-semibold`}
                                disabled={busy === 'payment'}
                              />
                            </label>
                            <label className="text-xs font-bold text-slate-600">
                              Method
                              <select
                                value={payment.method}
                                onChange={(e) => setPayment({ ...payment, method: e.target.value as 'Cash' | 'UPI' | 'Other' })}
                                className={`mt-1 ${inputCls}`}
                                disabled={busy === 'payment'}
                              >
                                <option value="Cash">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="Other">Other</option>
                              </select>
                            </label>
                          </div>
                          <label className="block text-xs font-bold text-slate-600">
                            {amountDiffers ? 'Note (required — why is the amount different?)' : 'Note (optional, e.g. UPI reference)'}
                            <input
                              type="text"
                              maxLength={200}
                              value={payment.notes}
                              onChange={(e) => {
                                setPayment({ ...payment, notes: e.target.value });
                                setPaymentError(null);
                              }}
                              className={`mt-1 ${inputCls} ${amountDiffers && payment.notes.trim().length < 3 ? '!border-amber-400' : ''}`}
                              disabled={busy === 'payment'}
                            />
                          </label>
                          {paymentError && (
                            <p role="alert" className="text-xs text-rose-700 flex items-start gap-1 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {paymentError}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPayment(null);
                                setPaymentError(null);
                              }}
                              disabled={busy === 'payment'}
                              className="flex-1 min-h-[40px] rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 disabled:opacity-60"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={!!busy}
                              className="flex-1 min-h-[40px] rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
                            >
                              {busy === 'payment' && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                              {busy === 'payment' ? 'Saving…' : 'Save payment'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentError(null);
                            setPayment({ amount: String(order.total ?? ''), method: 'Cash', notes: '' });
                          }}
                          disabled={!!busy}
                          className="w-full min-h-[44px] rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 font-bold text-xs hover:bg-emerald-100 inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          <HandCoins className="w-4 h-4" /> {paymentActionLabel(order)} · {formatINR(order.total)}
                        </button>
                      ))}

                    {showCancel && (
                      <div className="border-t border-line pt-3 space-y-2">
                        {cancelReason === null ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelError(null);
                              setCancelReason('');
                            }}
                            disabled={!!busy}
                            className="min-h-[40px] px-3 rounded-lg border border-rose-200 bg-white text-rose-700 font-bold text-xs hover:bg-rose-50 inline-flex items-center gap-1.5 disabled:opacity-60"
                          >
                            <Ban className="w-3.5 h-3.5" /> Cancel order…
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-600">
                              Reason for cancelling (the customer sees this)
                              <input
                                type="text"
                                maxLength={200}
                                value={cancelReason}
                                autoFocus
                                onChange={(e) => {
                                  setCancelReason(e.target.value);
                                  setCancelError(null);
                                }}
                                placeholder="e.g. Size out of stock, customer asked to cancel"
                                className={`mt-1 ${inputCls}`}
                                disabled={busy === 'cancel'}
                              />
                            </label>
                            {cancelError && (
                              <p role="alert" className="text-xs text-rose-700 flex items-start gap-1 font-medium">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {cancelError}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelReason(null);
                                  setCancelError(null);
                                }}
                                disabled={busy === 'cancel'}
                                className="flex-1 sm:flex-none sm:px-4 min-h-[40px] rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700"
                              >
                                Keep order
                              </button>
                              <button
                                type="button"
                                onClick={askCancel}
                                disabled={!!busy}
                                className="flex-1 sm:flex-none sm:px-4 min-h-[40px] rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-60"
                              >
                                Cancel order
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Timeline */}
                <div className="space-y-2">
                  <p className={sectionLabel}>Timeline</p>
                  {(order.timeline || []).length === 0 ? (
                    <p className="text-slate-500">No events yet.</p>
                  ) : (
                    <ol className="space-y-2 border-l-2 border-line pl-4">
                      {[...(order.timeline || [])].reverse().map((ev, i) => (
                        <li key={i} className="relative">
                          <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-ink border-2 border-white" />
                          <p className="font-semibold text-slate-900">{ev.label || ev.status}</p>
                          <p className="text-xs text-slate-500">
                            {ev.timestamp}
                            {ev.actor ? ` · ${ev.actor}` : ''}
                          </p>
                          {ev.notes && <p className="text-xs text-slate-600 break-words">{ev.notes}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 p-4 sm:px-6 border-t border-line/70 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button onClick={onClose} variant="primary" size="sm" className="min-h-[40px] px-6" disabled={!!busy}>
              Close
            </Button>
          </div>
        </div>
      </div>

      {confirm && (
        <div
          onClick={() => !confirming && setConfirm(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="order-confirm-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95"
          >
            <h3 id="order-confirm-title" className="font-bold text-base text-slate-900 flex items-start gap-2">
              {confirm.danger && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
              {confirm.title}
            </h3>
            <div className="text-sm text-slate-600">{confirm.message}</div>
            <div className="flex gap-2 pt-1">
              <Button onClick={() => setConfirm(null)} variant="outline" className="flex-1 min-h-[40px]" size="sm" disabled={confirming}>
                Keep order
              </Button>
              <Button
                onClick={runConfirm}
                isLoading={confirming}
                variant="primary"
                size="sm"
                className={`flex-1 min-h-[40px] ${confirm.danger ? 'bg-rose-600 hover:bg-rose-700' : ''}`}
              >
                {confirm.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Portal>
  );
};

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------
type StatusFilter = 'ALL' | 'OPEN' | 'UNPAID_DUE' | OrderStatus;

interface OrdersPanelProps {
  data: AdminOrdersState;
  /** Set by the dashboard card: open the list with this status filter, 'OPEN' or 'UNPAID' (bump `n` to re-apply). */
  preset?: { status: string; n: number } | null;
  /** Called once the preset has been applied (so a later visit starts unfiltered). */
  onPresetUsed?: () => void;
}

export const OrdersPanel: React.FC<OrdersPanelProps> = ({ data, preset, onPresetUsed }) => {
  const { addToast, selectedRequestId, setSelectedRequestId } = useApp();
  const { orders, loaded, loading, error, unavailable, reload, upsert } = data;
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [fulfilmentFilter, setFulfilmentFilter] = useState<'ALL' | FulfilmentMethod>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');
  const [detailId, setDetailId] = useState<string | null>(null);

  // A notification opens an order by putting its id in selectedRequestId.
  useEffect(() => {
    if (selectedRequestId && selectedRequestId.startsWith('ORD-')) {
      setDetailId(selectedRequestId);
      setSelectedRequestId(null);
    }
  }, [selectedRequestId, setSelectedRequestId]);

  useEffect(() => {
    if (!preset) return;
    setQuery('');
    setFulfilmentFilter('ALL');
    setPaymentFilter(preset.status === 'UNPAID' ? 'UNPAID' : 'ALL');
    setStatusFilter((ORDER_STATUSES as string[]).includes(preset.status) || preset.status === 'OPEN' ? (preset.status as StatusFilter) : 'ALL');
    onPresetUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const summary = useMemo(() => orderSummary(orders), [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return orders.filter((o) => {
      if (q) {
        const hit =
          o.id.toLowerCase().includes(q) ||
          (o.customerName || '').toLowerCase().includes(q) ||
          (digits.length >= 3 && (o.customerMobile || '').replace(/\D/g, '').includes(digits)) ||
          (o.items || []).some((l) => `${l.name} ${l.detail || ''}`.toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (statusFilter === 'OPEN') {
        if (!isOpenOrder(o)) return false;
      } else if (statusFilter === 'UNPAID_DUE') {
        if (!(o.status === 'Out for Delivery' || o.status === 'Ready for Pickup')) return false;
      } else if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (fulfilmentFilter !== 'ALL' && o.fulfilment !== fulfilmentFilter) return false;
      if (paymentFilter === 'PAID' && o.paymentStatus !== 'Paid') return false;
      if (paymentFilter === 'UNPAID' && !isUnpaid(o)) return false;
      return true;
    });
  }, [orders, query, statusFilter, fulfilmentFilter, paymentFilter]);

  const filtersActive = !!query.trim() || statusFilter !== 'ALL' || fulfilmentFilter !== 'ALL' || paymentFilter !== 'ALL';
  const clearFilters = () => {
    setQuery('');
    setStatusFilter('ALL');
    setFulfilmentFilter('ALL');
    setPaymentFilter('ALL');
  };

  const exportCsv = () => {
    if (filtered.length === 0) {
      addToast('info', 'Nothing to export', 'There are no orders to export.');
      return;
    }
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const lines = [
      csvRow([
        'Order ID',
        'Placed',
        'Customer',
        'Mobile',
        'Fulfilment',
        'Items',
        'Quantity',
        'Subtotal (INR)',
        'Delivery (INR)',
        'Total (INR)',
        'Payment',
        'Method',
        'Paid at',
        'Status',
        'Delivery address',
        'Distance (km)',
        'Customer note',
        'Cancel reason',
      ]),
      ...filtered.map((o) =>
        csvRow([
          o.id,
          formatDateTime(o.createdAt, ''),
          o.customerName,
          formatMobile(o.customerMobile),
          FULFILMENT_LABEL[o.fulfilment] || o.fulfilment,
          (o.items || []).map(lineText).join('; '),
          itemCount(o),
          o.subtotal ?? 0,
          o.deliveryCharge ?? 0,
          o.total ?? 0,
          o.paymentStatus === 'Paid' ? 'Paid' : o.status === 'Cancelled' ? 'Not due' : 'Unpaid',
          o.paymentMethod || '',
          o.paidAt ? formatDateTime(o.paidAt, '') : '',
          o.status,
          [addressText(o), o.address?.landmark ? `Landmark: ${o.address.landmark}` : ''].filter(Boolean).join(' · '),
          o.distanceKm ?? o.address?.distanceKm ?? '',
          o.notes || '',
          o.cancelReason || '',
        ])
      ),
    ];
    downloadCsv(`gr-sports-orders-${stamp}.csv`, lines);
  };

  const stageCards: { id: StatusFilter; label: string; count: number; detail: string; tone: string }[] = [
    { id: 'Placed', label: 'To confirm', count: summary.placed, detail: 'New orders', tone: summary.placed ? 'text-amber-600' : 'text-slate-900' },
    { id: 'Confirmed', label: 'To pack', count: summary.confirmed, detail: 'Confirmed, not packed', tone: 'text-slate-900' },
    { id: 'Packed', label: 'Packed', count: summary.packed, detail: 'Send out or make ready', tone: 'text-slate-900' },
    {
      id: 'UNPAID_DUE',
      label: 'Out / ready for pickup',
      count: summary.outForDelivery + summary.readyForPickup,
      detail: `${summary.outForDelivery} out for delivery · ${summary.readyForPickup} ready`,
      tone: 'text-slate-900',
    },
  ];

  const detailFallback = detailId ? orders.find((o) => o.id === detailId) || null : null;

  const pageHeader = (
    <PageHeader
      title="Shop orders"
      subtitle="Online orders for T-shirts & apparel, rackets and string sets. Customers pay on delivery or at pickup."
      actions={
      <>
        <Button
          onClick={() => reload()}
          variant="outline"
          size="sm"
          className="min-h-[40px]"
          isLoading={loading && loaded}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh
        </Button>
        <Button
          onClick={exportCsv}
          variant="outline"
          size="sm"
          className="min-h-[40px]"
          disabled={orders.length === 0}
          leftIcon={<Download className="w-4 h-4" />}
        >
          Export {filtersActive ? `${filtered.length} shown` : 'all'} (CSV)
        </Button>
      </>
      }
    />
  );

  // ---- states before there is a list ----
  if (!loaded) {
    return (
      <div className="space-y-4 animate-in fade-in">
        {pageHeader}
        <div className="space-y-3" aria-busy="true" aria-label="Loading orders">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${cardCls} p-4 animate-pulse space-y-2.5`}>
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="space-y-4 animate-in fade-in">
        {pageHeader}
        <div className={`${cardCls} p-6 sm:p-8 text-center flex flex-col items-center`} role="alert">
          <div className="w-12 h-12 rounded-2xl bg-paper border border-line flex items-center justify-center mb-3">
            {unavailable ? <ShoppingBag className="w-6 h-6 text-slate-500" /> : <AlertTriangle className="w-6 h-6 text-rose-500" />}
          </div>
          <h3 className="text-sm font-bold text-slate-900">{unavailable ? 'Online orders are not switched on yet' : "Couldn't load the orders"}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm break-words">
            {unavailable ? 'The server does not have the shop orders service yet. Once it is updated, orders appear here.' : error}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 min-h-[40px]"
            onClick={() => reload()}
            isLoading={loading}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Try again
          </Button>
        </div>
        {detailId && (
          <OrderDetailDialog
            key={detailId}
            orderId={detailId}
            fallback={detailFallback}
            onClose={() => setDetailId(null)}
            onChanged={upsert}
            reloadList={reload}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in min-w-0">
      {pageHeader}

      {/* Counts */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {stageCards.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={statusFilter === c.id}
            onClick={() => setStatusFilter((cur) => (cur === c.id ? 'ALL' : c.id))}
            className={`flex flex-col text-left bg-white p-4 sm:p-5 rounded-2xl border transition-colors duration-150 min-w-0 ${
              statusFilter === c.id ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-ink/30'
            }`}
          >
            <p className="text-[13px] font-semibold text-slate-500 truncate">{c.label}</p>
            <p className={`font-display text-[32px] leading-tight font-bold tabular-nums mt-1 ${c.tone}`}>{c.count}</p>
            <p className="text-[13px] text-slate-500 mt-0.5 leading-snug">{c.detail}</p>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={paymentFilter === 'UNPAID'}
          onClick={() => setPaymentFilter((cur) => (cur === 'UNPAID' ? 'ALL' : 'UNPAID'))}
          className={`col-span-2 lg:col-span-1 flex flex-col text-left bg-white p-4 sm:p-5 rounded-2xl border transition-colors duration-150 min-w-0 ${
            paymentFilter === 'UNPAID' ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-ink/30'
          }`}
        >
          <p className="text-[13px] font-semibold text-slate-500">To be collected</p>
          <p className="font-display text-[32px] leading-tight font-bold tabular-nums mt-1 text-amber-700">{formatINR(summary.unpaidTotal)}</p>
          <p className="text-[13px] text-slate-500 mt-0.5 truncate">
            {summary.unpaidCount} unpaid {summary.unpaidCount === 1 ? 'order' : 'orders'}
          </p>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between gap-2" role="alert">
          <span>Refresh failed: {error}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => reload()} className="min-h-[36px] shrink-0">
            Retry
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-line shadow-2xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order ID, name, mobile or item"
            aria-label="Search orders"
            className={`${inputCls} pl-10`}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filter by status"
            className={inputCls}
          >
            <option value="ALL">All statuses</option>
            <option value="OPEN">Open (not delivered, picked up or cancelled)</option>
            <option value="UNPAID_DUE">Out for delivery or ready for pickup</option>
            <optgroup label="Exact status">
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </optgroup>
          </select>
          <select
            value={fulfilmentFilter}
            onChange={(e) => setFulfilmentFilter(e.target.value as 'ALL' | FulfilmentMethod)}
            aria-label="Filter by delivery or pickup"
            className={inputCls}
          >
            <option value="ALL">Delivery & pickup</option>
            <option value="delivery">Home delivery</option>
            <option value="pickup">Pickup at shop</option>
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as 'ALL' | 'UNPAID' | 'PAID')}
            aria-label="Filter by payment"
            className={inputCls}
          >
            <option value="ALL">All payments</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Showing {filtered.length} of {orders.length} {orders.length === 1 ? 'order' : 'orders'}
          </span>
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="font-bold text-ink hover:underline min-h-[40px] px-2">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Phone: cards */}
      <ul className="md:hidden space-y-2.5">
        {filtered.length === 0 && (
          <li className={`${cardCls} py-10 px-4 text-center text-sm text-slate-500`}>
            {orders.length === 0 ? 'No orders yet. Orders placed on the website appear here.' : 'No orders match these filters.'}
          </li>
        )}
        {filtered.map((o) => (
          <li key={o.id} className={`${cardCls} p-3 space-y-2`}>
            <div className="flex items-start justify-between gap-2">
              <button type="button" onClick={() => setDetailId(o.id)} className="text-left min-w-0">
                <span className="block font-mono font-bold text-ink text-sm">{o.id}</span>
                <span className="block text-xs text-slate-500">{formatDateTime(o.createdAt)}</span>
              </button>
              <OrderStatusPill status={o.status} />
            </div>
            <div className="text-xs">
              <p className="font-bold text-slate-900 break-words">{o.customerName}</p>
              <TelLink phone={o.customerMobile} className="min-h-[36px]" />
            </div>
            <p className="text-xs text-slate-700 break-words">{itemsSummary(o)}</p>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <FulfilmentTag order={o} />
              <span className="text-right">
                <span className="font-bold text-slate-900">{formatINR(o.total)}</span>
                <span className={`block text-xs ${o.paymentStatus === 'Paid' ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {o.paymentStatus === 'Paid' ? `Paid${o.paymentMethod ? ` · ${o.paymentMethod}` : ''}` : o.status === 'Cancelled' ? 'Not due' : 'Unpaid'}
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDetailId(o.id)}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-line text-slate-700 font-bold text-xs hover:bg-paper"
            >
              <Eye className="w-3.5 h-3.5" /> Open order
            </button>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className={`${cardCls} overflow-hidden hidden md:block`}>
        <div className="overflow-auto lg:max-h-[calc(100vh-9rem)]">
          <table className="w-full min-w-[820px] text-left border-collapse text-[13px]">
            <thead>
              <tr className="text-slate-500 font-semibold uppercase tracking-[0.06em] text-xs [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-paper [&>th]:shadow-[inset_0_-1px_0_#E3DFD6]">
                <th className={thCls}>Order</th>
                <th className={thCls}>Customer</th>
                <th className={thCls}>Items</th>
                <th className={thCls}>Fulfilment</th>
                <th className={`${thCls} text-right`}>Total</th>
                <th className={thCls}>Status</th>
                <th className={`${thCls} text-right`}>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center text-sm text-slate-500">
                    {orders.length === 0 ? 'No orders yet. Orders placed on the website appear here.' : 'No orders match these filters.'}
                  </td>
                </tr>
              )}
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-paper/70 transition-colors">
                  <td className={tdCls}>
                    <button type="button" onClick={() => setDetailId(o.id)} className="font-mono font-bold text-ink hover:underline whitespace-nowrap">
                      {o.id}
                    </button>
                    <p className="text-xs text-slate-500 whitespace-nowrap">{formatDate(o.createdAt)}</p>
                  </td>
                  <td className={tdCls}>
                    <p className="font-bold text-slate-900 max-w-[11rem] truncate" title={o.customerName}>
                      {o.customerName}
                    </p>
                    <TelLink phone={o.customerMobile} className="text-xs font-medium" />
                  </td>
                  <td className={`${tdCls} max-w-[16rem]`}>
                    <p className="text-slate-800 line-clamp-2 break-words" title={(o.items || []).map(lineText).join('\n')}>
                      {itemsSummary(o)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {itemCount(o)} {itemCount(o) === 1 ? 'item' : 'items'}
                    </p>
                  </td>
                  <td className={tdCls}>
                    <FulfilmentTag order={o} />
                  </td>
                  <td className={`${tdCls} text-right whitespace-nowrap`}>
                    <p className="font-bold text-slate-900">{formatINR(o.total)}</p>
                    <p className={`text-xs ${o.paymentStatus === 'Paid' ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {o.paymentStatus === 'Paid' ? `Paid${o.paymentMethod ? ` · ${o.paymentMethod}` : ''}` : o.status === 'Cancelled' ? 'Not due' : 'Unpaid'}
                    </p>
                  </td>
                  <td className={tdCls}>
                    <OrderStatusPill status={o.status} />
                  </td>
                  <td className={`${tdCls} text-right`}>
                    <button
                      type="button"
                      onClick={() => setDetailId(o.id)}
                      className="min-h-[36px] px-3 inline-flex items-center gap-1 rounded-lg border border-line bg-white text-slate-700 font-semibold hover:text-ink hover:border-slate-400 transition-colors duration-150"
                    >
                      Open <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detailId && (
        <OrderDetailDialog
          key={detailId}
          orderId={detailId}
          fallback={detailFallback}
          onClose={() => setDetailId(null)}
          onChanged={upsert}
          reloadList={reload}
        />
      )}
    </div>
  );
};

export default OrdersPanel;
