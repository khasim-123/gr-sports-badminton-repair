/**
 * Admin: racket catalogue with real product photos.
 * The in-stock / out-of-stock button on each racket is one tap, optimistic, and rolls back
 * with a toast if the save fails (same pattern as the string colour toggle).
 */
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  EyeOff,
  ImageOff,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { contentService } from '../../../services/contentService';
import { Racket, RacketCondition, RacketInput } from '../../../types/content';
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
  NoMatches,
  Pills,
  RefreshFailed,
  SaveFailedNotice,
  SearchField,
  SectionHeader,
  StatGrid,
  StatTile,
  Switch,
  cardClass,
  chipClass,
  errorMessage,
  focusFirstInvalid,
  focusRing,
  hintClass,
  iconButtonDangerClass,
  inputClass,
  inputErrorClass,
  labelClass,
  nullIfEmpty,
  switchGroupClass,
} from './shared';

type FilterId = 'all' | 'used' | 'featured' | 'out' | 'noprice' | 'nophoto' | 'hidden';

export const MAX_RACKET_PHOTOS = 6;

const BRAND_SUGGESTIONS = ['Yonex', 'Li-Ning', 'Victor', 'Apacs', 'Hundred', 'Babolat', 'Nivia', 'Carlton'];
const BALANCE_OPTIONS = ['Head Heavy', 'Even Balance', 'Head Light'];
const FLEX_OPTIONS = ['Extra Stiff', 'Stiff', 'Medium', 'Flexible'];
const OTHER = '__other__';

const sortRackets = (list: Racket[]) =>
  [...list].sort((a, b) => a.sortOrder - b.sortOrder || racketLabel(a).localeCompare(racketLabel(b)));

const hasPrice = (r: Racket) => typeof r.price === 'number' && Number.isFinite(r.price);

const formatPrice = (price: number) => `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const racketLabel = (r: Pick<Racket, 'brand' | 'name'>) => {
  const brand = (r.brand || '').trim();
  const name = (r.name || '').trim();
  if (!brand || name.toLowerCase().startsWith(brand.toLowerCase())) return name;
  return `${brand} ${name}`;
};

const photosOf = (r: Racket): string[] => (Array.isArray(r.images) ? r.images.filter(Boolean) : []);

/** Same rule as the backend: https:// links, site paths (e.g. /images/rackets/x.webp),
 * or http://localhost uploads during local development. */
const isAllowedPhotoUrl = (url: string): boolean => {
  const v = url.trim();
  if (!v || /\s/.test(v)) return false;
  if (v.startsWith('/') && !v.startsWith('//')) return true;
  return /^https:\/\/[^/]/i.test(v) || /^http:\/\/(localhost|127\.0\.0\.1)[:/]/i.test(v);
};

// =====================================================================
// Photo manager (inside the form)
// =====================================================================

const PhotoTile: React.FC<{
  url: string;
  index: number;
  count: number;
  label: string;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}> = ({ url, index, count, label, onMove, onRemove }) => {
  const [broken, setBroken] = useState(false);
  const isMain = index === 0;
  const btn =
    'flex-1 min-w-[40px] min-h-[44px] inline-flex items-center justify-center text-ink-soft transition-colors duration-150 hover:bg-paper hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink';
  return (
    <li className={`rounded-2xl border bg-white overflow-hidden flex flex-col ${isMain ? 'border-ink' : 'border-line'}`}>
      <div className="relative aspect-square bg-white">
        {broken ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-ink-muted p-2 text-center">
            <ImageOff className="w-6 h-6" aria-hidden="true" />
            <span className="text-[13px] font-medium">Can’t load this photo</span>
          </div>
        ) : (
          <img
            src={url}
            alt={`${label || 'Racket'} photo ${index + 1}`}
            loading="lazy"
            onError={() => setBroken(true)}
            className="absolute inset-0 w-full h-full object-contain p-2"
          />
        )}
        <span
          className={`absolute top-1.5 left-1.5 text-[12px] font-semibold leading-none px-2 py-1 rounded-full ${
            isMain ? 'bg-ink text-white' : 'bg-white/95 border border-line text-ink-soft tabular-nums'
          }`}
        >
          {isMain ? 'Main photo' : index + 1}
        </span>
      </div>
      <div className="flex border-t border-line divide-x divide-line">
        <button
          type="button"
          className={btn}
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
          aria-label={`Move photo ${index + 1} left`}
          title="Move left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={`${btn} ${isMain ? '!text-ink' : ''}`}
          disabled={isMain}
          onClick={() => onMove(index, 0)}
          aria-label={isMain ? 'This is the main photo' : `Set photo ${index + 1} as main photo`}
          title={isMain ? 'Main photo' : 'Set as main photo'}
        >
          <Star className={`w-4 h-4 ${isMain ? 'fill-current' : ''}`} />
        </button>
        <button
          type="button"
          className={btn}
          disabled={index === count - 1}
          onClick={() => onMove(index, index + 1)}
          aria-label={`Move photo ${index + 1} right`}
          title="Move right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={`${btn} !text-rose-700 hover:!bg-rose-50`}
          onClick={() => onRemove(index)}
          aria-label={`Remove photo ${index + 1}`}
          title="Remove photo"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
};

const PhotosEditor: React.FC<{
  images: string[];
  label: string;
  onChange: (images: string[]) => void;
  onUploadingChange: (uploading: boolean) => void;
  error?: string | null;
}> = ({ images, label, onChange, onUploadingChange, error }) => {
  const { addToast } = useApp();
  const full = images.length >= MAX_RACKET_PHOTOS;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const remove = (index: number) => onChange(images.filter((_, i) => i !== index));

  const add = (url: string | null, uploaded: boolean) => {
    if (!url) return;
    const v = url.trim();
    if (!isAllowedPhotoUrl(v)) {
      addToast(
        'error',
        'Photo not added',
        uploaded
          ? 'The photo uploaded, but the server gave back a link the website can’t show safely. Please tell your website developer.'
          : 'Paste a secure link that starts with https://'
      );
      return;
    }
    if (images.includes(v)) {
      addToast('info', 'Already added', 'That photo is already in the list.');
      return;
    }
    if (images.length >= MAX_RACKET_PHOTOS) {
      addToast('error', 'Photo limit reached', `A racket can have up to ${MAX_RACKET_PHOTOS} photos.`);
      return;
    }
    onChange([...images, v]);
  };

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <p className={`text-[13px] ${full ? 'font-medium text-amber-800' : 'text-ink-muted'}`}>
          {images.length} of {MAX_RACKET_PHOTOS} photos{images.length > 1 ? ' · the first one is the main photo' : ''}
        </p>
      )}
      {images.length > 0 ? (
        <ul className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-3">
          {images.map((url, i) => (
            <PhotoTile
              key={url}
              url={url}
              index={i}
              count={images.length}
              label={label}
              onMove={move}
              onRemove={remove}
            />
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-ink-soft">No photos yet. Until you add one, the racket shows on the website without a photo.</p>
      )}
      {/* Kept mounted (only hidden) when full, so an in-flight upload can still report it finished. */}
      <div hidden={full}>
        <MediaUpload
          label={images.length ? 'Add another photo' : 'Add main photo'}
          value={null}
          onChange={(url, info) => add(url, !!info?.media)}
          aspectClass="aspect-square"
          compact
          hint="Square photos on a plain background look best, at least 800 × 800 px."
          onUploadingChange={onUploadingChange}
          error={error}
        />
      </div>
      {full && <p className="text-[13px] text-ink-muted">That’s the most photos a racket can have. Remove one to add another.</p>}
      {full && error && <FieldError>{error}</FieldError>}
    </div>
  );
};

// =====================================================================
// Racket form
// =====================================================================

interface RacketFormState {
  condition: RacketCondition;
  brand: string;
  name: string;
  price: string;
  tag: string;
  weight: string;
  balanceChoice: string; // one of BALANCE_OPTIONS, '' or OTHER
  balanceOther: string;
  flex: string;
  maxTension: string;
  description: string;
  images: string[];
  isFeatured: boolean;
  isActive: boolean;
  inStock: boolean;
}

const racketToForm = (r: Racket | null): RacketFormState => {
  const balance = (r?.balance || '').trim();
  const known = BALANCE_OPTIONS.find((b) => b.toLowerCase() === balance.toLowerCase());
  return {
    condition: r?.condition === 'used' ? 'used' : 'new',
    brand: r?.brand ?? '',
    name: r?.name ?? '',
    price: r && hasPrice(r) ? String(r.price) : '',
    tag: r?.tag ?? '',
    weight: r?.weight ?? '',
    balanceChoice: !balance ? '' : known ? known : OTHER,
    balanceOther: !balance || known ? '' : balance,
    flex: r?.flex ?? '',
    maxTension: r?.maxTension ?? '',
    description: r?.description ?? '',
    images: r ? photosOf(r) : [],
    isFeatured: r?.isFeatured ?? false,
    isActive: r?.isActive ?? true,
    inStock: r?.inStock ?? true,
  };
};

const RacketFormModal: React.FC<{
  racket: Racket | null;
  onClose: () => void;
  onSaved: (r: Racket, isNew: boolean) => void;
}> = ({ racket, onClose, onSaved }) => {
  const { addToast } = useApp();
  const uid = useId();
  const [form, setForm] = useState<RacketFormState>(() => racketToForm(racket));
  const [errors, setErrors] = useState<Partial<Record<'brand' | 'name' | 'price' | 'images', string>>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof RacketFormState>(key: K, value: RacketFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors && errors[key as keyof typeof errors]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // Keep an existing non-standard flex value (e.g. "Medium Stiff") selectable.
  const flexOptions = useMemo(() => {
    const current = (racket?.flex || '').trim();
    return current && !FLEX_OPTIONS.some((f) => f.toLowerCase() === current.toLowerCase())
      ? [...FLEX_OPTIONS, current]
      : FLEX_OPTIONS;
  }, [racket]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading) return;
    const errs: typeof errors = {};
    if (!form.brand.trim()) errs.brand = 'Add the brand.';
    if (!form.name.trim()) errs.name = 'Add the model name.';
    const priceText = form.price.trim();
    let price: number | null = null;
    if (priceText) {
      price = Number(priceText);
      if (!Number.isFinite(price) || price < 0) errs.price = 'Enter an amount in rupees, or leave it empty.';
    }
    if (form.images.length > MAX_RACKET_PHOTOS) errs.images = `A racket can have up to ${MAX_RACKET_PHOTOS} photos.`;
    else if (form.images.some((u) => !isAllowedPhotoUrl(u))) errs.images = 'One of the photos has a link the website can’t use. Remove it and upload the photo instead.';
    setErrors(errs);
    if (Object.keys(errs).length) {
      focusFirstInvalid(formId);
      return;
    }

    const balance = form.balanceChoice === OTHER ? form.balanceOther : form.balanceChoice;
    const input: RacketInput = {
      condition: form.condition,
      brand: form.brand.trim(),
      name: form.name.trim(),
      price,
      tag: nullIfEmpty(form.tag),
      weight: nullIfEmpty(form.weight),
      balance: nullIfEmpty(balance),
      flex: nullIfEmpty(form.flex),
      maxTension: nullIfEmpty(form.maxTension),
      description: nullIfEmpty(form.description),
      images: form.images,
      inStock: form.inStock,
      isFeatured: form.isFeatured,
      isActive: form.isActive,
    };
    setSaving(true);
    setSaveError(null);
    try {
      const saved = racket ? await contentService.updateRacket(racket.id, input) : await contentService.createRacket(input);
      addToast('success', racket ? 'Racket updated' : 'Racket added', `${racketLabel(saved)} saved.`);
      onSaved(saved, !racket);
    } catch (err) {
      const msg = errorMessage(err, 'Could not save the racket.');
      setSaveError(msg);
      addToast('error', 'Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const formId = 'racket-form';
  const label = racketLabel({ brand: form.brand, name: form.name });
  return (
    <Modal
      open
      size="lg"
      title={racket ? `Edit ${racketLabel(racket)}` : 'New racket'}
      subtitle="Shown in the rackets section of the website"
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="min-h-[44px] sm:px-5">
            Cancel
          </Button>
          <Button type="submit" form={formId} isLoading={saving} disabled={uploading} className="min-h-[44px] sm:px-6">
            {uploading ? 'Waiting for upload…' : racket ? 'Save changes' : 'Add racket'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-7" noValidate>
        {(saveError || Object.values(errors).some(Boolean)) && (
          <div className="space-y-2 -mb-2">
            <SaveFailedNotice message={saveError} />
            <FixFieldsNotice count={Object.values(errors).filter(Boolean).length} />
          </div>
        )}

        <FormSection title="Photos" description="Real photos of the racket. Use the star to choose the main photo.">
          <PhotosEditor
            images={form.images}
            label={label}
            onChange={(imgs) => set('images', imgs)}
            onUploadingChange={setUploading}
            error={errors.images}
          />
        </FormSection>

        <FormSection title="Details">
          <div>
            <p id={`${uid}-condition`} className={labelClass}>
              Condition
            </p>
            <div role="radiogroup" aria-labelledby={`${uid}-condition`} className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-paper-deep">
              {(
                [
                  { id: 'new', label: 'New' },
                  { id: 'used', label: 'Second-hand' },
                ] as const
              ).map((opt) => {
                const active = form.condition === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set('condition', opt.id)}
                    className={`min-h-[44px] rounded-lg text-[14px] font-medium transition-colors duration-150 ${focusRing} ${
                      active ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className={hintClass}>
              {form.condition === 'used'
                ? 'Listed under “Second-hand rackets” (Re-sell). Mention its condition in the description.'
                : 'Listed with the new rackets.'}
            </p>
          </div>

          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-4">
            <Field label="Brand" htmlFor={`${uid}-brand`} required error={errors.brand} hint="Pick a suggestion or type any brand.">
              <input
                id={`${uid}-brand`}
                list={`${uid}-brands`}
                value={form.brand}
                onChange={(e) => set('brand', e.target.value)}
                placeholder="e.g. Yonex"
                autoComplete="off"
                className={`${inputClass} ${errors.brand ? inputErrorClass : ''}`}
              />
              <datalist id={`${uid}-brands`}>
                {BRAND_SUGGESTIONS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </Field>
            <Field label="Model name" htmlFor={`${uid}-name`} required error={errors.name}>
              <input
                id={`${uid}-name`}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Astrox 88D Pro"
                className={`${inputClass} ${errors.name ? inputErrorClass : ''}`}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Price (₹)"
              htmlFor={`${uid}-price`}
              error={errors.price}
              hint={form.price.trim() ? 'Shown on the website' : 'Empty = shows “Price on request”'}
            >
              <input
                id={`${uid}-price`}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="Price on request"
                className={`${inputClass} ${errors.price ? inputErrorClass : ''}`}
              />
            </Field>
            <Field label="Tag" htmlFor={`${uid}-tag`} optional hint="A short badge, e.g. Bestseller">
              <input
                id={`${uid}-tag`}
                value={form.tag}
                onChange={(e) => set('tag', e.target.value)}
                maxLength={40}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Description" htmlFor={`${uid}-desc`} optional>
            <textarea
              id={`${uid}-desc`}
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className={`${inputClass} resize-y`}
              placeholder="Who it suits, playing style, what's included…"
            />
          </Field>
        </FormSection>

        <FormSection title="Specifications" description="All optional. Shown under the racket name.">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Weight" htmlFor={`${uid}-weight`} hint='e.g. "3U / 4U"'>
              <input
                id={`${uid}-weight`}
                value={form.weight}
                onChange={(e) => set('weight', e.target.value)}
                placeholder="3U / 4U"
                className={inputClass}
              />
            </Field>
            <Field label="Max tension" htmlFor={`${uid}-tension`} hint='e.g. "Up to 28 lbs"'>
              <input
                id={`${uid}-tension`}
                value={form.maxTension}
                onChange={(e) => set('maxTension', e.target.value)}
                placeholder="Up to 28 lbs"
                className={inputClass}
              />
            </Field>
            <Field label="Balance" htmlFor={`${uid}-balance`}>
              <select
                id={`${uid}-balance`}
                value={form.balanceChoice}
                onChange={(e) => set('balanceChoice', e.target.value)}
                className={inputClass}
              >
                <option value="">Not specified</option>
                {BALANCE_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
                <option value={OTHER}>Other…</option>
              </select>
              {form.balanceChoice === OTHER && (
                <>
                  <label htmlFor={`${uid}-balance-other`} className="sr-only">
                    Balance (other)
                  </label>
                  <input
                    id={`${uid}-balance-other`}
                    value={form.balanceOther}
                    onChange={(e) => set('balanceOther', e.target.value)}
                    placeholder="e.g. Slightly Head Heavy"
                    className={`${inputClass} mt-2`}
                  />
                </>
              )}
            </Field>
            <Field label="Shaft flex" htmlFor={`${uid}-flex`}>
              <select id={`${uid}-flex`} value={form.flex} onChange={(e) => set('flex', e.target.value)} className={inputClass}>
                <option value="">Not specified</option>
                {flexOptions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </FormSection>

        <FormSection title="On the website">
          <div className={switchGroupClass}>
            <Switch
              checked={form.isActive}
              onChange={(v) => set('isActive', v)}
              label="Show on the website"
              description="Turn off to hide this racket from customers."
            />
            <Switch
              checked={form.inStock}
              onChange={(v) => set('inStock', v)}
              label="Stock"
              description="Out-of-stock rackets stay visible with an “Ask availability” button."
              onLabel="In stock"
              offLabel="Out of stock"
            />
            <Switch
              checked={form.isFeatured}
              onChange={(v) => set('isFeatured', v)}
              label="Featured"
              description="Shown in the rackets row on the homepage."
            />
          </div>
        </FormSection>
      </form>
    </Modal>
  );
};

// =====================================================================
// Racket row
// =====================================================================

const RacketThumb: React.FC<{ racket: Racket }> = ({ racket }) => {
  const photos = photosOf(racket);
  const [broken, setBroken] = useState(false);
  const main = photos[0];
  return (
    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white border border-line shrink-0 overflow-hidden flex items-center justify-center">
      {main && !broken ? (
        <img
          src={main}
          alt={racketLabel(racket)}
          loading="lazy"
          onError={() => setBroken(true)}
          className={`w-full h-full object-contain p-1 ${racket.inStock ? '' : 'grayscale opacity-60'}`}
        />
      ) : (
        <span className="flex flex-col items-center gap-1 text-ink-muted" aria-hidden="true">
          <ImageOff className="w-5 h-5" />
          <span className="text-[12px] font-medium">No photo</span>
        </span>
      )}
      {photos.length > 1 && (
        <span className="absolute bottom-1 right-1 text-[12px] font-medium leading-none bg-ink/75 text-white px-1.5 py-1 rounded-md tabular-nums">
          {photos.length} photos
        </span>
      )}
    </div>
  );
};

const RacketRow: React.FC<{
  racket: Racket;
  pending: boolean;
  onToggleStock: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ racket: r, pending, onToggleStock, onEdit, onDelete }) => {
  const specs = [r.balance, r.flex, r.weight, r.maxTension].filter((s) => s && s.trim());
  const noPhoto = photosOf(r).length === 0;
  return (
    <li className={`${cardClass} p-3 sm:p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-5 ${r.isActive ? '' : 'bg-paper/70'}`}>
      <div className="flex gap-3 sm:gap-4 min-w-0 flex-1">
        <RacketThumb racket={r} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink-muted">{r.brand}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[16px] font-semibold leading-snug text-ink break-words">{r.name}</span>
            {r.condition === 'used' && <span className={`${chipClass} bg-sky-50 border-sky-200 text-sky-800`}>Second-hand</span>}
            {r.tag && <span className={`${chipClass} bg-white border-line text-ink-soft max-w-[12rem] truncate`}>{r.tag}</span>}
            {r.isFeatured && (
              <span className={`${chipClass} bg-accent/25 border-accent/60 text-ink`}>
                <Star className="w-3 h-3" aria-hidden="true" /> Featured
              </span>
            )}
            {!r.isActive && (
              <span className={`${chipClass} bg-paper-deep border-line text-ink-soft`}>
                <EyeOff className="w-3 h-3" aria-hidden="true" /> Hidden from website
              </span>
            )}
          </div>
          {specs.length > 0 && <p className="mt-0.5 text-[13px] text-ink-muted break-words">{specs.join(' · ')}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px]">
            {hasPrice(r) ? (
              <span className="font-semibold text-ink tabular-nums">{formatPrice(r.price as number)}</span>
            ) : (
              <span className="font-medium text-amber-800">No price yet</span>
            )}
            {noPhoto && (
              <>
                <span className="text-line" aria-hidden="true">
                  |
                </span>
                <span className="font-medium text-amber-800">No photo yet</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:shrink-0">
        <button
          type="button"
          onClick={onToggleStock}
          disabled={pending}
          aria-pressed={r.inStock}
          aria-busy={pending}
          aria-label={`${racketLabel(r)}: ${r.inStock ? 'in stock' : 'out of stock'}. Tap to mark ${r.inStock ? 'out of stock' : 'in stock'}.`}
          className={`flex-1 md:flex-none md:w-40 min-h-[44px] px-3 rounded-xl border text-[14px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors duration-150 active:scale-[0.98] disabled:cursor-wait ${focusRing} ${
            r.inStock
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
          }`}
        >
          {pending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : r.inStock ? (
            <CircleCheck className="w-4 h-4" />
          ) : (
            <CircleX className="w-4 h-4" />
          )}
          {r.inStock ? 'In stock' : 'Out of stock'}
        </button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-[44px] px-4"
          leftIcon={<Pencil className="w-4 h-4" />}
          onClick={onEdit}
          aria-label={`Edit ${racketLabel(r)}`}
        >
          Edit
        </Button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${racketLabel(r)}`}
          title="Delete racket"
          className={`${iconButtonDangerClass} sm:w-11 sm:h-11`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
};

// =====================================================================
// Manager
// =====================================================================

export const RacketsManager: React.FC = () => {
  const { addToast } = useApp();
  const [rackets, setRackets] = useState<Racket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Racket | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Racket | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await contentService.listRackets();
      setRackets(sortRackets(Array.isArray(list) ? list : []));
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load the rackets.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patchRacket = (id: string, patch: Partial<Racket>) =>
    setRackets((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const setPending = (id: string, on: boolean) =>
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  // ---- one-tap optimistic stock toggle ----
  const toggleStock = async (racket: Racket) => {
    if (pendingIds.has(racket.id)) return;
    const next = !racket.inStock;
    patchRacket(racket.id, { inStock: next });
    setPending(racket.id, true);
    setAnnouncement(`${racketLabel(racket)} marked ${next ? 'in stock' : 'out of stock'}`);
    try {
      const saved = await contentService.updateRacket(racket.id, { inStock: next });
      if (saved && saved.id) patchRacket(racket.id, saved);
    } catch (err) {
      patchRacket(racket.id, { inStock: racket.inStock });
      setAnnouncement(`Could not update ${racketLabel(racket)}; reverted.`);
      addToast(
        'error',
        'Stock not updated',
        `${racketLabel(racket)} is still ${racket.inStock ? 'in stock' : 'out of stock'}. ${errorMessage(err, '')}`.trim()
      );
    } finally {
      setPending(racket.id, false);
    }
  };

  const runDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await contentService.deleteRacket(deleting.id);
      setRackets((list) => list.filter((r) => r.id !== deleting.id));
      addToast('success', 'Racket deleted', `${racketLabel(deleting)} was removed.`);
      setDeleting(null);
    } catch (err) {
      addToast('error', 'Delete failed', errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  // ---- derived ----
  const q = query.trim().toLowerCase();

  const stats = useMemo(() => {
    let used = 0;
    let featured = 0;
    let out = 0;
    let noPrice = 0;
    let noPhoto = 0;
    let hidden = 0;
    rackets.forEach((r) => {
      if (r.condition === 'used') used++;
      if (r.isFeatured) featured++;
      if (!r.inStock) out++;
      if (!hasPrice(r)) noPrice++;
      if (photosOf(r).length === 0) noPhoto++;
      if (!r.isActive) hidden++;
    });
    return { used, featured, out, noPrice, noPhoto, hidden };
  }, [rackets]);

  const visible = useMemo(
    () =>
      rackets.filter((r) => {
        if (filter === 'used' && r.condition !== 'used') return false;
        if (filter === 'featured' && !r.isFeatured) return false;
        if (filter === 'out' && r.inStock) return false;
        if (filter === 'noprice' && hasPrice(r)) return false;
        if (filter === 'nophoto' && photosOf(r).length > 0) return false;
        if (filter === 'hidden' && r.isActive) return false;
        if (!q) return true;
        return [r.brand, r.name, r.tag, `${r.brand} ${r.name}`]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(q));
      }),
    [rackets, filter, q]
  );

  return (
    <div className="space-y-4 min-w-0">
      <SectionHeader
        title="Rackets"
        description="Photos, prices and stock for the rackets on the website. Tap a racket's stock button to switch it between in stock and out of stock; it saves straight away."
        actions={
          <Button
            type="button"
            onClick={() => setEditing('new')}
            leftIcon={<Plus className="w-4 h-4" />}
            className="min-h-[44px] px-5"
            disabled={loading && rackets.length === 0}
          >
            Add racket
          </Button>
        }
      />

      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      {loading && rackets.length === 0 ? (
        <ListSkeleton rows={5} />
      ) : loadError && rackets.length === 0 ? (
        <ErrorState message={loadError} onRetry={load} retrying={loading} />
      ) : rackets.length === 0 ? (
        <EmptyState
          title="No rackets yet"
          description="Add your first racket with photos and a price — it appears on the website right away."
          actionText="Add racket"
          onAction={() => setEditing('new')}
        />
      ) : (
        <>
          <StatGrid>
            <StatTile label="Rackets" value={rackets.length} />
            <StatTile label="Out of stock" value={stats.out} tone={stats.out ? 'bad' : 'default'} />
            <StatTile label="No price yet" value={stats.noPrice} tone={stats.noPrice ? 'warn' : 'default'} />
            <StatTile label="No photo yet" value={stats.noPhoto} tone={stats.noPhoto ? 'warn' : 'default'} />
          </StatGrid>

          {/* Search + filters */}
          <div className="space-y-3">
            <SearchField
              id="rackets-search"
              label="Search rackets"
              value={query}
              onChange={setQuery}
              placeholder="Search by brand, model or tag, e.g. Astrox"
            />
            <Pills<FilterId>
              ariaLabel="Filter rackets"
              value={filter}
              onChange={setFilter}
              options={[
                { id: 'all', label: 'All', count: rackets.length },
                ...(stats.used ? [{ id: 'used' as const, label: 'Second-hand', count: stats.used }] : []),
                { id: 'featured', label: 'Featured', count: stats.featured },
                { id: 'out', label: 'Out of stock', count: stats.out, highlight: true },
                { id: 'noprice', label: 'No price yet', count: stats.noPrice, highlight: true },
                { id: 'nophoto', label: 'No photo yet', count: stats.noPhoto, highlight: true },
                { id: 'hidden', label: 'Hidden', count: stats.hidden },
              ]}
            />
          </div>

          {loadError && <RefreshFailed message={loadError} onRetry={load} retrying={loading} />}

          {visible.length === 0 ? (
            <NoMatches
              title="No rackets match"
              onClear={() => {
                setQuery('');
                setFilter('all');
              }}
            />
          ) : (
            <ul className="space-y-2.5">
              {visible.map((r) => (
                <RacketRow
                  key={r.id}
                  racket={r}
                  pending={pendingIds.has(r.id)}
                  onToggleStock={() => toggleStock(r)}
                  onEdit={() => setEditing(r)}
                  onDelete={() => setDeleting(r)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {editing && (
        <RacketFormModal
          key={editing === 'new' ? 'new' : editing.id}
          racket={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            setRackets((list) => sortRackets(isNew ? [...list, saved] : list.map((r) => (r.id === saved.id ? saved : r))));
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={runDelete}
        title="Delete racket?"
        confirmLabel="Delete racket"
        message={
          deleting ? (
            <>
              <b className="font-semibold text-ink">{racketLabel(deleting)}</b> will be removed from the website. This can’t be undone.
              <span className="block mt-2 text-[13px] text-ink-muted">Tip: turn off “Show on the website” instead to hide it for now.</span>
            </>
          ) : null
        }
      />
    </div>
  );
};

export default RacketsManager;
