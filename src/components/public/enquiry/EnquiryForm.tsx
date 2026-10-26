import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Enquiry, EnquiryInput, EnquiryKind } from '../../../types/content';
import { ApiError } from '../../../services/apiClient';
import { contentService } from '../../../services/contentService';
import { displayMobile, localIsoDate, normaliseMobile } from '../home/format';
import { useShop } from '../home/shop';
import { FieldError, btn, cx, fieldControl, fieldHint, fieldLabel } from '../home/ui';

/** What each kind of request asks for, beyond name and mobile. */
const KIND_FIELDS: Record<EnquiryKind, { dateLabel: string; notesLabel: string; notesPlaceholder: string }> = {
  academy: {
    dateLabel: 'When would you like to start?',
    notesLabel: 'Anything the coach should know?',
    notesPlaceholder: "e.g. player's age, how long they have played",
  },
  tournament: {
    dateLabel: 'Tournament date',
    notesLabel: 'Tell us what you need',
    notesPlaceholder: 'e.g. number of courts and days, how many players, quantities',
  },
  custom_tshirt: {
    dateLabel: 'Needed by',
    notesLabel: 'Describe the T-shirts',
    notesPlaceholder: 'e.g. colours, logo, names and numbers on the back, sizes',
  },
};

const NOTES_MAX = 1000;
const QUANTITY_MAX = 5000;

export interface EnquiryFormProps {
  kind: EnquiryKind;
  /** Sent with every request of this form, e.g. the academy or the department. */
  fixed?: Pick<EnquiryInput, 'academyId' | 'department'>;
  /** Academy batches to choose from (one is required when there are any). */
  batches?: string[];
  /** "Book a slot", "Send request" … */
  submitLabel: string;
  /** Shown after sending, e.g. "We'll call you to fix the batch." */
  nextStep: string;
  onDone: () => void;
}

/**
 * Request form for academy slots, tournament organizing and custom T-shirts: name, mobile and
 * the fields that kind needs. Nothing to pay; the shop calls back. After sending it shows the
 * request number in place of the form.
 */
export const EnquiryForm: React.FC<EnquiryFormProps> = ({ kind, fixed, batches = [], submitLabel, nextStep, onDone }) => {
  const SHOP = useShop();
  const uid = useId();
  const fid = (n: string) => `${uid}-${n}`;
  const labels = KIND_FIELDS[kind];

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [batch, setBatch] = useState(batches.length === 1 ? batches[0] : '');
  const [location, setLocation] = useState('');
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<Enquiry | null>(null);

  const today = new Date();
  const minDate = localIsoDate(today);
  const maxDate = localIsoDate(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate() - 1));

  const clearError = (field: string) => setErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const next: Record<string, string> = {};
    const cleanName = name.trim().replace(/\s+/g, ' ');
    const digits = normaliseMobile(mobile);
    const count = quantity.trim() ? Number(quantity) : null;
    if (batches.length && !batch) next.batch = 'Choose a batch.';
    if (kind === 'custom_tshirt') {
      if (count !== null && !(Number.isInteger(count) && count >= 1 && count <= QUANTITY_MAX)) {
        next.quantity = `Enter a number from 1 to ${QUANTITY_MAX.toLocaleString('en-IN')}.`;
      } else if (count === null && !notes.trim()) {
        next.quantity = 'Tell us how many you need, or describe them below.';
      }
    }
    if (date && (date < minDate || date > maxDate)) next.date = 'Choose a date in the next 12 months.';
    if (cleanName.length < 2) next.name = 'Please enter your name.';
    if (!digits) next.mobile = 'Enter a 10-digit Indian mobile number.';
    setErrors(next);
    setServerError('');
    const first = Object.keys(next)[0];
    if (first) {
      const target =
        first === 'batch' ? document.querySelector<HTMLInputElement>(`input[name="${fid('batch')}"]`) : document.getElementById(fid(first));
      target?.focus();
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await contentService.submitEnquiry({
        kind,
        ...fixed,
        name: cleanName,
        mobile: digits as string,
        batch: batch || undefined,
        location: kind === 'tournament' ? location.trim() || undefined : undefined,
        quantity: kind === 'custom_tshirt' ? count : undefined,
        date: date || undefined,
        notes: notes.trim() || undefined,
      });
      setSent(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setServerError(`We couldn't reach the ${SHOP.name} server. Check your connection and try again, or call ${SHOP.phoneDisplay}.`);
      } else if (err instanceof ApiError && err.status === 429) {
        setServerError(`Too many requests from this number or device. Please wait a while, or call ${SHOP.phoneDisplay}.`);
      } else {
        setServerError(err instanceof Error && err.message ? err.message : `Sending failed. Please try again, or call ${SHOP.phoneDisplay}.`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) return <EnquirySent enquiry={sent} nextStep={nextStep} onDone={onDone} />;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {batches.length > 0 && (
        <fieldset aria-describedby={errors.batch ? fid('batch-err') : undefined}>
          <legend className={fieldLabel}>Which batch?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {batches.map((b) => (
              <label
                key={b}
                className={cx(
                  'flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border bg-white px-3.5 py-2 text-[15px] leading-snug text-ink transition-colors',
                  'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-sportsBlue',
                  b === batch ? 'border-ink ring-1 ring-ink' : errors.batch ? 'border-flameRed' : 'border-line hover:border-ink/40',
                )}
              >
                <input
                  type="radio"
                  name={fid('batch')}
                  value={b}
                  checked={b === batch}
                  onChange={() => {
                    setBatch(b);
                    clearError('batch');
                  }}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cx('flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2', b === batch ? 'border-ink' : 'border-ink/30')}
                >
                  {b === batch && <span className="h-2 w-2 rounded-full bg-ink" />}
                </span>
                <span className={cx(b === batch && 'font-medium')}>{b}</span>
              </label>
            ))}
          </div>
          {errors.batch && <FieldError id={fid('batch-err')}>{errors.batch}</FieldError>}
        </fieldset>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={fid('name')} className={fieldLabel}>
            Your name
          </label>
          <input
            id={fid('name')}
            type="text"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(ev) => {
              setName(ev.target.value);
              clearError('name');
            }}
            aria-invalid={errors.name ? 'true' : undefined}
            aria-describedby={errors.name ? fid('name-err') : undefined}
            className={fieldControl}
          />
          {errors.name && <FieldError id={fid('name-err')}>{errors.name}</FieldError>}
        </div>
        <div>
          <label htmlFor={fid('mobile')} className={fieldLabel}>
            Mobile number
          </label>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-xl border border-r-0 border-line bg-paper-deep/60 px-3 text-[15px] text-ink-soft" aria-hidden="true">
              +91
            </span>
            <input
              id={fid('mobile')}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={20}
              placeholder="98765 43210"
              value={mobile}
              onChange={(ev) => {
                setMobile(ev.target.value);
                clearError('mobile');
              }}
              aria-invalid={errors.mobile ? 'true' : undefined}
              aria-describedby={cx(fid('mobile-hint'), errors.mobile && fid('mobile-err')) || undefined}
              className={cx(fieldControl, 'rounded-l-none')}
            />
          </div>
          {errors.mobile ? (
            <FieldError id={fid('mobile-err')}>{errors.mobile}</FieldError>
          ) : (
            <p id={fid('mobile-hint')} className={fieldHint}>
              We call this number back.
            </p>
          )}
        </div>
      </div>

      {kind === 'tournament' && (
        <div>
          <label htmlFor={fid('location')} className={fieldLabel}>
            Where is the tournament? <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <input
            id={fid('location')}
            type="text"
            maxLength={200}
            placeholder="Venue or area"
            value={location}
            onChange={(ev) => setLocation(ev.target.value)}
            className={fieldControl}
          />
        </div>
      )}

      <div className={cx('grid gap-5', kind === 'custom_tshirt' && 'sm:grid-cols-2')}>
        {kind === 'custom_tshirt' && (
          <div>
            <label htmlFor={fid('quantity')} className={fieldLabel}>
              How many T-shirts?
            </label>
            <input
              id={fid('quantity')}
              type="number"
              inputMode="numeric"
              min={1}
              max={QUANTITY_MAX}
              step={1}
              value={quantity}
              onChange={(ev) => {
                setQuantity(ev.target.value);
                clearError('quantity');
              }}
              aria-invalid={errors.quantity ? 'true' : undefined}
              aria-describedby={errors.quantity ? fid('quantity-err') : undefined}
              className={fieldControl}
            />
            {errors.quantity && <FieldError id={fid('quantity-err')}>{errors.quantity}</FieldError>}
          </div>
        )}
        <div>
          <label htmlFor={fid('date')} className={fieldLabel}>
            {labels.dateLabel} <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <input
            id={fid('date')}
            type="date"
            min={minDate}
            max={maxDate}
            value={date}
            onChange={(ev) => {
              setDate(ev.target.value);
              clearError('date');
            }}
            aria-invalid={errors.date ? 'true' : undefined}
            aria-describedby={errors.date ? fid('date-err') : undefined}
            className={cx(fieldControl, kind !== 'custom_tshirt' && 'sm:max-w-[260px]')}
          />
          {errors.date && <FieldError id={fid('date-err')}>{errors.date}</FieldError>}
        </div>
      </div>

      <div>
        <label htmlFor={fid('notes')} className={fieldLabel}>
          {labels.notesLabel} <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <textarea
          id={fid('notes')}
          rows={3}
          maxLength={NOTES_MAX}
          value={notes}
          onChange={(ev) => {
            setNotes(ev.target.value);
            if (kind === 'custom_tshirt') clearError('quantity');
          }}
          placeholder={labels.notesPlaceholder}
          className={cx(fieldControl, 'py-2.5 leading-relaxed')}
        />
      </div>

      {serverError && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-[#F3C9C9] bg-[#FDF3F3] px-4 py-3 text-[14px] text-[#8A1F1F]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{serverError}</span>
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14px] text-ink-muted">Nothing to pay now. We'll call you to confirm.</p>
        <button type="submit" disabled={submitting} className={cx(btn.base, btn.primary, 'shrink-0 px-7')}>
          {submitting ? 'Sending…' : submitLabel}
        </button>
      </div>
    </form>
  );
};

const EnquirySent: React.FC<{ enquiry: Enquiry; nextStep: string; onDone: () => void }> = ({ enquiry, nextStep, onDone }) => {
  const doneRef = useRef<HTMLButtonElement>(null);
  useEffect(() => doneRef.current?.focus({ preventScroll: true }), []);
  const digits = normaliseMobile(enquiry.mobile);
  return (
    <div role="status">
      <CheckCircle2 className="h-10 w-10 text-[#1E7A44]" aria-hidden="true" />
      <h3 className="mt-3 font-display text-[28px] font-semibold leading-tight text-ink">Request sent</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        Thanks, {enquiry.name}. {nextStep} We'll call you on{' '}
        <span className="whitespace-nowrap font-medium text-ink">{digits ? displayMobile(digits) : enquiry.mobile}</span>.
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-line bg-paper px-4 py-3">
        <div>
          <dt className="text-[13px] text-ink-muted">Request number</dt>
          <dd className="mt-0.5 font-display text-[20px] font-semibold tabular-nums text-ink">{enquiry.id}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[13px] text-ink-muted">For</dt>
          <dd className="mt-0.5 truncate text-[15px] font-medium text-ink">{[enquiry.subject, enquiry.batch].filter(Boolean).join(' · ')}</dd>
        </div>
      </dl>
      <button ref={doneRef} type="button" onClick={onDone} className={cx(btn.base, btn.primary, 'mt-6 px-7')}>
        Done
      </button>
    </div>
  );
};
