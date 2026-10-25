/**
 * Setup: venues (details, photos, hours, prices, booking rules), their courts, and blocked times.
 * The server validates everything again and refuses deletes that would strand upcoming bookings
 * (409, shown as is).
 */
import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  ImageOff,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { courtService } from '../../../services/courtService';
import type { Court, CourtBlock, CourtBlockInput, CourtVenue, CourtVenueInput } from '../../../types/courts';
import { Button } from '../../common/Button';
import { formatINR } from '../../../utils/format';
import { MediaUpload } from '../content/MediaUpload';
import { Field, Modal, Switch, inputClass, inputErrorClass } from '../content/shared';
import {
  ConfirmLayer,
  ConfirmState,
  HATCH_STYLE,
  InlineError,
  Portal,
  WEEKDAYS,
  blockIsOver,
  cardCls,
  describeBlockDays,
  errText,
  fmtRange,
  fmtTime,
  inputCls,
  sectionLabel,
  toMin,
  todayIso,
  venueBoundaries,
} from './shared';

const MAX_PHOTOS = 6;
const AMENITY_SUGGESTIONS = ['Wooden floor', 'Synthetic mat', 'Parking', 'Drinking water', 'Washrooms', 'Changing room', 'Racket rental', 'Shuttles for sale'];
const TIME_RE = /^([01]\d|2[0-4]):([0-5]\d)$/;

const isAllowedPhotoUrl = (url: string): boolean => {
  const v = url.trim();
  if (!v || /\s/.test(v)) return false;
  if (v.startsWith('/') && !v.startsWith('//')) return true;
  return /^https:\/\/[^/]/i.test(v) || /^http:\/\/(localhost|127\.0\.0\.1)[:/]/i.test(v);
};

const sortCourts = (list: Court[]) => [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

// =====================================================================
// Venue form
// =====================================================================
interface VenueForm {
  name: string;
  address: string;
  area: string;
  mapsUrl: string;
  description: string;
  photos: string[];
  amenities: string[];
  rules: string;
  openTime: string;
  closeTime: string;
  slotMinutes: 30 | 60;
  pricePerHour: string;
  peakPricePerHour: string;
  peakStart: string;
  peakEnd: string;
  weekendPricePerHour: string;
  advanceDays: string;
  maxSlotsPerBooking: string;
  cancellationHours: string;
  isActive: boolean;
}

const numStr = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '' : String(n));

const toForm = (v: CourtVenue | null): VenueForm => ({
  name: v?.name ?? '',
  address: v?.address ?? '',
  area: v?.area ?? '',
  mapsUrl: v?.mapsUrl ?? '',
  description: v?.description ?? '',
  photos: Array.isArray(v?.photos) ? v!.photos.filter(Boolean) : [],
  amenities: Array.isArray(v?.amenities) ? v!.amenities.filter(Boolean) : [],
  rules: v?.rules ?? '',
  openTime: v?.openTime ?? '06:00',
  closeTime: v?.closeTime ?? '22:00',
  slotMinutes: v?.slotMinutes === 30 ? 30 : 60,
  pricePerHour: numStr(v?.pricePerHour),
  peakPricePerHour: numStr(v?.peakPricePerHour),
  peakStart: v?.peakStart ?? '',
  peakEnd: v?.peakEnd ?? '',
  weekendPricePerHour: numStr(v?.weekendPricePerHour),
  advanceDays: numStr(v?.advanceDays ?? 14),
  maxSlotsPerBooking: numStr(v?.maxSlotsPerBooking ?? 4),
  cancellationHours: numStr(v?.cancellationHours ?? 12),
  isActive: v?.isActive ?? true,
});

type VenueErrors = Partial<Record<keyof VenueForm, string>>;

const validateVenue = (f: VenueForm): { errors: VenueErrors; input: CourtVenueInput | null } => {
  const e: VenueErrors = {};
  if (!f.name.trim()) e.name = 'Venue name is required.';
  if (!f.address.trim()) e.address = 'Address is required.';
  if (f.mapsUrl.trim() && !/^https:\/\/\S+$/i.test(f.mapsUrl.trim())) e.mapsUrl = 'Use the https:// link from Google Maps (Share → Copy link).';
  if (f.photos.length > MAX_PHOTOS) e.photos = `Up to ${MAX_PHOTOS} photos.`;
  else if (f.photos.some((u) => !isAllowedPhotoUrl(u))) e.photos = 'Every photo must be an https:// link or a site path.';
  const open = toMin(f.openTime);
  const close = toMin(f.closeTime);
  if (!TIME_RE.test(f.openTime)) e.openTime = 'Enter the opening time.';
  else if (open % 30 !== 0) e.openTime = 'Use a time on the hour or half hour.';
  if (!TIME_RE.test(f.closeTime)) e.closeTime = 'Enter the closing time.';
  else if (close % 30 !== 0) e.closeTime = 'Use a time on the hour or half hour.';
  else if (!e.openTime && close <= open) e.closeTime = 'Closing must be after opening.';
  else if (!e.openTime && (close - open) % f.slotMinutes !== 0)
    e.closeTime = `The hours must divide into ${f.slotMinutes}-minute slots.`;
  const price = Number(f.pricePerHour);
  if (!f.pricePerHour.trim()) e.pricePerHour = 'Enter the price per hour.';
  else if (!Number.isFinite(price) || price <= 0) e.pricePerHour = 'Enter a price above ₹0.';
  let peak: number | null = null;
  const peakAny = f.peakPricePerHour.trim() || f.peakStart || f.peakEnd;
  if (peakAny) {
    peak = Number(f.peakPricePerHour);
    if (!f.peakPricePerHour.trim() || !Number.isFinite(peak) || peak <= 0) e.peakPricePerHour = 'Enter the peak price, or clear the peak times.';
    if (!TIME_RE.test(f.peakStart)) e.peakStart = 'Peak start time.';
    if (!TIME_RE.test(f.peakEnd)) e.peakEnd = 'Peak end time.';
    else if (!e.peakStart && toMin(f.peakEnd) <= toMin(f.peakStart)) e.peakEnd = 'Must be after the peak start.';
    else if (!e.peakStart && !e.openTime && !e.closeTime && (toMin(f.peakStart) < open || toMin(f.peakEnd) > close))
      e.peakEnd = 'The peak window must be inside the opening hours.';
  }
  let weekend: number | null = null;
  if (f.weekendPricePerHour.trim()) {
    weekend = Number(f.weekendPricePerHour);
    if (!Number.isFinite(weekend) || weekend <= 0) e.weekendPricePerHour = 'Enter a price above ₹0, or leave it empty.';
  }
  const adv = Number(f.advanceDays);
  if (!Number.isInteger(adv) || adv < 1 || adv > 90) e.advanceDays = '1–90 days.';
  const maxSlots = Number(f.maxSlotsPerBooking);
  if (!Number.isInteger(maxSlots) || maxSlots < 1 || maxSlots > 12) e.maxSlotsPerBooking = '1–12 slots.';
  const cancelH = Number(f.cancellationHours);
  if (!Number.isFinite(cancelH) || cancelH < 0 || cancelH > 168) e.cancellationHours = '0–168 hours.';
  if (Object.keys(e).length) return { errors: e, input: null };
  const opt = (s: string) => (s.trim() ? s.trim() : null);
  return {
    errors: e,
    input: {
      name: f.name.trim(),
      address: f.address.trim(),
      area: opt(f.area),
      mapsUrl: opt(f.mapsUrl),
      description: opt(f.description),
      photos: f.photos,
      amenities: f.amenities,
      rules: opt(f.rules),
      openTime: f.openTime,
      closeTime: f.closeTime,
      slotMinutes: f.slotMinutes,
      pricePerHour: Math.round(price * 100) / 100,
      peakPricePerHour: peak !== null ? Math.round(peak * 100) / 100 : null,
      peakStart: peak !== null ? f.peakStart : null,
      peakEnd: peak !== null ? f.peakEnd : null,
      weekendPricePerHour: weekend !== null ? Math.round(weekend * 100) / 100 : null,
      advanceDays: adv,
      maxSlotsPerBooking: maxSlots,
      cancellationHours: cancelH,
      isActive: f.isActive,
    },
  };
};

const PhotoTile: React.FC<{ url: string; index: number; count: number; onMove: (from: number, to: number) => void; onRemove: () => void }> = ({
  url,
  index,
  count,
  onMove,
  onRemove,
}) => {
  const [broken, setBroken] = useState(false);
  const btn =
    'flex-1 min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-slate-600 hover:bg-paper disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <li className={`rounded-2xl border bg-white overflow-hidden flex flex-col ${index === 0 ? 'border-amber-300 ring-2 ring-accent' : 'border-line'}`}>
      <div className="relative aspect-[4/3] bg-paper">
        {broken ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400 p-2 text-center">
            <ImageOff className="w-6 h-6" />
            <span className="text-[10px] font-semibold">Can't load this photo</span>
          </div>
        ) : (
          <img src={url} alt={`Venue photo ${index + 1}`} loading="lazy" onError={() => setBroken(true)} className="absolute inset-0 w-full h-full object-cover" />
        )}
        <span
          className={`absolute top-1.5 left-1.5 text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${
            index === 0 ? 'bg-accent text-ink' : 'bg-white/90 border border-line text-slate-600'
          }`}
        >
          {index === 0 ? 'Main photo' : `#${index + 1}`}
        </span>
      </div>
      <div className="flex border-t border-line/70 divide-x divide-line/70">
        <button type="button" className={btn} disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Move photo ${index + 1} left`}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" className={btn} disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={`Move photo ${index + 1} right`}>
          <ChevronRight className="w-4 h-4" />
        </button>
        <button type="button" className={`${btn} text-rose-600 hover:bg-rose-50`} onClick={onRemove} aria-label={`Remove photo ${index + 1}`}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
};

const VenueFormModal: React.FC<{
  venue: CourtVenue | null;
  onClose: () => void;
  onSaved: (v: CourtVenue, isNew: boolean) => void;
}> = ({ venue, onClose, onSaved }) => {
  const { addToast } = useApp();
  const uid = useId();
  const [form, setForm] = useState<VenueForm>(() => toForm(venue));
  const [errors, setErrors] = useState<VenueErrors>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [amenityDraft, setAmenityDraft] = useState('');

  const set = <K extends keyof VenueForm>(key: K, value: VenueForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const addPhoto = (url: string | null, uploaded: boolean) => {
    if (!url) return;
    const v = url.trim();
    if (!isAllowedPhotoUrl(v)) {
      addToast(
        'error',
        'Photo not added',
        uploaded ? 'The upload worked, but the server returned a non-secure (http) link.' : 'Use a secure link starting with https:// (or a site path starting with /).'
      );
      return;
    }
    if (form.photos.includes(v)) return;
    if (form.photos.length >= MAX_PHOTOS) {
      addToast('error', 'Photo limit reached', `A venue can have up to ${MAX_PHOTOS} photos.`);
      return;
    }
    set('photos', [...form.photos, v]);
  };
  const movePhoto = (from: number, to: number) => {
    if (to < 0 || to >= form.photos.length) return;
    const next = [...form.photos];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    set('photos', next);
  };

  const addAmenity = (raw: string) => {
    const v = raw.trim().replace(/\s+/g, ' ');
    if (!v) return;
    if (v.length > 40) {
      addToast('info', 'Keep it short', 'Amenities are shown as small tags — 40 characters at most.');
      return;
    }
    if (!form.amenities.some((a) => a.toLowerCase() === v.toLowerCase())) set('amenities', [...form.amenities, v]);
    setAmenityDraft('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || uploading) return;
    const { errors: errs, input } = validateVenue(form);
    setErrors(errs);
    if (!input) {
      setSaveError('Please fix the highlighted fields.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const saved = venue ? await courtService.updateVenue(venue.id, input) : await courtService.createVenue(input);
      addToast('success', venue ? 'Venue updated' : 'Venue added', venue ? `${saved.name} saved.` : `${saved.name} saved — now add its courts.`);
      onSaved(saved, !venue);
    } catch (err) {
      setSaveError(errText(err, 'Could not save the venue.'));
    } finally {
      setSaving(false);
    }
  };

  const ic = (k: keyof VenueForm) => `${inputClass} ${errors[k] ? inputErrorClass : ''}`;
  const formId = 'court-venue-form';
  const unused = AMENITY_SUGGESTIONS.filter((s) => !form.amenities.some((a) => a.toLowerCase() === s.toLowerCase()));

  return (
    <Portal>
      <Modal
        open
        size="lg"
        title={venue ? `Edit ${venue.name}` : 'New venue'}
        subtitle="What customers see when they book, plus the hours, prices and booking rules."
        onClose={onClose}
        busy={saving}
        footer={
          <>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="min-h-[42px]">
              Cancel
            </Button>
            <Button type="submit" form={formId} isLoading={saving} disabled={uploading} className="min-h-[42px]">
              {uploading ? 'Waiting for upload…' : venue ? 'Save changes' : 'Save venue'}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="space-y-5" noValidate>
          {saveError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700" role="alert">
              {saveError}
            </div>
          )}

          <div className="space-y-3">
            <p className={sectionLabel}>Venue</p>
            <Field label="Name" htmlFor={`${uid}-name`} required error={errors.name}>
              <input id={`${uid}-name`} value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={120} placeholder="e.g. GR Sports Courts" className={ic('name')} />
            </Field>
            <Field label="Address" htmlFor={`${uid}-address`} required error={errors.address}>
              <textarea id={`${uid}-address`} rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={300} className={`${ic('address')} resize-y`} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Area" htmlFor={`${uid}-area`}>
                <input id={`${uid}-area`} value={form.area} onChange={(e) => set('area', e.target.value)} maxLength={80} className={inputClass} />
              </Field>
              <Field label="Google Maps link" htmlFor={`${uid}-maps`} error={errors.mapsUrl} hint="Share → Copy link in Google Maps.">
                <input id={`${uid}-maps`} type="url" value={form.mapsUrl} onChange={(e) => set('mapsUrl', e.target.value)} placeholder="https://maps.app.goo.gl/…" className={ic('mapsUrl')} />
              </Field>
            </div>
            <Field label="Description" htmlFor={`${uid}-desc`}>
              <textarea id={`${uid}-desc`} rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={1000} className={`${inputClass} resize-y`} />
            </Field>
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="block text-xs font-semibold text-slate-700">Photos</span>
              <span className={`text-[11px] font-bold ${form.photos.length >= MAX_PHOTOS ? 'text-amber-700' : 'text-slate-500'}`}>
                {form.photos.length}/{MAX_PHOTOS}
              </span>
            </div>
            {form.photos.length > 0 ? (
              <ul className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-2">
                {form.photos.map((url, i) => (
                  <PhotoTile key={url} url={url} index={i} count={form.photos.length} onMove={movePhoto} onRemove={() => set('photos', form.photos.filter((_, j) => j !== i))} />
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-500">No photos yet — real photos of the courts help customers choose.</p>
            )}
            <div hidden={form.photos.length >= MAX_PHOTOS}>
              <MediaUpload
                label={form.photos.length ? 'Add another photo' : 'Add main photo'}
                value={null}
                onChange={(url, info) => addPhoto(url, !!info?.media)}
                aspectClass="aspect-[4/3]"
                contain={false}
                compact
                hint="The courts, the entrance and the parking."
                onUploadingChange={setUploading}
                error={errors.photos}
              />
            </div>
          </div>

          {/* Amenities */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-700">Amenities</span>
            {form.amenities.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {form.amenities.map((a) => (
                  <li key={a} className="inline-flex items-center gap-1 pl-3 pr-1 min-h-[32px] rounded-full bg-paper border border-line text-xs font-semibold text-slate-800">
                    {a}
                    <button
                      type="button"
                      onClick={() => set('amenities', form.amenities.filter((x) => x !== a))}
                      aria-label={`Remove ${a}`}
                      className="w-7 h-7 rounded-full inline-flex items-center justify-center text-slate-500 hover:bg-white hover:text-rose-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                value={amenityDraft}
                onChange={(e) => setAmenityDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAmenity(amenityDraft);
                  }
                }}
                placeholder="Type an amenity and press Enter"
                aria-label="New amenity"
                maxLength={40}
                className={`${inputClass} flex-1 min-w-0`}
              />
              <Button type="button" variant="outline" size="sm" className="min-h-[42px] shrink-0" onClick={() => addAmenity(amenityDraft)} disabled={!amenityDraft.trim()}>
                Add
              </Button>
            </div>
            {unused.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {unused.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addAmenity(s)}
                    className="inline-flex items-center gap-1 px-2.5 min-h-[32px] rounded-full border border-dashed border-slate-300 text-[11px] font-semibold text-slate-600 hover:bg-paper"
                  >
                    <Plus className="w-3 h-3" /> {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Field label="Rules" htmlFor={`${uid}-rules`} hint="Shown to customers before they book, e.g. non-marking shoes only.">
            <textarea id={`${uid}-rules`} rows={2} value={form.rules} onChange={(e) => set('rules', e.target.value)} maxLength={1000} className={`${inputClass} resize-y`} />
          </Field>

          {/* Hours */}
          <div className="space-y-3 p-3 rounded-2xl border border-line">
            <p className={sectionLabel}>Hours & slots</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Opens" htmlFor={`${uid}-open`} required error={errors.openTime}>
                <input id={`${uid}-open`} type="time" step={1800} value={form.openTime} onChange={(e) => set('openTime', e.target.value)} className={ic('openTime')} />
              </Field>
              <Field label="Closes (last slot ends)" htmlFor={`${uid}-close`} required error={errors.closeTime}>
                <input id={`${uid}-close`} type="time" step={1800} value={form.closeTime} onChange={(e) => set('closeTime', e.target.value)} className={ic('closeTime')} />
              </Field>
              <div className="col-span-2 sm:col-span-1">
                <span className="block text-xs font-semibold text-slate-700 mb-1">Slot length</span>
                <div className="flex gap-2" role="group" aria-label="Slot length">
                  {([60, 30] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={form.slotMinutes === m}
                      onClick={() => set('slotMinutes', m)}
                      className={`flex-1 min-h-[42px] rounded-xl text-xs font-bold border ${
                        form.slotMinutes === m ? 'bg-ink border-ink text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-paper'
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Prices */}
          <div className="space-y-3 p-3 rounded-2xl border border-line">
            <p className={sectionLabel}>Prices (one court, per hour)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Price per hour (₹)" htmlFor={`${uid}-price`} required error={errors.pricePerHour}>
                <input id={`${uid}-price`} type="number" inputMode="decimal" min={1} step="any" value={form.pricePerHour} onChange={(e) => set('pricePerHour', e.target.value)} className={ic('pricePerHour')} />
              </Field>
              <Field label="Weekend price per hour (₹, optional)" htmlFor={`${uid}-weekend`} error={errors.weekendPricePerHour} hint="All day Saturday & Sunday (replaces the peak price).">
                <input
                  id={`${uid}-weekend`}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="any"
                  value={form.weekendPricePerHour}
                  onChange={(e) => set('weekendPricePerHour', e.target.value)}
                  className={ic('weekendPricePerHour')}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Peak price per hour (₹, optional)" htmlFor={`${uid}-peak`} error={errors.peakPricePerHour}>
                <input id={`${uid}-peak`} type="number" inputMode="decimal" min={1} step="any" value={form.peakPricePerHour} onChange={(e) => set('peakPricePerHour', e.target.value)} className={ic('peakPricePerHour')} />
              </Field>
              <Field label="Peak from" htmlFor={`${uid}-ps`} error={errors.peakStart}>
                <input id={`${uid}-ps`} type="time" step={1800} value={form.peakStart} onChange={(e) => set('peakStart', e.target.value)} className={ic('peakStart')} />
              </Field>
              <Field label="Peak until" htmlFor={`${uid}-pe`} error={errors.peakEnd}>
                <input id={`${uid}-pe`} type="time" step={1800} value={form.peakEnd} onChange={(e) => set('peakEnd', e.target.value)} className={ic('peakEnd')} />
              </Field>
            </div>
          </div>

          {/* Booking rules */}
          <div className="space-y-3 p-3 rounded-2xl border border-line">
            <p className={sectionLabel}>Booking rules</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Book up to (days ahead)" htmlFor={`${uid}-adv`} error={errors.advanceDays}>
                <input id={`${uid}-adv`} type="number" inputMode="numeric" min={1} max={90} value={form.advanceDays} onChange={(e) => set('advanceDays', e.target.value)} className={ic('advanceDays')} />
              </Field>
              <Field label="Max slots per booking" htmlFor={`${uid}-max`} error={errors.maxSlotsPerBooking}>
                <input id={`${uid}-max`} type="number" inputMode="numeric" min={1} max={12} value={form.maxSlotsPerBooking} onChange={(e) => set('maxSlotsPerBooking', e.target.value)} className={ic('maxSlotsPerBooking')} />
              </Field>
              <Field label="Customers can cancel until (hours before)" htmlFor={`${uid}-cancel`} error={errors.cancellationHours}>
                <input id={`${uid}-cancel`} type="number" inputMode="numeric" min={0} max={168} value={form.cancellationHours} onChange={(e) => set('cancellationHours', e.target.value)} className={ic('cancellationHours')} />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-line px-3">
            <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} label="Open for online booking" description="Turn off to hide this venue from customers (you can still book it here)." />
          </div>
        </form>
      </Modal>
    </Portal>
  );
};

// =====================================================================
// Courts
// =====================================================================
const CourtsEditor: React.FC<{ venue: CourtVenue; onCourtsChange: (courts: Court[]) => void }> = ({ venue, onCourtsChange }) => {
  const { addToast } = useApp();
  const courts = useMemo(() => sortCourts(venue.courts || []), [venue.courts]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; surface: string } | null>(null);
  const [draft, setDraft] = useState({ name: '', surface: '' });
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  useEffect(() => {
    setDraft({ name: `Court ${(venue.courts || []).length + 1}`, surface: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue.id, (venue.courts || []).length]);

  const replace = (c: Court) => onCourtsChange(courts.map((x) => (x.id === c.id ? { ...x, ...c } : x)));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      setError('Give the court a name, e.g. "Court 3".');
      return;
    }
    if (courts.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setError(`There is already a court called "${name}".`);
      return;
    }
    setBusy('add');
    setError(null);
    try {
      const sortOrder = courts.length ? Math.max(...courts.map((c) => c.sortOrder)) + 1 : 0;
      const c = await courtService.addCourt(venue.id, { name, surface: draft.surface.trim() || null, isActive: true, sortOrder });
      onCourtsChange([...courts, c]);
      addToast('success', 'Court added', `${c.name} can now be booked.`);
    } catch (err) {
      setError(errText(err, 'Could not add the court.'));
    } finally {
      setBusy(null);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      setError('The court needs a name.');
      return;
    }
    setBusy(editing.id);
    setError(null);
    try {
      const c = await courtService.updateCourt(editing.id, { name, surface: editing.surface.trim() || null });
      replace(c);
      setEditing(null);
    } catch (err) {
      setError(errText(err, 'Could not rename the court.'));
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (court: Court, isActive: boolean) => {
    setBusy(court.id);
    setError(null);
    try {
      const c = await courtService.updateCourt(court.id, { isActive });
      replace(c);
    } catch (err) {
      setError(errText(err, 'Could not change the court.'));
    } finally {
      setBusy(null);
    }
  };

  const move = async (index: number, to: number) => {
    if (to < 0 || to >= courts.length) return;
    const next = [...courts];
    const [it] = next.splice(index, 1);
    next.splice(to, 0, it);
    setBusy(it.id);
    setError(null);
    try {
      const changed = next.map((c, i) => ({ c, i })).filter(({ c, i }) => c.sortOrder !== i);
      const saved = await Promise.all(changed.map(({ c, i }) => courtService.updateCourt(c.id, { sortOrder: i })));
      const byId = new Map(saved.map((s) => [s.id, s]));
      onCourtsChange(next.map((c, i) => ({ ...c, ...(byId.get(c.id) || {}), sortOrder: byId.get(c.id)?.sortOrder ?? i })));
    } catch (err) {
      setError(errText(err, 'Could not change the order.'));
    } finally {
      setBusy(null);
    }
  };

  const askDelete = (court: Court) =>
    setConfirm({
      title: `Delete ${court.name}?`,
      message: <>Past bookings keep their details. If the court has upcoming bookings the server refuses — cancel or move them first, or switch the court off instead.</>,
      confirmLabel: 'Delete court',
      danger: true,
      onConfirm: async () => {
        setBusy(court.id);
        setError(null);
        try {
          await courtService.deleteCourt(court.id);
          onCourtsChange(courts.filter((c) => c.id !== court.id));
          addToast('success', 'Court deleted', `${court.name} was removed.`);
        } catch (err) {
          setError(errText(err, 'Could not delete the court.'));
        } finally {
          setBusy(null);
        }
      },
    });

  const iconBtn =
    'w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-paper disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div className={`${cardCls} p-4 sm:p-5 space-y-3`}>
      <div>
        <h3 className="text-sm font-bold text-slate-900">Courts</h3>
        <p className="text-[11px] text-slate-500">The order here is the column order in the day view and on the booking page.</p>
      </div>
      {error && <InlineError>{error}</InlineError>}
      {courts.length === 0 ? (
        <p className="text-xs text-slate-500">No courts yet — add the first one below.</p>
      ) : (
        <ul className="divide-y divide-line/70 border border-line rounded-xl">
          {courts.map((c, i) => (
            <li key={c.id} className="p-2 sm:p-2.5 flex flex-wrap sm:flex-nowrap items-center gap-2">
              {editing?.id === c.id ? (
                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr,1fr,auto] gap-2">
                  <input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    aria-label="Court name"
                    maxLength={60}
                    autoFocus
                    className={inputCls}
                  />
                  <input
                    value={editing.surface}
                    onChange={(e) => setEditing({ ...editing, surface: e.target.value })}
                    aria-label="Surface"
                    placeholder="Surface (optional)"
                    maxLength={60}
                    className={inputCls}
                  />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" className="min-h-[40px]" onClick={() => setEditing(null)} disabled={busy === c.id}>
                      Cancel
                    </Button>
                    <Button type="button" size="sm" className="min-h-[40px]" onClick={saveEdit} isLoading={busy === c.id}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${c.isActive ? 'text-slate-900' : 'text-slate-400'}`}>{c.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {!c.isActive && <span className="font-bold text-slate-600">Off · </span>}
                      {c.surface || 'No surface noted'}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 ml-auto">
                    <Switch checked={c.isActive} onChange={(v) => toggle(c, v)} label={`${c.name} bookable`} hideLabel disabled={!!busy} />
                    <button type="button" className={iconBtn} onClick={() => move(i, i - 1)} disabled={i === 0 || !!busy} aria-label={`Move ${c.name} up`}>
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button type="button" className={iconBtn} onClick={() => move(i, i + 1)} disabled={i === courts.length - 1 || !!busy} aria-label={`Move ${c.name} down`}>
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className={iconBtn}
                      onClick={() => setEditing({ id: c.id, name: c.name, surface: c.surface || '' })}
                      disabled={!!busy}
                      aria-label={`Rename ${c.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" className={`${iconBtn} text-rose-600 hover:bg-rose-50`} onClick={() => askDelete(c)} disabled={!!busy} aria-label={`Delete ${c.name}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,auto] gap-2" noValidate>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="New court name" placeholder="Court name" maxLength={60} className={inputCls} />
        <input
          value={draft.surface}
          onChange={(e) => setDraft({ ...draft, surface: e.target.value })}
          aria-label="New court surface"
          placeholder="Surface, e.g. Wooden (optional)"
          maxLength={60}
          className={inputCls}
        />
        <Button type="submit" size="sm" className="min-h-[40px]" isLoading={busy === 'add'} disabled={!!busy && busy !== 'add'} leftIcon={<Plus className="w-4 h-4" />}>
          Add court
        </Button>
      </form>
      <ConfirmLayer confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
};

// =====================================================================
// Blocked times
// =====================================================================
const BlockFormModal: React.FC<{ venue: CourtVenue; onClose: () => void; onSaved: (b: CourtBlock) => void }> = ({ venue, onClose, onSaved }) => {
  const { addToast } = useApp();
  const uid = useId();
  const bounds = venueBoundaries(venue);
  const [kind, setKind] = useState<'single' | 'weekly'>('single');
  const [date, setDate] = useState(todayIso());
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState('');
  const [startTime, setStartTime] = useState(bounds[0] || '');
  const [endTime, setEndTime] = useState(bounds[1] || '');
  const [courtId, setCourtId] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const toggleDay = (d: number) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort((a, b) => a - b)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const errs: Record<string, string> = {};
    if (kind === 'single' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errs.date = 'Choose the date.';
    if (kind === 'weekly') {
      if (weekdays.length === 0) errs.weekdays = 'Choose at least one day.';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) errs.fromDate = 'Choose the first date.';
      if (toDate && toDate < fromDate) errs.toDate = 'Must be on or after the first date.';
    }
    if (!startTime) errs.startTime = 'Choose the start.';
    if (!endTime || toMin(endTime) <= toMin(startTime)) errs.endTime = 'Must be after the start.';
    if (reason.trim().length < 3) errs.reason = 'Say why, e.g. "Coaching batch" (only staff see this).';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const input: CourtBlockInput = {
      venueId: venue.id,
      courtId: courtId || null,
      date: kind === 'single' ? date : null,
      weekdays: kind === 'weekly' ? weekdays : null,
      fromDate: kind === 'weekly' ? fromDate : null,
      toDate: kind === 'weekly' ? toDate || null : null,
      startTime,
      endTime,
      reason: reason.trim(),
    };
    setSaving(true);
    setSaveError(null);
    try {
      const b = await courtService.createBlock(input);
      addToast('success', 'Time blocked', `${fmtRange(b.startTime, b.endTime)} · ${b.reason}`);
      onSaved(b);
    } catch (err) {
      setSaveError(errText(err, 'Could not block this time.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleBtn = (on: boolean) =>
    `flex-1 min-h-[42px] rounded-xl text-xs font-bold border ${on ? 'bg-ink border-ink text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-paper'}`;
  const formId = 'court-block-form';
  const activeCourts = sortCourts(venue.courts || []);

  return (
    <Portal>
      <Modal
        open
        title="Block time"
        subtitle="Coaching batches, tournaments or maintenance. Customers just see “Not available”."
        onClose={onClose}
        busy={saving}
        footer={
          <>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="min-h-[42px]">
              Cancel
            </Button>
            <Button type="submit" form={formId} isLoading={saving} className="min-h-[42px]">
              Block time
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
          {saveError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700" role="alert">
              {saveError}
            </div>
          )}
          <div className="flex gap-2" role="group" aria-label="One date or every week">
            <button type="button" aria-pressed={kind === 'single'} onClick={() => setKind('single')} className={toggleBtn(kind === 'single')}>
              One date
            </button>
            <button type="button" aria-pressed={kind === 'weekly'} onClick={() => setKind('weekly')} className={toggleBtn(kind === 'weekly')}>
              Every week
            </button>
          </div>
          {kind === 'single' ? (
            <Field label="Date" htmlFor={`${uid}-date`} required error={errors.date}>
              <input id={`${uid}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} ${errors.date ? inputErrorClass : ''}`} />
            </Field>
          ) : (
            <>
              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1">Days</span>
                <div className="grid grid-cols-7 gap-1" role="group" aria-label="Days of the week">
                  {WEEKDAYS.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={weekdays.includes(i)}
                      onClick={() => toggleDay(i)}
                      className={`min-h-[40px] rounded-lg text-xs font-bold border ${
                        weekdays.includes(i) ? 'bg-ink border-ink text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-paper'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[
                    { label: 'Mon–Fri', days: [0, 1, 2, 3, 4] },
                    { label: 'Sat & Sun', days: [5, 6] },
                    { label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] },
                  ].map((p) => (
                    <button key={p.label} type="button" onClick={() => setWeekdays(p.days)} className="min-h-[32px] px-2.5 rounded-full border border-dashed border-slate-300 text-[11px] font-semibold text-slate-600 hover:bg-paper">
                      {p.label}
                    </button>
                  ))}
                </div>
                {errors.weekdays && <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.weekdays}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From" htmlFor={`${uid}-from`} required error={errors.fromDate}>
                  <input id={`${uid}-from`} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={`${inputClass} ${errors.fromDate ? inputErrorClass : ''}`} />
                </Field>
                <Field label="Until (optional)" htmlFor={`${uid}-to`} error={errors.toDate} hint="Leave empty to keep repeating.">
                  <input id={`${uid}-to`} type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} className={`${inputClass} ${errors.toDate ? inputErrorClass : ''}`} />
                </Field>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="From time" htmlFor={`${uid}-st`} required error={errors.startTime}>
              <select id={`${uid}-st`} value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass}>
                {bounds.slice(0, -1).map((t) => (
                  <option key={t} value={t}>
                    {fmtTime(t)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Until" htmlFor={`${uid}-et`} required error={errors.endTime}>
              <select id={`${uid}-et`} value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`${inputClass} ${errors.endTime ? inputErrorClass : ''}`}>
                {bounds.slice(1).map((t) => (
                  <option key={t} value={t}>
                    {fmtTime(t)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Courts" htmlFor={`${uid}-court`}>
            <select id={`${uid}-court`} value={courtId} onChange={(e) => setCourtId(e.target.value)} className={inputClass}>
              <option value="">All courts</option>
              {activeCourts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reason" htmlFor={`${uid}-reason`} required error={errors.reason} hint="Only staff see this.">
            <input
              id={`${uid}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={120}
              placeholder="e.g. Coaching batch, Tournament, Floor maintenance"
              className={`${inputClass} ${errors.reason ? inputErrorClass : ''}`}
            />
          </Field>
          <p className="text-[11px] text-slate-500">Existing bookings in this time are not cancelled — check the day view and call those customers if needed.</p>
        </form>
      </Modal>
    </Portal>
  );
};

const BlocksEditor: React.FC<{ venue: CourtVenue; onChanged: () => void }> = ({ venue, onChanged }) => {
  const { addToast } = useApp();
  const [blocks, setBlocks] = useState<CourtBlock[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showOver, setShowOver] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const load = async () => {
    try {
      const list = await courtService.listBlocks(venue.id);
      setBlocks(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      setError(errText(err, 'Could not load the blocked times.'));
    } finally {
      setLoaded(true);
    }
  };
  useEffect(() => {
    setLoaded(false);
    setBlocks([]);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue.id]);

  const today = todayIso();
  const key = (b: CourtBlock) => `${b.date || b.fromDate || ''} ${b.startTime}`;
  const current = blocks.filter((b) => !blockIsOver(b, today)).sort((a, b) => key(a).localeCompare(key(b)));
  const over = blocks.filter((b) => blockIsOver(b, today)).sort((a, b) => key(b).localeCompare(key(a)));
  const courtName = (id?: string | null) => (id ? venue.courts.find((c) => c.id === id)?.name || 'One court' : 'All courts');

  const askDelete = (b: CourtBlock) =>
    setConfirm({
      title: 'Delete this blocked time?',
      message: (
        <>
          {describeBlockDays(b)}, {fmtRange(b.startTime, b.endTime)} ({courtName(b.courtId)}) — “{b.reason}”. Those slots become bookable again.
        </>
      ),
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await courtService.deleteBlock(b.id);
          setBlocks((list) => list.filter((x) => x.id !== b.id));
          addToast('success', 'Blocked time deleted', 'Those slots are bookable again.');
          onChanged();
        } catch (err) {
          setError(errText(err, 'Could not delete the blocked time.'));
        }
      },
    });

  const row = (b: CourtBlock, dim = false) => (
    <li key={b.id} className={`p-2.5 flex items-start gap-3 ${dim ? 'opacity-60' : ''}`}>
      <span className="w-9 h-9 shrink-0 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-500" style={HATCH_STYLE}>
        <Lock className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 break-words">{b.reason}</p>
        <p className="text-[11px] text-slate-600">
          {describeBlockDays(b)} · {fmtRange(b.startTime, b.endTime)} · {courtName(b.courtId)}
          {dim ? ' · over' : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={() => askDelete(b)}
        aria-label={`Delete blocked time ${b.reason}`}
        className="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </li>
  );

  return (
    <div className={`${cardCls} p-4 sm:p-5 space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">Blocked times</h3>
          <p className="text-[11px] text-slate-500">Times customers can't book (shown hatched in the day view).</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="min-h-[40px] shrink-0" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setAdding(true)} disabled={!venueBoundaries(venue).length}>
          Block time
        </Button>
      </div>
      {error && <InlineError>{error}</InlineError>}
      {!loaded ? (
        <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
      ) : current.length === 0 ? (
        <p className="text-xs text-slate-500">Nothing blocked{over.length ? ' from today on' : ''}.</p>
      ) : (
        <ul className="divide-y divide-line/70 border border-line rounded-xl">{current.map((b) => row(b))}</ul>
      )}
      {over.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowOver((s) => !s)} className="text-xs font-bold text-ink hover:underline min-h-[36px]">
            {showOver ? 'Hide' : 'Show'} past blocked times ({over.length})
          </button>
          {showOver && <ul className="divide-y divide-line/70 border border-line rounded-xl mt-1">{over.map((b) => row(b, true))}</ul>}
        </div>
      )}
      {adding && (
        <BlockFormModal
          venue={venue}
          onClose={() => setAdding(false)}
          onSaved={(b) => {
            setBlocks((list) => [...list, b]);
            setAdding(false);
            onChanged();
          }}
        />
      )}
      <ConfirmLayer confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
};

// =====================================================================
// Setup tab
// =====================================================================
export const SetupTab: React.FC<{
  venues: CourtVenue[];
  venueId: string;
  onVenueChange: (id: string) => void;
  onVenueSaved: (v: CourtVenue) => void;
  onVenueDeleted: (id: string) => void;
  /** Courts or blocks changed (refresh the day view). */
  onChanged: () => void;
}> = ({ venues, venueId, onVenueChange, onVenueSaved, onVenueDeleted, onChanged }) => {
  const { addToast } = useApp();
  const venue = venues.find((v) => v.id === venueId) || null;
  const [form, setForm] = useState<{ venue: CourtVenue | null } | null>(null);
  const [venueError, setVenueError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  useEffect(() => setVenueError(null), [venueId]);

  const askDeleteVenue = (v: CourtVenue) =>
    setConfirm({
      title: `Delete ${v.name}?`,
      message: (
        <>
          The venue, its {v.courts.length} {v.courts.length === 1 ? 'court' : 'courts'} and its blocked times are removed. If there are upcoming bookings the server
          refuses — switch off online booking instead.
        </>
      ),
      confirmLabel: 'Delete venue',
      danger: true,
      onConfirm: async () => {
        setVenueError(null);
        try {
          await courtService.deleteVenue(v.id);
          addToast('success', 'Venue deleted', `${v.name} was removed.`);
          onVenueDeleted(v.id);
        } catch (err) {
          setVenueError(errText(err, 'Could not delete the venue.'));
        }
      },
    });

  const price = (v: CourtVenue) => {
    const parts = [`${formatINR(v.pricePerHour)}/hr`];
    if (v.peakPricePerHour && v.peakStart && v.peakEnd) parts.push(`peak ${formatINR(v.peakPricePerHour)}/hr ${fmtRange(v.peakStart, v.peakEnd)}`);
    if (v.weekendPricePerHour) parts.push(`weekends ${formatINR(v.weekendPricePerHour)}/hr`);
    return parts.join(' · ');
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="bg-white p-3 rounded-2xl border border-line shadow-2xs flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        {venues.length > 0 ? (
          <div role="group" aria-label="Venue" className="flex gap-1.5 overflow-x-auto no-scrollbar min-w-0">
            {venues.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={v.id === venueId}
                onClick={() => onVenueChange(v.id)}
                className={`shrink-0 min-h-[40px] px-3.5 rounded-xl text-xs font-bold border whitespace-nowrap ${
                  v.id === venueId ? 'bg-ink text-white border-ink' : 'bg-white text-slate-700 border-line hover:bg-paper'
                }`}
              >
                {v.name}
                {!v.isActive && <span className="ml-1 font-normal opacity-70">(hidden)</span>}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600 px-1">No venues yet. Add your first venue to start taking court bookings.</p>
        )}
        <Button type="button" size="sm" className="min-h-[40px] shrink-0" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setForm({ venue: null })}>
          Add venue
        </Button>
      </div>

      {venue && (
        <>
          <div className={`${cardCls} overflow-hidden`}>
            <div className="flex flex-col sm:flex-row">
              <div className="sm:w-56 shrink-0 aspect-[16/9] sm:aspect-auto bg-paper relative">
                {venue.photos?.[0] ? (
                  <img src={venue.photos[0]} alt={venue.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-1">
                    <ImageOff className="w-6 h-6" />
                    <span className="text-[10px] font-semibold">No photos yet</span>
                  </div>
                )}
                {venue.photos?.length > 1 && (
                  <span className="absolute bottom-1.5 right-1.5 text-[10px] font-black bg-slate-900/75 text-white px-1.5 rounded">{venue.photos.length} photos</span>
                )}
              </div>
              <div className="flex-1 min-w-0 p-4 sm:p-5 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-slate-900 break-words">{venue.name}</h3>
                    <p className="text-xs text-slate-600 flex items-start gap-1 break-words">
                      <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {venue.address}
                      {venue.area ? `, ${venue.area}` : ''}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      venue.isActive ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600 border-line'
                    }`}
                  >
                    {venue.isActive ? 'Open for online booking' : 'Hidden from customers'}
                  </span>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex gap-1.5">
                    <dt className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Hours
                    </dt>
                    <dd className="text-slate-800 font-semibold">
                      {fmtRange(venue.openTime, venue.closeTime)} · {venue.slotMinutes}-min slots
                    </dd>
                  </div>
                  <div className="flex gap-1.5 min-w-0">
                    <dt className="text-slate-500">Price</dt>
                    <dd className="text-slate-800 font-semibold min-w-0 break-words">{price(venue)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-slate-500">Booking</dt>
                    <dd className="text-slate-800">
                      {venue.advanceDays} days ahead · up to {venue.maxSlotsPerBooking} {venue.maxSlotsPerBooking === 1 ? 'slot' : 'slots'}
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-slate-500">Cancel</dt>
                    <dd className="text-slate-800">until {venue.cancellationHours} hrs before</dd>
                  </div>
                </dl>
                {venue.amenities?.length > 0 && (
                  <ul className="flex flex-wrap gap-1">
                    {venue.amenities.map((a) => (
                      <li key={a} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-paper border border-line text-slate-700">
                        {a}
                      </li>
                    ))}
                  </ul>
                )}
                {venueError && <InlineError>{venueError}</InlineError>}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="button" size="sm" variant="outline" className="min-h-[40px]" leftIcon={<Pencil className="w-4 h-4" />} onClick={() => setForm({ venue })}>
                    Edit venue
                  </Button>
                  {venue.mapsUrl && (
                    <a
                      href={venue.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-paper"
                    >
                      <MapPin className="w-4 h-4" /> Map <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[40px] !text-rose-700 !border-rose-200 hover:!bg-rose-50"
                    leftIcon={<Trash2 className="w-4 h-4" />}
                    onClick={() => askDeleteVenue(venue)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            <CourtsEditor
              venue={venue}
              onCourtsChange={(courts) => {
                onVenueSaved({ ...venue, courts: sortCourts(courts) });
                onChanged();
              }}
            />
            <BlocksEditor venue={venue} onChanged={onChanged} />
          </div>
        </>
      )}

      {form && (
        <VenueFormModal
          venue={form.venue}
          onClose={() => setForm(null)}
          onSaved={(v) => {
            onVenueSaved({ ...v, courts: Array.isArray(v.courts) ? v.courts : form.venue?.courts || [] });
            onVenueChange(v.id);
            setForm(null);
            onChanged();
          }}
        />
      )}
      <ConfirmLayer confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
};
