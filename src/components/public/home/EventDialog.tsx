import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CalendarDays, CheckCircle2, ExternalLink, MapPin, Phone, Ticket, Users, X } from 'lucide-react';
import type { SiteEvent } from '../../../types/content';
import { ApiError } from '../../../services/apiClient';
import { contentService } from '../../../services/contentService';
import { useModalBehavior } from './Dialog';
import {
  categoryLabel,
  eventAction,
  eventDateLong,
  eventPhoto,
  feeText,
  needsPartner,
  registrationStatus,
  spotsText,
} from './events';
import { formatDay, safeUrl, siteSrcSet } from './format';
import { useShop } from './shop';
import { WhatsAppIcon, btn, cx, fieldControl, fieldHint, fieldLabel } from './ui';

interface EventDialogProps {
  event: SiteEvent | null;
  /** Which button opened it. Both layouts show the form without scrolling, so the layout doesn't depend on it. */
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

/**
 * Event details + registration. Website-form events open as two panes on wide screens
 * (what the event is on the left, the form on the right, both visible at once); on phones
 * the key facts come first, then the form, then the full write-up. Other events (WhatsApp,
 * call, external link, closed) open as a single column with their action above the write-up.
 */
export const EventDialog: React.FC<EventDialogProps> = ({ event, onClose, onRegistered }) => {
  const SHOP = useShop();
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  // Once the title scrolls away (phones, long single-column dialogs) a slim bar keeps the
  // event name in view and gives the close button a solid background.
  const [scrolledPastTitle, setScrolledPastTitle] = useState(false);
  // Registrations made on this page (kept while the page is open, so the success message
  // still shows after the event list refreshes, e.g. when the last place was taken).
  // A player may enter several categories, so this keeps a list per event.
  const [registered, setRegistered] = useState<Record<string, Registered[]>>({});
  const [addingAnother, setAddingAnother] = useState<string | null>(null);
  useModalBehavior(!!event, panelRef, onClose);

  useEffect(() => {
    setScrolledPastTitle(false);
    const title = titleRef.current;
    const root = overlayRef.current;
    if (!title || !root || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setScrolledPastTitle(!entry.isIntersecting && entry.boundingClientRect.top < 0), {
      root,
      rootMargin: '-60px 0px 0px 0px',
    });
    io.observe(title);
    return () => io.disconnect();
  }, [event?.id]);

  if (!event) return null;
  const e = event;

  const done = registered[e.id] || [];
  const canRegisterHere = e.registrationMode === 'form' && (e.registrationOpen || done.length > 0);
  const showForm = canRegisterHere && e.registrationOpen && (done.length === 0 || addingAnother === e.id);
  const remainingCategories = e.categories.filter((c) => !done.some((d) => d.category === c));
  const photo = eventPhoto(e);

  const topBar = (
    <div className={cx('sticky top-0 z-20 h-0', canRegisterHere && 'md:absolute md:inset-x-0')}>
      <div
        aria-hidden="true"
        className={cx(
          'absolute inset-x-0 top-0 flex h-[68px] items-center border-b border-line bg-white/95 pl-5 pr-20 backdrop-blur-sm transition-opacity duration-150 sm:pl-7',
          scrolledPastTitle ? 'opacity-100' : 'pointer-events-none opacity-0',
          canRegisterHere && 'md:hidden',
        )}
      >
        <p className="truncate font-display text-[20px] font-semibold text-ink">{e.title}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-ink shadow-sm ring-1 ring-black/5 transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue"
        aria-label="Close"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );

  const photoBlock = photo.desktop ? (
    <div className={cx('relative w-full bg-paper-deep', canRegisterHere ? 'aspect-[5/2] md:aspect-[2/1] md:max-h-[32vh]' : 'aspect-[16/7] max-h-[34vh]')}>
      <img
        src={photo.desktop}
        srcSet={siteSrcSet(photo.desktop)}
        sizes={canRegisterHere ? '(min-width: 768px) 460px, 100vw' : '(min-width: 768px) 768px, 100vw'}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  ) : null;

  const heading = (
    <div className={cx(!photo.desktop && 'pr-12')}>
      <p className="text-[13px] font-semibold text-[#9A6B00]">
        {categoryLabel(e)}
        {e.status === 'ongoing' ? ' · On now' : ''}
      </p>
      <h2 ref={titleRef} id={titleId} className="mt-1 font-display text-[28px] font-semibold leading-[1.06] text-ink text-balance sm:text-[30px]">
        {e.title}
      </h2>
      {e.summary && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{e.summary}</p>}
    </div>
  );

  let body: React.ReactNode;
  if (canRegisterHere) {
    body = (
      <div className="md:flex md:h-[min(660px,calc(100dvh-48px))]">
        {/* What the event is */}
        <div className="md:w-[44%] md:shrink-0 md:overflow-y-auto md:overscroll-contain md:border-r md:border-line">
          {photoBlock}
          <div className="px-5 pb-6 pt-5 sm:px-7">
            {heading}
            <EventFacts event={e} className="mt-5" />
            <div className="hidden md:block">
              <EventAbout event={e} />
              <EventQuestions event={e} />
            </div>
          </div>
        </div>

        {/* Registration */}
        <div className="border-t border-line bg-paper md:flex md:min-w-0 md:flex-1 md:flex-col md:border-t-0">
          {showForm ? (
            <RegistrationForm
              key={`${e.id}-${done.length}`}
              event={e}
              categories={done.length ? remainingCategories : e.categories}
              initial={done[done.length - 1]}
              earlier={done}
              onRegistered={(result) => {
                setRegistered((prev) => ({ ...prev, [e.id]: [...(prev[e.id] || []), result] }));
                setAddingAnother(null);
                onRegistered(e);
              }}
            />
          ) : (
            <RegisteredPanel
              event={e}
              entries={done}
              canAddAnother={e.registrationOpen && remainingCategories.length > 0 && done.some((d) => d.category)}
              onAddAnother={() => setAddingAnother(e.id)}
              onClose={onClose}
            />
          )}
        </div>

        <div className="px-5 pb-8 sm:px-7 md:hidden">
          <EventAbout event={e} />
          <EventQuestions event={e} />
        </div>
      </div>
    );
  } else {
    body = (
      <>
        {photoBlock}
        <div className="px-5 pb-7 pt-5 sm:px-7 sm:pt-6">
          {heading}
          <EventFacts event={e} showCategories className="mt-5" />
          <EventAction event={e} />
          <EventAbout event={e} />
          <EventQuestions event={e} />
        </div>
      </>
    );
  }

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-ink/60"
      onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}
    >
      <div className="flex min-h-full items-end justify-center sm:items-center sm:p-6" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cx(
            'relative w-full overflow-clip rounded-t-2xl bg-white text-ink shadow-2xl outline-none animate-in fade-in sm:rounded-xl',
            canRegisterHere ? 'max-w-5xl' : 'max-w-3xl',
          )}
        >
          {topBar}
          {body}
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ---------------------------------------------------------------------------
// Event information
// ---------------------------------------------------------------------------

const Fact: React.FC<{ icon: React.ElementType; label: string; children: React.ReactNode }> = ({ icon: Icon, label, children }) => (
  <div className="flex gap-3 py-3">
    <Icon className="mt-px h-[18px] w-[18px] shrink-0 text-ink-muted sm:mt-0.5" aria-hidden="true" />
    <div className="min-w-0">
      {/* Phones: the icon says it, so the label is for screen readers only. */}
      <dt className="sr-only text-[13px] text-ink-muted sm:not-sr-only">{label}</dt>
      <dd className="text-[15px] leading-snug text-ink sm:mt-0.5">{children}</dd>
    </div>
  </div>
);

/** When / where / fee (and categories), each on its own line. */
const EventFacts: React.FC<{ event: SiteEvent; showCategories?: boolean; className?: string }> = ({ event: e, showCategories, className }) => {
  const mapUrl = safeUrl(e.venueMapUrl);
  return (
    <dl className={cx('divide-y divide-line border-y border-line', className)}>
      <Fact icon={CalendarDays} label="When">
        <span className="font-medium">{eventDateLong(e)}</span>
        {e.timeText && <span className="block text-ink-soft">{e.timeText}</span>}
      </Fact>
      <Fact icon={MapPin} label="Where">
        {e.venue}
        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 flex w-fit items-center gap-1 rounded text-[14px] font-semibold text-sportsBlue underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue"
          >
            Open in Google Maps
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
      </Fact>
      <Fact icon={Ticket} label="Entry fee">
        <span className="font-medium tabular-nums">{feeText(e)}</span>
      </Fact>
      {showCategories && e.categories.length > 0 && (
        <Fact icon={Users} label="Categories">
          {e.categories.join(', ')}
        </Fact>
      )}
    </dl>
  );
};

const EventAbout: React.FC<{ event: SiteEvent }> = ({ event: e }) =>
  e.description ? (
    <section className="mt-6">
      <h3 className="text-[15px] font-semibold text-ink">About this event</h3>
      <p className="mt-2 whitespace-pre-line break-words text-[15px] leading-relaxed text-ink-soft">{e.description}</p>
    </section>
  ) : null;

const EventQuestions: React.FC<{ event: SiteEvent }> = ({ event: e }) => {
  const SHOP = useShop();
  return (
    <p className="mt-6 text-[14px] leading-relaxed text-ink-muted">
      Questions? Call{' '}
      <a href={SHOP.phoneTel} className="whitespace-nowrap font-medium text-ink underline underline-offset-2">
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
  );
};

/** Single-column dialogs: how to register (WhatsApp, call, link) or why you can't. */
const EventAction: React.FC<{ event: SiteEvent }> = ({ event: e }) => {
  const SHOP = useShop();
  const action = eventAction(e, SHOP);
  if (e.registrationMode === 'none') {
    return <p className="mt-5 rounded-xl bg-paper px-4 py-3 text-[15px] text-ink-soft">No registration needed.</p>;
  }
  if (!e.registrationOpen) {
    return (
      <p className="mt-5 rounded-xl bg-paper px-4 py-3 text-[15px] text-ink-soft">
        {registrationStatus(e) === 'Registrations full' ? 'All places have been taken.' : 'Registration for this event has closed.'}
      </p>
    );
  }
  if (action.kind !== 'link') return null;
  return (
    <div className="mt-5 flex flex-col gap-2 rounded-xl bg-paper p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[15px] text-ink-soft">
        {e.registrationDeadline ? `Register by ${formatDay(e.registrationDeadline)}.` : 'Registration is open.'}
      </p>
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
    </div>
  );
};

// ---------------------------------------------------------------------------
// After registering
// ---------------------------------------------------------------------------

const RegisteredPanel: React.FC<{
  event: SiteEvent;
  entries: Registered[];
  canAddAnother: boolean;
  onAddAnother: () => void;
  onClose: () => void;
}> = ({ event: e, entries, canAddAnother, onAddAnother, onClose }) => {
  const last = entries[entries.length - 1];
  const rootRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    doneRef.current?.focus({ preventScroll: true });
    if ((rootRef.current?.getBoundingClientRect().top ?? 0) < 0) rootRef.current?.scrollIntoView({ block: 'start' });
  }, []);
  if (!last) return null;
  const categories = entries.map((d) => d.category).filter(Boolean);
  return (
    <div ref={rootRef} role="status" className="flex flex-1 scroll-mt-0 flex-col justify-center px-5 pb-8 pt-20 sm:px-7 md:px-10 md:pt-8">
      <CheckCircle2 className="h-10 w-10 text-[#1E7A44]" aria-hidden="true" />
      <h3 className="mt-3 font-display text-[30px] font-semibold leading-tight text-ink">You're registered</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        Thanks, {last.name}. Your entry for {e.title} is in. We'll call you on{' '}
        <span className="whitespace-nowrap font-medium text-ink">{displayMobile(last.mobile)}</span> to confirm your place.
      </p>
      {categories.length > 0 && (
        <dl className="mt-5 rounded-xl border border-line bg-white px-4 py-3">
          <dt className="text-[13px] text-ink-muted">{categories.length > 1 ? 'Your categories' : 'Your category'}</dt>
          <dd className="mt-0.5 text-[15px] font-medium text-ink">{categories.join(', ')}</dd>
        </dl>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button ref={doneRef} type="button" onClick={onClose} className={cx(btn.base, btn.primary, 'px-7')}>
          Done
        </button>
        {canAddAnother && (
          <button type="button" onClick={onAddAnother} className={cx(btn.base, btn.secondary, 'px-6')}>
            Enter another category
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Registration form (registrationMode 'form')
// ---------------------------------------------------------------------------

const FieldError: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
  <p id={id} className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-flameRed">
    <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    {children}
  </p>
);

const RegistrationForm: React.FC<{
  event: SiteEvent;
  /** Categories offered (the event's, minus ones already entered on this page). */
  categories: string[];
  initial?: Registered;
  /** Entries already made on this page (shown above the form when adding another category). */
  earlier: Registered[];
  onRegistered: (result: Registered) => void;
}> = ({ event, categories, initial, earlier, onRegistered }) => {
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
  const status = [registrationStatus(event), spotsText(event)].filter(Boolean).join(' · ');

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const next: Record<string, string> = {};
    const cleanName = name.trim().replace(/\s+/g, ' ');
    const digits = normaliseMobile(mobile);
    if (categories.length && !category) next.category = 'Choose the category you want to play.';
    if (cleanName.length < 2) next.name = 'Please enter your name.';
    if (!digits) next.mobile = 'Enter a 10-digit Indian mobile number.';
    setErrors(next);
    setServerError('');
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0];
      const target =
        first === 'category'
          ? document.querySelector<HTMLInputElement>(`input[name="${uid}-category"]`)
          : document.getElementById(`${uid}-${first}`);
      target?.focus();
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
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
    <form onSubmit={submit} noValidate aria-labelledby={fid('heading')} className="flex flex-col md:min-h-0 md:flex-1">
      <div className="px-5 pt-6 sm:px-7 md:pr-20 md:pt-7">
        <h3 id={fid('heading')} className="font-display text-[26px] font-semibold leading-tight text-ink">
          {earlier.length ? 'Enter another category' : 'Register for this event'}
        </h3>
        {status && <p className="mt-1 text-[14px] text-ink-muted">{status}</p>}
      </div>

      <div className="px-5 sm:px-7 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain">
        <div className="space-y-5 pb-6 pt-5">
          {earlier.length > 0 && (
            <p className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-[14px] text-ink-soft">
              Already entered: <span className="font-medium text-ink">{earlier.map((d) => d.category).filter(Boolean).join(', ')}</span>
            </p>
          )}
          {categories.length > 0 && (
            <fieldset aria-describedby={errors.category ? fid('category-err') : undefined}>
              <legend className={fieldLabel}>{categories.length > 1 ? 'Which category will you play?' : 'Category'}</legend>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((c) => (
                  <label
                    key={c}
                    className={cx(
                      'flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-[14px] leading-snug text-ink transition-colors sm:gap-3 sm:px-3.5 sm:text-[15px]',
                      'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-sportsBlue',
                      c === category ? 'border-ink ring-1 ring-ink' : errors.category ? 'border-flameRed' : 'border-line hover:border-ink/40',
                    )}
                  >
                    <input
                      type="radio"
                      name={fid('category')}
                      value={c}
                      checked={c === category}
                      onChange={() => {
                        setCategory(c);
                        setErrors((prev) => ({ ...prev, category: '' }));
                      }}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={cx(
                        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2',
                        c === category ? 'border-ink' : 'border-ink/30',
                      )}
                    >
                      {c === category && <span className="h-2 w-2 rounded-full bg-ink" />}
                    </span>
                    <span className={cx(c === category && 'font-medium')}>{c}</span>
                  </label>
                ))}
              </div>
              {errors.category && <FieldError id={fid('category-err')}>{errors.category}</FieldError>}
            </fieldset>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
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
                onChange={(ev) => setName(ev.target.value)}
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
                  onChange={(ev) => setMobile(ev.target.value)}
                  aria-invalid={errors.mobile ? 'true' : undefined}
                  aria-describedby={cx(fid('mobile-hint'), errors.mobile && fid('mobile-err')) || undefined}
                  className={cx(fieldControl, 'rounded-l-none')}
                />
              </div>
              {errors.mobile ? (
                <FieldError id={fid('mobile-err')}>{errors.mobile}</FieldError>
              ) : (
                <p id={fid('mobile-hint')} className={fieldHint}>
                  We call this number to confirm.
                </p>
              )}
            </div>
          </div>

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
              <p className={fieldHint}>Leave it blank if you don't have a partner yet.</p>
            </div>
          )}

          <div>
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

          {serverError && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-[#F3C9C9] bg-[#FDF3F3] px-4 py-3 text-[14px] text-[#8A1F1F]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{serverError}</span>
            </p>
          )}
        </div>
      </div>

      {/* Always in view: what you're entering, the fee, and the button. */}
      <div className="sticky bottom-0 z-10 border-t border-line bg-white px-5 py-3 sm:px-7 md:static">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-[13px] text-ink-muted">{category || 'Entry fee'}</p>
            <p className="font-display text-[22px] font-semibold leading-tight tabular-nums text-ink">{feeText(event)}</p>
          </div>
          <button type="submit" disabled={submitting} className={cx(btn.base, btn.primary, 'shrink-0 px-7')}>
            {submitting ? 'Registering…' : 'Register'}
          </button>
        </div>
        <p className="mt-1 text-[13px] text-ink-muted">Nothing to pay now. We'll call you to confirm your place.</p>
      </div>
    </form>
  );
};
