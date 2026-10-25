/**
 * Admin → Website Content → Events: tournaments, coaching camps, clinics and store events.
 *
 * Events marked "Show in homepage banner" appear in the photo slider at the top of the
 * homepage while they're upcoming or ongoing. Players register on the website (mode "form"),
 * on WhatsApp, by phone, through an external link, or not at all. Website registrations are
 * listed per event with category filter, cancel / restore and CSV export.
 *
 * Dialogs are rendered into <body> through a portal: the app header uses backdrop-blur, which
 * would otherwise trap fixed overlays inside it.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Clock,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  ImageOff,
  Images,
  IndianRupee,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { contentService } from '../../../services/contentService';
import {
  EventRegistration,
  EventRegistrationMode,
  SiteEvent,
  SiteEventCategory,
  SiteEventInput,
} from '../../../types/content';
import { csvRow, downloadCsv, formatDate, formatDateTime, formatINR, formatTime, parseDate } from '../../../utils/format';
import { formatMobile, localMobileDigits, mobileTelHref } from '../../../utils/phone';
import { Button } from '../../common/Button';
import { EmptyState } from '../../common/EmptyStates';
import { MediaUpload } from './MediaUpload';
import {
  ConfirmDialog,
  ErrorState,
  Field,
  FieldError,
  FixFieldsNotice,
  FormSection,
  ListSkeleton,
  Modal,
  Notice,
  Pills,
  RefreshFailed,
  SaveFailedNotice,
  SectionHeader,
  StatGrid,
  StatTile,
  Switch,
  cardClass,
  chipClass,
  errorMessage,
  focusRing,
  hintClass,
  iconButtonDangerClass,
  inputClass,
  inputErrorClass,
  isHttpsUrl,
  labelClass,
  nullIfEmpty,
  switchGroupClass,
  todayISO,
} from './shared';

// =====================================================================
// Constants & helpers
// =====================================================================

/** Red border for a field with an error (the shared class is !important, so it wins over inputClass). */
const inputErrorCls = inputErrorClass;

const SHOP_PHONE = '+91 76758 31496'; // non-breaking spaces: never split across lines

export const EVENT_CATEGORY_LABELS: Record<SiteEventCategory, string> = {
  tournament: 'Tournament',
  coaching_camp: 'Coaching camp',
  clinic: 'Clinic',
  store_event: 'Store event',
  other: 'Other',
};
const EVENT_CATEGORIES = Object.keys(EVENT_CATEGORY_LABELS) as SiteEventCategory[];

const MODE_OPTIONS: {
  id: EventRegistrationMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'form', label: 'On this website', description: 'Players fill a short form. You see the list here and can export it.', icon: ClipboardList },
  { id: 'whatsapp', label: 'WhatsApp', description: `Players message the shop on WhatsApp (${SHOP_PHONE}).`, icon: MessageCircle },
  { id: 'phone', label: 'Phone call', description: `Players call the shop (${SHOP_PHONE}).`, icon: Phone },
  { id: 'url', label: 'External link', description: 'For example a Google Form or the association’s website.', icon: ExternalLink },
  { id: 'none', label: 'No registration', description: 'Walk-in or information only.', icon: Ban },
];

const MODE_SHORT: Record<EventRegistrationMode, string> = {
  form: 'Website registration',
  whatsapp: 'Registration on WhatsApp',
  phone: 'Registration by phone',
  url: 'Registration link',
  none: 'No registration needed',
};

/** Banner button text used in the preview (the homepage may word it slightly differently). */
const MODE_CTA: Record<EventRegistrationMode, string> = {
  form: 'Register now',
  whatsapp: 'Register on WhatsApp',
  phone: 'Call to register',
  url: 'Register',
  none: 'View details',
};

/** "on WhatsApp" etc., for sentences like "This event now takes registrations on WhatsApp". */
const MODE_HOW: Record<EventRegistrationMode, string> = {
  form: 'on this website',
  whatsapp: 'on WhatsApp',
  phone: 'by phone',
  url: 'through an external link',
  none: '',
};

const PLAY_CATEGORY_SUGGESTIONS = [
  "Men's Singles",
  "Women's Singles",
  "Men's Doubles",
  "Women's Doubles",
  'Mixed Doubles',
  'U-13 Singles',
  'U-15 Singles',
  'U-17 Singles',
  '35+ Doubles',
];

const LIMITS = {
  title: 120,
  summary: 300,
  description: 5000,
  timeText: 80,
  venue: 200,
  feeNote: 40,
  category: 40,
  categories: 12,
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dateParts = (iso?: string | null) => {
  const d = iso ? parseDate(iso) : null;
  return d ? { wd: WEEKDAYS[d.getDay()], day: d.getDate(), mon: MONTHS[d.getMonth()], year: d.getFullYear() } : null;
};

/** "Sat 14 Nov 2026", or a range: "Sat 14 – Sun 15 Nov 2026" / "Mon 30 Nov – Sat 5 Dec 2026". */
export const formatEventDates = (start: string, end?: string | null): string => {
  const a = dateParts(start);
  if (!a) return start;
  const b = end && end !== start ? dateParts(end) : null;
  if (!b) return `${a.wd} ${a.day} ${a.mon} ${a.year}`;
  if (a.year === b.year && a.mon === b.mon) return `${a.wd} ${a.day} – ${b.wd} ${b.day} ${b.mon} ${b.year}`;
  if (a.year === b.year) return `${a.wd} ${a.day} ${a.mon} – ${b.wd} ${b.day} ${b.mon} ${b.year}`;
  return `${a.wd} ${a.day} ${a.mon} ${a.year} – ${b.wd} ${b.day} ${b.mon} ${b.year}`;
};

/** "Wed 11 Nov" */
const shortDate = (iso?: string | null): string => {
  const p = dateParts(iso);
  return p ? `${p.wd} ${p.day} ${p.mon}` : iso || '';
};

export const formatEventFee = (e: Pick<SiteEvent, 'entryFee' | 'feeNote'>): string =>
  e.entryFee && e.entryFee > 0 ? `${formatINR(e.entryFee)}${e.feeNote ? ` ${e.feeNote}` : ''}` : 'Free';

const inHomepageBanner = (e: SiteEvent) => e.isActive && e.showAsBanner && e.status !== 'past';

const STATUS_META: Record<SiteEvent['status'], { label: string; cls: string }> = {
  upcoming: { label: 'Upcoming', cls: 'bg-white text-ink border-line' },
  ongoing: { label: 'Happening now', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  past: { label: 'Past', cls: 'bg-paper-deep text-ink-soft border-line' },
};

const byStartAsc = (a: SiteEvent, b: SiteEvent) =>
  a.startDate.localeCompare(b.startDate) || a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'event';

/** Same rule as the backend's validate_link for images: https, a /site-path, or http://localhost uploads. */
const isAllowedImageUrl = (url: string): boolean => {
  const v = url.trim();
  if (!v || /\s/.test(v)) return false;
  if (v.startsWith('/') && !v.startsWith('//')) return true;
  return /^https:\/\/[^/]/i.test(v) || /^http:\/\/(localhost|127\.0\.0\.1)[:/]/i.test(v);
};

/**
 * Scrolls `el` into view inside its nearest scrollable ancestor only (the admin <main> on
 * laptops, a dialog body, or the window on phones). Element.scrollIntoView would also scroll
 * the outer page and push the app header out of view.
 */
const scrollWithin = (el: HTMLElement | null, block: 'start' | 'center' = 'start') => {
  if (!el) return;
  let box: HTMLElement | null = el.parentElement;
  while (box && box !== document.body && box !== document.documentElement) {
    const { overflowY } = getComputedStyle(box);
    if (/(auto|scroll)/.test(overflowY) && box.scrollHeight > box.clientHeight + 1) break;
    box = box.parentElement;
  }
  const rect = el.getBoundingClientRect();
  if (box && box !== document.body && box !== document.documentElement) {
    const top = rect.top - box.getBoundingClientRect().top + box.scrollTop;
    const y = block === 'center' ? top - box.clientHeight / 2 + rect.height / 2 : top - 12;
    box.scrollTo({ top: Math.max(0, y) });
  } else {
    // Leave room for the sticky app header (the <header> sits inside a sticky wrapper).
    let headerH = 0;
    for (let h = document.querySelector('header') as HTMLElement | null; h && h !== document.body; h = h.parentElement) {
      if (/sticky|fixed/.test(getComputedStyle(h).position)) {
        headerH = h.getBoundingClientRect().height;
        break;
      }
    }
    const top = rect.top + window.scrollY;
    const y = block === 'center' ? top - window.innerHeight / 2 + rect.height / 2 : top - headerH - 12;
    window.scrollTo({ top: Math.max(0, y) });
  }
};

/** Dialogs go into <body> so no ancestor (e.g. a backdrop-blur header) can trap them. */
const InBody: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  typeof document === 'undefined' ? null : createPortal(children, document.body);

/** "98765 43210": readable in Excel without the leading-+ formula guard's apostrophe. */
const csvMobile = (mobile: string): string => {
  const digits = localMobileDigits(mobile);
  return digits ? `${digits.slice(0, 5)} ${digits.slice(5)}` : formatMobile(mobile);
};

const registrationsCsv = (event: SiteEvent, rows: { reg: EventRegistration; n: number }[], suffix = '') => {
  const lines = [
    csvRow(['#', 'Name', 'Mobile (+91)', 'Partner', 'Category', 'Notes', 'Registered at', 'Status']),
    ...rows.map(({ reg, n }) =>
      csvRow([
        n,
        reg.name,
        csvMobile(reg.mobile),
        reg.partnerName || '',
        reg.playCategory || '',
        (reg.notes || '').replace(/\s*\r?\n\s*/g, ' / '),
        formatDateTime(reg.createdAt, ''),
        reg.status === 'registered' ? 'Registered' : 'Cancelled',
      ])
    ),
  ];
  downloadCsv(`gr-sports-${slugify(event.title).replace(/^gr-sports-/, '')}-registrations${suffix}-${todayISO()}.csv`, lines);
};

// =====================================================================
// Small display pieces
// =====================================================================

const EventThumb: React.FC<{ event: SiteEvent; className?: string }> = ({ event, className = '' }) => {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [event.bannerImageUrl]);
  return (
    <div className={`relative aspect-[16/6] rounded-xl overflow-hidden bg-slate-100 border border-line ${className}`}>
      {broken || !event.bannerImageUrl ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-ink-muted">
          <ImageOff className="w-5 h-5" aria-hidden="true" />
          <span className="text-[13px] font-medium">Photo not found</span>
        </div>
      ) : (
        <img
          src={event.bannerImageUrl}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className={`absolute inset-0 w-full h-full object-cover ${event.isActive && event.status !== 'past' ? '' : 'grayscale opacity-70'}`}
        />
      )}
    </div>
  );
};

const CapacityBar: React.FC<{ count: number; capacity: number }> = ({ count, capacity }) => {
  const pct = Math.min(100, Math.round((count / capacity) * 100));
  return (
    <span
      className="block h-1.5 w-full max-w-[160px] rounded-full bg-slate-200 overflow-hidden"
      role="img"
      aria-label={`${count} of ${capacity} places taken`}
    >
      <span
        className={`block h-full rounded-full ${pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
};

// =====================================================================
// Banner preview (inside the form)
// =====================================================================

interface PreviewData {
  title: string;
  category: SiteEventCategory;
  startDate: string;
  endDate: string;
  venue: string;
  feeLabel: string;
  mode: EventRegistrationMode;
  bannerImageUrl: string | null;
  mobileImageUrl: string | null;
}

const BannerPreview: React.FC<{ data: PreviewData }> = ({ data }) => {
  const dates = data.startDate ? formatEventDates(data.startDate, data.endDate || null) : 'Date to be set';
  const title = data.title.trim() || 'Event name';
  const phoneImage = data.mobileImageUrl || data.bannerImageUrl;
  const chip = (
    <span className="inline-block self-start text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-brandYellow text-sportsBlue">
      {EVENT_CATEGORY_LABELS[data.category]}
    </span>
  );
  return (
    <div className="space-y-2">
      <p className="text-[14px] font-medium text-ink">How the banner will look</p>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
        <figure className="flex-1 min-w-0">
          <div className="relative aspect-[16/6] rounded-xl overflow-hidden bg-ink-hover border border-line">
            {data.bannerImageUrl && (
              <img src={data.bannerImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
            <div className="absolute inset-y-0 left-0 w-[62%] p-3 sm:p-4 flex flex-col justify-center gap-1 text-white min-w-0">
              {chip}
              <p className="font-black text-sm sm:text-base leading-tight line-clamp-1 sm:line-clamp-2 break-words">{title}</p>
              <p className="text-[10px] sm:text-[11px] text-white/85 truncate">{dates}</p>
              <p className="hidden sm:block text-[10px] text-white/75 truncate">{data.venue.trim() || 'Venue'}</p>
              <span className="mt-1 self-start text-[10px] font-bold px-2 py-1 rounded-lg bg-brandYellow text-sportsBlue">
                {MODE_CTA[data.mode]}
              </span>
            </div>
          </div>
          <figcaption className="text-[12px] text-ink-muted mt-1">Laptops and tablets</figcaption>
        </figure>
        <figure className="w-[150px] shrink-0">
          <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-ink-hover border border-line">
            {phoneImage && <img src={phoneImage} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-2 text-white space-y-0.5 min-w-0">
              {chip}
              <p className="font-black text-[11px] leading-tight line-clamp-2 break-words">{title}</p>
              <p className="text-[9px] text-white/85 line-clamp-2">{dates}</p>
            </div>
          </div>
          <figcaption className="text-[12px] text-ink-muted mt-1 leading-snug">
            Phones{data.mobileImageUrl ? '' : ' (cropped from the wide photo)'}
          </figcaption>
        </figure>
      </div>
      <p className="text-[13px] text-ink-muted leading-snug">
        A close preview. The homepage writes the event details over the photo, so choose a photo without words in it and keep the
        main subject near the centre. Fee shown on the site: <b className="font-semibold text-ink">{data.feeLabel}</b>.
      </p>
    </div>
  );
};

// =====================================================================
// Category chips editor
// =====================================================================

const CategoryChips: React.FC<{
  value: string[];
  onChange: (next: string[]) => void;
  inputId: string;
  error?: string;
}> = ({ value, onChange, inputId, error }) => {
  const [draft, setDraft] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const full = value.length >= LIMITS.categories;

  const add = (raw: string) => {
    const v = raw.replace(/\s+/g, ' ').trim();
    if (!v) return;
    if (v.length > LIMITS.category) {
      setLocalError(`Keep each category under ${LIMITS.category} characters.`);
      return;
    }
    if (value.some((c) => c.toLowerCase() === v.toLowerCase())) {
      setLocalError(`“${v}” is already in the list.`);
      return;
    }
    if (full) {
      setLocalError(`Up to ${LIMITS.categories} categories.`);
      return;
    }
    setLocalError(null);
    onChange([...value, v]);
    setDraft('');
  };

  const remove = (c: string) => {
    setLocalError(null);
    onChange(value.filter((x) => x !== c));
  };

  const suggestions = PLAY_CATEGORY_SUGGESTIONS.filter((s) => !value.some((c) => c.toLowerCase() === s.toLowerCase()));
  const shownError = localError || error;

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Play categories">
          {value.map((c) => (
            <li
              key={c}
              className="inline-flex items-center pl-3.5 rounded-full border border-line bg-paper text-ink text-[14px] font-medium max-w-full"
            >
              <span className="truncate">{c}</span>
              <button
                type="button"
                onClick={() => remove(c)}
                aria-label={`Remove ${c}`}
                title="Remove"
                className={`shrink-0 w-11 h-11 inline-flex items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-rose-50 hover:text-rose-700 ${focusRing}`}
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-ink-soft">
          No categories yet, so players won’t be asked to pick one. Add them for tournaments, e.g. Men’s Doubles.
        </p>
      )}
      {!full && (
        <div className="flex gap-2">
          <input
            id={inputId}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (localError) setLocalError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                add(draft);
              }
            }}
            maxLength={LIMITS.category + 10}
            placeholder="Type a category and press Add"
            className={`${inputClass} ${shownError ? inputErrorCls : ''}`}
            aria-describedby={`${inputId}-help`}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => add(draft)}
            disabled={!draft.trim()}
            className="min-h-[44px] px-4 shrink-0"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add
          </Button>
        </div>
      )}
      <div id={`${inputId}-help`}>
        {shownError ? (
          <FieldError className="!mt-0">{shownError}</FieldError>
        ) : (
          <p className={`${hintClass} !mt-0`}>
            {value.length} of {LIMITS.categories} · Players choose one when they register on the website.
          </p>
        )}
      </div>
      {!full && suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[13px] text-ink-muted">Quick add:</p>
          <div className="flex flex-wrap gap-2" aria-label="Suggested categories">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                aria-label={`Add ${s}`}
                className={`inline-flex items-center gap-1 min-h-[44px] sm:min-h-[40px] px-3 rounded-full border border-dashed border-slate-300 text-[13px] font-medium text-ink-soft transition-colors duration-150 hover:bg-paper hover:border-ink/40 hover:text-ink ${focusRing}`}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" /> {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// Event form
// =====================================================================

interface EventFormState {
  title: string;
  category: SiteEventCategory;
  summary: string;
  description: string;
  startDate: string;
  endDate: string;
  timeText: string;
  venue: string;
  venueMapUrl: string;
  entryFee: string;
  feeNote: string;
  categories: string[];
  registrationMode: EventRegistrationMode;
  registrationUrl: string;
  registrationDeadline: string;
  capacity: string;
  bannerImageUrl: string | null;
  mobileImageUrl: string | null;
  showAsBanner: boolean;
  isActive: boolean;
}

type FormErrors = Partial<Record<keyof EventFormState, string>>;

const emptyForm: EventFormState = {
  title: '',
  category: 'tournament',
  summary: '',
  description: '',
  startDate: '',
  endDate: '',
  timeText: '',
  venue: '',
  venueMapUrl: '',
  entryFee: '',
  feeNote: '',
  categories: [],
  registrationMode: 'form',
  registrationUrl: '',
  registrationDeadline: '',
  capacity: '',
  bannerImageUrl: null,
  mobileImageUrl: null,
  showAsBanner: true,
  isActive: true,
};

const toForm = (e: SiteEvent): EventFormState => ({
  title: e.title,
  category: e.category,
  summary: e.summary ?? '',
  description: e.description ?? '',
  startDate: e.startDate,
  endDate: e.endDate ?? '',
  timeText: e.timeText ?? '',
  venue: e.venue,
  venueMapUrl: e.venueMapUrl ?? '',
  entryFee: e.entryFee ? String(e.entryFee) : '',
  feeNote: e.feeNote ?? '',
  categories: Array.isArray(e.categories) ? e.categories : [],
  registrationMode: e.registrationMode,
  registrationUrl: e.registrationUrl ?? '',
  registrationDeadline: e.registrationDeadline ?? '',
  capacity: e.capacity ? String(e.capacity) : '',
  bannerImageUrl: e.bannerImageUrl || null,
  mobileImageUrl: e.mobileImageUrl ?? null,
  showAsBanner: e.showAsBanner,
  isActive: e.isActive,
});

const tooLong = (value: string, max: number, label: string) =>
  value.trim().length > max ? `${label} must be at most ${max} characters.` : undefined;

const validate = (f: EventFormState): FormErrors => {
  const e: FormErrors = {};
  if (!f.title.trim()) e.title = 'Give the event a name.';
  else e.title = tooLong(f.title, LIMITS.title, 'Name');
  e.summary = tooLong(f.summary, LIMITS.summary, 'Summary');
  e.description = tooLong(f.description, LIMITS.description, 'Details');
  e.timeText = tooLong(f.timeText, LIMITS.timeText, 'Time');
  e.feeNote = tooLong(f.feeNote, LIMITS.feeNote, 'Fee note');
  if (!f.startDate) e.startDate = 'Choose the start date.';
  if (f.endDate && f.startDate && f.endDate < f.startDate) e.endDate = 'The last day must be on or after the start date.';
  if (!f.venue.trim()) e.venue = 'Enter where the event takes place.';
  else e.venue = tooLong(f.venue, LIMITS.venue, 'Venue');
  if (f.venueMapUrl.trim() && !isHttpsUrl(f.venueMapUrl)) e.venueMapUrl = 'Map link must start with https://';
  if (f.entryFee.trim()) {
    const fee = Number(f.entryFee);
    if (!Number.isFinite(fee) || fee < 0) e.entryFee = 'Enter an amount of ₹0 or more, or leave it empty for free.';
  }
  if (f.registrationMode !== 'none' && f.registrationDeadline && f.startDate) {
    const last = f.endDate && f.endDate >= f.startDate ? f.endDate : f.startDate;
    if (f.registrationDeadline > last) e.registrationDeadline = 'Registration must close on or before the last day of the event.';
  }
  if (f.registrationMode === 'form' && f.capacity.trim()) {
    const cap = Number(f.capacity);
    if (!Number.isInteger(cap) || cap < 1) e.capacity = 'Enter a whole number of 1 or more, or leave it empty for no limit.';
  }
  if (f.registrationMode === 'url') {
    if (!f.registrationUrl.trim()) e.registrationUrl = 'Paste the registration link.';
    else if (!isHttpsUrl(f.registrationUrl)) e.registrationUrl = 'Link must start with https://';
  }
  if (!f.bannerImageUrl) e.bannerImageUrl = 'Add a banner photo.';
  else if (!isAllowedImageUrl(f.bannerImageUrl)) e.bannerImageUrl = 'Use an https:// link or upload the photo.';
  if (f.mobileImageUrl && !isAllowedImageUrl(f.mobileImageUrl)) e.mobileImageUrl = 'Use an https:// link or upload the photo.';
  (Object.keys(e) as (keyof EventFormState)[]).forEach((k) => e[k] === undefined && delete e[k]);
  return e;
};

const toInput = (f: EventFormState): SiteEventInput => {
  const fee = f.entryFee.trim() ? Number(f.entryFee) : null;
  return {
    title: f.title.trim(),
    category: f.category,
    summary: nullIfEmpty(f.summary),
    description: nullIfEmpty(f.description),
    startDate: f.startDate,
    endDate: f.endDate && f.endDate !== f.startDate ? f.endDate : null,
    timeText: nullIfEmpty(f.timeText),
    venue: f.venue.trim(),
    venueMapUrl: nullIfEmpty(f.venueMapUrl),
    entryFee: fee,
    feeNote: fee && fee > 0 ? nullIfEmpty(f.feeNote) : null,
    categories: f.categories,
    registrationMode: f.registrationMode,
    registrationUrl: f.registrationMode === 'url' ? f.registrationUrl.trim() : null,
    registrationDeadline: f.registrationMode !== 'none' ? f.registrationDeadline || null : null,
    capacity: f.registrationMode === 'form' && f.capacity.trim() ? Number(f.capacity) : null,
    bannerImageUrl: f.bannerImageUrl as string,
    mobileImageUrl: f.mobileImageUrl || null,
    showAsBanner: f.showAsBanner,
    isActive: f.isActive,
  };
};

/** Field order used to focus the first problem after a failed save. */
const FIELD_ORDER: (keyof EventFormState)[] = [
  'title',
  'summary',
  'description',
  'startDate',
  'endDate',
  'timeText',
  'venue',
  'venueMapUrl',
  'entryFee',
  'feeNote',
  'categories',
  'registrationUrl',
  'capacity',
  'registrationDeadline',
  'bannerImageUrl',
  'mobileImageUrl',
];

const EventFormModal: React.FC<{
  event: SiteEvent | null; // null = new
  onClose: () => void;
  onSaved: (saved: SiteEvent, isNew: boolean) => void;
}> = ({ event, onClose, onSaved }) => {
  const { addToast } = useApp();
  const uid = useId();
  const [form, setForm] = useState<EventFormState>(() => (event ? toForm(event) : emptyForm));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingWide, setUploadingWide] = useState(false);
  const [uploadingPhone, setUploadingPhone] = useState(false);
  const uploading = uploadingWide || uploadingPhone;

  const fid = (key: keyof EventFormState) => `${uid}-${key}`;

  const set = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const focusFirstError = (errs: FormErrors) => {
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(fid(first));
      if (el) {
        scrollWithin(el, 'center');
        (el as HTMLElement).focus({ preventScroll: true });
      }
    });
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (uploading || saving) return;
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      focusFirstError(errs);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const input = toInput(form);
      const saved = event ? await contentService.updateEvent(event.id, input) : await contentService.createEvent(input);
      addToast('success', event ? 'Event updated' : 'Event added', `“${saved.title}” has been saved.`);
      onSaved(saved, !event);
    } catch (err) {
      const msg = errorMessage(err, 'Could not save the event.');
      setSaveError(msg);
      addToast('error', 'Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const today = todayISO();
  const lastDay = form.endDate && form.endDate >= form.startDate ? form.endDate : form.startDate;
  const registered = event?.registrationCount ?? 0;
  const capacityNum = Number(form.capacity);
  const overCapacity =
    form.registrationMode === 'form' && form.capacity.trim() && Number.isInteger(capacityNum) && capacityNum > 0 && capacityNum < registered;
  const feeNum = Number(form.entryFee);
  const feeLabel = form.entryFee.trim() && Number.isFinite(feeNum) && feeNum > 0
    ? `${formatINR(feeNum)}${form.feeNote.trim() ? ` ${form.feeNote.trim()}` : ''}`
    : 'Free';
  const formId = 'event-form';

  return (
    <InBody>
      <Modal
        open
        title={event ? 'Edit event' : 'New event'}
        subtitle={event ? event.title : 'Tournament, coaching camp, clinic or store event'}
        onClose={onClose}
        busy={saving}
        size="lg"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="min-h-[44px] sm:px-5">
              Cancel
            </Button>
            <Button type="submit" form={formId} isLoading={saving} disabled={uploading} className="min-h-[44px] sm:px-6">
              {uploading ? 'Waiting for upload…' : event ? 'Save changes' : 'Add event'}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="space-y-8" noValidate>
          {(saveError || Object.keys(errors).length > 0) && (
            <div className="space-y-2 -mb-3">
              <SaveFailedNotice message={saveError} />
              <FixFieldsNotice count={Object.keys(errors).length} />
            </div>
          )}

          {/* ---- Basics ---- */}
          <FormSection title="Basics">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Event name" htmlFor={fid('title')} required error={errors.title} className="sm:col-span-2">
                <input
                  id={fid('title')}
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  className={`${inputClass} ${errors.title ? inputErrorCls : ''}`}
                  placeholder="e.g. GR Sports Doubles Tournament"
                  maxLength={LIMITS.title + 20}
                />
              </Field>
              <Field label="Type" htmlFor={fid('category')}>
                <select
                  id={fid('category')}
                  value={form.category}
                  onChange={(e) => set('category', e.target.value as SiteEventCategory)}
                  className={inputClass}
                >
                  {EVENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {EVENT_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              label="Short summary"
              htmlFor={fid('summary')}
              error={errors.summary}
              optional
              hint={`One or two lines shown on the banner · ${form.summary.trim().length} of ${LIMITS.summary} characters`}
            >
              <textarea
                id={fid('summary')}
                rows={2}
                value={form.summary}
                onChange={(e) => set('summary', e.target.value)}
                className={`${inputClass} resize-y ${errors.summary ? inputErrorCls : ''}`}
                placeholder="e.g. Men's, women's and mixed doubles. Register online before 11 Nov."
              />
            </Field>
            <Field
              label="Full details"
              htmlFor={fid('description')}
              error={errors.description}
              optional
              hint="Format, rules, what to bring, prizes, contact. Line breaks are kept."
            >
              <textarea
                id={fid('description')}
                rows={5}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                className={`${inputClass} resize-y ${errors.description ? inputErrorCls : ''}`}
              />
            </Field>
          </FormSection>

          {/* ---- When & where ---- */}
          <FormSection title="When & where">
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 gap-4">
              <Field
                label="Start date"
                htmlFor={fid('startDate')}
                required
                error={errors.startDate}
                hint={form.startDate && form.startDate < today ? 'This date has passed.' : undefined}
              >
                <input
                  id={fid('startDate')}
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  className={`${inputClass} ${errors.startDate ? inputErrorCls : ''}`}
                />
              </Field>
              <Field label="Last day" htmlFor={fid('endDate')} error={errors.endDate} optional hint="Only for events over several days">
                <input
                  id={fid('endDate')}
                  type="date"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) => set('endDate', e.target.value)}
                  className={`${inputClass} ${errors.endDate ? inputErrorCls : ''}`}
                />
              </Field>
              <Field label="Time" htmlFor={fid('timeText')} error={errors.timeText} optional hint='e.g. "7:00 AM onwards"'>
                <input
                  id={fid('timeText')}
                  value={form.timeText}
                  onChange={(e) => set('timeText', e.target.value)}
                  className={`${inputClass} ${errors.timeText ? inputErrorCls : ''}`}
                  placeholder="7:00 AM onwards"
                />
              </Field>
            </div>
            {form.startDate && (
              <p className="text-[13px] text-ink-muted -mt-1">
                Shown on the website as{' '}
                <b className="font-semibold text-ink">{formatEventDates(form.startDate, form.endDate && form.endDate >= form.startDate ? form.endDate : null)}</b>
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Venue" htmlFor={fid('venue')} required error={errors.venue}>
                <input
                  id={fid('venue')}
                  value={form.venue}
                  onChange={(e) => set('venue', e.target.value)}
                  className={`${inputClass} ${errors.venue ? inputErrorCls : ''}`}
                  placeholder="e.g. Indoor courts, MVP Colony"
                />
              </Field>
              <Field label="Google Maps link" htmlFor={fid('venueMapUrl')} error={errors.venueMapUrl} optional hint="It must start with https://">
                <input
                  id={fid('venueMapUrl')}
                  type="url"
                  inputMode="url"
                  value={form.venueMapUrl}
                  onChange={(e) => set('venueMapUrl', e.target.value)}
                  className={`${inputClass} ${errors.venueMapUrl ? inputErrorCls : ''}`}
                  placeholder="https://maps.app.goo.gl/…"
                />
              </Field>
            </div>
          </FormSection>

          {/* ---- Fee & categories ---- */}
          <FormSection title="Fee & play categories">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Entry fee (₹)"
                htmlFor={fid('entryFee')}
                error={errors.entryFee}
                hint={feeLabel === 'Free' ? 'Empty or 0 = free entry' : `Shown as ${feeLabel}`}
              >
                <input
                  id={fid('entryFee')}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={form.entryFee}
                  onChange={(e) => set('entryFee', e.target.value)}
                  className={`${inputClass} ${errors.entryFee ? inputErrorCls : ''}`}
                  placeholder="Free"
                />
              </Field>
              <Field label="Fee is…" htmlFor={fid('feeNote')} error={errors.feeNote} hint='e.g. "per pair", "per player"'>
                <input
                  id={fid('feeNote')}
                  value={form.feeNote}
                  onChange={(e) => set('feeNote', e.target.value)}
                  className={`${inputClass} ${errors.feeNote ? inputErrorCls : ''}`}
                  placeholder="per pair"
                  disabled={!(form.entryFee.trim() && Number(form.entryFee) > 0)}
                />
              </Field>
            </div>
            <div>
              <label htmlFor={fid('categories')} className={labelClass}>
                Play categories <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <CategoryChips
                value={form.categories}
                onChange={(next) => set('categories', next)}
                inputId={fid('categories')}
                error={errors.categories}
              />
            </div>
          </FormSection>

          {/* ---- Registration ---- */}
          <FormSection title="Registration" description="How players sign up for this event.">
            <div role="radiogroup" aria-label="How players register" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {MODE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const checked = form.registrationMode === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-3 min-h-[56px] p-3.5 rounded-xl border cursor-pointer transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                      checked ? 'border-ink bg-paper ring-1 ring-ink' : 'border-line bg-white hover:border-ink/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${uid}-mode`}
                      value={opt.id}
                      checked={checked}
                      onChange={() => set('registrationMode', opt.id)}
                      className="mt-0.5 w-4 h-4 shrink-0 accent-ink focus:outline-none"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                        <Icon className={`w-4 h-4 shrink-0 ${checked ? 'text-ink' : 'text-ink-muted'}`} aria-hidden="true" />
                        {opt.label}
                      </span>
                      <span className="block text-[13px] text-ink-muted leading-snug mt-0.5">{opt.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            {form.registrationMode !== 'none' && (
              <div className="p-4 rounded-2xl bg-paper border border-line grid grid-cols-1 sm:grid-cols-2 gap-4">
                {form.registrationMode === 'url' && (
                  <Field
                    label="Registration link"
                    htmlFor={fid('registrationUrl')}
                    required
                    error={errors.registrationUrl}
                    hint="Must start with https://"
                    className="sm:col-span-2"
                  >
                    <input
                      id={fid('registrationUrl')}
                      type="url"
                      inputMode="url"
                      value={form.registrationUrl}
                      onChange={(e) => set('registrationUrl', e.target.value)}
                      className={`${inputClass} ${errors.registrationUrl ? inputErrorCls : ''}`}
                      placeholder="https://forms.gle/…"
                    />
                  </Field>
                )}
                {form.registrationMode === 'form' && (
                  <Field
                    label="Maximum registrations"
                    htmlFor={fid('capacity')}
                    error={errors.capacity}
                    hint={
                      overCapacity
                        ? `${registered} are already registered, so the event will show as full.`
                        : `Empty = no limit. Registration closes by itself when full.${registered ? ` ${registered} registered so far.` : ''}`
                    }
                  >
                    <input
                      id={fid('capacity')}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={form.capacity}
                      onChange={(e) => set('capacity', e.target.value)}
                      className={`${inputClass} ${errors.capacity ? inputErrorCls : ''}`}
                      placeholder="No limit"
                    />
                  </Field>
                )}
                <Field
                  label="Registration closes on"
                  htmlFor={fid('registrationDeadline')}
                  error={errors.registrationDeadline}
                  hint={
                    form.registrationDeadline
                      ? `Players can register until the end of ${shortDate(form.registrationDeadline)}.`
                      : form.startDate
                        ? `Empty = until the start date (${shortDate(form.startDate)}).`
                        : 'Empty = until the start date.'
                  }
                >
                  <input
                    id={fid('registrationDeadline')}
                    type="date"
                    value={form.registrationDeadline}
                    max={lastDay || undefined}
                    onChange={(e) => set('registrationDeadline', e.target.value)}
                    className={`${inputClass} ${errors.registrationDeadline ? inputErrorCls : ''}`}
                  />
                </Field>
              </div>
            )}
          </FormSection>

          {/* ---- Banner photo ---- */}
          <FormSection title="Banner photo" description="Real photos only. The event details are written over the photo on the homepage.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div id={fid('bannerImageUrl')} tabIndex={-1} className="sm:col-span-2 outline-none">
                <MediaUpload
                  label="Wide photo"
                  required
                  value={form.bannerImageUrl}
                  onChange={(url) => set('bannerImageUrl', url)}
                  aspectClass="aspect-[16/6]"
                  contain={false}
                  hint="Landscape, at least 1600 × 600 px. The middle stays visible on every screen."
                  error={errors.bannerImageUrl}
                  onUploadingChange={setUploadingWide}
                />
              </div>
              <div id={fid('mobileImageUrl')} tabIndex={-1} className="outline-none">
                <MediaUpload
                  label="Phone photo (optional)"
                  value={form.mobileImageUrl}
                  onChange={(url) => set('mobileImageUrl', url)}
                  aspectClass="aspect-[4/5]"
                  contain={false}
                  hint="Portrait, about 800 × 1000 px. If empty, the wide photo is cropped."
                  error={errors.mobileImageUrl}
                  onUploadingChange={setUploadingPhone}
                />
              </div>
            </div>
            {form.bannerImageUrl && (
              <BannerPreview
                data={{
                  title: form.title,
                  category: form.category,
                  startDate: form.startDate,
                  endDate: form.endDate && form.endDate >= form.startDate ? form.endDate : '',
                  venue: form.venue,
                  feeLabel,
                  mode: form.registrationMode,
                  bannerImageUrl: form.bannerImageUrl,
                  mobileImageUrl: form.mobileImageUrl,
                }}
              />
            )}
          </FormSection>

          {/* ---- Visibility ---- */}
          <FormSection title="On the website">
            <div className={switchGroupClass}>
              <Switch
                checked={form.isActive}
                onChange={(v) => set('isActive', v)}
                label="Published"
                description="Turn off to keep it as a draft, hidden from the website."
                onLabel="Published"
                offLabel="Draft"
              />
              <Switch
                checked={form.showAsBanner}
                onChange={(v) => set('showAsBanner', v)}
                label="Show in homepage banner"
                description="Adds the event to the photo slider at the top of the homepage until it ends."
              />
            </div>
          </FormSection>
        </form>
      </Modal>
    </InBody>
  );
};

// =====================================================================
// Event row
// =====================================================================

const EventRow: React.FC<{
  event: SiteEvent;
  domId: string;
  busy: boolean;
  onEdit: () => void;
  onRegistrations: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}> = ({ event: e, domId, busy, onEdit, onRegistrations, onToggleActive, onDelete }) => {
  const status = STATUS_META[e.status];
  const isForm = e.registrationMode === 'form';
  const showRegistrations = isForm || e.registrationCount > 0;
  const full = isForm && e.spotsLeft === 0;

  let regText: string = MODE_SHORT[e.registrationMode];
  let regTone = 'text-ink-muted';
  if (e.registrationMode !== 'none' && e.isActive) {
    if (full) {
      regText += ' · full';
      regTone = 'text-rose-700';
    } else if (e.registrationOpen) {
      regText += ` · open until ${shortDate(e.registrationDeadline || e.startDate)}`;
      regTone = 'text-emerald-800';
    } else {
      regText += ' · closed';
    }
  }

  return (
    <li id={domId} className={`${cardClass} p-3 sm:p-4 scroll-mt-4 ${e.isActive ? '' : 'bg-paper/70'}`}>
      <div className="flex flex-col md:flex-row gap-3 md:gap-5">
        <EventThumb event={e} className="w-full md:w-[240px] shrink-0 self-start" />

        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`${chipClass} ${status.cls}`}>{status.label}</span>
            {!e.isActive && (
              <span className={`${chipClass} bg-paper-deep border-line text-ink-soft`}>
                <EyeOff className="w-3 h-3" aria-hidden="true" /> Draft, hidden from website
              </span>
            )}
            <span className={`${chipClass} bg-white border-line text-ink-soft`}>{EVENT_CATEGORY_LABELS[e.category]}</span>
            {inHomepageBanner(e) ? (
              <span className={`${chipClass} bg-accent/25 border-accent/60 text-ink`}>
                <Images className="w-3 h-3" aria-hidden="true" /> In homepage banner
              </span>
            ) : (
              <span className={`${chipClass} bg-white border-line text-ink-muted`}>
                {!e.showAsBanner
                  ? 'Not in homepage banner'
                  : e.status === 'past'
                    ? 'Banner ended'
                    : 'Banner shows once published'}
              </span>
            )}
          </div>

          <h4 className="text-[16px] sm:text-[17px] font-semibold text-ink break-words leading-snug">{e.title}</h4>

          <dl className="grid grid-cols-1 lg:grid-cols-2 gap-x-5 gap-y-1.5 text-[14px] text-ink-soft">
            <div className="flex items-start gap-2 min-w-0">
              <dt className="sr-only">Dates</dt>
              <CalendarDays className="w-4 h-4 mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
              <dd className="min-w-0">
                <span className="font-medium text-ink">{formatEventDates(e.startDate, e.endDate)}</span>
                {e.timeText && <span className="text-ink-muted"> · {e.timeText}</span>}
              </dd>
            </div>
            <div className="flex items-start gap-2 min-w-0">
              <dt className="sr-only">Venue</dt>
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
              <dd className="min-w-0 break-words line-clamp-2">{e.venue}</dd>
            </div>
            <div className="flex items-start gap-2 min-w-0">
              <dt className="sr-only">Entry fee</dt>
              <IndianRupee className="w-4 h-4 mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
              <dd className="font-medium text-ink tabular-nums">{formatEventFee(e)}</dd>
            </div>
            <div className="flex items-start gap-2 min-w-0">
              <dt className="sr-only">Registration</dt>
              <ClipboardList className="w-4 h-4 mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
              <dd className={`min-w-0 font-medium ${regTone}`}>{regText}</dd>
            </div>
          </dl>

          {isForm && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink tabular-nums">
                <Users className="w-4 h-4 text-ink-muted" aria-hidden="true" />
                {e.capacity ? `${e.registrationCount} of ${e.capacity} registered` : `${e.registrationCount} registered`}
              </span>
              {e.capacity ? <CapacityBar count={e.registrationCount} capacity={e.capacity} /> : null}
              {e.registrationOpen && e.capacity && e.spotsLeft ? (
                <span className="text-[13px] text-ink-muted tabular-nums">{e.spotsLeft} places left</span>
              ) : null}
            </div>
          )}

          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 pt-1 sm:flex sm:flex-wrap sm:justify-end [&>button]:min-h-[44px] sm:[&>button]:min-h-[40px]">
            {showRegistrations && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onRegistrations}
                className="col-span-3 px-4"
                leftIcon={<Users className="w-4 h-4" />}
              >
                Registrations
                <span className="ml-0.5 text-[12px] leading-none min-w-[22px] text-center px-1.5 py-1 rounded-full font-semibold bg-paper-deep text-ink tabular-nums">
                  {e.registrationCount}
                </span>
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onEdit}
              className="px-4 sm:min-w-[88px]"
              leftIcon={<Pencil className="w-4 h-4" />}
              aria-label={`Edit ${e.title}`}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onToggleActive}
              disabled={busy}
              isLoading={busy}
              className="px-4 sm:min-w-[100px]"
              leftIcon={e.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              aria-label={e.isActive ? `Hide ${e.title} from the website` : `Publish ${e.title} on the website`}
            >
              {e.isActive ? 'Hide' : 'Publish'}
            </Button>
            <button type="button" onClick={onDelete} aria-label={`Delete ${e.title}`} title="Delete event" className={iconButtonDangerClass}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
};

// =====================================================================
// Registrations view
// =====================================================================

const ALL = '__all__';
const NO_CATEGORY = '__none__';

const RegistrationsView: React.FC<{
  event: SiteEvent;
  onBack: () => void;
  onChanged: () => void;
}> = ({ event, onBack, onChanged }) => {
  const { addToast } = useApp();
  const [regs, setRegs] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(ALL);
  const [showCancelled, setShowCancelled] = useState(true);
  const [pending, setPending] = useState<{ reg: EventRegistration; to: EventRegistration['status'] } | null>(null);
  const [busy, setBusy] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);
  const scrolledAfterLoad = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await contentService.listEventRegistrations(event.id);
      setRegs(Array.isArray(list) ? list : []);
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load the registrations.'));
    } finally {
      setLoading(false);
    }
  }, [event.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Once the list has loaded, put the top of this view back in sight: while the short loading
  // skeleton was shown, the browser's scroll anchoring may have moved the page.
  useEffect(() => {
    if (loading || scrolledAfterLoad.current) return;
    scrolledAfterLoad.current = true;
    requestAnimationFrame(() => scrollWithin(viewRef.current, 'start'));
  }, [loading]);

  const numbered = useMemo(() => regs.map((reg, i) => ({ reg, n: i + 1 })), [regs]);
  const active = regs.filter((r) => r.status === 'registered');
  const cancelledCount = regs.length - active.length;

  const categoryOptions = useMemo(() => {
    const names = [...(event.categories || [])];
    regs.forEach((r) => {
      if (r.playCategory && !names.includes(r.playCategory)) names.push(r.playCategory);
    });
    const opts: { id: string; label: string; count: number }[] = [{ id: ALL, label: 'All categories', count: active.length }];
    names.forEach((name) => opts.push({ id: name, label: name, count: active.filter((r) => r.playCategory === name).length }));
    if (names.length > 0 && regs.some((r) => !r.playCategory)) {
      opts.push({ id: NO_CATEGORY, label: 'No category', count: active.filter((r) => !r.playCategory).length });
    }
    return opts;
  }, [event.categories, regs, active]);

  const visible = numbered.filter(({ reg }) => {
    if (!showCancelled && reg.status === 'cancelled') return false;
    if (category === ALL) return true;
    if (category === NO_CATEGORY) return !reg.playCategory;
    return reg.playCategory === category;
  });
  const filtered = category !== ALL || !showCancelled;

  const runStatusChange = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const saved = await contentService.updateEventRegistration(pending.reg.id, { status: pending.to });
      setRegs((list) => list.map((r) => (r.id === saved.id ? saved : r)));
      addToast(
        'success',
        pending.to === 'cancelled' ? 'Registration cancelled' : 'Registration restored',
        `${saved.name} is now ${pending.to === 'cancelled' ? 'cancelled' : 'registered'}.`
      );
      setPending(null);
      onChanged();
    } catch (err) {
      addToast('error', 'Could not update the registration', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    if (visible.length === 0) {
      addToast('info', 'Nothing to export', 'There are no registrations in this list.');
      return;
    }
    registrationsCsv(event, visible, filtered ? '-filtered' : '');
  };

  const capacityFull = !!event.capacity && active.length >= event.capacity;
  const restoringOverCapacity = pending?.to === 'registered' && capacityFull;

  const statusPill = (reg: EventRegistration) =>
    reg.status === 'registered' ? (
      <span className={`${chipClass} bg-emerald-50 text-emerald-800 border-emerald-200`}>Registered</span>
    ) : (
      <span className={`${chipClass} bg-paper-deep text-ink-soft border-line`}>Cancelled</span>
    );

  const actionButton = (reg: EventRegistration, className = '') =>
    reg.status === 'registered' ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setPending({ reg, to: 'cancelled' })}
        className={`min-h-[44px] sm:min-h-[40px] text-rose-700 border-rose-200 hover:bg-rose-50 ${className}`}
        leftIcon={<UserX className="w-3.5 h-3.5" />}
        aria-label={`Cancel registration of ${reg.name}`}
      >
        Cancel
      </Button>
    ) : (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setPending({ reg, to: 'registered' })}
        className={`min-h-[44px] sm:min-h-[40px] ${className}`}
        leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
        aria-label={`Restore registration of ${reg.name}`}
      >
        Restore
      </Button>
    );

  const phoneLinks = (reg: EventRegistration) => {
    const digits = localMobileDigits(reg.mobile);
    return (
      <span className="inline-flex items-center gap-1">
        <a
          href={mobileTelHref(reg.mobile)}
          className="inline-flex items-center min-h-[44px] sm:min-h-[40px] font-semibold text-ink tabular-nums underline decoration-ink/20 underline-offset-4 hover:decoration-ink whitespace-nowrap rounded"
        >
          {formatMobile(reg.mobile)}
        </a>
        {digits && (
          <a
            href={`https://wa.me/91${digits}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`WhatsApp ${reg.name}`}
            title="Open WhatsApp chat"
            className={`shrink-0 w-11 h-11 sm:w-10 sm:h-10 inline-flex items-center justify-center rounded-xl text-emerald-700 hover:bg-emerald-50 ${focusRing}`}
          >
            <MessageCircle className="w-4 h-4" />
          </a>
        )}
      </span>
    );
  };

  return (
    <div ref={viewRef} className="space-y-4 min-w-0 min-h-[70vh]">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="min-h-[44px] -ml-2 px-3"
        leftIcon={<ArrowLeft className="w-4 h-4" />}
      >
        All events
      </Button>

      <div className={`${cardClass} p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-5 sm:items-center`}>
        <EventThumb event={event} className="hidden sm:block sm:w-[180px] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-ink-muted">Registrations</p>
          <h3 className="font-display tracking-[0.01em] text-[22px] sm:text-[24px] font-semibold text-ink break-words leading-tight">{event.title}</h3>
          <p className="text-[14px] text-ink-soft mt-1 break-words">
            {formatEventDates(event.startDate, event.endDate)} · {event.venue}
          </p>
          <p className="text-[13px] text-ink-muted mt-0.5">
            {MODE_SHORT[event.registrationMode]}
            {event.registrationMode === 'form' &&
              (event.registrationOpen
                ? ` · open until ${shortDate(event.registrationDeadline || event.startDate)}`
                : capacityFull
                  ? ' · full'
                  : ' · closed')}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            onClick={load}
            isLoading={loading && regs.length > 0}
            className="min-h-[44px] px-4"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            aria-label="Refresh registrations"
          >
            <span className="hidden min-[400px]:inline">Refresh</span>
          </Button>
          <Button
            type="button"
            onClick={exportCsv}
            disabled={regs.length === 0}
            className="min-h-[44px] px-5 flex-1 sm:flex-none"
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export {filtered && regs.length ? `${visible.length} shown` : 'CSV'}
          </Button>
        </div>
      </div>

      {event.registrationMode !== 'form' && (
        <Notice tone="info">
          {event.registrationMode === 'none'
            ? 'This event no longer takes registrations'
            : `This event now takes registrations ${MODE_HOW[event.registrationMode]}`}
          , so new players won’t appear here. Registrations made on the website earlier are kept below.
        </Notice>
      )}

      {loading && regs.length === 0 ? (
        <ListSkeleton rows={4} withImage={false} />
      ) : loadError && regs.length === 0 ? (
        <ErrorState message={loadError} onRetry={load} retrying={loading} />
      ) : regs.length === 0 ? (
        <EmptyState
          title="No registrations yet"
          description={
            event.registrationOpen
              ? 'When players register on the website, they appear here with their mobile number and category.'
              : 'Nobody registered on the website for this event.'
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-label="Summary">
            <StatTile label="Registered" value={active.length} suffix={event.capacity ? `/ ${event.capacity}` : undefined} />
            <StatTile
              label="Places left"
              value={event.capacity ? Math.max(event.capacity - active.length, 0) : '—'}
              tone={event.capacity ? (capacityFull ? 'bad' : 'good') : 'muted'}
            />
            <StatTile label="Cancelled" value={cancelledCount} tone="muted" />
          </div>

          <div className="space-y-3">
            {categoryOptions.length > 1 && (
              <Pills<string> ariaLabel="Filter by category" value={category} onChange={setCategory} options={categoryOptions} />
            )}
            {cancelledCount > 0 && (
              <div className="w-fit">
                <Switch
                  checked={showCancelled}
                  onChange={setShowCancelled}
                  label={`Show cancelled (${cancelledCount})`}
                />
              </div>
            )}
          </div>

          {loadError && <RefreshFailed message={loadError} onRetry={load} retrying={loading} />}

          {visible.length === 0 ? (
            <div className={`${cardClass} px-6 py-10 text-center`} role="status">
              <p className="text-[16px] font-semibold text-ink">No registrations in this category</p>
              <Button
                type="button"
                variant="secondary"
                className="mt-4 min-h-[44px] px-5"
                onClick={() => {
                  setCategory(ALL);
                  setShowCancelled(true);
                }}
              >
                Show everyone
              </Button>
            </div>
          ) : (
            <>
              {/* Table (wide screens: the client's 1280px laptop and up) */}
              <div className={`${cardClass} hidden xl:block overflow-x-auto`}>
                <table className="w-full min-w-[880px] text-[13px] text-left">
                  <thead className="bg-paper text-[13px] font-semibold text-ink-soft border-b border-line">
                    <tr>
                      <th scope="col" className="py-2.5 pl-4 pr-1.5 w-10 text-right tabular-nums">#</th>
                      <th scope="col" className="py-2.5 px-3">Name &amp; partner</th>
                      <th scope="col" className="py-2.5 px-3">Mobile</th>
                      <th scope="col" className="py-2.5 px-3">Category</th>
                      <th scope="col" className="py-2.5 px-3">Notes</th>
                      <th scope="col" className="py-2.5 px-3">Registered</th>
                      <th scope="col" className="py-2.5 px-3 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {visible.map(({ reg, n }) => {
                      const cancelled = reg.status === 'cancelled';
                      const when = parseDate(reg.createdAt);
                      return (
                        <tr key={reg.id} className={`transition-colors duration-150 ${cancelled ? 'bg-paper/70 text-ink-muted' : 'text-ink-soft hover:bg-paper/50'}`}>
                          <td className="py-2 pl-4 pr-1.5 align-middle text-right font-semibold text-ink-muted tabular-nums">{n}</td>
                          <td className="py-2 px-3 align-middle min-w-[150px] max-w-[220px]">
                            <span className={`block font-semibold break-words text-[14px] ${cancelled ? 'line-through' : 'text-ink'}`}>
                              {reg.name}
                            </span>
                            {reg.partnerName && (
                              <span className="block text-[13px] text-ink-muted break-words">with {reg.partnerName}</span>
                            )}
                          </td>
                          <td className="py-0.5 px-3 align-middle">{phoneLinks(reg)}</td>
                          <td className="py-2 px-3 align-middle">
                            {reg.playCategory ? (
                              <span className={`${chipClass} bg-paper border-line text-ink whitespace-nowrap`}>
                                {reg.playCategory}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 align-middle min-w-[140px]">
                            {reg.notes ? (
                              <span className="block whitespace-pre-line break-words line-clamp-3" title={reg.notes}>
                                {reg.notes}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 align-middle whitespace-nowrap text-ink-muted tabular-nums">
                            {when ? (
                              <>
                                <span className="block">{formatDate(when)}</span>
                                <span className="block text-[12px] text-ink-muted">{formatTime(when)}</span>
                              </>
                            ) : (
                              reg.createdAt
                            )}
                          </td>
                          <td className="py-1.5 px-3 pr-4 align-middle">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              {statusPill(reg)}
                              {actionButton(reg)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cards (phones, tablets and narrow laptops) */}
              <ul className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-2">
                {visible.map(({ reg, n }) => {
                  const cancelled = reg.status === 'cancelled';
                  return (
                    <li key={reg.id} className={`${cardClass} p-3.5 ${cancelled ? 'bg-paper/80' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-[15px] font-semibold break-words ${cancelled ? 'line-through text-ink-muted' : 'text-ink'}`}>
                            <span className="text-ink-muted font-medium mr-1.5 tabular-nums">{n}.</span>
                            {reg.name}
                          </p>
                          {reg.partnerName && <p className="text-[13px] text-ink-soft break-words">Partner: {reg.partnerName}</p>}
                        </div>
                        {statusPill(reg)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2">
                        {phoneLinks(reg)}
                        {reg.playCategory && (
                          <span className={`${chipClass} bg-paper border-line text-ink`}>{reg.playCategory}</span>
                        )}
                      </div>
                      {reg.notes && <p className="text-[13px] text-ink-soft whitespace-pre-line break-words mt-1">{reg.notes}</p>}
                      <div className="mt-2 pt-2 border-t border-line flex items-center justify-between gap-2">
                        <span className="text-[13px] text-ink-muted inline-flex items-center gap-1.5 tabular-nums">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {formatDateTime(reg.createdAt)}
                        </span>
                        {actionButton(reg)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}

      <InBody>
        <Modal
          open={!!pending}
          title={pending?.to === 'cancelled' ? 'Cancel this registration?' : 'Restore this registration?'}
          onClose={() => setPending(null)}
          busy={busy}
          closeOnEscape
          size="sm"
          role="alertdialog"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setPending(null)} disabled={busy} autoFocus className="min-h-[44px] sm:px-5">
                {pending?.to === 'cancelled' ? 'Keep registration' : 'Not now'}
              </Button>
              <Button
                type="button"
                variant={pending?.to === 'cancelled' ? 'danger' : 'primary'}
                onClick={runStatusChange}
                isLoading={busy}
                className="min-h-[44px] sm:px-5"
              >
                {pending?.to === 'cancelled' ? 'Cancel registration' : 'Restore registration'}
              </Button>
            </>
          }
        >
          {pending && (
            <div className="text-[15px] text-ink-soft leading-relaxed">
              <b className="font-semibold text-ink">{pending.reg.name}</b> ({formatMobile(pending.reg.mobile)})
              {pending.reg.playCategory ? ` · ${pending.reg.playCategory}` : ''}
              {pending.to === 'cancelled'
                ? ' will be marked as cancelled and their place freed. You can restore it later.'
                : ' will be registered again.'}
              {restoringOverCapacity && (
                <span className="block mt-2 text-[13px] font-medium text-amber-800">
                  The event is already full ({event.capacity}). Restoring takes it over the limit.
                </span>
              )}
              {pending.to === 'cancelled' && (
                <span className="block mt-2 text-[13px] text-ink-muted">The player isn’t told automatically. Let them know if needed.</span>
              )}
            </div>
          )}
        </Modal>
      </InBody>
    </div>
  );
};

// =====================================================================
// Manager
// =====================================================================

export const EventsManager: React.FC = () => {
  const { addToast } = useApp();
  const rootRef = useRef<HTMLDivElement>(null);
  const [events, setEvents] = useState<SiteEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SiteEvent | 'new' | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SiteEvent | null>(null);
  const [deleteRegs, setDeleteRegs] = useState<EventRegistration[] | null>(null);
  const [deleteRegsLoading, setDeleteRegsLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [showPast, setShowPast] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const list = await contentService.listEvents();
      setEvents(Array.isArray(list) ? list : []);
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load events.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  const replaceEvent = (saved: SiteEvent) => setEvents((list) => list.map((x) => (x.id === saved.id ? saved : x)));

  const toggleActive = async (e: SiteEvent) => {
    if (busyIds.has(e.id)) return;
    const next = !e.isActive;
    markBusy(e.id, true);
    try {
      const saved = await contentService.updateEvent(e.id, { isActive: next });
      replaceEvent(saved);
      setAnnouncement(`${e.title} ${next ? 'published' : 'hidden'}`);
      addToast(
        'success',
        next ? 'Event published' : 'Event hidden',
        next ? `“${e.title}” is on the website again.` : `“${e.title}” is hidden from the website.`
      );
    } catch (err) {
      addToast('error', 'Could not update the event', errorMessage(err));
    } finally {
      markBusy(e.id, false);
    }
  };

  const openDelete = async (e: SiteEvent) => {
    setToDelete(e);
    setDeleteRegs(null);
    if (e.registrationMode !== 'form' && e.registrationCount === 0) {
      setDeleteRegs([]);
      return;
    }
    setDeleteRegsLoading(true);
    try {
      const list = await contentService.listEventRegistrations(e.id);
      setDeleteRegs(Array.isArray(list) ? list : []);
    } catch {
      setDeleteRegs(null); // fall back to the event's own count
    } finally {
      setDeleteRegsLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await contentService.deleteEvent(toDelete.id);
      setEvents((list) => list.filter((x) => x.id !== toDelete.id));
      addToast('success', 'Event deleted', `“${toDelete.title}” was removed.`);
      setToDelete(null);
    } catch (err) {
      addToast('error', 'Delete failed', errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const openRegistrations = (id: string) => {
    setViewingId(id);
    requestAnimationFrame(() => scrollWithin(rootRef.current, 'start'));
  };

  const closeRegistrations = () => {
    const id = viewingId;
    setViewingId(null);
    load(true);
    requestAnimationFrame(() => {
      const row = id ? document.getElementById(`event-row-${id}`) : null;
      scrollWithin(row || rootRef.current, row ? 'center' : 'start');
    });
  };

  const current = useMemo(() => events.filter((e) => e.status !== 'past').sort(byStartAsc), [events]);
  const past = useMemo(() => events.filter((e) => e.status === 'past').sort((a, b) => -byStartAsc(a, b)), [events]);

  const stats = useMemo(() => {
    const live = current.filter((e) => e.isActive);
    return {
      live: live.length,
      banners: current.filter(inHomepageBanner).length,
      open: live.filter((e) => e.registrationOpen).length,
      registrations: current.reduce((sum, e) => sum + (e.registrationCount || 0), 0),
    };
  }, [current]);

  const viewing = viewingId ? events.find((e) => e.id === viewingId) : null;

  useEffect(() => {
    if (viewingId && !loading && !viewing) setViewingId(null);
  }, [viewingId, viewing, loading]);

  const renderRow = (e: SiteEvent) => (
    <EventRow
      key={e.id}
      domId={`event-row-${e.id}`}
      event={e}
      busy={busyIds.has(e.id)}
      onEdit={() => setEditing(e)}
      onRegistrations={() => openRegistrations(e.id)}
      onToggleActive={() => toggleActive(e)}
      onDelete={() => openDelete(e)}
    />
  );

  const deleteCounts = deleteRegs
    ? { total: deleteRegs.length, active: deleteRegs.filter((r) => r.status === 'registered').length }
    : toDelete
      ? { total: toDelete.registrationCount, active: toDelete.registrationCount }
      : { total: 0, active: 0 };

  return (
    <div ref={rootRef} className="space-y-4 min-w-0 scroll-mt-4">
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      {viewing ? (
        <RegistrationsView key={viewing.id} event={viewing} onBack={closeRegistrations} onChanged={() => load(true)} />
      ) : (
        <>
          <SectionHeader
            title="Events"
            description="Tournaments, coaching camps, clinics and store events. Events marked “Show in homepage banner” lead the photo slider at the top of the homepage until they end."
            actions={
              <Button
                type="button"
                onClick={() => setEditing('new')}
                leftIcon={<Plus className="w-4 h-4" />}
                className="min-h-[44px] px-5"
                disabled={loading && events.length === 0 && !loadError}
              >
                Add event
              </Button>
            }
          />

          {loading && events.length === 0 ? (
            <ListSkeleton rows={2} />
          ) : loadError && events.length === 0 ? (
            <ErrorState message={loadError} onRetry={() => load()} retrying={loading} />
          ) : events.length === 0 ? (
            <EmptyState
              title="No events yet"
              description="Add a tournament, coaching camp or store event. With a banner photo it can lead the homepage slider."
              actionText="Add event"
              onAction={() => setEditing('new')}
            />
          ) : (
            <>
              <StatGrid>
                <StatTile label="Upcoming & ongoing" value={stats.live} />
                <StatTile label="In homepage banner" value={stats.banners} tone={stats.banners ? 'default' : 'warn'} />
                <StatTile label="Registration open" value={stats.open} />
                <StatTile label="Website registrations" value={stats.registrations} />
              </StatGrid>

              {loadError && <RefreshFailed message={loadError} onRetry={() => load()} retrying={loading} />}

              {current.length === 0 ? (
                <div className={`${cardClass} px-6 py-10 text-center`}>
                  <p className="text-[16px] font-semibold text-ink">No upcoming events</p>
                  <p className="mt-1 text-[14px] text-ink-muted">Add the next tournament or camp so it shows on the homepage.</p>
                  <Button
                    type="button"
                    className="mt-4 min-h-[44px] px-5"
                    onClick={() => setEditing('new')}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Add event
                  </Button>
                </div>
              ) : (
                <ul className="space-y-3" aria-label="Upcoming and ongoing events">
                  {current.map(renderRow)}
                </ul>
              )}

              {past.length > 0 && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowPast((v) => !v)}
                    aria-expanded={showPast}
                    aria-controls="past-events"
                    className={`w-full flex items-center justify-between gap-2 min-h-[48px] px-4 rounded-2xl border border-line bg-white text-[15px] font-semibold text-ink transition-colors duration-150 hover:bg-paper ${focusRing}`}
                  >
                    <span>
                      Past events <span className="text-ink-muted font-medium tabular-nums">({past.length})</span>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-ink-muted transition-transform duration-200 motion-reduce:transition-none ${showPast ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  {showPast && (
                    <ul id="past-events" className="space-y-3" aria-label="Past events">
                      {past.map(renderRow)}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {editing && (
        <EventFormModal
          key={editing === 'new' ? 'new' : editing.id}
          event={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            setEvents((list) => (isNew ? [...list, saved] : list.map((x) => (x.id === saved.id ? saved : x))));
            setEditing(null);
            if (isNew && saved.status === 'past') setShowPast(true);
          }}
        />
      )}

      <InBody>
        <ConfirmDialog
          open={!!toDelete}
          title="Delete event?"
          busy={deleting}
          confirmLabel={deleteCounts.total > 0 ? `Delete event and ${deleteCounts.total} registration${deleteCounts.total === 1 ? '' : 's'}` : 'Delete event'}
          onCancel={() => setToDelete(null)}
          onConfirm={confirmDelete}
          message={
            toDelete ? (
              <>
                <b className="font-semibold text-ink">“{toDelete.title}”</b> will be removed from the website. This can’t be undone.
                {deleteRegsLoading ? (
                  <span className="block mt-2 text-[13px] text-ink-muted">Checking registrations…</span>
                ) : deleteCounts.total > 0 ? (
                  <span className="block mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-[14px] text-rose-800">
                    <b>
                      {deleteCounts.total} registration{deleteCounts.total === 1 ? '' : 's'}
                    </b>
                    {deleteCounts.total !== deleteCounts.active ? ` (${deleteCounts.active} active)` : ''} will also be
                    permanently deleted.
                    {deleteRegs && deleteRegs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => registrationsCsv(toDelete, deleteRegs.map((reg, i) => ({ reg, n: i + 1 })))}
                        className={`mt-1 flex items-center gap-1.5 min-h-[44px] font-semibold text-rose-800 underline underline-offset-4 rounded ${focusRing}`}
                      >
                        <Download className="w-3.5 h-3.5" /> Download them as CSV first
                      </button>
                    )}
                  </span>
                ) : null}
                <span className="block mt-2 text-[13px] text-ink-muted">Tip: use “Hide” instead if you may use it again.</span>
              </>
            ) : null
          }
        />
      </InBody>
    </div>
  );
};

export default EventsManager;
