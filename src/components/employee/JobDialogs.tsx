import React, { useMemo, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { BatConditionAtPickup, DistancePricingConfig, PaymentMethod, RepairCategoryTier, RepairEstimate, ServiceRequest } from '../../types';
import { formatINR } from '../../utils/format';
import { fileToResizedDataUrl } from '../../utils/photos';
import { repairCategoryFor } from '../customer/requestDisplay';
import { DialogButtons, FieldError, StaffDialog, fieldLabel, inputCls, textareaCls } from './StaffDialog';
import { addressLine, amountDue, declinedFee, wasDeclined } from './jobLogic';
import { distanceSourceInfo } from '../../utils/distance';

const NOT_SAVED = 'Not saved. Check your connection and try again.';

/** Finds the server's error message for a failed save (the app reports it as an error toast). */
export type ErrorSince = (since: number) => string | null;

/** Error shown inside a dialog: a validation message, or the server's reason for a failed save. */
const useSaveError = (errorSince: ErrorSince) => {
  const [error, setError] = useState<string | null>(null);
  const [failedAt, setFailedAt] = useState<number | null>(null);
  return {
    message: error ?? (failedAt !== null ? errorSince(failedAt) ?? NOT_SAVED : null),
    setError: (msg: string | null) => {
      setFailedAt(null);
      setError(msg);
    },
    /** Runs the save; on failure keeps the dialog open with the server's reason. */
    save: async (action: () => Promise<boolean>, onDone: () => void, setBusy: (b: boolean) => void) => {
      const started = Date.now();
      setError(null);
      setFailedAt(null);
      setBusy(true);
      const ok = await action();
      setBusy(false);
      if (ok) onDone();
      else setFailedAt(started);
    },
  };
};

const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Parses a rupee field: '' -> 0, invalid/negative -> NaN. */
const rupees = (v: string): number => {
  if (v.trim() === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
};

const JobSummary: React.FC<{ request: ServiceRequest }> = ({ request }) => (
  <div className="rounded-2xl bg-paper border border-line px-3 py-2.5">
    <p className="font-semibold text-slate-900">
      {request.batBrand} {request.batModel}
    </p>
    <p className="text-xs text-slate-600">
      {request.customerName} · {request.pickupAddress?.area || addressLine(request.pickupAddress)}
    </p>
  </div>
);

const RupeeInput: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}> = ({ id, label, value, onChange, hint }) => (
  <div>
    <label htmlFor={id} className={fieldLabel}>
      {label}
    </label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold" aria-hidden="true">
        ₹
      </span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        placeholder="0"
        className={`${inputCls} pl-7 tabular-nums`}
      />
    </div>
    {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
  </div>
);

// ---------------------------------------------------------------------------
// Pickup
// ---------------------------------------------------------------------------

const CONDITIONS: { value: BatConditionAtPickup; hint: string }[] = [
  { value: 'Good', hint: 'No visible damage' },
  { value: 'Minor Damage', hint: 'Scratches, chipped paint' },
  { value: 'Damaged', hint: 'Cracks or dents' },
  { value: 'Broken', hint: 'Frame or shaft broken' },
  { value: 'Other', hint: 'Describe in the notes' },
];
const MAX_PICKUP_PHOTOS = 3;

export const PickupDialog: React.FC<{
  request: ServiceRequest;
  onClose: () => void;
  onSubmit: (condition: BatConditionAtPickup, notes: string, photos: string[]) => Promise<boolean>;
  errorSince: ErrorSince;
}> = ({ request, onClose, onSubmit, errorSince }) => {
  const [condition, setCondition] = useState<BatConditionAtPickup | null>(null);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const { message: error, setError, save } = useSaveError(errorSince);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_PICKUP_PHOTOS - photos.length;
    if (room <= 0) return;
    setReading(true);
    setError(null);
    try {
      const urls = await Promise.all(Array.from(files).slice(0, room).map((f) => fileToResizedDataUrl(f)));
      setPhotos((prev) => [...prev, ...urls].slice(0, MAX_PICKUP_PHOTOS));
    } catch (err: any) {
      setError(err?.message || 'Could not add the photo.');
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condition) return setError('Choose the condition of the racket.');
    if (condition !== 'Good' && !notes.trim()) return setError('Describe the damage in the notes (the customer can see them).');
    await save(() => onSubmit(condition, notes.trim(), photos), onClose, setBusy);
  };

  return (
    <StaffDialog
      title="Record pickup"
      subtitle={<span className="font-mono">{request.id}</span>}
      onClose={onClose}
      busy={busy}
      footer={<DialogButtons onCancel={onClose} busy={busy || reading} form="pickup-form" submitLabel="Confirm pickup" />}
    >
      <form id="pickup-form" onSubmit={submit} className="space-y-4" noValidate>
        <JobSummary request={request} />
        <fieldset>
          <legend className={fieldLabel}>Condition when collected</legend>
          <div role="radiogroup" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CONDITIONS.map((c) => {
              const active = condition === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setCondition(c.value);
                    setError(null);
                  }}
                  className={`min-h-[52px] px-3 py-2 rounded-xl border text-left transition-colors ${
                    active ? 'border-ink bg-paper ring-1 ring-ink/40' : 'border-line bg-white hover:bg-paper'
                  }`}
                >
                  <span className={`block text-sm font-bold ${active ? 'text-ink' : 'text-slate-800'}`}>{c.value}</span>
                  <span className="block text-[11px] text-slate-500 leading-tight">{c.hint}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="pickup-notes" className={fieldLabel}>
            Notes {condition && condition !== 'Good' ? '' : <span className="font-medium text-slate-400">(optional)</span>}
          </label>
          <textarea
            id="pickup-notes"
            rows={3}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. crack near the T-joint, two strings broken, grip worn"
            className={textareaCls}
          />
          <p className="text-[11px] text-slate-500 mt-1">The customer sees the condition and notes on their request.</p>
        </div>

        <div>
          <p className={fieldLabel}>
            Photos <span className="font-medium text-slate-400">(optional, up to {MAX_PICKUP_PHOTOS})</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {photos.map((src, i) => (
              <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-line">
                <img src={src} alt={`Pickup photo ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute top-0 right-0 w-11 h-11 flex items-start justify-end p-1.5"
                >
                  <span className="w-6 h-6 rounded-full bg-slate-900/70 text-white flex items-center justify-center">
                    <X className="w-3.5 h-3.5" />
                  </span>
                </button>
              </div>
            ))}
            {photos.length < MAX_PICKUP_PHOTOS && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={reading}
                className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 hover:border-ink/30 hover:text-ink flex flex-col items-center justify-center gap-1 text-xs font-semibold disabled:opacity-60"
              >
                <Camera className="w-5 h-5" />
                {reading ? 'Adding…' : 'Add photo'}
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addPhotos(e.target.files)}
          />
        </div>

        <FieldError>{error}</FieldError>
      </form>
    </StaffDialog>
  );
};

// ---------------------------------------------------------------------------
// Repair estimate
// ---------------------------------------------------------------------------

const DEFAULT_REPAIR_DAYS = 7;

export const EstimateDialog: React.FC<{
  request: ServiceRequest;
  repairCategories: RepairCategoryTier[];
  onClose: () => void;
  onSubmit: (estimate: RepairEstimate) => Promise<boolean>;
  errorSince: ErrorSince;
}> = ({ request, repairCategories, onClose, onSubmit, errorSince }) => {
  const category = repairCategoryFor(request.repairIssue, repairCategories);
  const slaDays = category?.slaDays || DEFAULT_REPAIR_DAYS;
  const today = toIsoDate(new Date());
  const defaultDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + slaDays);
    return toIsoDate(d);
  }, [slaDays]);

  const [notes, setNotes] = useState('');
  const [labour, setLabour] = useState('');
  const [materials, setMaterials] = useState('');
  const [additional, setAdditional] = useState('');
  const [date, setDate] = useState(defaultDate);
  const { message: error, setError, save } = useSaveError(errorSince);
  const [busy, setBusy] = useState(false);

  const l = rupees(labour);
  const m = rupees(materials);
  const a = rupees(additional);
  const valid = [l, m, a].every((n) => !Number.isNaN(n));
  const total = valid ? l + m + a : 0;
  const delivery = request.pickupDeliveryCharge || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) return setError('Write what you found during the inspection.');
    if (!valid) return setError('Charges must be numbers of ₹0 or more.');
    if (total <= 0) return setError('Enter the labour and/or material charges.');
    if (!date || date < today) return setError('Choose an expected completion date from today onwards.');
    const estimate: RepairEstimate = {
      labourCharge: l,
      materialsCharge: m,
      additionalCharges: a,
      pickupDeliveryCharge: delivery,
      discount: 0,
      totalEstimate: total,
      expectedCompletionDate: date,
      inspectionNotes: notes.trim(),
    };
    await save(() => onSubmit(estimate), onClose, setBusy);
  };

  return (
    <StaffDialog
      title="Send repair estimate"
      subtitle={<span className="font-mono">{request.id}</span>}
      onClose={onClose}
      busy={busy}
      footer={<DialogButtons onCancel={onClose} busy={busy} form="estimate-form" submitLabel="Send to customer" busyLabel="Sending…" />}
    >
      <form id="estimate-form" onSubmit={submit} className="space-y-4" noValidate>
        <JobSummary request={request} />
        <div className="text-xs text-slate-600 space-y-0.5">
          <p>
            <span className="font-bold text-slate-700">Customer reported:</span> {request.repairIssue || '—'}
            {request.repairDescription ? ` — ${request.repairDescription}` : ''}
          </p>
          {request.pickupCondition && (
            <p>
              <span className="font-bold text-slate-700">At pickup:</span> {request.pickupCondition.condition}
              {request.pickupCondition.notes ? ` — ${request.pickupCondition.notes}` : ''}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="est-notes" className={fieldLabel}>
            Inspection notes
          </label>
          <textarea
            id="est-notes"
            rows={3}
            maxLength={800}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What you found and what the repair involves"
            className={textareaCls}
          />
          <p className="text-[11px] text-slate-500 mt-1">Shown to the customer with the estimate.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <RupeeInput id="est-labour" label="Labour" value={labour} onChange={setLabour} />
          <RupeeInput id="est-materials" label="Materials / parts" value={materials} onChange={setMaterials} />
          <RupeeInput id="est-additional" label="Additional" value={additional} onChange={setAdditional} />
          <div>
            <label htmlFor="est-date" className={fieldLabel}>
              Ready by
            </label>
            <input
              id="est-date"
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 -mt-2">
          {category
            ? `Suggested from the ${category.name} turnaround (${slaDays} days).`
            : `Suggested from the usual ${DEFAULT_REPAIR_DAYS}-day repair turnaround.`}
        </p>

        <dl className="rounded-2xl border border-line divide-y divide-line/70 text-sm">
          <div className="flex justify-between gap-3 px-3 py-2">
            <dt className="text-slate-600">Repair estimate</dt>
            <dd className="font-semibold text-slate-900 tabular-nums">{formatINR(total)}</dd>
          </div>
          <div className="flex justify-between gap-3 px-3 py-2">
            <dt className="text-slate-600">Pickup & delivery</dt>
            <dd className="font-semibold text-slate-900 tabular-nums">{delivery > 0 ? formatINR(delivery) : 'Free'}</dd>
          </div>
          <div className="flex justify-between gap-3 px-3 py-2 bg-paper rounded-b-2xl">
            <dt className="font-bold text-slate-900">Customer pays on delivery</dt>
            <dd className="font-bold text-slate-900 tabular-nums">{formatINR(total + delivery)}</dd>
          </div>
        </dl>
        <p className="text-xs text-slate-600">The repair can start only after the customer approves this estimate.</p>
        <FieldError>{error}</FieldError>
      </form>
    </StaffDialog>
  );
};

// ---------------------------------------------------------------------------
// Revise estimate
// ---------------------------------------------------------------------------

export const ReviseDialog: React.FC<{
  request: ServiceRequest;
  onClose: () => void;
  onSubmit: (additional: number, newTotal: number, reason: string) => Promise<boolean>;
  errorSince: ErrorSince;
}> = ({ request, onClose, onSubmit, errorSince }) => {
  const current = request.repairEstimate?.totalEstimate || 0;
  const delivery = request.pickupDeliveryCharge || 0;
  const [extra, setExtra] = useState('');
  const [reason, setReason] = useState('');
  const { message: error, setError, save } = useSaveError(errorSince);
  const [busy, setBusy] = useState(false);
  const add = rupees(extra);
  const newTotal = current + (Number.isNaN(add) ? 0 : add);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number.isNaN(add) || add <= 0) return setError('Enter the extra amount (more than ₹0).');
    if (!reason.trim()) return setError('Explain to the customer why the price has changed.');
    await save(() => onSubmit(add, newTotal, reason.trim()), onClose, setBusy);
  };

  return (
    <StaffDialog
      title="Revise repair estimate"
      subtitle={<span className="font-mono">{request.id}</span>}
      onClose={onClose}
      busy={busy}
      footer={<DialogButtons onCancel={onClose} busy={busy} form="revise-form" submitLabel="Send revised estimate" busyLabel="Sending…" />}
    >
      <form id="revise-form" onSubmit={submit} className="space-y-4" noValidate>
        <JobSummary request={request} />
        <p className="text-xs text-slate-600">
          Use this when you find more damage while working. The extra amount is added as one additional charge, and work
          pauses until the customer approves the new total.
        </p>
        <RupeeInput id="rev-extra" label="Extra amount" value={extra} onChange={setExtra} />
        <div>
          <label htmlFor="rev-reason" className={fieldLabel}>
            Reason
          </label>
          <textarea
            id="rev-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. a second crack under the grommet strip"
            className={textareaCls}
          />
          <p className="text-[11px] text-slate-500 mt-1">Shown to the customer.</p>
        </div>
        <dl className="rounded-2xl border border-line divide-y divide-line/70 text-sm">
          <div className="flex justify-between gap-3 px-3 py-2">
            <dt className="text-slate-600">Approved estimate</dt>
            <dd className="font-semibold tabular-nums">{formatINR(current)}</dd>
          </div>
          <div className="flex justify-between gap-3 px-3 py-2">
            <dt className="text-slate-600">Extra</dt>
            <dd className="font-semibold tabular-nums">+{formatINR(Number.isNaN(add) ? 0 : add)}</dd>
          </div>
          <div className="flex justify-between gap-3 px-3 py-2 bg-paper">
            <dt className="font-bold text-slate-900">New repair estimate</dt>
            <dd className="font-bold tabular-nums">{formatINR(newTotal)}</dd>
          </div>
          {delivery > 0 && (
            <div className="flex justify-between gap-3 px-3 py-2">
              <dt className="text-slate-600">Customer pays (with {formatINR(delivery)} pickup & delivery)</dt>
              <dd className="font-semibold tabular-nums">{formatINR(newTotal + delivery)}</dd>
            </div>
          )}
        </dl>
        <FieldError>{error}</FieldError>
      </form>
    </StaffDialog>
  );
};

// ---------------------------------------------------------------------------
// Payment on delivery
// ---------------------------------------------------------------------------

const METHODS: PaymentMethod[] = ['Cash', 'UPI', 'Other'];

export const PaymentDialog: React.FC<{
  request: ServiceRequest;
  onClose: () => void;
  onSubmit: (amount: number, method: PaymentMethod, notes?: string) => Promise<boolean>;
  errorSince: ErrorSince;
}> = ({ request, onClose, onSubmit, errorSince }) => {
  const due = amountDue(request);
  const declined = wasDeclined(request);
  const [amount, setAmount] = useState(String(due || ''));
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [upiRef, setUpiRef] = useState('');
  const [note, setNote] = useState('');
  const { message: error, setError, save } = useSaveError(errorSince);
  const [busy, setBusy] = useState(false);
  const value = rupees(amount);
  const differs = !Number.isNaN(value) && value > 0 && Math.abs(value - due) >= 0.01;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number.isNaN(value) || value <= 0) return setError('Enter the amount you received.');
    if (method === 'Other' && !note.trim()) return setError('Say how the customer paid.');
    const parts = [method === 'UPI' && upiRef.trim() ? `UPI ref ${upiRef.trim()}` : '', note.trim()].filter(Boolean);
    await save(() => onSubmit(value, method, parts.join(' · ') || undefined), onClose, setBusy);
  };

  return (
    <StaffDialog
      title={declined ? 'Racket returned — record payment' : 'Delivered — record payment'}
      subtitle={<span className="font-mono">{request.id}</span>}
      onClose={onClose}
      busy={busy}
      footer={
        <DialogButtons
          onCancel={onClose}
          busy={busy}
          form="payment-form"
          tone="success"
          submitLabel={`Record ${formatINR(Number.isNaN(value) ? 0 : value)}`}
        />
      }
    >
      <form id="payment-form" onSubmit={submit} className="space-y-4" noValidate>
        <JobSummary request={request} />
        <dl className="rounded-2xl border border-line divide-y divide-line/70 text-sm">
          {declined ? (
            <>
              <div className="flex justify-between gap-3 px-3 py-2">
                <dt className="text-slate-600">Repair (declined)</dt>
                <dd className="text-slate-500">Not charged</dd>
              </div>
              {declinedFee(request) > 0 && (
                <div className="flex justify-between gap-3 px-3 py-2">
                  <dt className="text-slate-600">Declined-repair fee</dt>
                  <dd className="font-semibold tabular-nums">{formatINR(declinedFee(request))}</dd>
                </div>
              )}
            </>
          ) : (
            <div className="flex justify-between gap-3 px-3 py-2">
              <dt className="text-slate-600">{request.serviceType === 'REPAIR' ? 'Repair' : 'Stringing'}</dt>
              <dd className="font-semibold tabular-nums">{formatINR(request.serviceCharge)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3 px-3 py-2">
            <dt className="text-slate-600">Pickup & delivery</dt>
            <dd className="font-semibold tabular-nums">{request.pickupDeliveryCharge > 0 ? formatINR(request.pickupDeliveryCharge) : 'Free'}</dd>
          </div>
          {!declined && request.discount > 0 && (
            <div className="flex justify-between gap-3 px-3 py-2">
              <dt className="text-slate-600">Discount</dt>
              <dd className="font-semibold tabular-nums">−{formatINR(request.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3 px-3 py-2 bg-paper rounded-b-2xl">
            <dt className="font-bold text-slate-900">Amount due</dt>
            <dd className="font-bold text-slate-900 tabular-nums">{formatINR(due)}</dd>
          </div>
        </dl>

        <RupeeInput id="pay-amount" label="Amount received" value={amount} onChange={setAmount} />
        {differs && (
          <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 -mt-2">
            This is different from the amount due ({formatINR(due)}). Record the amount due — if the customer paid a different amount, ask the admin to record it.
          </p>
        )}

        <fieldset>
          <legend className={fieldLabel}>Paid by</legend>
          <div role="radiogroup" className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                onClick={() => setMethod(m)}
                className={`min-h-[44px] rounded-xl border text-sm font-bold transition-colors ${
                  method === m ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600' : 'border-line bg-white text-slate-700 hover:bg-paper'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </fieldset>

        {method === 'UPI' && (
          <div>
            <label htmlFor="pay-upi" className={fieldLabel}>
              UPI reference <span className="font-medium text-slate-400">(optional)</span>
            </label>
            <input
              id="pay-upi"
              type="text"
              inputMode="numeric"
              maxLength={40}
              value={upiRef}
              onChange={(e) => setUpiRef(e.target.value)}
              placeholder="12-digit UTR / transaction ID"
              className={inputCls}
            />
          </div>
        )}
        <div>
          <label htmlFor="pay-note" className={fieldLabel}>
            Note {method === 'Other' ? '' : <span className="font-medium text-slate-400">(optional)</span>}
          </label>
          <input
            id="pay-note"
            type="text"
            maxLength={160}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={method === 'Other' ? 'How was it paid?' : ''}
            className={inputCls}
          />
        </div>
        <p className="text-xs text-slate-600">
          Saving marks the request as paid and {declined ? 'closes it (returned without repair)' : 'completed'}.
        </p>
        <FieldError>{error}</FieldError>
      </form>
    </StaffDialog>
  );
};

// ---------------------------------------------------------------------------
// Correct the pickup distance (before payment)
// ---------------------------------------------------------------------------

export const DistanceDialog: React.FC<{
  request: ServiceRequest;
  distanceConfig: DistancePricingConfig;
  /** Same pricing as the server (AppContext.calculateDistanceCharge) - preview only. */
  chargeFor: (km: number) => { charge: number; isFree: boolean };
  onClose: () => void;
  /** Saves on the server; resolves with the updated request or rejects with the server's message. */
  onSubmit: (distanceKm: number, reason: string) => Promise<ServiceRequest>;
}> = ({ request, distanceConfig, chargeFor, onClose, onSubmit }) => {
  const currentKm = request.distanceKm ?? request.pickupAddress?.distanceKm ?? 0;
  const [km, setKm] = useState(String(currentKm || ''));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<ServiceRequest | null>(null);
  const value = km.trim() === '' ? NaN : Number(km);
  const valid = Number.isFinite(value) && value >= 0 && value <= 200;
  const rounded = valid ? Math.round(value * 10) / 10 : NaN;
  const preview = valid ? chargeFor(rounded) : null;
  // Charge when the dialog opened: `request` is replaced by the saved one after submit.
  const [oldCharge] = useState(() => request.pickupDeliveryCharge || 0);
  const source = distanceSourceInfo(request.pickupAddress);
  const maxKm = distanceConfig.maxServiceDistanceKm || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return setError('Enter the distance in km (0–200).');
    if (rounded === Math.round(currentKm * 10) / 10) return setError(`The distance is already ${currentKm} km.`);
    if (reason.trim().length < 3) return setError('Say why the distance is being corrected (e.g. "checked on Google Maps").');
    setError(null);
    setBusy(true);
    try {
      setSaved(await onSubmit(rounded, reason.trim()));
    } catch (err: any) {
      setError(err?.message || NOT_SAVED);
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    const newCharge = saved.pickupDeliveryCharge || 0;
    return (
      <StaffDialog
        title="Distance corrected"
        subtitle={<span className="font-mono">{saved.id}</span>}
        onClose={onClose}
        width="sm"
        footer={
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl bg-ink hover:bg-ink-hover text-white text-sm font-bold"
          >
            Done
          </button>
        }
      >
        <dl className="rounded-2xl border border-emerald-200 bg-emerald-50/60 divide-y divide-emerald-100 text-sm">
          <div className="flex justify-between gap-3 px-3 py-2">
            <dt className="text-slate-600">Distance</dt>
            <dd className="font-semibold tabular-nums">{saved.distanceKm} km</dd>
          </div>
          <div className="flex justify-between gap-3 px-3 py-2">
            <dt className="text-slate-600">Pickup & delivery</dt>
            <dd className="font-semibold tabular-nums">
              {newCharge > 0 ? formatINR(newCharge) : 'Free'}
              {newCharge !== oldCharge && <span className="text-slate-500 font-normal"> (was {oldCharge > 0 ? formatINR(oldCharge) : 'free'})</span>}
            </dd>
          </div>
          <div className="flex justify-between gap-3 px-3 py-2">
            <dt className="font-bold text-slate-900">To collect</dt>
            <dd className="font-bold tabular-nums">
              {saved.serviceType === 'REPAIR' && !saved.repairEstimate && !wasDeclined(saved)
                ? `${formatINR(newCharge)} + repair`
                : formatINR(amountDue(saved))}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-slate-600 mt-3">
          {newCharge !== oldCharge ? 'The customer has been told about the new charge.' : 'The charge did not change.'}
        </p>
      </StaffDialog>
    );
  }

  return (
    <StaffDialog
      title="Correct distance"
      subtitle={<span className="font-mono">{request.id}</span>}
      onClose={onClose}
      busy={busy}
      footer={<DialogButtons onCancel={onClose} busy={busy} form="distance-form" submitLabel="Save distance" busyLabel="Saving…" />}
    >
      <form id="distance-form" onSubmit={submit} className="space-y-4" noValidate>
        <JobSummary request={request} />
        <p className={`text-xs rounded-xl px-3 py-2 border ${source.needsCheck ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-paper border-line text-slate-700'}`}>
          Now <b>{currentKm} km</b> ({source.label}) · pickup & delivery {oldCharge > 0 ? formatINR(oldCharge) : 'free'}.
        </p>
        <div>
          <label htmlFor="dist-km" className={fieldLabel}>
            Road distance from the shop (km)
          </label>
          <input
            id="dist-km"
            type="number"
            inputMode="decimal"
            min="0"
            max="200"
            step="0.1"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            onFocus={(e) => e.target.select()}
            className={`${inputCls} tabular-nums`}
          />
          <p className="text-[11px] text-slate-500 mt-1">Free within {distanceConfig.freeRadiusKm} km.</p>
        </div>
        <div>
          <label htmlFor="dist-reason" className={fieldLabel}>
            Reason
          </label>
          <input
            id="dist-reason"
            type="text"
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. checked on Google Maps at pickup"
            className={inputCls}
          />
          <p className="text-[11px] text-slate-500 mt-1">Shown to the customer in their request timeline.</p>
        </div>
        {preview && (
          <dl className="rounded-2xl border border-line divide-y divide-line/70 text-sm">
            <div className="flex justify-between gap-3 px-3 py-2">
              <dt className="text-slate-600">New pickup & delivery</dt>
              <dd className="font-semibold tabular-nums">{preview.charge > 0 ? formatINR(preview.charge) : 'Free'}</dd>
            </div>
            {maxKm > 0 && rounded > maxKm && (
              <div className="px-3 py-2 text-xs text-amber-800 bg-amber-50">Beyond the usual {maxKm} km pickup area.</div>
            )}
          </dl>
        )}
        <FieldError>{error}</FieldError>
      </form>
    </StaffDialog>
  );
};


// ---------------------------------------------------------------------------
// Confirm a status change
// ---------------------------------------------------------------------------

export const ConfirmDialog: React.FC<{
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
  tone?: 'primary' | 'success';
  errorSince: ErrorSince;
}> = ({ title, message, confirmLabel, onClose, onConfirm, tone = 'primary', errorSince }) => {
  const [busy, setBusy] = useState(false);
  const { message: error, save } = useSaveError(errorSince);
  const confirm = () => save(onConfirm, onClose, setBusy);
  return (
    <StaffDialog
      title={title}
      onClose={onClose}
      busy={busy}
      role="alertdialog"
      width="sm"
      footer={<DialogButtons onCancel={onClose} busy={busy} onSubmit={confirm} submitLabel={confirmLabel} tone={tone} />}
    >
      <div className="text-sm text-slate-700 space-y-2">{message}</div>
      <FieldError>{error}</FieldError>
    </StaffDialog>
  );
};
