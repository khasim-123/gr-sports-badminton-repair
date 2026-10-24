/**
 * Admin: string catalogue (products) and per-colour stock.
 * The in-stock / out-of-stock toggle on each colour tile is the most-used action,
 * so it is one tap, optimistic, and rolls back with a toast if the save fails.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  CircleCheck,
  CircleX,
  IndianRupee,
  Loader2,
  PackageCheck,
  PackageX,
  Palette,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { contentService } from '../../../services/contentService';
import { StringProduct, StringProductInput, StringVariant, StringVariantInput } from '../../../types/content';
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

type FilterId = 'all' | 'featured' | 'out' | 'noprice' | 'inactive';

const sortProducts = (list: StringProduct[]) =>
  [...list]
    .map((p) => ({ ...p, variants: [...(p.variants || [])].sort((a, b) => a.sortOrder - b.sortOrder) }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

const withCounts = (p: StringProduct): StringProduct => ({
  ...p,
  inStockCount: p.variants.filter((v) => v.inStock).length,
});

const hasPrice = (p: StringProduct) => p.price !== null && p.price !== undefined;

const formatPrice = (price: number) =>
  `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const productLabel = (p: StringProduct) => [p.brand, p.name].filter(Boolean).join(' ');

// =====================================================================
// Product form
// =====================================================================

interface ProductFormState {
  brand: string;
  code: string;
  name: string;
  gauge: string;
  price: string;
  description: string;
  isFeatured: boolean;
  isActive: boolean;
}

const productToForm = (p: StringProduct | null, defaultBrand: string): ProductFormState => ({
  brand: p?.brand ?? defaultBrand,
  code: p?.code ?? '',
  name: p?.name ?? '',
  gauge: p?.gauge ?? '',
  price: p && hasPrice(p) ? String(p.price) : '',
  description: p?.description ?? '',
  isFeatured: p?.isFeatured ?? false,
  isActive: p?.isActive ?? true,
});

const ProductFormModal: React.FC<{
  product: StringProduct | null;
  defaultBrand: string;
  onClose: () => void;
  onSaved: (p: StringProduct, isNew: boolean) => void;
}> = ({ product, defaultBrand, onClose, onSaved }) => {
  const { addToast } = useApp();
  const [form, setForm] = useState<ProductFormState>(() => productToForm(product, defaultBrand));
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!form.brand.trim()) errs.brand = 'Brand is required.';
    if (!form.name.trim()) errs.name = 'Name is required.';
    const priceText = form.price.trim();
    let price: number | null = null;
    if (priceText) {
      price = Number(priceText);
      if (!Number.isFinite(price) || price < 0) errs.price = 'Enter a valid amount, or leave empty.';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const input: StringProductInput = {
      brand: form.brand.trim(),
      code: nullIfEmpty(form.code),
      name: form.name.trim(),
      gauge: nullIfEmpty(form.gauge),
      price,
      description: nullIfEmpty(form.description),
      isFeatured: form.isFeatured,
      isActive: form.isActive,
    };
    setSaving(true);
    setSaveError(null);
    try {
      const saved = product
        ? await contentService.updateString(product.id, input)
        : await contentService.createString(input);
      addToast('success', product ? 'String updated' : 'String added', `${productLabel(saved)} saved.`);
      onSaved(saved, !product);
    } catch (err) {
      const msg = errorMessage(err, 'Could not save the string.');
      setSaveError(msg);
      addToast('error', 'Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const formId = 'string-product-form';
  return (
    <Modal
      open
      title={product ? `Edit ${productLabel(product)}` : 'New string'}
      subtitle={product ? 'Details shown in the strings catalogue' : 'Add colours after saving'}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="min-h-[42px]">
            Cancel
          </Button>
          <Button type="submit" form={formId} isLoading={saving} className="min-h-[42px]">
            {product ? 'Save changes' : 'Add string'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        {saveError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700" role="alert">
            {saveError} Your changes are still here — try again.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand" htmlFor="sp-brand" required error={errors.brand}>
            <input
              id="sp-brand"
              value={form.brand}
              onChange={(e) => set('brand', e.target.value)}
              className={`${inputClass} ${errors.brand ? inputErrorClass : ''}`}
            />
          </Field>
          <Field label="Code" htmlFor="sp-code" hint="e.g. 66XB">
            <input id="sp-code" value={form.code} onChange={(e) => set('code', e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Name" htmlFor="sp-name" required error={errors.name}>
          <input
            id="sp-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={`${inputClass} ${errors.name ? inputErrorClass : ''}`}
            placeholder="e.g. Pro 66XB"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gauge" htmlFor="sp-gauge" hint="e.g. 0.66 mm">
            <input id="sp-gauge" value={form.gauge} onChange={(e) => set('gauge', e.target.value)} className={inputClass} />
          </Field>
          <Field
            label="Price (₹)"
            htmlFor="sp-price"
            error={errors.price}
            hint={form.price.trim() ? 'Stringing price incl. string' : 'Empty = "Price on request"'}
          >
            <input
              id="sp-price"
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
        </div>
        <Field label="Description" htmlFor="sp-desc">
          <textarea
            id="sp-desc"
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className={`${inputClass} resize-y`}
            placeholder="Feel, durability, who it suits…"
          />
        </Field>
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 px-3">
          <Switch
            checked={form.isFeatured}
            onChange={(v) => set('isFeatured', v)}
            label="Featured"
            description="Highlighted at the top of the catalogue."
          />
          <Switch
            checked={form.isActive}
            onChange={(v) => set('isActive', v)}
            label="Show on website"
            description="Turn off to hide this string from customers."
          />
        </div>
      </form>
    </Modal>
  );
};

// =====================================================================
// Variant (colour) form
// =====================================================================

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const VariantFormModal: React.FC<{
  product: StringProduct;
  variant: StringVariant | null;
  onClose: () => void;
  onSaved: (v: StringVariant, isNew: boolean) => void;
}> = ({ product, variant, onClose, onSaved }) => {
  const { addToast } = useApp();
  const [colour, setColour] = useState(variant?.colour ?? '');
  const [hex, setHex] = useState(variant?.colourHex ?? '');
  const [imageUrl, setImageUrl] = useState<string | null>(variant?.imageUrl ?? null);
  const [inStock, setInStock] = useState(variant?.inStock ?? true);
  const [errors, setErrors] = useState<{ colour?: string; hex?: string }>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    const name = colour.trim();
    if (!name) errs.colour = 'Colour name is required.';
    else if (
      product.variants.some((v) => v.id !== variant?.id && v.colour.trim().toLowerCase() === name.toLowerCase())
    )
      errs.colour = `${product.name} already has a "${name}" colour.`;
    const hexValue = hex.trim();
    if (hexValue && !HEX_RE.test(hexValue)) errs.hex = 'Use the format #RRGGBB, or leave empty.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const input: StringVariantInput = {
      colour: name,
      colourHex: hexValue ? hexValue.toUpperCase() : null,
      imageUrl: imageUrl || null,
      inStock,
    };
    setSaving(true);
    setSaveError(null);
    try {
      const saved = variant
        ? await contentService.updateVariant(variant.id, input)
        : await contentService.addVariant(product.id, input);
      addToast('success', variant ? 'Colour updated' : 'Colour added', `${product.name} — ${saved.colour}`);
      onSaved(saved, !variant);
    } catch (err) {
      const msg = errorMessage(err, 'Could not save the colour.');
      setSaveError(msg);
      addToast('error', 'Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const formId = 'string-variant-form';
  return (
    <Modal
      open
      title={variant ? `Edit colour — ${variant.colour}` : 'Add colour'}
      subtitle={productLabel(product)}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="min-h-[42px]">
            Cancel
          </Button>
          <Button type="submit" form={formId} isLoading={saving} disabled={uploading} className="min-h-[42px]">
            {uploading ? 'Waiting for upload…' : variant ? 'Save colour' : 'Add colour'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        {saveError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700" role="alert">
            {saveError} Your changes are still here — try again.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4">
          <MediaUpload
            label="Pack photo"
            value={imageUrl}
            onChange={(url) => setImageUrl(url)}
            aspectClass="aspect-square"
            compact
            hint="Square photo on white works best."
            onUploadingChange={setUploading}
          />
          <div className="space-y-4">
            <Field label="Colour name" htmlFor="sv-colour" required error={errors.colour}>
              <input
                id="sv-colour"
                value={colour}
                onChange={(e) => {
                  setColour(e.target.value);
                  if (errors.colour) setErrors((x) => ({ ...x, colour: undefined }));
                }}
                className={`${inputClass} ${errors.colour ? inputErrorClass : ''}`}
                placeholder="e.g. Lime"
              />
            </Field>
            <Field label="Swatch colour (optional)" htmlFor="sv-hex" error={errors.hex} hint="Shown as a dot next to the name.">
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Pick swatch colour"
                  value={HEX_RE.test(hex) ? hex : '#cccccc'}
                  onChange={(e) => {
                    setHex(e.target.value.toUpperCase());
                    if (errors.hex) setErrors((x) => ({ ...x, hex: undefined }));
                  }}
                  className="w-12 h-[42px] rounded-xl border border-slate-300 bg-white p-1 cursor-pointer shrink-0"
                />
                <input
                  id="sv-hex"
                  value={hex}
                  onChange={(e) => {
                    setHex(e.target.value);
                    if (errors.hex) setErrors((x) => ({ ...x, hex: undefined }));
                  }}
                  placeholder="#RRGGBB"
                  className={`${inputClass} font-mono ${errors.hex ? inputErrorClass : ''}`}
                  maxLength={7}
                />
                {hex && (
                  <button
                    type="button"
                    onClick={() => setHex('')}
                    aria-label="Clear swatch colour"
                    className="w-10 h-[42px] shrink-0 inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </Field>
            <Switch checked={inStock} onChange={setInStock} label="In stock" onLabel="In stock" offLabel="Out of stock" />
          </div>
        </div>
      </form>
    </Modal>
  );
};

// =====================================================================
// Colour tile
// =====================================================================

const VariantTile: React.FC<{
  product: StringProduct;
  variant: StringVariant;
  pending: boolean;
  highlight: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ product, variant, pending, highlight, onToggle, onEdit, onDelete }) => {
  const v = variant;
  return (
    <li
      className={`rounded-2xl border bg-white overflow-hidden flex flex-col transition-shadow ${
        highlight ? 'ring-2 ring-brandYellow border-amber-300' : v.inStock ? 'border-slate-200' : 'border-rose-200'
      }`}
    >
      <div className="relative aspect-square bg-white">
        {v.imageUrl ? (
          <img
            src={v.imageUrl}
            alt={`${product.name} ${v.colour}`}
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-contain p-2 transition ${v.inStock ? '' : 'grayscale opacity-50'}`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Palette className="w-8 h-8 text-slate-300" />
          </div>
        )}
        {!v.inStock && (
          <span className="absolute top-1.5 left-1.5 text-[9px] font-black uppercase tracking-wide bg-rose-600 text-white px-1.5 py-0.5 rounded">
            Sold out
          </span>
        )}
        <div className="absolute top-1 right-1 flex gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit colour ${v.colour}`}
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-white/90 border border-slate-200 text-slate-600 hover:text-blue-700 shadow-2xs"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete colour ${v.colour}`}
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-white/90 border border-slate-200 text-slate-600 hover:text-rose-600 shadow-2xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="px-2 pt-1.5 pb-2 flex flex-col gap-1.5 border-t border-slate-100">
        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
          {v.colourHex && (
            <span
              className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
              style={{ backgroundColor: v.colourHex }}
              aria-hidden="true"
            />
          )}
          <span className="truncate">{v.colour}</span>
        </p>
        <button
          type="button"
          onClick={onToggle}
          disabled={pending}
          aria-pressed={v.inStock}
          aria-busy={pending}
          aria-label={`${v.colour}: ${v.inStock ? 'in stock' : 'out of stock'}. Tap to mark ${v.inStock ? 'out of stock' : 'in stock'}.`}
          className={`w-full min-h-[44px] rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98] disabled:cursor-wait ${
            v.inStock
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100'
          }`}
        >
          {pending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : v.inStock ? (
            <CircleCheck className="w-4 h-4" />
          ) : (
            <CircleX className="w-4 h-4" />
          )}
          {v.inStock ? 'In stock' : 'Out of stock'}
        </button>
      </div>
    </li>
  );
};

// =====================================================================
// Manager
// =====================================================================

type Confirm =
  | { kind: 'deleteProduct'; product: StringProduct }
  | { kind: 'deleteVariant'; product: StringProduct; variant: StringVariant }
  | { kind: 'allStock'; product: StringProduct; inStock: boolean };

export const StringsManager: React.FC = () => {
  const { addToast } = useApp();
  const [products, setProducts] = useState<StringProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingVariants, setPendingVariants] = useState<Set<string>>(new Set());
  const [editingProduct, setEditingProduct] = useState<StringProduct | 'new' | null>(null);
  const [editingVariant, setEditingVariant] = useState<{ product: StringProduct; variant: StringVariant | null } | null>(
    null
  );
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setProducts(sortProducts(await contentService.listStrings()));
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load the strings catalogue.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replaceProduct = (saved: StringProduct) =>
    setProducts((list) => sortProducts(list.map((p) => (p.id === saved.id ? saved : p))));

  const patchVariant = (productId: string, variantId: string, patch: Partial<StringVariant> | StringVariant) =>
    setProducts((list) =>
      list.map((p) =>
        p.id === productId
          ? withCounts({ ...p, variants: p.variants.map((v) => (v.id === variantId ? { ...v, ...patch } : v)) })
          : p
      )
    );

  const setPending = (id: string, on: boolean) =>
    setPendingVariants((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  // ---- the most-used action: one-tap optimistic stock toggle ----
  const toggleStock = async (product: StringProduct, variant: StringVariant) => {
    if (pendingVariants.has(variant.id)) return;
    const next = !variant.inStock;
    patchVariant(product.id, variant.id, { inStock: next });
    setPending(variant.id, true);
    setAnnouncement(`${product.name} ${variant.colour} marked ${next ? 'in stock' : 'out of stock'}`);
    try {
      const saved = await contentService.updateVariant(variant.id, { inStock: next });
      if (saved && saved.id) patchVariant(product.id, variant.id, saved);
    } catch (err) {
      patchVariant(product.id, variant.id, { inStock: variant.inStock });
      setAnnouncement(`Could not update ${variant.colour}; reverted.`);
      addToast(
        'error',
        'Stock not updated',
        `${product.name} ${variant.colour} is still ${variant.inStock ? 'in stock' : 'out of stock'}. ${errorMessage(err, '')}`.trim()
      );
    } finally {
      setPending(variant.id, false);
    }
  };

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      if (confirm.kind === 'deleteProduct') {
        await contentService.deleteString(confirm.product.id);
        setProducts((list) => list.filter((p) => p.id !== confirm.product.id));
        addToast('success', 'String deleted', `${productLabel(confirm.product)} was removed.`);
      } else if (confirm.kind === 'deleteVariant') {
        await contentService.deleteVariant(confirm.variant.id);
        setProducts((list) =>
          list.map((p) =>
            p.id === confirm.product.id
              ? withCounts({ ...p, variants: p.variants.filter((v) => v.id !== confirm.variant.id) })
              : p
          )
        );
        addToast('success', 'Colour deleted', `${confirm.product.name} — ${confirm.variant.colour} removed.`);
      } else {
        const saved = await contentService.setAllVariantsStock(confirm.product.id, confirm.inStock);
        replaceProduct(saved);
        addToast(
          'success',
          confirm.inStock ? 'All colours in stock' : 'All colours out of stock',
          `${productLabel(confirm.product)} updated.`
        );
      }
      setConfirm(null);
    } catch (err) {
      addToast('error', 'Action failed', errorMessage(err));
    } finally {
      setConfirmBusy(false);
    }
  };

  // ---- derived ----
  const q = query.trim().toLowerCase();

  const stats = useMemo(() => {
    let colours = 0;
    let out = 0;
    let noPrice = 0;
    let featured = 0;
    let inactive = 0;
    let withOut = 0;
    products.forEach((p) => {
      colours += p.variants.length;
      const o = p.variants.filter((v) => !v.inStock).length;
      out += o;
      if (o > 0) withOut++;
      if (!hasPrice(p)) noPrice++;
      if (p.isFeatured) featured++;
      if (!p.isActive) inactive++;
    });
    return { colours, out, noPrice, featured, inactive, withOut };
  }, [products]);

  const visible = useMemo(() => {
    return products
      .filter((p) => {
        if (filter === 'featured' && !p.isFeatured) return false;
        if (filter === 'out' && !p.variants.some((v) => !v.inStock)) return false;
        if (filter === 'noprice' && hasPrice(p)) return false;
        if (filter === 'inactive' && p.isActive) return false;
        return true;
      })
      .map((p) => {
        if (!q) return { product: p, colourMatches: new Set<string>(), matched: true };
        const productHit = [p.name, p.code, p.brand, `${p.brand} ${p.name}`]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(q));
        const colourMatches = new Set(p.variants.filter((v) => v.colour.toLowerCase().includes(q)).map((v) => v.id));
        return { product: p, colourMatches, matched: productHit || colourMatches.size > 0 };
      })
      .filter((x) => x.matched);
  }, [products, filter, q]);

  const defaultBrand = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((p) => counts.set(p.brand, (counts.get(p.brand) || 0) + 1));
    let best = 'Hundred';
    let max = 0;
    counts.forEach((n, b) => {
      if (n > max) {
        max = n;
        best = b;
      }
    });
    return best;
  }, [products]);

  // ---- render ----
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Strings & colour stock"
        description="Tap a colour's stock button to mark it in or out of stock — it saves instantly. Strings without a price show “Price on request” on the website."
        actions={
          <Button
            type="button"
            onClick={() => setEditingProduct('new')}
            leftIcon={<Plus className="w-4 h-4" />}
            className="min-h-[42px]"
            disabled={loading && products.length === 0}
          >
            Add string
          </Button>
        }
      />

      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      {loading && products.length === 0 ? (
        <ListSkeleton rows={5} />
      ) : loadError && products.length === 0 ? (
        <ErrorState message={loadError} onRetry={load} retrying={loading} />
      ) : products.length === 0 ? (
        <EmptyState
          title="No strings in the catalogue"
          description="Add your first string model, then add its colours with pack photos."
          actionText="Add string"
          onAction={() => setEditingProduct('new')}
        />
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className={`${cardClass} p-3`}>
              <p className="text-[11px] font-semibold text-slate-500">Strings</p>
              <p className="text-xl font-black text-slate-900">{products.length}</p>
            </div>
            <div className={`${cardClass} p-3`}>
              <p className="text-[11px] font-semibold text-slate-500">Colours</p>
              <p className="text-xl font-black text-slate-900">{stats.colours}</p>
            </div>
            <div className={`${cardClass} p-3`}>
              <p className="text-[11px] font-semibold text-slate-500">Colours out of stock</p>
              <p className={`text-xl font-black ${stats.out ? 'text-rose-600' : 'text-emerald-600'}`}>{stats.out}</p>
            </div>
            <div className={`${cardClass} p-3`}>
              <p className="text-[11px] font-semibold text-slate-500">No price yet</p>
              <p className={`text-xl font-black ${stats.noPrice ? 'text-amber-600' : 'text-emerald-600'}`}>
                {stats.noPrice}
              </p>
            </div>
          </div>

          {/* Search + filters */}
          <div className="space-y-2">
            <div className="relative">
              <label htmlFor="strings-search" className="sr-only">
                Search strings
              </label>
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="strings-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, code or colour (e.g. 66XB, lime)"
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
              ariaLabel="Filter strings"
              value={filter}
              onChange={setFilter}
              options={[
                { id: 'all', label: 'All', count: products.length },
                { id: 'featured', label: 'Featured', count: stats.featured },
                { id: 'out', label: 'Has out-of-stock', count: stats.withOut, highlight: true },
                { id: 'noprice', label: 'No price yet', count: stats.noPrice, highlight: true },
                { id: 'inactive', label: 'Inactive', count: stats.inactive },
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
              <p className="text-sm font-semibold text-slate-700">No strings match</p>
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
              {visible.map(({ product: p, colourMatches }) => {
                const isOpen = expanded.has(p.id) || colourMatches.size > 0;
                const total = p.variants.length;
                const inStock = p.variants.filter((v) => v.inStock).length;
                const thumb = p.variants.find((v) => v.imageUrl)?.imageUrl;
                const panelId = `string-panel-${p.id}`;
                return (
                  <li key={p.id} className={`${cardClass} overflow-hidden ${p.isActive ? '' : 'opacity-80'}`}>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(p.id)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="w-full text-left p-3 sm:p-4 flex items-center gap-3 hover:bg-slate-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                    >
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                        {thumb ? (
                          <img src={thumb} alt="" loading="lazy" className="w-full h-full object-contain p-1" />
                        ) : (
                          <Palette className="w-6 h-6 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-sm text-slate-900 break-words">{p.name}</span>
                          {p.isFeatured && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-brandYellow text-sportsBlue">
                              <Star className="w-3 h-3" /> Featured
                            </span>
                          )}
                          {!p.isActive && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                              Hidden
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {[p.brand, p.code, p.gauge].filter(Boolean).join(' · ')}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          {hasPrice(p) ? (
                            <span className="text-xs font-bold text-slate-900">{formatPrice(p.price as number)}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">
                              <IndianRupee className="w-3 h-3" /> No price — shows “Price on request”
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-semibold ${
                              total === 0 ? 'text-slate-400' : inStock === total ? 'text-emerald-700' : inStock === 0 ? 'text-rose-600' : 'text-amber-700'
                            }`}
                          >
                            {total === 0 ? 'No colours yet' : `${inStock}/${total} colours in stock`}
                          </span>
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>

                    {isOpen && (
                      <div id={panelId} className="border-t border-slate-100 p-3 sm:p-4 space-y-3 bg-slate-50/40">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-[40px]"
                            leftIcon={<Pencil className="w-3.5 h-3.5" />}
                            onClick={() => setEditingProduct(p)}
                          >
                            Edit details
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-[40px]"
                            leftIcon={<Plus className="w-3.5 h-3.5" />}
                            onClick={() => setEditingVariant({ product: p, variant: null })}
                          >
                            Add colour
                          </Button>
                          {total > 0 && (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="min-h-[40px] text-emerald-700"
                                leftIcon={<PackageCheck className="w-3.5 h-3.5" />}
                                disabled={inStock === total}
                                onClick={() => setConfirm({ kind: 'allStock', product: p, inStock: true })}
                              >
                                All in stock
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="min-h-[40px] text-rose-700"
                                leftIcon={<PackageX className="w-3.5 h-3.5" />}
                                disabled={inStock === 0}
                                onClick={() => setConfirm({ kind: 'allStock', product: p, inStock: false })}
                              >
                                All out of stock
                              </Button>
                            </>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="min-h-[40px] text-rose-600 sm:ml-auto"
                            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={() => setConfirm({ kind: 'deleteProduct', product: p })}
                          >
                            Delete string
                          </Button>
                        </div>

                        {p.description && <p className="text-xs text-slate-600">{p.description}</p>}

                        {total === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
                            <Palette className="w-7 h-7 text-slate-300 mx-auto" />
                            <p className="text-xs text-slate-500 mt-2">No colours yet.</p>
                            <Button
                              type="button"
                              size="sm"
                              className="mt-3 min-h-[40px]"
                              leftIcon={<Plus className="w-3.5 h-3.5" />}
                              onClick={() => setEditingVariant({ product: p, variant: null })}
                            >
                              Add first colour
                            </Button>
                          </div>
                        ) : (
                          <ul className="grid grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                            {p.variants.map((v) => (
                              <VariantTile
                                key={v.id}
                                product={p}
                                variant={v}
                                pending={pendingVariants.has(v.id)}
                                highlight={colourMatches.has(v.id)}
                                onToggle={() => toggleStock(p, v)}
                                onEdit={() => setEditingVariant({ product: p, variant: v })}
                                onDelete={() => setConfirm({ kind: 'deleteVariant', product: p, variant: v })}
                              />
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {editingProduct && (
        <ProductFormModal
          key={editingProduct === 'new' ? 'new' : editingProduct.id}
          product={editingProduct === 'new' ? null : editingProduct}
          defaultBrand={defaultBrand}
          onClose={() => setEditingProduct(null)}
          onSaved={(saved, isNew) => {
            if (isNew) {
              const full = withCounts({ ...saved, variants: saved.variants || [] });
              setProducts((list) => sortProducts([...list, full]));
              setExpanded((prev) => new Set(prev).add(saved.id));
            } else {
              // Keep the live variant list (it may have changed while the form was open).
              setProducts((list) =>
                sortProducts(
                  list.map((p) =>
                    p.id === saved.id ? withCounts({ ...saved, variants: saved.variants?.length ? saved.variants : p.variants }) : p
                  )
                )
              );
            }
            setEditingProduct(null);
          }}
        />
      )}

      {editingVariant && (
        <VariantFormModal
          key={editingVariant.variant ? editingVariant.variant.id : `new-${editingVariant.product.id}`}
          product={products.find((p) => p.id === editingVariant.product.id) || editingVariant.product}
          variant={editingVariant.variant}
          onClose={() => setEditingVariant(null)}
          onSaved={(saved, isNew) => {
            const productId = editingVariant.product.id;
            setProducts((list) =>
              sortProducts(
                list.map((p) =>
                  p.id === productId
                    ? withCounts({
                        ...p,
                        variants: isNew ? [...p.variants, saved] : p.variants.map((v) => (v.id === saved.id ? saved : v)),
                      })
                    : p
                )
              )
            );
            setEditingVariant(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        busy={confirmBusy}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
        danger={confirm?.kind !== 'allStock' || confirm.inStock === false}
        title={
          confirm?.kind === 'deleteProduct'
            ? 'Delete string?'
            : confirm?.kind === 'deleteVariant'
              ? 'Delete colour?'
              : confirm?.kind === 'allStock' && confirm.inStock
                ? 'Mark all colours in stock?'
                : 'Mark all colours out of stock?'
        }
        confirmLabel={
          confirm?.kind === 'deleteProduct'
            ? 'Delete string'
            : confirm?.kind === 'deleteVariant'
              ? 'Delete colour'
              : confirm?.kind === 'allStock' && confirm.inStock
                ? 'Mark all in stock'
                : 'Mark all out of stock'
        }
        message={
          confirm?.kind === 'deleteProduct' ? (
            <>
              <b>{productLabel(confirm.product)}</b> and its {confirm.product.variants.length} colour
              {confirm.product.variants.length === 1 ? '' : 's'} will be removed from the website. This can't be undone.
              <span className="block mt-2 text-xs text-slate-500">Tip: turn off “Show on website” instead to hide it temporarily.</span>
            </>
          ) : confirm?.kind === 'deleteVariant' ? (
            <>
              Remove <b>{confirm.variant.colour}</b> from {productLabel(confirm.product)}? This can't be undone.
            </>
          ) : confirm?.kind === 'allStock' ? (
            <>
              All {confirm.product.variants.length} colours of <b>{productLabel(confirm.product)}</b> will be marked{' '}
              <b>{confirm.inStock ? 'in stock' : 'out of stock'}</b>, replacing the individual colour settings.
            </>
          ) : null
        }
      />
    </div>
  );
};

export default StringsManager;
