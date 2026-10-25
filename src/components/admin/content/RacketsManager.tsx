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
  Eye,
  EyeOff,
  ImageOff,
  IndianRupee,
  Loader2,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { contentService } from '../../../services/contentService';
import { Racket, RacketInput } from '../../../types/content';
import { Button } from '../../common/Button';
import { EmptyState } from '../../common/EmptyStates';
import { MediaUpload } from './MediaUpload';
import {
  ConfirmDialog,
  ErrorState,
  Field,
  ListSkeleton,
  Modal,
  Pills,
  SectionHeader,
  Switch,
  cardClass,
  errorMessage,
  inputClass,
  inputErrorClass,
  nullIfEmpty,
} from './shared';

type FilterId = 'all' | 'featured' | 'out' | 'noprice' | 'nophoto' | 'hidden';

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
    'flex-1 min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-slate-600 hover:bg-paper disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/40';
  return (
    <li
      className={`rounded-2xl border bg-white overflow-hidden flex flex-col ${
        isMain ? 'border-amber-300 ring-2 ring-brandYellow' : 'border-line'
      }`}
    >
      <div className="relative aspect-square bg-white">
        {broken ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400 p-2 text-center">
            <ImageOff className="w-6 h-6" />
            <span className="text-xs font-semibold">Can't load this photo</span>
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
          className={`absolute top-1.5 left-1.5 text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
            isMain ? 'bg-brandYellow text-sportsBlue' : 'bg-white/90 border border-line text-slate-600'
          }`}
        >
          {isMain ? 'Main photo' : `#${index + 1}`}
        </span>
      </div>
      <div className="flex border-t border-line/70 divide-x divide-line/70">
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
          className={`${btn} ${isMain ? 'text-amber-500' : ''}`}
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
          className={`${btn} text-rose-600 hover:bg-rose-50`}
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
          ? 'The upload worked, but the server returned a non-secure (http) link. Ask your developer to set PUBLIC_API_URL to the https address.'
          : 'Use a secure link starting with https:// (or a site path starting with /).'
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
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="block text-xs font-semibold text-slate-700">Photos</span>
        <span className={`text-xs font-bold ${full ? 'text-amber-700' : 'text-slate-500'}`}>
          {images.length}/{MAX_RACKET_PHOTOS}
        </span>
      </div>
      {images.length > 0 ? (
        <ul className="grid grid-cols-2 min-[480px]:grid-cols-3 gap-2">
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
        <p className="text-xs text-slate-500">
          No photos yet — the website shows a 🏸 placeholder until you add one.
        </p>
      )}
      {/* Kept mounted (only hidden) when full, so an in-flight upload can still report it finished. */}
      <div hidden={full}>
        <MediaUpload
          label={images.length ? 'Add another photo' : 'Add main photo'}
          value={null}
          onChange={(url, info) => add(url, !!info?.media)}
          aspectClass="aspect-square"
          compact
          hint="Square photos on a plain background look best (at least 800×800)."
          onUploadingChange={onUploadingChange}
          error={error}
        />
      </div>
      {full && (
        <p className="text-xs text-amber-700 font-medium">
          Maximum of {MAX_RACKET_PHOTOS} photos reached — remove one to add another.
        </p>
      )}
    </div>
  );
};

// =====================================================================
// Racket form
// =====================================================================

interface RacketFormState {
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
    if (!form.brand.trim()) errs.brand = 'Brand is required.';
    if (!form.name.trim()) errs.name = 'Model name is required.';
    const priceText = form.price.trim();
    let price: number | null = null;
    if (priceText) {
      price = Number(priceText);
      if (!Number.isFinite(price) || price < 0) errs.price = 'Enter a valid amount, or leave empty.';
    }
    if (form.images.length > MAX_RACKET_PHOTOS) errs.images = `Up to ${MAX_RACKET_PHOTOS} photos.`;
    else if (form.images.some((u) => !isAllowedPhotoUrl(u))) errs.images = 'Every photo must be an https:// link or a site path.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const balance = form.balanceChoice === OTHER ? form.balanceOther : form.balanceChoice;
    const input: RacketInput = {
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
      subtitle="Shown in the rackets collection on the website"
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="min-h-[42px]">
            Cancel
          </Button>
          <Button type="submit" form={formId} isLoading={saving} disabled={uploading} className="min-h-[42px]">
            {uploading ? 'Waiting for upload…' : racket ? 'Save changes' : 'Add racket'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-5" noValidate>
        {saveError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700" role="alert">
            {saveError} Your changes are still here — try again.
          </div>
        )}

        <PhotosEditor
          images={form.images}
          label={label}
          onChange={(imgs) => set('images', imgs)}
          onUploadingChange={setUploading}
          error={errors.images}
        />

        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3">
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

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Price (₹)"
            htmlFor={`${uid}-price`}
            error={errors.price}
            hint={form.price.trim() ? 'Shown on the website' : 'Empty = "Price on request"'}
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
          <Field label="Tag" htmlFor={`${uid}-tag`} hint="Short badge, e.g. Bestseller">
            <input
              id={`${uid}-tag`}
              value={form.tag}
              onChange={(e) => set('tag', e.target.value)}
              maxLength={40}
              className={inputClass}
            />
          </Field>
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

        <Field label="Description" htmlFor={`${uid}-desc`}>
          <textarea
            id={`${uid}-desc`}
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className={`${inputClass} resize-y`}
            placeholder="Who it suits, playing style, what's included…"
          />
        </Field>

        <div className="divide-y divide-line/70 rounded-2xl border border-line px-3">
          <Switch
            checked={form.inStock}
            onChange={(v) => set('inStock', v)}
            label="In stock"
            description="Out of stock rackets stay visible with an “Ask availability” button."
            onLabel="In stock"
            offLabel="Out of stock"
          />
          <Switch
            checked={form.isFeatured}
            onChange={(v) => set('isFeatured', v)}
            label="Featured"
            description="Shown in the rackets row on the home page."
          />
          <Switch
            checked={form.isActive}
            onChange={(v) => set('isActive', v)}
            label="Visible on website"
            description="Turn off to hide this racket from customers."
          />
        </div>
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
        <span className="text-3xl select-none" aria-hidden="true">
          🏸
        </span>
      )}
      {photos.length > 1 && (
        <span className="absolute bottom-1 right-1 text-xs font-bold bg-slate-900/75 text-white px-1 rounded">
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
    <li className={`${cardClass} p-3 sm:p-4 flex flex-col md:flex-row md:items-center gap-3 ${r.isActive ? '' : 'bg-paper/80'}`}>
      <div className="flex gap-3 min-w-0 flex-1">
        <RacketThumb racket={r} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-paper text-sportsBlue border border-line">
              {r.brand}
            </span>
            {r.tag && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 max-w-[12rem] truncate">
                {r.tag}
              </span>
            )}
            {r.isFeatured && (
              <span className="inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded bg-brandYellow text-sportsBlue">
                <Star className="w-3 h-3" /> Featured
              </span>
            )}
            {r.isActive ? (
              <span className="inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                <Eye className="w-3 h-3" /> On website
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                <EyeOff className="w-3 h-3" /> Hidden
              </span>
            )}
          </div>
          <p className="font-bold text-sm text-slate-900 mt-1 break-words">{r.name}</p>
          {specs.length > 0 && <p className="text-xs text-slate-500 break-words">{specs.join(' · ')}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {hasPrice(r) ? (
              <span className="text-xs font-bold text-slate-900">{formatPrice(r.price as number)}</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">
                <IndianRupee className="w-3 h-3" /> No price — shows “Price on request”
              </span>
            )}
            {noPhoto && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded border border-slate-300 bg-paper text-slate-600">
                <ImageOff className="w-3 h-3" /> No photo yet
              </span>
            )}
          </div>
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
          className={`flex-1 md:flex-none md:w-36 min-h-[44px] px-3 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98] disabled:cursor-wait ${
            r.inStock
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100'
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
          variant="outline"
          size="sm"
          className="min-h-[44px]"
          leftIcon={<Pencil className="w-3.5 h-3.5" />}
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
          className="shrink-0 w-11 h-11 inline-flex items-center justify-center rounded-xl border border-line bg-white text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50"
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
    let featured = 0;
    let out = 0;
    let noPrice = 0;
    let noPhoto = 0;
    let hidden = 0;
    rackets.forEach((r) => {
      if (r.isFeatured) featured++;
      if (!r.inStock) out++;
      if (!hasPrice(r)) noPrice++;
      if (photosOf(r).length === 0) noPhoto++;
      if (!r.isActive) hidden++;
    });
    return { featured, out, noPrice, noPhoto, hidden };
  }, [rackets]);

  const visible = useMemo(
    () =>
      rackets.filter((r) => {
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
        description="Add real photos, prices and stock for the rackets shown on the website. Tap a racket's stock button to mark it in or out of stock — it saves instantly. Rackets without a price show “Price on request” with an Enquire button."
        actions={
          <Button
            type="button"
            onClick={() => setEditing('new')}
            leftIcon={<Plus className="w-4 h-4" />}
            className="min-h-[42px]"
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
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className={`${cardClass} p-3`}>
              <p className="text-xs font-semibold text-slate-500">Rackets</p>
              <p className="text-xl font-bold text-slate-900">{rackets.length}</p>
            </div>
            <div className={`${cardClass} p-3`}>
              <p className="text-xs font-semibold text-slate-500">Out of stock</p>
              <p className={`text-xl font-bold ${stats.out ? 'text-rose-600' : 'text-emerald-600'}`}>{stats.out}</p>
            </div>
            <div className={`${cardClass} p-3`}>
              <p className="text-xs font-semibold text-slate-500">No price yet</p>
              <p className={`text-xl font-bold ${stats.noPrice ? 'text-amber-600' : 'text-emerald-600'}`}>{stats.noPrice}</p>
            </div>
            <div className={`${cardClass} p-3`}>
              <p className="text-xs font-semibold text-slate-500">No photo yet</p>
              <p className={`text-xl font-bold ${stats.noPhoto ? 'text-amber-600' : 'text-emerald-600'}`}>{stats.noPhoto}</p>
            </div>
          </div>

          {/* Search + filters */}
          <div className="space-y-2">
            <div className="relative">
              <label htmlFor="rackets-search" className="sr-only">
                Search rackets
              </label>
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="rackets-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search brand, model or tag (e.g. Astrox, Li-Ning)"
                className={`${inputClass} pl-9 pr-10`}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Pills<FilterId>
              ariaLabel="Filter rackets"
              value={filter}
              onChange={setFilter}
              options={[
                { id: 'all', label: 'All', count: rackets.length },
                { id: 'featured', label: 'Featured', count: stats.featured },
                { id: 'out', label: 'Out of stock', count: stats.out, highlight: true },
                { id: 'noprice', label: 'No price yet', count: stats.noPrice, highlight: true },
                { id: 'nophoto', label: 'No photo yet', count: stats.noPhoto, highlight: true },
                { id: 'hidden', label: 'Hidden', count: stats.hidden },
              ]}
            />
          </div>

          {loadError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between gap-2">
              <span>Refresh failed: {loadError}</span>
              <Button type="button" size="sm" variant="outline" onClick={load} className="min-h-[36px]">
                Retry
              </Button>
            </div>
          )}

          {visible.length === 0 ? (
            <div className={`${cardClass} p-8 text-center`}>
              <p className="text-sm font-semibold text-slate-700">No rackets match</p>
              <p className="text-xs text-slate-500 mt-1">Try a different search or filter.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 min-h-[40px]"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
              >
                Clear search & filters
              </Button>
            </div>
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
              <b>{racketLabel(deleting)}</b> will be removed from the website. This can't be undone.
              <span className="block mt-2 text-xs text-slate-500">
                Tip: turn off “Visible on website” instead to hide it temporarily.
              </span>
            </>
          ) : null
        }
      />
    </div>
  );
};

export default RacketsManager;
