import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Phone } from 'lucide-react';
import type { SiteEvent } from '../../../types/content';
import { ApiError } from '../../../services/apiClient';
import { contentService } from '../../../services/contentService';
import { Dialog } from './Dialog';
import {
  categoryLabel,
  eventAction,
  eventDateLong,
  eventPhoto,
  feeText,
  hasFee,
  needsPartner,
  registrationStatus,
  spotsText,
} from './events';
import { formatDay, safeUrl, siteSrcSet } from './format';
import { useShop } from './shop';
import { Select, WhatsAppIcon, btn, cx, fieldControl, fieldHint, fieldLabel } from './ui';

interface EventDialogProps {
  event: SiteEvent | null;
  intent: 'details' | 'register';
  onClose: () => void;
  onRegistered: (event: SiteEvent) => void;
}

/** "+91 98765 43210" from any 10-digit input. */
function displayMobile(digits: string): string {
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/** Accepts "98765 43210", "+91 98765-43210", "09876543210" … → 10 digits, or null. */
function normaliseMobile(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

interface Registered {
  name: string;
  mobile: string;
  category: string;
}

export const EventDialog: React.FC<EventDialogProps> = ({ event, intent, onClose, onRegistered }) => {
  const SHOP = useShop();
  const nameRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState<SiteEvent | null>(event);
  // Registrations made on this page (kept while the page is open, so the success message
  // still shows after the event list refreshes, e.g. when the last place was taken).
  // A player may enter several categories, so this keeps a list per event.
  const [registered, setRegistered] = useState<Record<string, Registered[]>>({});
  const [addingAnother, setAddingAnother] = useState<string | null>(null);

  // Keep showing the last event while the dialog animates out / between opens.
  useEffect(() => {
    if (event) setOpened(event);
  }, [event]);

  const e = event || opened;
  const done = e ? registered[e.id] || [] : [];
  const showForm = !!e && e.registrationMode === 'form' && e.registrationOpen && (done.length === 0 || addingAnother === e.id);
  const remainingCategories = e ? e.categories.filter((c) => !done.some((d) => d.category === c)) : [];
  const canRegisterHere = !!e && e.registrationMode === 'form' && (e.registrationOpen || done.length > 0);

  useEffect(() => {
    if (!event || intent !== 'register' || !canRegisterHere) return;
    const t = window.setTimeout(() => formRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' }), 60);
    return () => clearTimeout(t);
  }, [event, intent, canRegisterHere]);

  if (!e) return null;
  const photo = eventPhoto(e);
  const action = eventAction(e, SHOP);
  const status = registrationStatus(e);
  const spots = spotsText(e);
  const mapUrl = safeUrl(e.venueMapUrl);

  const details: [string, React.ReactNode][] = [
    ['When', <>{eventDateLong(e)}{e.timeText ? <><br />{e.timeText}</> : null}</>],
    [
      'Where',
      <>
        {e.venue}
        {mapUrl && (
          <>
            <br />
            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-sportsBlue underline underline-offset-4">
              Open in Google Maps
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </>
        )}
      </>,
    ],
    ['Entry fee', feeText(e)],
  ];
  if (e.categories.length) details.push(['Categories', e.categories.join(', ')]);
  if (status) details.push(['Registration', [status, e.registrationOpen ? spots : null].filter(Boolean).join(' · ')]);

  return (
    <Dialog
      open={!!event}
      onClose={onClose}
      size="lg"
      title={e.title}
      description={`${categoryLabel(e)}${e.status === 'ongoing' ? ' · On now' : ''}`}
      initialFocusRef={intent === 'register' && canRegisterHere ? nameRef : undefined}
      media={
        photo.desktop ? (
          <div className="relative aspect-[16/7] max-h-[34vh] w-full bg-paper-deep">
            <img
              src={photo.desktop}
              srcSet={siteSrcSet(photo.desktop)}
              sizes="(min-width: 768px) 768px, 100vw"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        ) : undefined
      }
    >
      <dl className="grid gap-x-8 gap-y-4 border-y border-line py-5 sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[13px] font-medium text-ink-muted">{label}</dt>
            <dd className="mt-0.5 text-[15px] leading-relaxed text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {(e.summary || e.description) && (
        <div className="mt-5 space-y-3 text-[15px] leading-relaxed text-ink-soft">
          {e.summary && <p className="font-medium text-ink">{e.summary}</p>}
          {e.description && <p className="whitespace-pre-line break-words">{e.description}</p>}
        </div>
      )}

      <div ref={formRef} className="mt-6 scroll-mt-4">
        {done.length > 0 && (
          <div role="status" className="mb-5 rounded-xl border border-[#BFE3CC] bg-[#F1FAF4] p-5">
            <p className="flex items-center gap-2 font-display text-[24px] font-semibold text-ink">
              <CheckCircle2 className="h-6 w-6 text-[#1E7A44]" aria-hidden="true" />
              You're registered
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              {done[done.length - 1].name}, we've noted your entry for {e.title}
              {done.some((d) => d.category) ? ` (${done.map((d) => d.category).filter(Boolean).join(', ')})` : ''}. We'll call you on{' '}
              {displayMobile(done[done.length - 1].mobile)} to confirm.
            </p>
            {!showForm && e.registrationOpen && remainingCategories.length > 0 && done.some((d) => d.category) && (
              <button type="button" onClick={() => setAddingAnother(e.id)} className={cx(btn.link, 'mt-1')}>
                Enter another category
              </button>
            )}
          </div>
        )}
        {showForm ? (
          <RegistrationForm
            key={`${e.id}-${done.length}`}
            event={e}
            categories={done.length ? remainingCategories : e.categories}
            initial={done[done.length - 1]}
            nameRef={nameRef}
            onRegistered={(result) => {
              setRegistered((prev) => ({ ...prev, [e.id]: [...(prev[e.id] || []), result] }));
              setAddingAnother(null);
              onRegistered(e);
            }}
          />
        ) : done.length > 0 || canRegisterHere ? null : e.registrationMode === 'none' ? (
          <p className="rounded-xl bg-paper px-4 py-3 text-[15px] text-ink-soft">No registration needed.</p>
        ) : !e.registrationOpen ? (
          <p className="rounded-xl bg-paper px-4 py-3 text-[15px] text-ink-soft">
            {status === 'Registrations full' ? 'All places have been taken.' : 'Registration for this event has closed.'} Questions? Call{' '}
            <a href={SHOP.phoneTel} className="font-semibold text-sportsBlue underline underline-offset-2">
              {SHOP.phoneDisplay}
            </a>
            .
          </p>
        ) : action.kind === 'link' ? (
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={action.href}
              className={cx(btn.base, btn.primary, 'px-6')}
              {...(action.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {e.registrationMode === 'whatsapp' && <WhatsAppIcon className="h-4 w-4" />}
              {e.registrationMode === 'phone' && <Phone className="h-4 w-4" aria-hidden="true" />}
              {action.label}
              {e.registrationMode === 'url' && <ExternalLink className="h-4 w-4" aria-hidden="true" />}
            </a>
            {e.registrationDeadline && <span className="text-[14px] text-ink-muted">Register by {formatDay(e.registrationDeadline)}</span>}
          </div>
        ) : null}
      </div>

      <p className="mt-6 text-[14px] text-ink-muted">
        Questions about this event? Call{' '}
        <a href={SHOP.phoneTel} className="font-medium text-ink underline underline-offset-2">
          {SHOP.phoneDisplay}
        </a>{' '}
        or{' '}
        <a
          href={SHOP.whatsAppLink(SHOP.greeting(`I have a question about ${e.title}.`))}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-ink underline underline-offset-2"
        >
          message us on WhatsApp
        </a>
        .
      </p>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Registration form (registrationMode 'form')
// ---------------------------------------------------------------------------

const RegistrationForm: React.FC<{
  event: SiteEvent;
  /** Categories offered (the event's, minus ones already entered on this page). */
  categories: string[];
  initial?: Registered;
  nameRef: React.RefObject<HTMLInputElement>;
  onRegistered: (result: Registered) => void;
}> = ({ event, categories, initial, nameRef, onRegistered }) => {
  const SHOP = useShop();
  const uid = useId();
  const [name, setName] = useState(initial?.name || '');
  const [mobile, setMobile] = useState(initial ? `${initial.mobile.slice(0, 5)} ${initial.mobile.slice(5)}` : '');
  const [category, setCategory] = useState(categories.length === 1 ? categories[0] : '');
  const [partner, setPartner] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const showPartner = needsPartner(category);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const next: Record<string, string> = {};
    const cleanName = name.trim().replace(/\s+/g, ' ');
    const digits = normaliseMobile(mobile);
    if (cleanName.length < 2) next.name = 'Please enter your name.';
    if (!digits) next.mobile = 'Enter a 10-digit Indian mobile number.';
    if (categories.length && !category) next.category = 'Choose the category you want to play.';
    setErrors(next);
    setServerError('');
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0];
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await contentService.registerForEvent(event.id, {
        name: cleanName,
        mobile: digits as string,
        partnerName: showPartner && partner.trim() ? partner.trim() : undefined,
        playCategory: category || undefined,
        notes: notes.trim() || undefined,
      });
      onRegistered({ name: cleanName, mobile: digits as string, category });
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setServerError(`We couldn't reach the ${SHOP.name} server. Check your connection and try again, or call ${SHOP.phoneDisplay}.`);
      } else if (err instanceof ApiError && err.status === 429) {
        setServerError(`Too many attempts from this device. Please wait a few minutes, or call ${SHOP.phoneDisplay} to register.`);
      } else {
        setServerError(err instanceof Error && err.message ? err.message : 'Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fid = (n: string) => `${uid}-${n}`;
  return (
    <form onSubmit={submit} noValidate className="rounded-xl border border-line p-5 sm:p-6">
      <h3 className="font-display text-[24px] font-semibold text-ink">Register</h3>
      <p className="mt-1 text-[14px] text-ink-muted">
        {[registrationStatus(event), spotsText(event)].filter(Boolean).join(' · ')}
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={fid('name')} className={fieldLabel}>
            Your name
          </label>
          <input
            ref={nameRef}
            id={fid('name')}
            type="text"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            aria-invalid={errors.name ? 'true' : undefined}
            aria-describedby={errors.name ? fid('name-err') : undefined}
            className={fieldControl}
          />
          {errors.name && (
            <p id={fid('name-err')} className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-flameRed">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={fid('mobile')} className={fieldLabel}>
            Mobile number
          </label>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-xl border border-r-0 border-line bg-paper px-3 text-[15px] text-ink-soft" aria-hidden="true">
              +91
            </span>
            <input
              id={fid('mobile')}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={14}
              placeholder="98765 43210"
              value={mobile}
              onChange={(ev) => setMobile(ev.target.value)}
              aria-invalid={errors.mobile ? 'true' : undefined}
              aria-describedby={cx(fid('mobile-hint'), errors.mobile && fid('mobile-err')) || undefined}
              className={cx(fieldControl, 'rounded-l-none')}
            />
          </div>
          <p id={fid('mobile-hint')} className={fieldHint}>
            We call this number to confirm.
          </p>
          {errors.mobile && (
            <p id={fid('mobile-err')} className="mt-1 flex items-start gap-1.5 text-[13px] font-medium text-flameRed">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {errors.mobile}
            </p>
          )}
        </div>

        {categories.length > 0 && (
          <div>
            <label htmlFor={fid('category')} className={fieldLabel}>
              Category
            </label>
            <Select
              id={fid('category')}
              value={category}
              onChange={(ev) => setCategory(ev.target.value)}
              aria-invalid={errors.category ? 'true' : undefined}
              aria-describedby={errors.category ? fid('category-err') : undefined}
            >
              {categories.length > 1 && <option value="">Choose a category</option>}
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            {errors.category && (
              <p id={fid('category-err')} className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-flameRed">
                <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {errors.category}
              </p>
            )}
          </div>
        )}

        {showPartner && (
          <div>
            <label htmlFor={fid('partner')} className={fieldLabel}>
              Partner's name <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id={fid('partner')}
              type="text"
              maxLength={80}
              value={partner}
              onChange={(ev) => setPartner(ev.target.value)}
              className={fieldControl}
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <label htmlFor={fid('notes')} className={fieldLabel}>
            Anything we should know? <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <textarea
            id={fid('notes')}
            rows={2}
            maxLength={500}
            value={notes}
            onChange={(ev) => setNotes(ev.target.value)}
            placeholder="e.g. age for junior categories, club name"
            className={cx(fieldControl, 'py-2.5 leading-relaxed')}
          />
        </div>
      </div>

      {serverError && (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-[#F3C9C9] bg-[#FDF3F3] px-4 py-3 text-[14px] text-[#8A1F1F]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{serverError}</span>
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14px] text-ink-muted sm:max-w-[340px]">
          {hasFee(event) ? `Entry fee: ${feeText(event)}.` : 'Free entry.'} We'll call you to confirm your place.
        </p>
        <button type="submit" disabled={submitting} className={cx(btn.base, btn.primary, 'px-7')}>
          {submitting ? 'Registering…' : 'Register'}
        </button>
      </div>
    </form>
  );
};
