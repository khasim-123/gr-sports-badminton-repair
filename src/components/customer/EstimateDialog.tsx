import React from 'react';
import { X, CheckCircle2, XCircle, FileText, ArrowUpRight } from 'lucide-react';
import { Button } from '../common/Button';
import { ServiceRequest } from '../../types';
import { calendarDaysBetween, formatDate, formatINR, parseDate } from '../../utils/format';
import { useShopSettings } from '../../hooks/useShopSettings';

interface Props {
  request: ServiceRequest;
  freeRadiusKm: number;
  onClose: () => void;
  onApprove: () => void;
  onDecline: () => void;
}

const Line: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = 'text-slate-900' }) => (
  <div className="flex justify-between items-baseline gap-4 py-1.5">
    <span className="text-slate-600">{label}</span>
    <span className={`font-semibold text-right ${tone}`}>{value}</span>
  </div>
);

/**
 * Shared body of the repair-estimate dialogs (first estimate and revised estimate). Shows only what
 * the technician entered; the total payable is the server's figure (estimate + pickup & delivery).
 */
export const EstimateDialog: React.FC<Props> = ({ request, freeRadiusKm, onClose, onApprove, onDecline }) => {
  const est = request.repairEstimate!;
  const isRevised = !!est.isRevised;
  const original = est.originalEstimate ?? request.previousEstimate?.totalEstimate ?? null;
  const increase = original != null ? est.totalEstimate - original : null;
  const delivery = request.pickupDeliveryCharge || 0;
  const [confirmDecline, setConfirmDecline] = React.useState(false);
  const declinedFee = Math.max(0, Number(useShopSettings().declinedRepairFee) || 0);
  const payIfDeclined = delivery + declinedFee;
  const titleId = `estimate-title-${request.id}`;
  const readyBy = parseDate(est.expectedCompletionDate);
  const showReadyBy = !!readyBy && calendarDaysBetween(new Date(), readyBy) >= 0;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] animate-in zoom-in-95 ${
          isRevised ? 'border-amber-300' : 'border-line'
        }`}
      >
        <div
          className={`text-white px-5 py-4 flex items-start justify-between gap-3 shrink-0 ${
            isRevised ? 'bg-amber-700' : 'bg-ink'
          }`}
        >
          <div className="min-w-0">
            <h3 id={titleId} className="text-lg font-bold">
              {isRevised ? 'Updated repair estimate' : 'Repair estimate'}
            </h3>
            <p className="text-xs text-white/80 mt-0.5 truncate">
              {request.id} · {request.batBrand} {request.batModel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 -mr-2 -mt-1 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-sm">
          {isRevised && est.revisionReason && (
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200">
              <p className="text-xs font-semibold text-amber-900 mb-1">Why the price changed</p>
              <p className="text-slate-800">{est.revisionReason}</p>
            </div>
          )}

          {(est.inspectionNotes || request.repairIssue) && (
            <div className="p-3.5 bg-paper rounded-2xl border border-line">
              <p className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Technician&apos;s findings
              </p>
              {est.inspectionNotes && <p className="text-slate-800">{est.inspectionNotes}</p>}
              <p className="text-xs text-slate-500 mt-1.5">
                {request.repairIssue ? `Reported problem: ${request.repairIssue}` : ''}
                {request.repairIssue && showReadyBy ? ' · ' : ''}
                {showReadyBy ? `Ready by ${formatDate(readyBy)} if approved` : ''}
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-line px-4 py-2 divide-y divide-line/70">
            {/* A revision only records the new total (the server derives the labour/materials split), so
                itemised lines are shown for first estimates only. */}
            {!isRevised && est.labourCharge > 0 && <Line label="Labour" value={formatINR(est.labourCharge)} />}
            {!isRevised && est.materialsCharge > 0 && <Line label="Materials" value={formatINR(est.materialsCharge)} />}
            {!isRevised && est.additionalCharges > 0 && <Line label="Other charges" value={formatINR(est.additionalCharges)} />}
            {est.discount > 0 && <Line label="Discount" value={`−${formatINR(est.discount)}`} tone="text-emerald-700" />}
            <Line label={isRevised ? 'New repair estimate' : 'Repair estimate'} value={formatINR(est.totalEstimate)} />
            {isRevised && original != null && increase != null && (
              <div className="py-1.5 text-xs text-amber-800 flex justify-between gap-4">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Earlier estimate {formatINR(original)}
                </span>
                <span className="font-semibold">
                  {increase >= 0 ? '+' : '−'}
                  {formatINR(Math.abs(increase))}
                </span>
              </div>
            )}
            <Line
              label="Pickup & delivery"
              value={delivery > 0 ? formatINR(delivery) : `Free (within ${freeRadiusKm} km)`}
              tone={delivery > 0 ? 'text-slate-900' : 'text-emerald-700'}
            />
            <div className="flex justify-between items-baseline gap-4 py-2.5">
              <span className="font-bold text-slate-900">Total to pay after delivery</span>
              <span className="text-xl font-black text-ink">{formatINR(request.totalAmount || est.totalEstimate + delivery)}</span>
            </div>
          </div>

          <p className="text-xs text-slate-600">
            We start the repair only after you approve. Nothing is paid now — you pay our agent by cash or UPI when the racket is
            delivered back.
          </p>

        </div>

        <div className="shrink-0 border-t border-line bg-white p-4 sm:px-5">
            {confirmDecline ? (
              <div className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50 space-y-3">
                <p className="text-sm text-rose-900">
                  <b>Decline this estimate?</b> We won&apos;t repair the racket and will return it to you as it is.
                </p>
                <div className="rounded-xl bg-white/70 border border-rose-200 px-3 py-2 text-xs text-rose-900 space-y-1">
                  <div className="flex justify-between gap-3">
                    <span>Pickup &amp; delivery</span>
                    <span className="font-semibold">{delivery > 0 ? formatINR(delivery) : 'Free'}</span>
                  </div>
                  {declinedFee > 0 && (
                    <div className="flex justify-between gap-3">
                      <span>Inspection fee (repair declined)</span>
                      <span className="font-semibold">{formatINR(declinedFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 pt-1 border-t border-rose-200 text-sm">
                    <b>You pay when it&apos;s returned</b>
                    <b>{payIfDeclined > 0 ? formatINR(payIfDeclined) : 'Nothing'}</b>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="md" className="min-h-[44px]" onClick={() => setConfirmDecline(false)}>
                    Go back
                  </Button>
                  <Button variant="danger" size="md" className="min-h-[44px]" onClick={onDecline}>
                    Yes, decline
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Button
                  onClick={() => setConfirmDecline(true)}
                  variant="outline"
                  size="md"
                  className="w-full min-h-[48px] text-slate-700 border-rose-300 hover:bg-rose-50 order-2 sm:order-1"
                  leftIcon={<XCircle className="w-4 h-4 text-rose-500" />}
                >
                  Decline repair
                </Button>
                <Button
                  onClick={onApprove}
                  variant="primary"
                  size="md"
                  className="w-full min-h-[48px] font-bold order-1 sm:order-2"
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Approve {formatINR(est.totalEstimate)}
                </Button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
