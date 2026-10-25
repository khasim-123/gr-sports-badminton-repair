import React, { useState } from 'react';
import { ArrowLeft, CalendarDays, ClipboardList, History, MapPin, Phone, Wallet, Wrench } from 'lucide-react';
import { DistancePricingConfig, GettingServiceTier, RepairCategoryTier, ServiceRequest } from '../../types';
import { StatusBadge } from '../common/Badge';
import { formatDate, formatDateTime, formatINR } from '../../utils/format';
import { formatMobile, mobileTelHref } from '../../utils/phone';
import { gettingTierName, splitNotes, tidyRupees } from '../customer/requestDisplay';
import { StaffDialog } from './StaffDialog';
import { useRequestPhotos } from '../../hooks/useRequestPhotos';
import { distanceSourceInfo } from '../../utils/distance';
import { TimingNote, actionClass, secondaryBtnCls } from './JobCard';
import {
  ActionKind,
  actionsFor,
  addressLine,
  amountDue,
  declinedFee,
  isNewRequest,
  mapsUrl,
  nextStepText,
  serviceName,
  stageOf,
  wasDeclined,
} from './jobLogic';

const Card: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section className="bg-white rounded-2xl border border-line p-4 sm:p-5">
    <h2 className="font-display tracking-[0.01em] text-xl leading-tight font-bold text-ink flex items-center gap-2 mb-3">
      {icon}
      {title}
    </h2>
    {children}
  </section>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <dt className="text-xs font-semibold text-slate-500">{children}</dt>
);

const Line: React.FC<{ label: React.ReactNode; value: React.ReactNode; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="flex justify-between items-baseline gap-4 py-2">
    <dt className={strong ? 'font-bold text-slate-900' : 'text-slate-600'}>{label}</dt>
    <dd className={`text-right tabular-nums ${strong ? 'font-bold text-slate-900' : 'font-semibold text-slate-900'}`}>{value}</dd>
  </div>
);

const Photos: React.FC<{ photos: string[]; label: string; onView: (src: string) => void }> = ({ photos, label, onView }) => (
  <div className="flex flex-wrap gap-2">
    {photos.map((src, i) => (
      <button
        key={i}
        type="button"
        onClick={() => onView(src)}
        className="w-24 h-24 rounded-xl overflow-hidden border border-line hover:ring-2 hover:ring-ink/40"
        aria-label={`View ${label} ${i + 1}`}
      >
        <img src={src} alt={`${label} ${i + 1}`} className="w-full h-full object-cover" />
      </button>
    ))}
  </div>
);

interface JobDetailProps {
  request: ServiceRequest;
  mine: boolean;
  backLabel: string;
  onBack: () => void;
  onAction: (kind: ActionKind, request: ServiceRequest) => void;
  gettingServices: GettingServiceTier[];
  repairCategories: RepairCategoryTier[];
  distanceConfig: DistancePricingConfig;
}

export const JobDetail: React.FC<JobDetailProps> = ({
  request: r,
  mine,
  backLabel,
  onBack,
  onAction,
  gettingServices,
  repairCategories,
  distanceConfig,
}) => {
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const loadedPhotos = useRequestPhotos(r);
  const isRepair = r.serviceType === 'REPAIR';
  const stage = stageOf(r);
  const actions = actionsFor(r, mine);
  const tel = mobileTelHref(r.customerMobile);
  const map = mapsUrl(r.pickupAddress);
  const { slot, notes } = splitNotes(r.additionalNotes);
  const customerPhotos = loadedPhotos.batPhotos;
  const pickupPhotos = loadedPhotos.pickupPhotos;
  const est = r.repairEstimate;
  const declined = wasDeclined(r);
  const isPaid = r.paymentStatus === 'Paid';
  const delivery = r.pickupDeliveryCharge || 0;
  const readOnly = !mine && !isNewRequest(r);
  const distSource = distanceSourceInfo(r.pickupAddress);
  const fee = declined ? declinedFee(r) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 min-h-[44px] pr-3 -ml-1 pl-1 rounded-xl text-[15px] font-semibold text-slate-600 hover:text-ink transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </button>
        <span className="text-[13px] text-slate-500">Booked {formatDateTime(r.createdAt)}</span>
      </div>

      {/* Who and where: the first thing needed on the road */}
      <section className="bg-white rounded-2xl border border-line p-4 sm:p-5" aria-label="Job and customer">
        <div className="flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 min-w-0 text-[13px] text-slate-500">
            <span className="font-mono font-semibold text-slate-700">{r.id}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{serviceName(r)}</span>
          </p>
          <StatusBadge status={r.status} size="sm" />
        </div>
        <h1 className="mt-1 font-display tracking-[0.01em] text-[28px] sm:text-[32px] leading-tight font-bold text-ink break-words">
          {r.batBrand} {r.batModel}
        </h1>
        <p className="text-[13px] text-slate-500">
          {r.assignedEmployeeName ? `Assigned to ${r.assignedEmployeeName}` : 'Not assigned yet'}
        </p>

        <div className="mt-4 pt-4 border-t border-line/70 space-y-1">
          <p className="text-base font-semibold text-ink">{r.customerName}</p>
          <p className="text-sm text-slate-600 tabular-nums">{formatMobile(r.customerMobile) || 'No mobile number'}</p>
          <p className="text-[15px] text-slate-900 pt-1">{addressLine(r.pickupAddress) || 'Address not recorded'}</p>
          {r.pickupAddress?.landmark && <p className="text-sm text-slate-600">Landmark: {r.pickupAddress.landmark}</p>}
        </div>
        {notes && (
          <p className="mt-3 rounded-xl bg-paper border border-line px-3 py-2 text-sm text-slate-800 whitespace-pre-line">
            <span className="font-semibold text-ink">Customer note: </span>
            {notes}
          </p>
        )}
        {(tel || map) && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:max-w-sm">
            {tel && (
              <a href={tel} className={`${secondaryBtnCls} min-h-[48px] ${map ? '' : 'col-span-2'}`} aria-label={`Call ${r.customerName}`}>
                <Phone className="w-[18px] h-[18px]" aria-hidden="true" /> Call
              </a>
            )}
            {map && (
              <a
                href={map}
                target="_blank"
                rel="noreferrer"
                className={`${secondaryBtnCls} min-h-[48px] ${tel ? '' : 'col-span-2'}`}
                aria-label="Open the address in Google Maps"
              >
                <MapPin className="w-[18px] h-[18px]" aria-hidden="true" /> Map
              </a>
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        <div className="lg:col-span-3 space-y-4">
          {/* What to do next */}
          <section
            className={`rounded-2xl border p-4 sm:p-5 ${stage === 'done' ? 'bg-emerald-50/60 border-emerald-200' : 'bg-paper border-line'}`}
            aria-label="Next step"
          >
            <p className="text-xs font-semibold text-slate-500">{stage === 'done' ? 'Finished' : 'Next step'}</p>
            <p className="font-display tracking-[0.01em] text-2xl leading-tight font-bold text-ink mt-0.5">{nextStepText(r, mine)}</p>
            <div className="mt-1.5">
              <TimingNote request={r} repairCategories={repairCategories} />
            </div>
            {readOnly && stage !== 'done' && (
              <p className="text-sm text-slate-600 mt-1.5">
                This job is assigned to {r.assignedEmployeeName || 'another staff member'}. Ask the admin if it should move to you.
              </p>
            )}
            {mine && r.status === 'Awaiting Customer Approval' && (
              <p className="text-sm text-slate-600 mt-1.5">
                The customer approves the estimate in their account. Call them if it is taking long; work can start once they approve.
              </p>
            )}
            {actions.length > 0 && (
              <div className="hidden md:flex flex-wrap gap-2 mt-4">
                {actions.map((a) => (
                  <button
                    key={a.kind}
                    type="button"
                    onClick={() => onAction(a.kind, r)}
                    className={`${a.primary ? actionClass(a.kind) : secondaryBtnCls} min-w-[160px]`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Pickup details */}
          <Card title="Pickup" icon={<CalendarDays className="w-4 h-4 text-ink" />}>
            <dl className="space-y-3 text-sm">
              <div>
                <Label>When</Label>
                <dd className="text-[15px] text-slate-900">
                  {r.pickupDate ? formatDate(r.pickupDate) : 'Date not chosen'}
                  {slot ? `, ${slot}` : ''}
                </dd>
              </div>
              <div>
                <Label>Distance</Label>
                <dd className="text-[15px] text-slate-900 tabular-nums">
                  {r.distanceKm} km from the shop ·{' '}
                  {r.isFreeDelivery || delivery === 0 ? 'free pickup & delivery' : `${formatINR(delivery)} pickup & delivery`}
                </dd>
                <dd className="mt-1.5">
                  <span
                    className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold border ${
                      distSource.needsCheck && stage !== 'done'
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-paper border-line text-slate-600'
                    }`}
                  >
                    Distance {distSource.label}
                  </span>
                </dd>
              </div>
            </dl>
          </Card>

          {/* What was booked */}
          <Card title={isRepair ? 'Repair' : 'Stringing'} icon={<ClipboardList className="w-4 h-4 text-ink" />}>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <Label>Racket</Label>
                <dd className="font-semibold text-slate-900">
                  {r.batBrand} {r.batModel}
                </dd>
                {r.batType && <dd className="text-xs text-slate-500">{r.batType}</dd>}
              </div>
              {isRepair ? (
                <div>
                  <Label>Problem reported</Label>
                  <dd className="font-semibold text-slate-900">{r.repairIssue || '—'}</dd>
                  {r.repairDescription && <dd className="text-xs text-slate-600 whitespace-pre-line">{r.repairDescription}</dd>}
                </div>
              ) : (
                <>
                  <div>
                    <Label>Package</Label>
                    <dd className="font-semibold text-slate-900">{gettingTierName(r, gettingServices)}</dd>
                  </div>
                  <div>
                    <Label>String</Label>
                    <dd className="font-semibold text-slate-900">{r.stringType || r.stringPreference || "Customer didn't choose"}</dd>
                    {r.colour && <dd className="text-xs text-slate-600">Colour: {r.colour}</dd>}
                  </div>
                  <div>
                    <Label>Tension</Label>
                    <dd className="font-semibold text-slate-900">{r.stringTensionLbs ? `${r.stringTensionLbs} lbs` : 'Not given'}</dd>
                  </div>
                </>
              )}
            </dl>
            {customerPhotos.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">Customer&apos;s photos</p>
                <Photos photos={customerPhotos} label="Customer photo" onView={setViewPhoto} />
              </div>
            )}
          </Card>

          {r.pickupCondition && (
            <Card title="Condition at pickup" icon={<ClipboardList className="w-4 h-4 text-ink" />}>
              <div className="text-sm space-y-1">
                <p className="font-semibold text-slate-900">{r.pickupCondition.condition}</p>
                {r.pickupCondition.notes && <p className="text-slate-700 whitespace-pre-line">{r.pickupCondition.notes}</p>}
                <p className="text-xs text-slate-500">
                  {[r.pickupCondition.collectedBy && `Collected by ${r.pickupCondition.collectedBy}`, r.pickupCondition.collectedAt && formatDateTime(r.pickupCondition.collectedAt)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {pickupPhotos.length > 0 && (
                  <div className="pt-2">
                    <Photos photos={pickupPhotos} label="Pickup photo" onView={setViewPhoto} />
                  </div>
                )}
              </div>
            </Card>
          )}

          {est && (
            <Card title={est.isRevised ? 'Repair estimate (revised)' : 'Repair estimate'} icon={<Wrench className="w-4 h-4 text-amber-600" />}>
              <dl className="text-sm divide-y divide-line/70">
                <Line label="Labour" value={formatINR(est.labourCharge)} />
                <Line label="Materials / parts" value={formatINR(est.materialsCharge)} />
                {est.additionalCharges > 0 && <Line label="Additional" value={formatINR(est.additionalCharges)} />}
                {est.discount > 0 && <Line label="Discount" value={`−${formatINR(est.discount)}`} />}
                <Line label="Repair estimate" value={formatINR(est.totalEstimate)} strong />
              </dl>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                {est.isRevised && est.originalEstimate != null && (
                  <p>
                    Was {formatINR(est.originalEstimate)}
                    {est.revisionReason ? ` — ${est.revisionReason}` : ''}
                  </p>
                )}
                {est.expectedCompletionDate && <p>Ready by {formatDate(est.expectedCompletionDate)}</p>}
                {est.inspectionNotes && <p className="whitespace-pre-line">Inspection: {est.inspectionNotes}</p>}
              </div>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card title="Charges" icon={<Wallet className="w-4 h-4 text-ink" />}>
            <dl className="text-sm divide-y divide-line/70">
              {isRepair ? (
                <Line
                  label="Repair"
                  value={
                    declined ? <span className="text-slate-500 font-medium">Declined — not charged</span> : est ? formatINR(est.totalEstimate) : <span className="text-amber-700">After inspection</span>
                  }
                />
              ) : (
                <Line label={gettingTierName(r, gettingServices)} value={formatINR(r.serviceCharge)} />
              )}
              <Line
                label="Pickup & delivery"
                value={delivery > 0 ? formatINR(delivery) : <span className="text-emerald-700">Free (within {distanceConfig.freeRadiusKm} km)</span>}
              />
              {fee > 0 && <Line label="Declined-repair fee" value={formatINR(fee)} />}
              {!declined && r.discount > 0 && <Line label="Discount" value={`−${formatINR(r.discount)}`} />}
              <Line
                label={isPaid ? 'Total' : 'To collect on delivery'}
                value={
                  isRepair && !est && !declined ? (delivery > 0 ? `${formatINR(delivery)} + repair` : 'After inspection') : formatINR(amountDue(r))
                }
                strong
              />
            </dl>
            <p
              className={`mt-3 rounded-xl px-3 py-2 text-xs ${
                isPaid ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'bg-paper border border-line text-slate-700'
              }`}
            >
              {isPaid && r.paymentRecord
                ? `Paid ${formatINR(r.paymentRecord.amount)} by ${r.paymentRecord.method} · collected by ${r.paymentRecord.collectedBy} · ${formatDateTime(r.paymentRecord.collectedAt)}${
                    r.paymentRecord.transactionNotes ? ` · ${r.paymentRecord.transactionNotes}` : ''
                  }`
                : isPaid
                ? 'Paid'
                : r.status === 'Cancelled'
                ? 'Cancelled — nothing to collect.'
                : 'Not paid yet. The customer pays by cash or UPI when the racket is delivered.'}
            </p>
          </Card>

          <Card title="Timeline" icon={<History className="w-4 h-4 text-ink" />}>
            {(r.timeline || []).length === 0 ? (
              <p className="text-sm text-slate-500">No updates yet.</p>
            ) : (
              <ol className="space-y-3 border-l-2 border-line pl-4 ml-1">
                {[...(r.timeline || [])].reverse().map((ev, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-white border-2 border-ink" aria-hidden="true" />
                    <p className="text-sm font-semibold text-slate-900">{tidyRupees(ev.label || ev.status)}</p>
                    <p className="text-xs text-slate-500">
                      {ev.timestamp}
                      {ev.actor ? ` · ${ev.actor}` : ''}
                    </p>
                    {ev.notes && <p className="text-xs text-slate-600 mt-0.5 break-words">{tidyRupees(ev.notes)}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      {/* Phones: the job's actions sit at the bottom of the screen, within thumb reach */}
      {actions.length > 0 && (
        <div
          className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          role="region"
          aria-label="Job actions"
        >
          <div className="flex flex-wrap gap-2">
            {[...actions.filter((a) => a.primary), ...actions.filter((a) => !a.primary)].map((a) => (
              <button
                key={a.kind}
                type="button"
                onClick={() => onAction(a.kind, r)}
                className={`${a.primary ? `${actionClass(a.kind)} min-h-[52px] text-base basis-full` : secondaryBtnCls} flex-1`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {viewPhoto && (
        <StaffDialog
          title="Photo"
          subtitle={<span className="font-mono">{r.id}</span>}
          onClose={() => setViewPhoto(null)}
          footer={
            <button
              type="button"
              onClick={() => setViewPhoto(null)}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-paper"
            >
              Close
            </button>
          }
        >
          <img src={viewPhoto} alt="Racket photo" className="w-full h-auto max-h-[70vh] object-contain rounded-xl bg-slate-100" />
        </StaffDialog>
      )}
    </div>
  );
};
