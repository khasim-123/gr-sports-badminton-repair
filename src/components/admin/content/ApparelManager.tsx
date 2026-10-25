/**
 * Admin: T-shirts & apparel sold online — product details, photos and stock per size × colour.
 * Product saves and stock changes wait for the server. Stock steppers save shortly after the last
 * tap (so "+ + + +" is one save) and roll back with an inline error if the save fails.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ImageOff,
  Layers,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Search,
  Shirt,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { shopService } from '../../../services/shopService';
import type { ApparelCategory, ApparelProduct, ApparelProductInput, ApparelVariant } from '../../../types/shop';
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
    'flex-1 min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-slate-600 hover:bg-paper disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/40';
  return (
    <li className={`rounded-2xl border bg-white overflow-hidden flex flex-col ${isMain ? 'border-amber-300 ring-2 ring-brandYellow' : 'border-line'}`}>
      <div className="relative aspect-square bg-white">
        {broken ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400 p-2 text-center">
            <ImageOff className="w-6 h-6" />
            <span className="text-xs font-semibold">Can't load this photo</span>
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
          className={`absolute top-1.5 left-1.5 text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
            isMain ? 'bg-brandYellow text-sportsBlue' : 'bg-white/90 border border-line text-slate-600'
          }`}
        >
          {isMain ? 'Main photo' : `#${index + 1}`}
        </span>
      </div>
      <div className="flex border-t border-line/70 divide-x divide-line/70">
        <button type="button" className={btn} disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Move photo ${index + 1} left`} title="Move left">
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
          ? 'The upload worked, but the server returned a non-secure (http) link. Ask your developer to set PUBLIC_API_URL to the https address.'
          : 'Use a secure link starting with https:// (or a site path starting with /).'
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
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="block text-xs font-semibold text-slate-700">Photos</span>
        <span className={`text-xs font-bold ${full ? 'text-amber-700' : 'text-slate-500'}`}>
          {images.length}/{MAX_APPAREL_PHOTOS}
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
              onRemove={(index) => onChange(images.filter((_, j) => j !== index))}
            />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">No photos yet — add at least one real photo of the garment before showing it on the website.</p>
      )}
      {/* Kept mounted (only hidden) when full, so an in-flight upload can still report it finished. */}
      <div hidden={full}>
        <MediaUpload
          label={images.length ? 'Add another photo' : 'Add main photo'}
          value={null}
          onChange={(url, info) => add(url, !!info?.media)}
          aspectClass="aspect-square"
          compact
          hint="Front view first, then back, close-up of the fabric or print, and someone wearing it."
          onUploadingChange={onUploadingChange}
          error={error}
        />
      </div>
      {full && <p className="text-xs text-amber-700 font-medium">Maximum of {MAX_APPAREL_PHOTOS} photos reached — remove one to add another.</p>}
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
  const [errors, setErrors] = useState<Partial<Record<'name' | 'price' | 'images', string>>>({});
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
    if (!form.name.trim()) errs.name = 'Product name is required.';
    else if (form.name.trim().length > 120) errs.name = 'Keep the name under 120 characters.';
    const price = Number(form.price.trim());
    if (!form.price.trim()) errs.price = 'Price is required for items sold online.';
    else if (!Number.isFinite(price) || price <= 0) errs.price = 'Enter a price above ₹0.';
    if (form.images.length > MAX_APPAREL_PHOTOS) errs.images = `Up to ${MAX_APPAREL_PHOTOS} photos.`;
    else if (form.images.some((u) => !isAllowedPhotoUrl(u))) errs.images = 'Every photo must be an https:// link or a site path.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const input: ApparelProductInput = {
      name: form.name.trim(),
      category: form.category,
      price: Math.round(price * 100) / 100,
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
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="min-h-[42px]">
              Cancel
            </Button>
            <Button type="submit" form={formId} isLoading={saving} disabled={uploading} className="min-h-[42px]">
              {uploading ? 'Waiting for upload…' : product ? 'Save changes' : 'Save & add sizes'}
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
            label={form.name}
            onChange={(imgs) => set('images', imgs)}
            onUploadingChange={setUploading}
            error={errors.images}
          />

          <Field label="Product name" htmlFor={`${uid}-name`} required error={errors.name}>
            <input
              id={`${uid}-name`}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Dry-fit round neck T-shirt"
              maxLength={140}
              className={`${inputClass} ${errors.name ? inputErrorClass : ''}`}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor={`${uid}-cat`}>
              <select id={`${uid}-cat`} value={form.category} onChange={(e) => set('category', e.target.value as ApparelCategory)} className={inputClass}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Price per piece (₹)" htmlFor={`${uid}-price`} required error={errors.price}>
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
            <Field label="Fabric" htmlFor={`${uid}-fabric`} hint='e.g. "100% polyester dry-fit, 160 GSM"'>
              <input id={`${uid}-fabric`} value={form.fabric} onChange={(e) => set('fabric', e.target.value)} maxLength={120} className={inputClass} />
            </Field>
            <Field label="Fit" htmlFor={`${uid}-fit`}>
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

          <Field label="Description" htmlFor={`${uid}-desc`}>
            <textarea
              id={`${uid}-desc`}
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className={`${inputClass} resize-y`}
              placeholder="Feel, care instructions, what it's good for…"
            />
          </Field>

          <div className="divide-y divide-line/70 rounded-2xl border border-line px-3">
            <Switch
              checked={form.customisable}
              onChange={(v) => set('customisable', v)}
              label="Name / number printing"
              description="Shows that team names or numbers can be printed on request."
            />
            <Switch checked={form.isFeatured} onChange={(v) => set('isFeatured', v)} label="Featured" description="Shown first in the shop." />
            <Switch
              checked={form.isActive}
              onChange={(v) => set('isActive', v)}
              label="Visible on website"
              description="Turn off to hide this item from customers."
            />
          </div>

          {product && onEditStock && (
            <button
              type="button"
              onClick={onEditStock}
              disabled={saving}
              className="w-full min-h-[44px] rounded-xl border border-line bg-paper text-ink font-bold text-xs hover:bg-paper-deep inline-flex items-center justify-center gap-1.5"
            >
              <Layers className="w-4 h-4" /> Edit sizes, colours & stock ({variantsOf(product).length} variants)
            </button>
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
    'w-9 h-10 shrink-0 inline-flex items-center justify-center text-slate-600 hover:bg-white/80 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/40';

  return (
    <div className="min-w-[8.5rem]">
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
          className="w-full min-w-0 text-center text-sm font-bold text-slate-900 bg-transparent focus:outline-none focus:bg-white"
        />
        <button type="button" className={stepBtn} onClick={() => bump(1)} aria-label={`One more ${label}`}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-1 mt-0.5 min-h-[24px]">
        <span
          className={`text-xs font-bold ${error ? 'text-rose-700' : shown <= 0 ? 'text-rose-700' : shown <= LOW_STOCK ? 'text-amber-700' : 'text-slate-400'}`}
          role={error ? 'alert' : undefined}
        >
          {saving ? (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving
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
          className="w-6 h-6 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40"
        >
          <Trash2 className="w-3.5 h-3.5" />
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
    <span className={`${className} rounded-full border border-slate-300 shrink-0`} style={{ backgroundColor: hex }} aria-hidden="true" />
  ) : (
    <span className={`${className} rounded-full border border-dashed border-slate-300 shrink-0`} aria-hidden="true" />
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
        className="w-full min-w-[8.5rem] min-h-[40px] rounded-xl border border-dashed border-slate-300 text-xs font-bold text-slate-500 hover:bg-paper hover:text-ink inline-flex items-center justify-center gap-1 disabled:opacity-50"
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
      className="w-7 h-7 shrink-0 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  );

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/70 backdrop-blur-xs">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${uid}-title`}
          className="bg-white w-full sm:max-w-5xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[calc(100dvh-2rem)] animate-fadeIn"
        >
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-line/70 shrink-0">
            <div className="min-w-0">
              <h3 id={`${uid}-title`} className="font-bold text-base text-slate-900 break-words">
                Sizes, colours & stock — {product.name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {variants.length === 0
                  ? isNew
                    ? 'Saved. Now add the sizes and colours you have, then enter the stock for each.'
                    : 'Add the sizes and colours you have, then enter the stock for each.'
                  : `${total} pieces in stock · ${variants.length} ${variants.length === 1 ? 'variant' : 'variants'}${low ? ` · ${low} low` : ''}${
                      out ? ` · ${out} out of stock` : ''
                    }`}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={anyPending}
              aria-label="Close"
              className="shrink-0 w-10 h-10 -mr-2 -mt-1 inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 py-4 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-1.5" role="alert">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            {/* Add size / colour */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl border border-line bg-paper/60 space-y-2">
                <label htmlFor={`${uid}-size`} className="block text-xs font-semibold text-slate-700">
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
                  <Button type="button" variant="outline" className="min-h-[42px] shrink-0" onClick={() => addSize(sizeInput)} disabled={!!busy}>
                    Add
                  </Button>
                </div>
                {inputError.size && (
                  <p className="text-xs text-rose-600 font-medium" role="alert">
                    {inputError.size}
                  </p>
                )}
                {quickSizes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5" aria-label="Common sizes">
                    {quickSizes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => addSize(s)}
                        disabled={!!busy}
                        className="min-h-[34px] px-2.5 rounded-lg border border-line bg-white text-xs font-bold text-slate-700 hover:bg-paper disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {busy === `size:${s}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-2xl border border-line bg-paper/60 space-y-2">
                <label htmlFor={`${uid}-colour`} className="block text-xs font-semibold text-slate-700">
                  Add a colour
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label="Swatch colour (optional)"
                    title="Swatch colour (optional)"
                    value={HEX_RE.test(hexInput) ? hexInput : '#cccccc'}
                    onChange={(e) => setHexInput(e.target.value.toUpperCase())}
                    className="w-12 h-[42px] rounded-xl border border-slate-300 bg-white p-1 cursor-pointer shrink-0"
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
                  <Button type="button" variant="outline" className="min-h-[42px] shrink-0" onClick={addColour} disabled={!!busy}>
                    {busy?.startsWith('colour:') ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                  </Button>
                </div>
                {inputError.colour ? (
                  <p className="text-xs text-rose-600 font-medium" role="alert">
                    {inputError.colour}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 leading-snug">
                    {hexInput ? (
                      <span className="inline-flex items-center gap-1">
                        Swatch {hexInput}
                        <button type="button" onClick={() => setHexInput('')} className="font-bold text-ink hover:underline px-1">
                          clear
                        </button>
                      </span>
                    ) : (
                      'Pick a swatch colour (optional) — shown as a dot on the website.'
                    )}
                  </p>
                )}
              </div>
            </div>

            {(pendingSizes.length > 0 || pendingColours.length > 0) && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                {pendingSizes.length > 0
                  ? `Now add a colour — sizes ${pendingSizes.join(', ')} are saved once there is at least one colour.`
                  : `Now add a size — ${pendingColours.map((c) => c.colour).join(', ')} is saved once there is at least one size.`}
              </p>
            )}

            {sizes.length > 0 && colours.length > 0 ? (
              <>
                {/* Desktop: colour rows × size columns */}
                <div className="hidden md:block overflow-x-auto rounded-2xl border border-line">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-paper border-b border-line text-slate-600">
                        <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Colour \ Size</th>
                        {sizes.map((s) => (
                          <th key={s} className="py-2 px-2 font-bold text-slate-900 text-sm whitespace-nowrap">
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
                          <th scope="row" className="py-2 px-3 align-top font-semibold text-slate-900 whitespace-nowrap">
                            <span className="inline-flex items-center gap-2 min-h-[40px]">
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
                      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-paper rounded-t-2xl border-b border-line">
                        <span className="inline-flex items-center gap-2 font-bold text-sm text-slate-900 min-w-0">
                          <Swatch hex={c.colourHex} />
                          <span className="truncate">{c.colour}</span>
                        </span>
                        {removeBtn(() => removeColour(c.colour), `Remove colour ${c.colour}`)}
                      </div>
                      <ul className="divide-y divide-line/70">
                        {sizes.map((s) => (
                          <li key={s} className="flex items-start gap-3 px-3 py-2">
                            <span className="w-16 shrink-0 pt-2.5 text-sm font-bold text-slate-900 break-words">{s}</span>
                            <div className="flex-1 min-w-0">{cell(s, c)}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {sizes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 text-xs text-slate-500 items-center">
                      Remove a size:
                      {sizes.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => removeSize(s)}
                          disabled={!!busy}
                          className="min-h-[32px] px-2 rounded-lg border border-line bg-white font-bold text-slate-600 hover:text-rose-600 hover:border-rose-200 inline-flex items-center gap-1"
                        >
                          {s} <X className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Tap − / + or type a number; it saves on its own. <span className="text-amber-700 font-semibold">Amber</span> = {LOW_STOCK} or
                  fewer left, <span className="text-rose-700 font-semibold">red</span> = out of stock (customers can't order it).
                </p>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-line p-6 text-center">
                <Layers className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-700 mt-2">No sizes or colours yet</p>
                <p className="text-xs text-slate-500 mt-1">Add at least one size and one colour. Customers can only order sizes you add here.</p>
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-line/70 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {anyPending && (
              <span className="text-xs text-slate-500 inline-flex items-center gap-1 sm:mr-auto" role="status">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving stock…
              </span>
            )}
            <Button type="button" onClick={close} disabled={anyPending} className="min-h-[42px] sm:min-w-[8rem]">
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
                This deletes {confirm.variants.length} {confirm.variants.length === 1 ? 'variant' : 'variants'} (
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
        <Shirt className="w-8 h-8 text-slate-300" aria-hidden="true" />
      )}
      {photos.length > 1 && (
        <span className="absolute bottom-1 right-1 text-xs font-bold bg-slate-900/75 text-white px-1 rounded">{photos.length} photos</span>
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
    <li className={`${cardClass} p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3 ${p.isActive ? '' : 'bg-paper/80'}`}>
      <div className="flex gap-3 min-w-0 flex-1">
        <ProductThumb product={p} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-paper text-sportsBlue border border-line">
              {categoryLabel(p.category)}
            </span>
            {p.isFeatured && (
              <span className="inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded bg-brandYellow text-sportsBlue">
                <Star className="w-3 h-3" /> Featured
              </span>
            )}
            {p.isActive ? (
              <span className="inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                <Eye className="w-3 h-3" /> On website
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                <EyeOff className="w-3 h-3" /> Hidden
              </span>
            )}
            {p.customisable && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-white border border-line text-slate-600">Name / number printing</span>
            )}
          </div>
          <p className="font-bold text-sm text-slate-900 mt-1 break-words">{p.name}</p>
          <p className="text-xs text-slate-500 break-words">
            <span className="font-bold text-slate-900 text-xs">₹{Number(p.price || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            {[p.fabric, p.fit].filter((s) => s && s.trim()).map((s) => ` · ${s}`)}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
            {vs.length === 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">
                <Layers className="w-3 h-3" /> No sizes yet — customers can't order it
              </span>
            ) : (
              <>
                <span className={`text-xs font-bold ${total === 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                  {total} in stock · {vs.length} {vs.length === 1 ? 'variant' : 'variants'}
                </span>
                {sizes.length > 0 && <span className="text-xs text-slate-500">Sizes {sizes.join(', ')}</span>}
                {colours.length > 0 && (
                  <span className="inline-flex items-center gap-0.5" aria-label={`Colours: ${colours.map((c) => c.colour).join(', ')}`}>
                    {colours.slice(0, 8).map((c) => (
                      <span key={c.colour} title={c.colour}>
                        <Swatch hex={c.colourHex} className="w-3 h-3" />
                      </span>
                    ))}
                  </span>
                )}
                {low > 0 && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">{low} low</span>
                )}
                {out > 0 && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-700">{out} out of stock</span>
                )}
              </>
            )}
            {noPhoto && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded border border-slate-300 bg-paper text-slate-600">
                <ImageOff className="w-3 h-3" /> No photo yet
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 lg:shrink-0">
        <div className="flex items-center gap-3 px-1 sm:pr-2 sm:border-r border-line/70">
          {(['isActive', 'isFeatured'] as const).map((key) => (
            <label key={key} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer min-h-[44px]">
              <button
                type="button"
                role="switch"
                aria-checked={p[key]}
                aria-label={`${key === 'isActive' ? 'Visible on website' : 'Featured'}: ${p.name}`}
                disabled={!!pending}
                onClick={() => onToggle(key)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:cursor-wait"
              >
                <span className={`absolute inset-0 rounded-full ${p[key] ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span
                  className={`relative inline-flex items-center justify-center h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    p[key] ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                >
                  {pending === key && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
                </span>
              </button>
              {key === 'isActive' ? 'On website' : 'Featured'}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px] flex-1 sm:flex-none"
            leftIcon={<Layers className="w-3.5 h-3.5" />}
            onClick={onStock}
            aria-label={`Sizes and stock for ${p.name}`}
          >
            Sizes & stock
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            leftIcon={<Pencil className="w-3.5 h-3.5" />}
            onClick={onEdit}
            aria-label={`Edit ${p.name}`}
          >
            Edit
          </Button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${p.name}`}
            title="Delete product"
            className="shrink-0 w-11 h-11 inline-flex items-center justify-center rounded-xl border border-line bg-white text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50"
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
        description="T-shirts, jerseys and other clothing sold online. Add real photos and a price, then the sizes and colours you have with the stock for each — customers can only order what is in stock."
        actions={
          <Button
            type="button"
            onClick={() => setEditing('new')}
            leftIcon={<Plus className="w-4 h-4" />}
            className="min-h-[42px]"
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
          <div className={`${cardClass} p-6 sm:p-8 text-center flex flex-col items-center`} role="status">
            <div className="w-12 h-12 rounded-2xl bg-paper border border-line flex items-center justify-center mb-3">
              <Shirt className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">The online shop isn't switched on yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              The server doesn't have the apparel catalogue yet. Once it is updated you can add T-shirts and stock here.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-4 min-h-[40px]" onClick={() => load()} isLoading={loading}>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className={`${cardClass} p-3`}>
              <p className="text-xs font-semibold text-slate-500">Items</p>
              <p className="text-xl font-bold text-slate-900">{products.length}</p>
            </div>
            <div className={`${cardClass} p-3`}>
              <p className="text-xs font-semibold text-slate-500">Pieces in stock</p>
              <p className="text-xl font-bold text-slate-900">{stats.units}</p>
            </div>
            <div className={`${cardClass} p-3`}>
              <p className="text-xs font-semibold text-slate-500">Low stock (≤ {LOW_STOCK})</p>
              <p className={`text-xl font-bold ${stats.lowVariants ? 'text-amber-600' : 'text-emerald-600'}`}>{stats.lowVariants}</p>
            </div>
            <div className={`${cardClass} p-3`}>
              <p className="text-xs font-semibold text-slate-500">Out of stock</p>
              <p className={`text-xl font-bold ${stats.outVariants ? 'text-rose-600' : 'text-emerald-600'}`}>{stats.outVariants}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <label htmlFor="apparel-search" className="sr-only">
                Search apparel
              </label>
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="apparel-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, fabric, size or colour"
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

          {loadError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between gap-2">
              <span>Refresh failed: {loadError}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => load()} className="min-h-[36px]">
                Retry
              </Button>
            </div>
          )}

          {visible.length === 0 ? (
            <div className={`${cardClass} p-8 text-center`}>
              <p className="text-sm font-semibold text-slate-700">Nothing matches</p>
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
                <b>{deleting.name}</b> and its {variantsOf(deleting).length} sizes/colours will be removed from the website. Orders already placed
                are not affected. This can't be undone.
                <span className="block mt-2 text-xs text-slate-500">Tip: turn off “On website” instead to hide it temporarily.</span>
              </>
            ) : null
          }
        />
      </Portal>
    </div>
  );
};

export default ApparelManager;
