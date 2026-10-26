/**
 * Admin: T-shirts & apparel sold online — product details, photos and stock per size × colour.
 * Product saves and stock changes wait for the server. Stock steppers save shortly after the last
 * tap (so "+ + + +" is one save) and roll back with an inline error if the save fails.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  ImageOff,
  Layers,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Shirt,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { shopService } from '../../../services/shopService';
import type { ApparelCategory, ApparelProduct, ApparelProductInput, ApparelVariant } from '../../../types/shop';
import { PriceTag } from '../../public/home/PriceTag';
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
  Notice,
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
  iconButtonDangerClass,
  inputClass,
  inputErrorClass,
  labelClass,
  hintClass,
  nullIfEmpty,
  originalPriceHint,
  parseOriginalPrice,
  switchGroupClass,
} from './shared';

export const MAX_APPAREL_PHOTOS = 6;
const LOW_STOCK = 3;

const CATEGORIES: { id: ApparelCategory; label: string }[] = [
  { id: 't-shirt', label: 'T-shirt' },
  { id: 'jersey', label: 'Jersey' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'track', label: 'Track wear' },
  { id: 'accessory', label: 'Accessory' },
];
const categoryLabel = (c: string) => CATEGORIES.find((x) => x.id === c)?.label || c;

const FIT_SUGGESTIONS = ['Regular fit', 'Slim fit', 'Relaxed fit', 'Oversized'];
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', 'Kids 6-8', 'Kids 8-10', 'Kids 10-12', 'Kids 12-14', 'Free size'];
const QUICK_SIZES = ['S', 'M', 'L', 'XL', 'XXL', '3XL', 'Kids 10-12', 'Free size'];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

type FilterId = 'all' | 'featured' | 'low' | 'out' | 'nophoto' | 'hidden';

const photosOf = (p: ApparelProduct): string[] => (Array.isArray(p.images) ? p.images.filter(Boolean) : []);
const variantsOf = (p: ApparelProduct): ApparelVariant[] => (Array.isArray(p.variants) ? p.variants : []);
const totalStock = (p: ApparelProduct) => variantsOf(p).reduce((acc, v) => acc + (v.stock || 0), 0);
const lowCount = (p: ApparelProduct) => variantsOf(p).filter((v) => v.stock > 0 && v.stock <= LOW_STOCK).length;
const outCount = (p: ApparelProduct) => variantsOf(p).filter((v) => v.stock <= 0).length;

const sortProducts = (list: ApparelProduct[]) =>
  [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));

const sizeRank = (size: string, fallback: number) => {
  const i = SIZE_ORDER.findIndex((s) => s.toLowerCase() === size.toLowerCase());
  return i >= 0 ? i : 100 + fallback;
};

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Same rule as the backend: https:// links, site paths, or http://localhost uploads in development. */
const isAllowedPhotoUrl = (url: string): boolean => {
  const v = url.trim();
  if (!v || /\s/.test(v)) return false;
  if (v.startsWith('/') && !v.startsWith('//')) return true;
  return /^https:\/\/[^/]/i.test(v) || /^http:\/\/(localhost|127\.0\.0\.1)[:/]/i.test(v);
};

const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  typeof document === 'undefined' ? null : createPortal(children, document.body);

/** Keeps the server-computed fields roughly right after local stock edits (the next load replaces them). */
const withVariants = (p: ApparelProduct, variants: ApparelVariant[]): ApparelProduct => ({
  ...p,
  variants,
  inStock: variants.some((v) => v.stock > 0),
});

// =====================================================================
// Photos (inside the form)
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
            alt={`${label || 'Product'} photo ${index + 1}`}
            loading="lazy"
            onError={() => setBroken(true)}
            className="absolute inset-0 w-full h-full object-cover"
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
        <button type="button" className={btn} disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Move photo ${index + 1} left`} title="Move left">
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
  const full = images.length >= MAX_APPAREL_PHOTOS;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

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
    if (images.length >= MAX_APPAREL_PHOTOS) {
      addToast('error', 'Photo limit reached', `A product can have up to ${MAX_APPAREL_PHOTOS} photos.`);
      return;
    }
    onChange([...images, v]);
  };

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <p className={`text-[13px] ${full ? 'font-medium text-amber-800' : 'text-ink-muted'}`}>
          {images.length} of {MAX_APPAREL_PHOTOS} photos{images.length > 1 ? ' · the first one is the main photo' : ''}
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
              onRemove={(index) => onChange(images.filter((_, j) => j !== index))}
            />
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-ink-soft">No photos yet. Add at least one real photo before showing it on the website.</p>
      )}
      {/* Kept mounted (only hidden) when full, so an in-flight upload can still report it finished. */}
      <div hidden={full}>
        <MediaUpload
          label={images.length ? 'Add another photo' : 'Add main photo'}
          value={null}
          onChange={(url, info) => add(url, !!info?.media)}
          aspectClass="aspect-square"
          compact
          hint="JPG, PNG or WebP. Square photos look best."
          onUploadingChange={onUploadingChange}
          error={error}
        />
      </div>
      {full && <p className="text-[13px] text-ink-muted">That’s the most photos an item can have. Remove one to add another.</p>}
      {full && error && <FieldError>{error}</FieldError>}
    </div>
  );
};

// =====================================================================
// Product form
// =====================================================================

interface FormState {
  name: string;
  category: ApparelCategory;
  price: string;
  mrp: string;
  fabric: string;
  fit: string;
  description: string;
  images: string[];
  customisable: boolean;
  isFeatured: boolean;
  isActive: boolean;
}

const toForm = (p: ApparelProduct | null): FormState => ({
  name: p?.name ?? '',
  category: p?.category ?? 't-shirt',
  price: p && Number.isFinite(p.price) ? String(p.price) : '',
  mrp: p?.mrp ? String(p.mrp) : '',
  fabric: p?.fabric ?? '',
  fit: p?.fit ?? '',
  description: p?.description ?? '',
  images: p ? photosOf(p) : [],
  customisable: p?.customisable ?? false,
  isFeatured: p?.isFeatured ?? false,
  isActive: p?.isActive ?? true,
});

const ApparelFormModal: React.FC<{
  product: ApparelProduct | null;
  onClose: () => void;
  onSaved: (p: ApparelProduct, isNew: boolean) => void;
  onEditStock?: () => void;
}> = ({ product, onClose, onSaved, onEditStock }) => {
  const { addToast } = useApp();
  const uid = useId();
  const [form, setForm] = useState<FormState>(() => toForm(product));
  const [errors, setErrors] = useState<Partial<Record<'name' | 'price' | 'mrp' | 'images', string>>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors && errors[key as keyof typeof errors]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading || saving) return;
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = 'Add the item name.';
    else if (form.name.trim().length > 120) errs.name = 'Keep the name under 120 characters.';
    const price = Number(form.price.trim());
    if (!form.price.trim()) errs.price = 'Add the price. Items sold online need one.';
    else if (!Number.isFinite(price) || price <= 0) errs.price = 'Enter a price above ₹0.';
    const original = parseOriginalPrice(form.mrp, errs.price ? null : price);
    if (original.error) errs.mrp = original.error;
    if (form.images.length > MAX_APPAREL_PHOTOS) errs.images = `An item can have up to ${MAX_APPAREL_PHOTOS} photos.`;
    else if (form.images.some((u) => !isAllowedPhotoUrl(u))) errs.images = 'One of the photos has a link the website can’t use. Remove it and upload the photo instead.';
    setErrors(errs);
    if (Object.keys(errs).length) {
      focusFirstInvalid(formId);
      return;
    }

    const input: ApparelProductInput = {
      name: form.name.trim(),
      category: form.category,
      price: Math.round(price * 100) / 100,
      mrp: original.mrp,
      fabric: nullIfEmpty(form.fabric),
      fit: nullIfEmpty(form.fit),
      description: nullIfEmpty(form.description),
      images: form.images,
      customisable: form.customisable,
      isFeatured: form.isFeatured,
      isActive: form.isActive,
    };
    setSaving(true);
    setSaveError(null);
    try {
      const saved = product ? await shopService.updateApparel(product.id, input) : await shopService.createApparel(input);
      addToast('success', product ? 'Product updated' : 'Product added', `${saved.name} saved.`);
      onSaved(saved, !product);
    } catch (err) {
      const msg = errorMessage(err, 'Could not save the product.');
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const formId = 'apparel-form';
  return (
    <Portal>
      <Modal
        open
        size="lg"
        title={product ? `Edit ${product.name}` : 'New T-shirt or apparel item'}
        subtitle={product ? 'Sizes, colours and stock are edited separately.' : 'Save the details first, then add sizes, colours and stock.'}
        onClose={onClose}
        busy={saving}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="min-h-[44px] sm:px-5">
              Cancel
            </Button>
            <Button type="submit" form={formId} isLoading={saving} disabled={uploading} className="min-h-[44px] sm:px-6">
              {uploading ? 'Waiting for upload…' : product ? 'Save changes' : 'Save & add sizes'}
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

          <FormSection title="Photos" description="Front view first, then the back, a close-up of the fabric or print, and someone wearing it.">
            <PhotosEditor
              images={form.images}
              label={form.name}
              onChange={(imgs) => set('images', imgs)}
              onUploadingChange={setUploading}
              error={errors.images}
            />
          </FormSection>

          <FormSection title="Details">
            <Field label="Item name" htmlFor={`${uid}-name`} required error={errors.name}>
              <input
                id={`${uid}-name`}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Dry-fit round neck T-shirt"
                maxLength={140}
                className={`${inputClass} ${errors.name ? inputErrorClass : ''}`}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Category" htmlFor={`${uid}-cat`}>
                <select id={`${uid}-cat`} value={form.category} onChange={(e) => set('category', e.target.value as ApparelCategory)} className={inputClass}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Your price per piece (₹)" htmlFor={`${uid}-price`} required error={errors.price}>
                <input
                  id={`${uid}-price`}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="any"
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  placeholder="e.g. 499"
                  className={`${inputClass} ${errors.price ? inputErrorClass : ''}`}
                />
              </Field>
              <Field
                label="Original price (₹)"
                htmlFor={`${uid}-mrp`}
                optional
                error={errors.mrp}
                hint={originalPriceHint(form.mrp, form.price)}
              >
                <input
                  id={`${uid}-mrp`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={form.mrp}
                  onChange={(e) => set('mrp', e.target.value)}
                  placeholder="MRP"
                  className={`${inputClass} ${errors.mrp ? inputErrorClass : ''}`}
                />
              </Field>
              <Field label="Fabric" htmlFor={`${uid}-fabric`} optional hint='e.g. "100% polyester dry-fit, 160 GSM"'>
                <input id={`${uid}-fabric`} value={form.fabric} onChange={(e) => set('fabric', e.target.value)} maxLength={120} className={inputClass} />
              </Field>
              <Field label="Fit" htmlFor={`${uid}-fit`} optional>
                <input
                  id={`${uid}-fit`}
                  list={`${uid}-fits`}
                  value={form.fit}
                  onChange={(e) => set('fit', e.target.value)}
                  placeholder="Regular fit"
                  maxLength={60}
                  autoComplete="off"
                  className={inputClass}
                />
                <datalist id={`${uid}-fits`}>
                  {FIT_SUGGESTIONS.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </Field>
            </div>

            <Field label="Description" htmlFor={`${uid}-desc`} optional>
              <textarea
                id={`${uid}-desc`}
                rows={3}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                className={`${inputClass} resize-y`}
                placeholder="Feel, care instructions, what it's good for…"
              />
            </Field>
          </FormSection>

          <FormSection title="On the website">
            <div className={switchGroupClass}>
              <Switch
                checked={form.isActive}
                onChange={(v) => set('isActive', v)}
                label="Show on the website"
                description="Turn off to hide this item from customers."
              />
              <Switch checked={form.isFeatured} onChange={(v) => set('isFeatured', v)} label="Featured" description="Shown first in the shop." />
              <Switch
                checked={form.customisable}
                onChange={(v) => set('customisable', v)}
                label="Name / number printing"
                description="Tells customers that team names or numbers can be printed on request."
              />
            </div>
          </FormSection>

          {product && onEditStock && (
            <FormSection title="Sizes, colours & stock">
              <button
                type="button"
                onClick={onEditStock}
                disabled={saving}
                className={`w-full min-h-[44px] rounded-xl border border-line bg-white text-ink font-medium text-[14px] transition-colors duration-150 hover:bg-paper inline-flex items-center justify-center gap-2 ${focusRing}`}
              >
                <Layers className="w-4 h-4" aria-hidden="true" /> Edit sizes, colours & stock ({variantsOf(product).length}{' '}
                {variantsOf(product).length === 1 ? 'option' : 'options'})
              </button>
            </FormSection>
          )}
        </form>
      </Modal>
    </Portal>
  );
};

// =====================================================================
// Stock cell (− [n] +)
// =====================================================================

const StockCell: React.FC<{
  variant: ApparelVariant;
  label: string;
  onSave: (stock: number) => Promise<void>;
  onDelete: () => void;
  onPendingChange: (id: string, pending: boolean) => void;
}> = ({ variant, label, onSave, onDelete, onPendingChange }) => {
  const [draft, setDraftState] = useState(String(variant.stock));
  // Latest typed / stepped value, so quick taps never read a stale render.
  const draftRef = useRef(String(variant.stock));
  const setDraft = (v: string) => {
    draftRef.current = v;
    setDraftState(v);
  };
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) setDraft(String(variant.stock));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant.stock]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const commit = async (value: number) => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (value === variant.stock) {
      dirty.current = false;
      onPendingChange(variant.id, false);
      return;
    }
    setSaving(true);
    setError(null);
    onPendingChange(variant.id, true);
    try {
      await onSave(value);
      dirty.current = timer.current !== null;
    } catch (err) {
      dirty.current = false;
      setDraft(String(variant.stock));
      setError(errorMessage(err, 'Not saved.'));
    } finally {
      setSaving(false);
      onPendingChange(variant.id, timer.current !== null);
    }
  };

  const parsed = (s: string) => {
    const n = Math.floor(Number(s));
    return Number.isFinite(n) && n >= 0 ? Math.min(n, 9999) : null;
  };

  const bump = (delta: number) => {
    const n = Math.max(0, Math.min(9999, (parsed(draftRef.current) ?? variant.stock) + delta));
    setDraft(String(n));
    setError(null);
    dirty.current = true;
    onPendingChange(variant.id, true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => commit(n), 600);
  };

  const commitTyped = () => {
    const n = parsed(draftRef.current);
    if (n === null) {
      setDraft(String(variant.stock));
      setError('Whole number, 0 or more.');
      dirty.current = false;
      onPendingChange(variant.id, false);
      return;
    }
    setDraft(String(n));
    commit(n);
  };

  const shown = parsed(draft) ?? variant.stock;
  const tone =
    shown <= 0 ? 'border-rose-300 bg-rose-50' : shown <= LOW_STOCK ? 'border-amber-300 bg-amber-50' : 'border-line bg-white';
  const stepBtn =
    'w-11 h-11 shrink-0 inline-flex items-center justify-center text-ink-soft transition-colors duration-150 hover:bg-white/80 hover:text-ink disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink';

  return (
    <div className="min-w-[9.5rem]">
      <div className={`flex items-stretch rounded-xl border overflow-hidden ${tone}`}>
        <button type="button" className={stepBtn} onClick={() => bump(-1)} disabled={shown <= 0} aria-label={`One less ${label}`}>
          <Minus className="w-4 h-4" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          aria-label={`Stock for ${label}`}
          onChange={(e) => {
            setDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 4));
            dirty.current = true;
            onPendingChange(variant.id, true);
            if (timer.current) {
              window.clearTimeout(timer.current);
              timer.current = null;
            }
          }}
          onBlur={commitTyped}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitTyped();
            }
          }}
          className="w-full min-w-0 text-center text-[15px] font-semibold tabular-nums text-ink bg-transparent focus:outline-none focus:bg-white"
        />
        <button type="button" className={stepBtn} onClick={() => bump(1)} aria-label={`One more ${label}`}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-1 mt-0.5">
        <span
          className={`text-[12px] font-semibold ${error ? 'text-rose-700' : shown <= 0 ? 'text-rose-700' : shown <= LOW_STOCK ? 'text-amber-800' : 'text-ink-muted'}`}
          role={error ? 'alert' : undefined}
        >
          {saving ? (
            <span className="inline-flex items-center gap-1 text-ink-muted">
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> Saving
            </span>
          ) : error ? (
            error
          ) : shown <= 0 ? (
            'Out of stock'
          ) : shown <= LOW_STOCK ? (
            'Low stock'
          ) : (
            'In stock'
          )}
        </span>
        <button
          type="button"
          onClick={onDelete}
          disabled={saving}
          aria-label={`Delete ${label}`}
          title="Delete this size & colour"
          className={`-mr-1 w-11 h-11 sm:w-10 sm:h-10 inline-flex items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-40 ${focusRing}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// =====================================================================
// Sizes × colours dialog
// =====================================================================

interface ColourInfo {
  colour: string;
  colourHex: string | null;
}

type PendingConfirm =
  | { kind: 'variant'; variant: ApparelVariant }
  | { kind: 'size'; size: string; variants: ApparelVariant[] }
  | { kind: 'colour'; colour: string; variants: ApparelVariant[] };

const Swatch: React.FC<{ hex?: string | null; className?: string }> = ({ hex, className = 'w-4 h-4' }) =>
  hex ? (
    <span className={`${className} inline-block rounded-full border border-slate-300 shrink-0`} style={{ backgroundColor: hex }} aria-hidden="true" />
  ) : (
    <span className={`${className} inline-block rounded-full border border-dashed border-slate-300 shrink-0`} aria-hidden="true" />
  );

const VariantsDialog: React.FC<{
  product: ApparelProduct;
  isNew?: boolean;
  onChange: (p: ApparelProduct) => void;
  onClose: () => void;
}> = ({ product: initial, isNew, onChange, onClose }) => {
  const uid = useId();
  const [product, setProduct] = useState<ApparelProduct>(initial);
  const [pendingSizes, setPendingSizes] = useState<string[]>([]);
  const [pendingColours, setPendingColours] = useState<ColourInfo[]>([]);
  const [sizeInput, setSizeInput] = useState('');
  const [colourInput, setColourInput] = useState('');
  const [hexInput, setHexInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<{ size?: string; colour?: string }>({});
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set());

  const variants = variantsOf(product);
  // Latest copy, updated synchronously so overlapping saves never overwrite each other.
  const productRef = useRef(product);
  const commitProduct = useCallback(
    (next: ApparelProduct) => {
      productRef.current = next;
      setProduct(next);
      onChange(next);
    },
    [onChange]
  );

  // Grid axes: sizes in a sensible order, colours in the order they were added.
  const sizes = useMemo(() => {
    const seen: string[] = [];
    [...variants].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).forEach((v) => {
      if (!seen.some((s) => sameText(s, v.size))) seen.push(v.size);
    });
    pendingSizes.forEach((s) => {
      if (!seen.some((x) => sameText(x, s))) seen.push(s);
    });
    return seen
      .map((s, i) => ({ s, r: sizeRank(s, i) }))
      .sort((a, b) => a.r - b.r)
      .map((x) => x.s);
  }, [variants, pendingSizes]);

  const colours = useMemo(() => {
    const seen: ColourInfo[] = [];
    [...variants].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).forEach((v) => {
      const found = seen.find((c) => sameText(c.colour, v.colour));
      if (!found) seen.push({ colour: v.colour, colourHex: v.colourHex || null });
      else if (!found.colourHex && v.colourHex) found.colourHex = v.colourHex;
    });
    pendingColours.forEach((c) => {
      if (!seen.some((x) => sameText(x.colour, c.colour))) seen.push(c);
    });
    return seen;
  }, [variants, pendingColours]);

  const find = (size: string, colour: string) => variants.find((v) => sameText(v.size, size) && sameText(v.colour, colour));

  const sortOrderFor = (size: string, colour: string) => {
    const si = sizes.findIndex((s) => sameText(s, size));
    const ci = colours.findIndex((c) => sameText(c.colour, colour));
    return sizeRank(size, si < 0 ? sizes.length : si) * 100 + (ci < 0 ? colours.length : ci);
  };

  /** Creates the given size × colour combinations one by one (stock 0); keeps whatever succeeded. */
  const createCombos = async (combos: { size: string; colour: ColourInfo }[], label: string) => {
    setBusy(label);
    setError(null);
    try {
      for (const c of combos) {
        const list = variantsOf(productRef.current);
        if (list.some((v) => sameText(v.size, c.size) && sameText(v.colour, c.colour.colour))) continue;
        const created = await shopService.addApparelVariant(productRef.current.id, {
          size: c.size,
          colour: c.colour.colour,
          colourHex: c.colour.colourHex,
          stock: 0,
          sku: null,
          sortOrder: sortOrderFor(c.size, c.colour.colour),
        });
        commitProduct(withVariants(productRef.current, [...variantsOf(productRef.current), created]));
      }
      return true;
    } catch (err) {
      setError(errorMessage(err, 'Could not add the size / colour.'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const addSize = async (raw: string) => {
    const size = raw.trim().replace(/\s+/g, ' ');
    if (!size) {
      setInputError({ size: 'Type a size, e.g. M or Kids 10-12.' });
      return;
    }
    if (size.length > 20) {
      setInputError({ size: 'Keep sizes short (20 characters).' });
      return;
    }
    if (sizes.some((s) => sameText(s, size))) {
      setInputError({ size: `${size} is already in the list.` });
      return;
    }
    setInputError({});
    if (colours.length === 0) {
      setPendingSizes((p) => [...p, size]);
      setSizeInput('');
      return;
    }
    const ok = await createCombos(colours.map((c) => ({ size, colour: c })), `size:${size}`);
    if (ok) {
      setSizeInput('');
      setPendingColours([]);
    }
  };

  const addColour = async () => {
    const colour = colourInput.trim().replace(/\s+/g, ' ');
    const hex = hexInput.trim();
    if (!colour) {
      setInputError({ colour: 'Type a colour name, e.g. Navy.' });
      return;
    }
    if (colour.length > 30) {
      setInputError({ colour: 'Keep colour names short (30 characters).' });
      return;
    }
    if (colours.some((c) => sameText(c.colour, colour))) {
      setInputError({ colour: `${colour} is already in the list.` });
      return;
    }
    if (hex && !HEX_RE.test(hex)) {
      setInputError({ colour: 'Swatch must look like #1F2A44, or leave it empty.' });
      return;
    }
    setInputError({});
    const info: ColourInfo = { colour, colourHex: hex ? hex.toUpperCase() : null };
    if (sizes.length === 0) {
      setPendingColours((p) => [...p, info]);
      setColourInput('');
      setHexInput('');
      return;
    }
    const ok = await createCombos(sizes.map((s) => ({ size: s, colour: info })), `colour:${colour}`);
    if (ok) {
      setColourInput('');
      setHexInput('');
      setPendingSizes([]);
    }
  };

  const addCell = (size: string, colour: ColourInfo) => createCombos([{ size, colour }], `cell:${size}:${colour.colour}`);

  const saveStock = async (variant: ApparelVariant, stock: number) => {
    const saved = await shopService.updateApparelVariant(variant.id, { stock });
    const p = productRef.current;
    commitProduct(
      withVariants(
        p,
        variantsOf(p).map((v) => (v.id === variant.id ? { ...v, ...(saved && saved.id ? saved : { stock }) } : v))
      )
    );
  };

  const setCellPending = useCallback((id: string, pending: boolean) => {
    setPendingCells((prev) => {
      if (prev.has(id) === pending) return prev;
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const runConfirm = async () => {
    if (!confirm) return;
    const targets = confirm.kind === 'variant' ? [confirm.variant] : confirm.variants;
    setConfirmBusy(true);
    setError(null);
    try {
      for (const v of targets) {
        await shopService.deleteApparelVariant(v.id);
        const p = productRef.current;
        commitProduct(withVariants(p, variantsOf(p).filter((x) => x.id !== v.id)));
      }
      setConfirm(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not delete.'));
      setConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const removeSize = (size: string) => {
    const vs = variants.filter((v) => sameText(v.size, size));
    if (vs.length === 0) setPendingSizes((p) => p.filter((s) => !sameText(s, size)));
    else setConfirm({ kind: 'size', size, variants: vs });
  };
  const removeColour = (colour: string) => {
    const vs = variants.filter((v) => sameText(v.colour, colour));
    if (vs.length === 0) setPendingColours((p) => p.filter((c) => !sameText(c.colour, colour)));
    else setConfirm({ kind: 'colour', colour, variants: vs });
  };

  const anyPending = pendingCells.size > 0 || !!busy;
  const total = variants.reduce((acc, v) => acc + v.stock, 0);
  const low = variants.filter((v) => v.stock > 0 && v.stock <= LOW_STOCK).length;
  const out = variants.filter((v) => v.stock <= 0).length;
  const quickSizes = QUICK_SIZES.filter((s) => !sizes.some((x) => sameText(x, s)));

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const close = () => {
    if (anyPending) return;
    onClose();
  };

  const missingCell = (size: string, colour: ColourInfo) => {
    const key = `cell:${size}:${colour.colour}`;
    return (
      <button
        type="button"
        onClick={() => addCell(size, colour)}
        disabled={!!busy}
        className={`w-full min-w-[9.5rem] min-h-[44px] rounded-xl border border-dashed border-slate-300 text-[13px] font-medium text-ink-muted transition-colors duration-150 hover:bg-paper hover:text-ink inline-flex items-center justify-center gap-1 disabled:opacity-50 ${focusRing}`}
        aria-label={`Add ${colour.colour} / ${size}`}
      >
        {busy === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add
      </button>
    );
  };

  const cell = (size: string, colour: ColourInfo) => {
    const v = find(size, colour.colour);
    if (!v) return missingCell(size, colour);
    return (
      <StockCell
        key={v.id}
        variant={v}
        label={`${colour.colour} / ${size}`}
        onSave={(n) => saveStock(v, n)}
        onDelete={() => setConfirm({ kind: 'variant', variant: v })}
        onPendingChange={setCellPending}
      />
    );
  };

  const removeBtn = (onClick: () => void, label: string) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!!busy}
      aria-label={label}
      title={label}
      className={`w-11 h-11 sm:w-10 sm:h-10 shrink-0 inline-flex items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-40 ${focusRing}`}
    >
      <X className="w-4 h-4" />
    </button>
  );

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${uid}-title`}
          className="bg-white w-full sm:max-w-5xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-0.75rem)] sm:max-h-[calc(100dvh-2rem)] motion-safe:animate-fadeIn"
        >
          <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-4 pb-3 border-b border-line shrink-0">
            <div className="min-w-0 pt-1">
              <h2 id={`${uid}-title`} className="font-display tracking-[0.01em] text-[22px] sm:text-[24px] leading-tight font-bold text-ink break-words">
                Sizes, colours & stock
              </h2>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">
                <span className="font-medium text-ink-soft">{product.name}</span>
                {' · '}
                {variants.length === 0
                  ? isNew
                    ? 'Saved. Now add the sizes and colours you have, then enter the stock for each.'
                    : 'Add the sizes and colours you have, then enter the stock for each.'
                  : `${total} pieces in stock · ${variants.length} ${variants.length === 1 ? 'option' : 'options'}${low ? ` · ${low} low` : ''}${
                      out ? ` · ${out} out of stock` : ''
                    }`}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={anyPending}
              aria-label="Close"
              className={`shrink-0 w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-xl text-ink-muted transition-colors duration-150 hover:bg-paper hover:text-ink disabled:opacity-40 ${focusRing}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 sm:px-6 py-5 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-5">
            {error && <Notice tone="error">{error}</Notice>}

            {/* Add size / colour */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl border border-line bg-paper/60 space-y-2.5">
                <label htmlFor={`${uid}-size`} className={labelClass + ' !mb-0'}>
                  Add a size
                </label>
                <div className="flex gap-2">
                  <input
                    id={`${uid}-size`}
                    value={sizeInput}
                    onChange={(e) => {
                      setSizeInput(e.target.value);
                      if (inputError.size) setInputError({});
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSize(sizeInput);
                      }
                    }}
                    placeholder="e.g. M"
                    maxLength={20}
                    className={`${inputClass} ${inputError.size ? inputErrorClass : ''}`}
                  />
                  <Button type="button" variant="secondary" className="min-h-[44px] px-5 shrink-0" onClick={() => addSize(sizeInput)} disabled={!!busy}>
                    Add
                  </Button>
                </div>
                {inputError.size && <FieldError className="!mt-0">{inputError.size}</FieldError>}
                {quickSizes.length > 0 && (
                  <div className="flex flex-wrap gap-2" aria-label="Common sizes">
                    {quickSizes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => addSize(s)}
                        disabled={!!busy}
                        aria-label={`Add size ${s}`}
                        className={`min-h-[44px] sm:min-h-[40px] px-3 rounded-full border border-line bg-white text-[13px] font-medium text-ink-soft transition-colors duration-150 hover:border-ink/30 hover:text-ink disabled:opacity-50 inline-flex items-center gap-1 ${focusRing}`}
                      >
                        {busy === `size:${s}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5" aria-hidden="true" />} {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl border border-line bg-paper/60 space-y-2.5">
                <label htmlFor={`${uid}-colour`} className={labelClass + ' !mb-0'}>
                  Add a colour
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label="Swatch colour (optional)"
                    title="Swatch colour (optional)"
                    value={HEX_RE.test(hexInput) ? hexInput : '#cccccc'}
                    onChange={(e) => setHexInput(e.target.value.toUpperCase())}
                    className={`w-12 h-11 rounded-xl border border-line bg-white p-1 cursor-pointer shrink-0 ${focusRing}`}
                  />
                  <input
                    id={`${uid}-colour`}
                    value={colourInput}
                    onChange={(e) => {
                      setColourInput(e.target.value);
                      if (inputError.colour) setInputError({});
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addColour();
                      }
                    }}
                    placeholder="e.g. Navy"
                    maxLength={30}
                    className={`${inputClass} ${inputError.colour ? inputErrorClass : ''}`}
                  />
                  <Button type="button" variant="secondary" className="min-h-[44px] px-5 shrink-0" onClick={addColour} disabled={!!busy}>
                    {busy?.startsWith('colour:') ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Adding" /> : 'Add'}
                  </Button>
                </div>
                {inputError.colour ? (
                  <FieldError className="!mt-0">{inputError.colour}</FieldError>
                ) : (
                  <p className={`${hintClass} !mt-0`}>
                    {hexInput ? (
                      <span className="inline-flex items-center gap-1">
                        Swatch {hexInput}
                        <button
                          type="button"
                          onClick={() => setHexInput('')}
                          className={`-my-3 min-h-[44px] px-2 rounded-lg font-medium text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink ${focusRing}`}
                        >
                          Clear
                        </button>
                      </span>
                    ) : (
                      'Optional: pick a swatch colour with the square button. It shows as a dot on the website.'
                    )}
                  </p>
                )}
              </div>
            </div>

            {(pendingSizes.length > 0 || pendingColours.length > 0) && (
              <Notice tone="warning">
                {pendingSizes.length > 0
                  ? `Now add a colour. Sizes ${pendingSizes.join(', ')} are saved once there is at least one colour.`
                  : `Now add a size. ${pendingColours.map((c) => c.colour).join(', ')} is saved once there is at least one size.`}
              </Notice>
            )}

            {sizes.length > 0 && colours.length > 0 ? (
              <>
                {/* Desktop: colour rows × size columns */}
                <div className="hidden md:block overflow-x-auto rounded-2xl border border-line">
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-paper border-b border-line text-ink-soft">
                        <th scope="col" className="py-1.5 px-3 text-[13px] font-semibold whitespace-nowrap">
                          Colour <span className="font-normal text-ink-muted">/ size</span>
                        </th>
                        {sizes.map((s) => (
                          <th key={s} scope="col" className="py-1.5 px-2 font-semibold text-ink text-[15px] whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              {s}
                              {removeBtn(() => removeSize(s), `Remove size ${s}`)}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/70">
                      {colours.map((c) => (
                        <tr key={c.colour}>
                          <th scope="row" className="py-2 px-3 align-top font-semibold text-[14px] text-ink whitespace-nowrap">
                            <span className="inline-flex items-center gap-2 min-h-[44px]">
                              <Swatch hex={c.colourHex} />
                              {c.colour}
                              {removeBtn(() => removeColour(c.colour), `Remove colour ${c.colour}`)}
                            </span>
                          </th>
                          {sizes.map((s) => (
                            <td key={s} className="py-2 px-2 align-top">
                              {cell(s, c)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Phone: one block per colour */}
                <div className="md:hidden space-y-3">
                  {colours.map((c) => (
                    <div key={c.colour} className="rounded-2xl border border-line">
                      <div className="flex items-center justify-between gap-2 pl-3 pr-1 py-1 bg-paper rounded-t-2xl border-b border-line">
                        <span className="inline-flex items-center gap-2 font-semibold text-[15px] text-ink min-w-0">
                          <Swatch hex={c.colourHex} />
                          <span className="truncate">{c.colour}</span>
                        </span>
                        {removeBtn(() => removeColour(c.colour), `Remove colour ${c.colour}`)}
                      </div>
                      <ul className="divide-y divide-line/70">
                        {sizes.map((s) => (
                          <li key={s} className="flex items-start gap-3 px-3 py-2">
                            <span className="w-16 shrink-0 pt-3 text-[15px] font-semibold text-ink break-words">{s}</span>
                            <div className="flex-1 min-w-0">{cell(s, c)}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {sizes.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-[13px] text-ink-muted items-center">
                      Remove a size:
                      {sizes.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => removeSize(s)}
                          disabled={!!busy}
                          aria-label={`Remove size ${s}`}
                          className={`min-h-[44px] px-3 rounded-full border border-line bg-white font-medium text-ink-soft transition-colors duration-150 hover:text-rose-700 hover:border-rose-200 inline-flex items-center gap-1 ${focusRing}`}
                        >
                          {s} <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[13px] text-ink-muted">
                  Tap − / + or type a number; it saves on its own. <span className="text-amber-800 font-semibold">Amber</span> = {LOW_STOCK} or
                  fewer left, <span className="text-rose-700 font-semibold">red</span> = out of stock (customers can’t order it).
                </p>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-8 text-center">
                <p className="text-[15px] font-semibold text-ink">No sizes or colours yet</p>
                <p className="mt-1 text-[14px] text-ink-muted">Add at least one size and one colour. Customers can only order what you add here.</p>
              </div>
            )}
          </div>

          <div className="px-5 sm:px-6 pt-3 border-t border-line shrink-0 flex items-center justify-end gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <span className="text-[13px] text-ink-muted inline-flex items-center gap-1.5 mr-auto" role="status">
              {anyPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Saving stock…
                </>
              ) : variants.length > 0 ? (
                'All changes saved'
              ) : null}
            </span>
            <Button type="button" onClick={close} disabled={anyPending} className="min-h-[44px] px-6 sm:min-w-[8rem]">
              Done
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirm}
        busy={confirmBusy}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
        title={confirm?.kind === 'variant' ? 'Delete this size & colour?' : confirm?.kind === 'size' ? `Remove size ${confirm.size}?` : confirm ? `Remove ${confirm.colour}?` : ''}
        confirmLabel="Delete"
        message={
          confirm ? (
            confirm.kind === 'variant' ? (
              <>
                <b>
                  {confirm.variant.colour} / {confirm.variant.size}
                </b>{' '}
                ({confirm.variant.stock} in stock) will no longer be sold. Orders already placed are not affected.
              </>
            ) : (
              <>
                This deletes {confirm.variants.length} size & colour {confirm.variants.length === 1 ? 'option' : 'options'} (
                {confirm.variants.reduce((a, v) => a + v.stock, 0)} pieces in stock). Orders already placed are not affected.
              </>
            )
          ) : null
        }
      />
    </Portal>
  );
};

// =====================================================================
// Product row
// =====================================================================

const ProductThumb: React.FC<{ product: ApparelProduct }> = ({ product }) => {
  const photos = photosOf(product);
  const [broken, setBroken] = useState(false);
  const main = photos[0];
  const soldOut = variantsOf(product).length > 0 && totalStock(product) === 0;
  return (
    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white border border-line shrink-0 overflow-hidden flex items-center justify-center">
      {main && !broken ? (
        <img
          src={main}
          alt={product.name}
          loading="lazy"
          onError={() => setBroken(true)}
          className={`w-full h-full object-cover ${soldOut ? 'grayscale opacity-60' : ''}`}
        />
      ) : (
        <span className="flex flex-col items-center gap-1 text-ink-muted" aria-hidden="true">
          <Shirt className="w-5 h-5" />
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

const ProductRow: React.FC<{
  product: ApparelProduct;
  pending: 'isActive' | 'isFeatured' | null;
  onToggle: (key: 'isActive' | 'isFeatured') => void;
  onStock: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ product: p, pending, onToggle, onStock, onEdit, onDelete }) => {
  const vs = variantsOf(p);
  const total = totalStock(p);
  const low = lowCount(p);
  const out = outCount(p);
  const sizes = Array.isArray(p.sizes) && p.sizes.length ? p.sizes : Array.from(new Set(vs.map((v) => v.size)));
  const colours = Array.isArray(p.colours) && p.colours.length ? p.colours : [];
  const noPhoto = photosOf(p).length === 0;

  return (
    <li className={`${cardClass} p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5 ${p.isActive ? '' : 'bg-paper/70'}`}>
      <div className="flex gap-3 sm:gap-4 min-w-0 flex-1">
        <ProductThumb product={p} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink-muted">{categoryLabel(p.category)}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[16px] font-semibold leading-snug text-ink break-words">{p.name}</span>
            {p.isFeatured && (
              <span className={`${chipClass} bg-accent/25 border-accent/60 text-ink`}>
                <Star className="w-3 h-3" aria-hidden="true" /> Featured
              </span>
            )}
            {!p.isActive && (
              <span className={`${chipClass} bg-paper-deep border-line text-ink-soft`}>
                <EyeOff className="w-3 h-3" aria-hidden="true" /> Hidden from website
              </span>
            )}
            {p.customisable && <span className={`${chipClass} bg-white border-line text-ink-soft`}>Name / number printing</span>}
          </div>
          <p className="mt-0.5 text-[13px] text-ink-muted break-words">
            <PriceTag price={Number(p.price || 0)} mrp={p.mrp} size="compact" />
            {[p.fabric, p.fit].filter((s) => s && s.trim()).map((s) => ` · ${s}`)}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[13px]">
            {vs.length === 0 ? (
              <span className="font-medium text-amber-800">No sizes yet, so customers can’t order it</span>
            ) : (
              <>
                <span className={`font-medium ${total === 0 ? 'text-rose-700' : 'text-ink-soft'}`}>
                  {total} in stock · {vs.length} {vs.length === 1 ? 'option' : 'options'}
                </span>
                {sizes.length > 0 && <span className="text-ink-muted">Sizes {sizes.join(', ')}</span>}
                {colours.length > 0 && (
                  <span className="inline-flex items-center gap-0.5" aria-label={`Colours: ${colours.map((c) => c.colour).join(', ')}`}>
                    {colours.slice(0, 8).map((c) => (
                      <span key={c.colour} title={c.colour}>
                        <Swatch hex={c.colourHex} className="w-3 h-3" />
                      </span>
                    ))}
                  </span>
                )}
                {low > 0 && <span className={`${chipClass} border-amber-200 bg-amber-50 text-amber-900`}>{low} low</span>}
                {out > 0 && <span className={`${chipClass} border-rose-200 bg-rose-50 text-rose-700`}>{out} out of stock</span>}
              </>
            )}
            {noPhoto && <span className="font-medium text-amber-800">No photo yet</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 lg:shrink-0">
        <div className="flex items-center gap-4 px-1 sm:pr-3 sm:border-r border-line">
          {(['isActive', 'isFeatured'] as const).map((key) => (
            <label key={key} className="inline-flex items-center gap-2 text-[14px] font-medium text-ink-soft cursor-pointer min-h-[44px]">
              <button
                type="button"
                role="switch"
                aria-checked={p[key]}
                aria-label={`${key === 'isActive' ? 'Show on the website' : 'Featured'}: ${p.name}`}
                disabled={!!pending}
                onClick={() => onToggle(key)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-150 disabled:cursor-wait ${focusRing}`}
              >
                <span className={`absolute inset-0 rounded-full transition-colors duration-150 ${p[key] ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                <span
                  className={`relative inline-flex items-center justify-center h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    p[key] ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                >
                  {pending === key && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
                </span>
              </button>
              {key === 'isActive' ? 'On the website' : 'Featured'}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-[44px] px-4 flex-1 sm:flex-none"
            leftIcon={<Layers className="w-4 h-4" />}
            onClick={onStock}
            aria-label={`Sizes and stock for ${p.name}`}
          >
            Sizes & stock
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-[44px] px-4"
            leftIcon={<Pencil className="w-4 h-4" />}
            onClick={onEdit}
            aria-label={`Edit ${p.name}`}
          >
            Edit
          </Button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${p.name}`}
            title="Delete item"
            className={`${iconButtonDangerClass} sm:w-11 sm:h-11`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </li>
  );
};

// =====================================================================
// Manager
// =====================================================================

export const ApparelManager: React.FC = () => {
  const { addToast } = useApp();
  const [products, setProducts] = useState<ApparelProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [pending, setPending] = useState<Record<string, 'isActive' | 'isFeatured'>>({});
  const [editing, setEditing] = useState<ApparelProduct | 'new' | null>(null);
  const [stockFor, setStockFor] = useState<{ product: ApparelProduct; isNew?: boolean } | null>(null);
  const [deleting, setDeleting] = useState<ApparelProduct | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setLoadError(null);
    try {
      const list = await shopService.listApparel();
      setProducts(sortProducts(Array.isArray(list) ? list : []));
      setUnavailable(false);
    } catch (err) {
      setUnavailable((err as { status?: number })?.status === 404);
      setLoadError(errorMessage(err, 'Could not load the apparel.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replace = useCallback((p: ApparelProduct) => {
    setProducts((list) => sortProducts(list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p]));
  }, []);

  const toggle = async (p: ApparelProduct, key: 'isActive' | 'isFeatured') => {
    if (pending[p.id]) return;
    setPending((m) => ({ ...m, [p.id]: key }));
    try {
      const saved = await shopService.updateApparel(p.id, { [key]: !p[key] });
      replace(saved && saved.id ? saved : { ...p, [key]: !p[key] });
    } catch (err) {
      addToast('error', 'Not saved', `${p.name}: ${errorMessage(err, 'please try again.')}`);
    } finally {
      setPending((m) => {
        const next = { ...m };
        delete next[p.id];
        return next;
      });
    }
  };

  const runDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await shopService.deleteApparel(deleting.id);
      setProducts((list) => list.filter((p) => p.id !== deleting.id));
      addToast('success', 'Product deleted', `${deleting.name} was removed.`);
      setDeleting(null);
    } catch (err) {
      addToast('error', 'Delete failed', errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const stats = useMemo(() => {
    let featured = 0;
    let low = 0;
    let out = 0;
    let noPhoto = 0;
    let hidden = 0;
    let units = 0;
    let lowVariants = 0;
    let outVariants = 0;
    products.forEach((p) => {
      if (p.isFeatured) featured++;
      if (!p.isActive) hidden++;
      if (photosOf(p).length === 0) noPhoto++;
      const l = lowCount(p);
      const o = outCount(p);
      if (l) low++;
      if (o || variantsOf(p).length === 0) out++;
      lowVariants += l;
      outVariants += o;
      units += totalStock(p);
    });
    return { featured, low, out, noPhoto, hidden, units, lowVariants, outVariants };
  }, [products]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      products.filter((p) => {
        if (filter === 'featured' && !p.isFeatured) return false;
        if (filter === 'low' && lowCount(p) === 0) return false;
        if (filter === 'out' && !(outCount(p) > 0 || variantsOf(p).length === 0)) return false;
        if (filter === 'nophoto' && photosOf(p).length > 0) return false;
        if (filter === 'hidden' && p.isActive) return false;
        if (!q) return true;
        return [p.name, categoryLabel(p.category), p.fabric, p.fit, ...variantsOf(p).map((v) => `${v.colour} ${v.size}`)]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(q));
      }),
    [products, filter, q]
  );

  return (
    <div className="space-y-4 min-w-0">
      <SectionHeader
        title="T-shirts & apparel"
        description="T-shirts, jerseys and other clothing sold online. Customers can only order the sizes and colours that are in stock."
        actions={
          <Button
            type="button"
            onClick={() => setEditing('new')}
            leftIcon={<Plus className="w-4 h-4" />}
            className="min-h-[44px] px-5"
            disabled={(loading && products.length === 0) || unavailable}
          >
            Add item
          </Button>
        }
      />

      {loading && products.length === 0 ? (
        <ListSkeleton rows={4} />
      ) : loadError && products.length === 0 ? (
        unavailable ? (
          <div className={`${cardClass} px-6 py-10 sm:py-12 text-center flex flex-col items-center`} role="status">
            <div className="w-12 h-12 rounded-full bg-paper flex items-center justify-center">
              <Shirt className="w-6 h-6 text-ink-soft" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-[17px] font-semibold text-ink">The online shop isn’t set up yet</h3>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-muted max-w-sm">
              Once your website developer switches on the T-shirt shop, you can add items and stock here.
            </p>
            <Button type="button" variant="secondary" className="mt-5 min-h-[44px] px-5" onClick={() => load()} isLoading={loading}>
              Try again
            </Button>
          </div>
        ) : (
          <ErrorState message={loadError} onRetry={() => load()} retrying={loading} />
        )
      ) : products.length === 0 ? (
        <EmptyState
          title="No T-shirts or apparel yet"
          description="Add your first item with photos and a price, then its sizes, colours and stock."
          actionText="Add item"
          onAction={() => setEditing('new')}
        />
      ) : (
        <>
          <StatGrid>
            <StatTile label="Items" value={products.length} />
            <StatTile label="Pieces in stock" value={stats.units} />
            <StatTile label={`Low stock (${LOW_STOCK} or fewer)`} value={stats.lowVariants} tone={stats.lowVariants ? 'warn' : 'default'} />
            <StatTile label="Sizes out of stock" value={stats.outVariants} tone={stats.outVariants ? 'bad' : 'default'} />
          </StatGrid>

          <div className="space-y-3">
            <SearchField
              id="apparel-search"
              label="Search T-shirts and apparel"
              value={query}
              onChange={setQuery}
              placeholder="Search by name, fabric, size or colour"
            />
            <Pills<FilterId>
              ariaLabel="Filter apparel"
              value={filter}
              onChange={setFilter}
              options={[
                { id: 'all', label: 'All', count: products.length },
                { id: 'featured', label: 'Featured', count: stats.featured },
                { id: 'low', label: 'Low stock', count: stats.low, highlight: true },
                { id: 'out', label: 'Out of stock', count: stats.out, highlight: true },
                { id: 'nophoto', label: 'No photo yet', count: stats.noPhoto, highlight: true },
                { id: 'hidden', label: 'Hidden', count: stats.hidden },
              ]}
            />
          </div>

          {loadError && <RefreshFailed message={loadError} onRetry={() => load()} retrying={loading} />}

          {visible.length === 0 ? (
            <NoMatches
              title="Nothing matches"
              onClear={() => {
                setQuery('');
                setFilter('all');
              }}
            />
          ) : (
            <ul className="space-y-2.5">
              {visible.map((p) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  pending={pending[p.id] || null}
                  onToggle={(key) => toggle(p, key)}
                  onStock={() => setStockFor({ product: p })}
                  onEdit={() => setEditing(p)}
                  onDelete={() => setDeleting(p)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {editing && (
        <ApparelFormModal
          key={editing === 'new' ? 'new' : editing.id}
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onEditStock={
            editing !== 'new'
              ? () => {
                  const current = products.find((p) => p.id === editing.id) || editing;
                  setEditing(null);
                  setStockFor({ product: current });
                }
              : undefined
          }
          onSaved={(saved, isNew) => {
            replace(saved);
            setEditing(null);
            if (isNew) setStockFor({ product: saved, isNew: true });
          }}
        />
      )}

      {stockFor && (
        <VariantsDialog
          key={stockFor.product.id}
          product={stockFor.product}
          isNew={stockFor.isNew}
          onChange={replace}
          onClose={() => {
            setStockFor(null);
            load(true);
          }}
        />
      )}

      <Portal>
        <ConfirmDialog
          open={!!deleting}
          busy={deleteBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={runDelete}
          title="Delete this item?"
          confirmLabel="Delete item"
          message={
            deleting ? (
              <>
                <b className="font-semibold text-ink">{deleting.name}</b> and its {variantsOf(deleting).length} size & colour options will be removed
                from the website. Orders already placed are not affected. This can’t be undone.
                <span className="block mt-2 text-[13px] text-ink-muted">Tip: turn off “On the website” instead to hide it for now.</span>
              </>
            ) : null
          }
        />
      </Portal>
    </div>
  );
};

export default ApparelManager;
