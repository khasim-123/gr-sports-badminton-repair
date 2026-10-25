/**
 * Court booking detail: customer, court & time, price, payment and the actions the booking's
 * state allows. Every action waits for the server; refused actions show the server's `detail`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, HandCoins, UserX, X } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { courtService } from '../../../services/courtService';
import type { CourtBooking } from '../../../types/courts';
import { Button } from '../../common/Button';
import { formatDateTime, formatINR } from '../../../utils/format';
import {
  ConfirmLayer,
  ConfirmState,
  CourtStatusPill,
  InlineError,
  Portal,
  TelLink,
  durationMin,
  errText,
  fmtRange,
  formatDayLabel,
  hasStarted,
  hoursText,
  inputCls,
  paymentText,
  sectionLabel,
  useBodyScrollLock,
} from './shared';

type Method = 'Cash' | 'UPI' | 'Other';

export const BookingDetailDialog: React.FC<{
  bookingId: string;
  fallback: CourtBooking | null;
  onClose: () => void;
  /** A fresh copy after a load or an action. */
  onChanged: (b: CourtBooking) => void;
}> = ({ bookingId, fallback, onClose, onChanged }) => {
  const { addToast } = useApp();
  const [booking, setBooking] = useState<CourtBooking | null>(fallback);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [payment, setPayment] = useState<{ amount: string; method: Method; notes: string } | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  useBodyScrollLock();

  const fetchBooking = useCallback(async () => {
    setLoadError(null);
    try {
      const fresh = await courtService.getBooking(bookingId);
      if (fresh && fresh.id) {
        setBooking(fresh);
        onChanged(fresh);
      }
    } catch (err) {
      setLoadError(errText(err, 'Could not load this booking.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirm && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm, busy, onClose]);

  const applied = (fresh: CourtBooking, title: string, message: string) => {
    if (fresh && fresh.id) {
      setBooking(fresh);
      onChanged(fresh);
    }
    addToast('success', title, message);
  };

  const runStatus = async (status: 'Completed' | 'No-show') => {
    if (!booking || busy) return;
    setBusy(status);
    setStatusError(null);
    try {
      const fresh = await courtService.updateBookingStatus(booking.id, status, statusNote.trim() || undefined);
      setStatusNote('');
      applied(fresh, `${booking.id}: ${status}`, status === 'Completed' ? 'Marked as played.' : `${booking.customerName} did not turn up.`);
    } catch (err) {
      setStatusError(errText(err, 'The status could not be changed. Please try again.'));
      fetchBooking();
    } finally {
      setBusy(null);
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !payment || busy) return;
    const amount = Number(payment.amount);
    if (payment.amount.trim() === '' || !Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Enter the amount received in rupees.');
      return;
    }
    if (Math.abs(amount - booking.price) > 0.005 && payment.notes.trim().length < 3) {
      setPaymentError(`The booking price is ${formatINR(booking.price)}. Add a note explaining the different amount.`);
      return;
    }
    setBusy('payment');
    setPaymentError(null);
    try {
      const fresh = await courtService.recordBookingPayment(booking.id, amount, payment.method, payment.notes.trim() || undefined);
      setPayment(null);
      applied(fresh, `${booking.id} paid`, `${formatINR(amount)} by ${payment.method}.`);
    } catch (err) {
      setPaymentError(errText(err, 'The payment could not be recorded. Please try again.'));
      fetchBooking();
    } finally {
      setBusy(null);
    }
  };

  const askCancel = () => {
    if (!booking || cancelReason === null) return;
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      setCancelError('Give a short reason — the customer sees it.');
      return;
    }
    setCancelError(null);
    const id = booking.id;
    setConfirm({
      title: `Cancel ${id}?`,
      message: (
        <>
          {booking.courtName}, {formatDayLabel(booking.date)} {fmtRange(booking.startTime, booking.endTime)} becomes free again and{' '}
          {booking.customerName} is told it is cancelled (“{reason}”). This can't be undone.
        </>
      ),
      confirmLabel: 'Cancel booking',
      cancelLabel: 'Keep booking',
      danger: true,
      onConfirm: async () => {
        setBusy('cancel');
        try {
          const fresh = await courtService.cancelBooking(id, reason);
          setCancelReason(null);
          applied(fresh, `${id} cancelled`, 'The court is free again for that time.');
        } catch (err) {
          setCancelError(errText(err, 'The booking could not be cancelled. Please try again.'));
          fetchBooking();
        } finally {
          setBusy(null);
        }
      },
    });
  };

  const started = booking ? hasStarted(booking) : false;
  const isConfirmed = booking?.status === 'Confirmed';
  const showStatus = !!booking && isConfirmed && started;
  const showPayment = !!booking && booking.paymentStatus !== 'Paid' && (booking.status === 'Confirmed' || booking.status === 'Completed');
  const showCancel = !!booking && isConfirmed && (booking.canCancel || !started);
  const hasActions = showStatus || showPayment || showCancel || (!!booking && isConfirmed && !started);
  const amountDiffers =
    !!booking && !!payment && payment.amount.trim() !== '' && Math.abs(Number(payment.amount) - booking.price) > 0.005;

  return (
    <Portal>
      <div
        onClick={() => !busy && !confirm && onClose()}
        className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="court-booking-title"
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl my-auto flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] animate-in zoom-in-95"
        >
          <div className="flex justify-between items-start gap-3 p-4 sm:p-6 pb-3 border-b border-line/70 shrink-0">
            <div className="min-w-0">
              <h3 id="court-booking-title" className="text-lg font-semibold text-ink flex flex-wrap items-center gap-2">
                <span className="font-mono">{bookingId}</span>
                {booking && <CourtStatusPill status={booking.status} />}
              </h3>
              {booking && (
                <p className="text-[13px] text-slate-500 mt-0.5">
                  {booking.bookedBy === 'admin' ? 'Booked by the shop (walk-in / phone)' : 'Booked online by the customer'} ·{' '}
                  {formatDateTime(booking.createdAt)}
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
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {booking ? `Showing the last loaded copy. ${loadError}` : loadError}
                </span>
                <Button type="button" size="sm" variant="outline" onClick={fetchBooking} className="min-h-[36px] shrink-0">
                  Retry
                </Button>
              </div>
            )}

            {!booking ? (
              !loadError && (
                <div className="py-10 text-center text-slate-500 flex items-center justify-center gap-2" role="status">
                  <span className="w-3 h-3 border-2 border-ink border-t-transparent rounded-full animate-spin" /> Loading the booking…
                </div>
              )
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-paper rounded-xl space-y-1">
                    <p className={sectionLabel}>Customer</p>
                    <p className="font-bold text-slate-900 text-sm break-words">{booking.customerName}</p>
                    <TelLink phone={booking.customerMobile} className="min-h-[40px]" />
                    {booking.players ? <p className="text-slate-700">{booking.players} {booking.players === 1 ? 'player' : 'players'}</p> : null}
                    {booking.notes && (
                      <p className="text-slate-700 pt-1 break-words">
                        <b>Note:</b> {booking.notes}
                      </p>
                    )}
                  </div>
                  <div className="p-3 bg-paper rounded-xl space-y-1">
                    <p className={sectionLabel}>Court & time</p>
                    <p className="font-bold text-slate-900 text-sm break-words">
                      {booking.courtName} <span className="font-normal text-slate-500">· {booking.venueName}</span>
                    </p>
                    <p className="text-slate-800 font-semibold">{formatDayLabel(booking.date)}</p>
                    <p className="text-slate-800">
                      {fmtRange(booking.startTime, booking.endTime)} · {hoursText(durationMin(booking))}
                      {booking.slots > 1 ? ` (${booking.slots} slots)` : ''}
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-[1fr,auto] gap-x-3 gap-y-1 p-3 border border-line rounded-xl">
                  <dt className="font-bold text-slate-900 text-sm">Price</dt>
                  <dd className="text-right font-bold text-slate-900 text-sm">{formatINR(booking.price)}</dd>
                  <dt className="text-slate-500">Payment</dt>
                  <dd className={`text-right font-semibold ${booking.paymentStatus === 'Paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {paymentText(booking)}
                  </dd>
                  {booking.paymentStatus === 'Paid' && booking.paidAt && (
                    <>
                      <dt className="text-slate-500">Paid at</dt>
                      <dd className="text-right text-slate-800">{formatDateTime(booking.paidAt)}</dd>
                    </>
                  )}
                </dl>

                {booking.status === 'Cancelled' && booking.cancelReason && (
                  <div className="p-3 border border-rose-200 bg-rose-50/60 rounded-xl text-rose-800 break-words">
                    <b>Cancelled:</b> {booking.cancelReason}
                  </div>
                )}

                {hasActions && (
                  <div className="p-3 border border-line bg-paper rounded-xl space-y-3">
                    <p className={sectionLabel}>Actions</p>

                    {isConfirmed && !started && (
                      <p className="text-slate-600">“Played” and “No-show” can be marked once the booking starts at {fmtRange(booking.startTime, booking.endTime).split(' – ')[0]}.</p>
                    )}

                    {showStatus && (
                      <div className="space-y-2">
                        {statusError && <InlineError>{statusError}</InlineError>}
                        <input
                          type="text"
                          value={statusNote}
                          maxLength={200}
                          onChange={(e) => setStatusNote(e.target.value)}
                          placeholder="Note for the timeline (optional)"
                          aria-label="Note for the timeline"
                          className={inputCls}
                          disabled={!!busy}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            className="min-h-[40px]"
                            isLoading={busy === 'Completed'}
                            disabled={!!busy && busy !== 'Completed'}
                            leftIcon={<CheckCircle2 className="w-4 h-4" />}
                            onClick={() => runStatus('Completed')}
                          >
                            Mark completed
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-[40px] !border-amber-300 !text-amber-800 hover:!bg-amber-50"
                            isLoading={busy === 'No-show'}
                            disabled={!!busy && busy !== 'No-show'}
                            leftIcon={<UserX className="w-4 h-4" />}
                            onClick={() => runStatus('No-show')}
                          >
                            No-show
                          </Button>
                        </div>
                      </div>
                    )}

                    {showPayment &&
                      (payment ? (
                        <form className="space-y-2 bg-white border border-emerald-200 rounded-xl p-3" onSubmit={submitPayment} noValidate>
                          <p className="font-bold text-slate-900 text-sm">Record payment at the venue</p>
                          <p className="text-xs text-slate-500">Booking price {formatINR(booking.price)}.</p>
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
                                onChange={(e) => setPayment({ ...payment, method: e.target.value as Method })}
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
                          {paymentError && <InlineError>{paymentError}</InlineError>}
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
                            setPayment({ amount: String(booking.price ?? ''), method: 'Cash', notes: '' });
                          }}
                          disabled={!!busy}
                          className="w-full min-h-[44px] rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 font-bold text-xs hover:bg-emerald-100 inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          <HandCoins className="w-4 h-4" /> Record payment · {formatINR(booking.price)}
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
                            <Ban className="w-3.5 h-3.5" /> Cancel booking…
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
                                placeholder="e.g. Customer called to cancel, court maintenance"
                                className={`mt-1 ${inputCls}`}
                                disabled={busy === 'cancel'}
                              />
                            </label>
                            {cancelError && <InlineError>{cancelError}</InlineError>}
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
                                Keep booking
                              </button>
                              <button
                                type="button"
                                onClick={askCancel}
                                disabled={!!busy}
                                className="flex-1 sm:flex-none sm:px-4 min-h-[40px] rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-60"
                              >
                                Cancel booking
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <p className={sectionLabel}>Timeline</p>
                  {(booking.timeline || []).length === 0 ? (
                    <p className="text-slate-500">No events yet.</p>
                  ) : (
                    <ol className="space-y-2 border-l-2 border-line pl-4">
                      {[...(booking.timeline || [])].reverse().map((ev, i) => (
                        <li key={i} className="relative">
                          <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-ink border-2 border-white" />
                          <p className="font-semibold text-slate-900">{ev.label || ev.status}</p>
                          <p className="text-xs text-slate-500">
                            {formatDateTime(ev.timestamp)}
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
      <ConfirmLayer confirm={confirm} onClose={() => setConfirm(null)} />
    </Portal>
  );
};
