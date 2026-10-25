/**
 * Admin: homepage banner carousel management.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ExternalLink,

  MousePointerClick,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { contentService } from '../../../services/contentService';
import { Banner, BannerCtaTarget, BannerInput } from '../../../types/content';
import { Button } from '../../common/Button';
import { EmptyState } from '../../common/EmptyStates';
import { MediaUpload } from './MediaUpload';
import {
  ConfirmDialog,
  ErrorState,
  Field,
  ListSkeleton,
  Modal,
  SectionHeader,
  Switch,
  cardClass,
  errorMessage,
  formatDate,
  inputClass,
  inputErrorClass,
  isHttpsUrl,
  nullIfEmpty,
  todayISO,
} from './shared';

export const CTA_TARGET_LABELS: Record<BannerCtaTarget, string> = {
  stringing: 'Book stringing',
  repair: 'Book repair',
  strings: 'Strings catalogue',
  rackets: 'Rackets',
  tshirts: 'T-shirts',
  courts: 'Courts',
  tournaments: 'Tournaments',
  url: 'External link',
  none: 'No button',
};

const CTA_TARGETS = Object.keys(CTA_TARGET_LABELS) as BannerCtaTarget[];

const sortBanners = (list: Banner[]) => [...list].sort((a, b) => a.sortOrder - b.sortOrder);

type ScheduleState = { label: string; tone: 'live' | 'scheduled' | 'expired' | 'off' };

const scheduleState = (b: Banner): ScheduleState => {
  if (!b.isActive) return { label: 'Hidden', tone: 'off' };
  const today = todayISO();
  if (b.startsAt && b.startsAt > today) return { label: `Starts ${formatDate(b.startsAt)}`, tone: 'scheduled' };
  if (b.endsAt && b.endsAt < today) return { label: `Ended ${formatDate(b.endsAt)}`, tone: 'expired' };
  return { label: 'Live now', tone: 'live' };
};

const toneClass: Record<ScheduleState['tone'], string> = {
  live: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  scheduled: 'bg-paper text-ink border-line',
  expired: 'bg-amber-50 text-amber-800 border-amber-200',
  off: 'bg-slate-100 text-slate-600 border-line',
};

// ---------- Form ----------

interface BannerFormState {
  title: string;
  subtitle: string;
  badge: string;
  ctaLabel: string;
  ctaTarget: BannerCtaTarget;
  ctaUrl: string;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

const emptyForm: BannerFormState = {
  title: '',
  subtitle: '',
  badge: '',
  ctaLabel: 'Book now',
  ctaTarget: 'stringing',
  ctaUrl: '',
  desktopImageUrl: null,
  mobileImageUrl: null,
  isActive: true,
  startsAt: '',
  endsAt: '',
};

const toForm = (b: Banner): BannerFormState => ({
  title: b.title,
  subtitle: b.subtitle ?? '',
  badge: b.badge ?? '',
  ctaLabel: b.ctaLabel ?? '',
  ctaTarget: b.ctaTarget,
  ctaUrl: b.ctaUrl ?? '',
  desktopImageUrl: b.desktopImageUrl || null,
  mobileImageUrl: b.mobileImageUrl ?? null,
  isActive: b.isActive,
  startsAt: b.startsAt ?? '',
  endsAt: b.endsAt ?? '',
});

type FormErrors = Partial<Record<keyof BannerFormState, string>>;

const validate = (f: BannerFormState): FormErrors => {
  const e: FormErrors = {};
  if (!f.title.trim()) e.title = 'Title is required.';
  if (!f.desktopImageUrl) e.desktopImageUrl = 'A desktop image is required.';
  if (f.ctaTarget !== 'none' && !f.ctaLabel.trim()) e.ctaLabel = 'Button text is required (or choose "No button").';
  if (f.ctaTarget === 'url') {
    if (!f.ctaUrl.trim()) e.ctaUrl = 'Enter the link the button should open.';
    else if (!isHttpsUrl(f.ctaUrl)) e.ctaUrl = 'Link must start with https://';
  }
  if (f.startsAt && f.endsAt && f.endsAt < f.startsAt) e.endsAt = 'End date must be on or after the start date.';
  return e;
};

const toInput = (f: BannerFormState): BannerInput => ({
  title: f.title.trim(),
  subtitle: nullIfEmpty(f.subtitle),
  badge: nullIfEmpty(f.badge),
  ctaTarget: f.ctaTarget,
  ctaLabel: f.ctaTarget === 'none' ? null : nullIfEmpty(f.ctaLabel),
  ctaUrl: f.ctaTarget === 'url' ? f.ctaUrl.trim() : null,
  desktopImageUrl: f.desktopImageUrl as string,
  mobileImageUrl: f.mobileImageUrl || null,
  isActive: f.isActive,
  startsAt: f.startsAt || null,
  endsAt: f.endsAt || null,
});

interface BannerFormModalProps {
  banner: Banner | null; // null = new
  open: boolean;
  onClose: () => void;
  onSaved: (b: Banner, isNew: boolean) => void;
}

const BannerFormModal: React.FC<BannerFormModalProps> = ({ banner, open, onClose, onSaved }) => {
  const { addToast } = useApp();
  const [form, setForm] = useState<BannerFormState>(banner ? toForm(banner) : emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);

  const set = <K extends keyof BannerFormState>(key: K, value: BannerFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const input = toInput(form);
      const saved = banner
        ? await contentService.updateBanner(banner.id, input)
        : await contentService.createBanner(input);
      addToast('success', banner ? 'Banner updated' : 'Banner added', `"${saved.title}" has been saved.`);
      onSaved(saved, !banner);
    } catch (err) {
      const msg = errorMessage(err, 'Could not save the banner.');
      setSaveError(msg);
      addToast('error', 'Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const uploading = uploadingDesktop || uploadingMobile;
  const formId = 'banner-form';

  return (
    <Modal
      open={open}
      title={banner ? 'Edit banner' : 'New banner'}
      subtitle="Shown in the homepage carousel"
      onClose={onClose}
      busy={saving}
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="min-h-[42px]">
            Cancel
          </Button>
          <Button type="submit" form={formId} isLoading={saving} disabled={uploading} className="min-h-[42px]">
            {uploading ? 'Waiting for upload…' : banner ? 'Save changes' : 'Add banner'}
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <MediaUpload
              label="Desktop image"
              required
              value={form.desktopImageUrl}
              onChange={(url) => set('desktopImageUrl', url)}
              aspectClass="aspect-[16/5]"
              contain={false}
              hint="Recommended 1600 × 500 px (wide). Keep text away from the edges."
              error={errors.desktopImageUrl}
              onUploadingChange={setUploadingDesktop}
            />
          </div>
          <div>
            <MediaUpload
              label="Mobile image (optional)"
              value={form.mobileImageUrl}
              onChange={(url) => set('mobileImageUrl', url)}
              aspectClass="aspect-square"
              contain={false}
              compact
              hint="Recommended 800 × 800 px. Falls back to the desktop image."
              onUploadingChange={setUploadingMobile}
            />
          </div>
        </div>

        <Field label="Title" htmlFor="banner-title" required error={errors.title}>
          <input
            id="banner-title"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            className={`${inputClass} ${errors.title ? inputErrorClass : ''}`}
            placeholder="e.g. Pro stringing in 24 hours"
            maxLength={120}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Subtitle" htmlFor="banner-subtitle" className="sm:col-span-2">
            <input
              id="banner-subtitle"
              value={form.subtitle}
              onChange={(e) => set('subtitle', e.target.value)}
              className={inputClass}
              placeholder="e.g. Free pickup within 5 km"
              maxLength={200}
            />
          </Field>
          <Field label="Badge" htmlFor="banner-badge" hint="Small tag, e.g. NEW or 20% OFF">
            <input
              id="banner-badge"
              value={form.badge}
              onChange={(e) => set('badge', e.target.value)}
              className={inputClass}
              maxLength={30}
            />
          </Field>
        </div>

        <div className="p-3.5 rounded-2xl bg-paper border border-line space-y-3">
          <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <MousePointerClick className="w-4 h-4 text-ink" /> Button
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Button goes to" htmlFor="banner-target">
              <select
                id="banner-target"
                value={form.ctaTarget}
                onChange={(e) => set('ctaTarget', e.target.value as BannerCtaTarget)}
                className={inputClass}
              >
                {CTA_TARGETS.map((t) => (
                  <option key={t} value={t}>
                    {CTA_TARGET_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
            {form.ctaTarget !== 'none' && (
              <Field label="Button text" htmlFor="banner-cta-label" required error={errors.ctaLabel}>
                <input
                  id="banner-cta-label"
                  value={form.ctaLabel}
                  onChange={(e) => set('ctaLabel', e.target.value)}
                  className={`${inputClass} ${errors.ctaLabel ? inputErrorClass : ''}`}
                  placeholder="e.g. Book now"
                  maxLength={40}
                />
              </Field>
            )}
          </div>
          {form.ctaTarget === 'url' && (
            <Field label="Link" htmlFor="banner-cta-url" required error={errors.ctaUrl} hint="Must start with https://">
              <input
                id="banner-cta-url"
                type="url"
                inputMode="url"
                value={form.ctaUrl}
                onChange={(e) => set('ctaUrl', e.target.value)}
                className={`${inputClass} ${errors.ctaUrl ? inputErrorClass : ''}`}
                placeholder="https://"
              />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Show from" htmlFor="banner-start" hint="Leave empty to show immediately">
            <input
              id="banner-start"
              type="date"
              value={form.startsAt}
              onChange={(e) => set('startsAt', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Show until" htmlFor="banner-end" hint="Inclusive. Leave empty for no end" error={errors.endsAt}>
            <input
              id="banner-end"
              type="date"
              value={form.endsAt}
              min={form.startsAt || undefined}
              onChange={(e) => set('endsAt', e.target.value)}
              className={`${inputClass} ${errors.endsAt ? inputErrorClass : ''}`}
            />
          </Field>
        </div>

        <Switch
          checked={form.isActive}
          onChange={(v) => set('isActive', v)}
          label="Active"
          description="Inactive banners are never shown, regardless of dates."
        />
      </form>
    </Modal>
  );
};

// ---------- Manager ----------

export const BannersManager: React.FC = () => {
  const { addToast } = useApp();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Banner | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Banner | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setBanners(sortBanners(await contentService.listBanners()));
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load banners.'));
    } finally {
      setLoading(false);
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

  const toggleActive = async (b: Banner) => {
    const next = !b.isActive;
    setBanners((list) => list.map((x) => (x.id === b.id ? { ...x, isActive: next } : x)));
    markBusy(b.id, true);
    try {
      const saved = await contentService.updateBanner(b.id, { isActive: next });
      setBanners((list) => list.map((x) => (x.id === b.id ? saved : x)));
    } catch (err) {
      setBanners((list) => list.map((x) => (x.id === b.id ? { ...x, isActive: b.isActive } : x)));
      addToast('error', 'Could not update banner', errorMessage(err));
    } finally {
      markBusy(b.id, false);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= banners.length || reordering) return;
    const previous = banners;
    const next = [...banners];
    [next[index], next[target]] = [next[target], next[index]];
    setBanners(next);
    setReordering(true);
    try {
      const saved = await contentService.reorderBanners(next.map((b) => b.id));
      if (Array.isArray(saved) && saved.length === next.length) setBanners(sortBanners(saved));
    } catch (err) {
      setBanners(previous);
      addToast('error', 'Could not reorder banners', errorMessage(err));
    } finally {
      setReordering(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await contentService.deleteBanner(toDelete.id);
      setBanners((list) => list.filter((b) => b.id !== toDelete.id));
      addToast('success', 'Banner deleted', `"${toDelete.title}" was removed.`);
      setToDelete(null);
    } catch (err) {
      addToast('error', 'Delete failed', errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleSaved = (saved: Banner, isNew: boolean) => {
    setBanners((list) => (isNew ? [...list, saved] : list.map((b) => (b.id === saved.id ? saved : b))));
    setEditing(null);
  };

  const liveCount = banners.filter((b) => scheduleState(b).tone === 'live').length;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Homepage banners"
        description="Slides in the homepage carousel, shown in the order below. Desktop images 1600 × 500 px, mobile 800 × 800 px."
        actions={
          <Button
            type="button"
            onClick={() => setEditing('new')}
            leftIcon={<Plus className="w-4 h-4" />}
            className="min-h-[42px]"
            disabled={loading && banners.length === 0 && !loadError}
          >
            Add banner
          </Button>
        }
      />

      {loading && banners.length === 0 ? (
        <ListSkeleton rows={3} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} retrying={loading} />
      ) : banners.length === 0 ? (
        <EmptyState
          title="No banners yet"
          description="Add your first homepage slide — e.g. a stringing offer or new string colours."
          actionText="Add banner"
          onAction={() => setEditing('new')}
        />
      ) : (
        <>
          <p className="text-xs text-slate-500" aria-live="polite">
            {banners.length} banner{banners.length === 1 ? '' : 's'} · <b className="text-emerald-700">{liveCount} live now</b>
          </p>
          <ol className="space-y-3">
            {banners.map((b, i) => {
              const state = scheduleState(b);
              const busy = busyIds.has(b.id);
              return (
                <li key={b.id} className={`${cardClass} p-3 sm:p-4`}>
                  <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                    {/* Previews */}
                    <div className="flex gap-2 md:w-[340px] shrink-0">
                      <div className="relative flex-1 min-w-0 aspect-[16/5] rounded-xl overflow-hidden bg-slate-100 border border-line">
                        <img
                          src={b.desktopImageUrl}
                          alt={`${b.title} — desktop`}
                          loading="lazy"
                          className={`absolute inset-0 w-full h-full object-cover ${b.isActive ? '' : 'grayscale opacity-60'}`}
                        />
                        <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded">
                          Desktop
                        </span>
                      </div>
                      <div className="relative w-[4.5rem] sm:w-20 shrink-0 aspect-square rounded-xl overflow-hidden bg-slate-100 border border-line self-start">
                        <img
                          src={b.mobileImageUrl || b.desktopImageUrl}
                          alt={`${b.title} — mobile`}
                          loading="lazy"
                          className={`absolute inset-0 w-full h-full object-cover ${b.isActive ? '' : 'grayscale opacity-60'}`}
                        />
                        <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded">
                          {b.mobileImageUrl ? 'Mobile' : 'Auto'}
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400">#{i + 1}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${toneClass[state.tone]}`}>
                          {state.label}
                        </span>
                        {b.badge && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-brandYellow text-sportsBlue">
                            {b.badge}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 break-words">{b.title}</h4>
                      {b.subtitle && <p className="text-xs text-slate-600 break-words">{b.subtitle}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <MousePointerClick className="w-3.5 h-3.5 shrink-0" />
                          {b.ctaTarget === 'none' ? (
                            'No button'
                          ) : (
                            <span className="truncate">
                              "{b.ctaLabel}" → {CTA_TARGET_LABELS[b.ctaTarget]}
                              {b.ctaTarget === 'url' && b.ctaUrl && (
                                <a
                                  href={b.ctaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1 text-ink hover:underline inline-flex items-center gap-0.5"
                                >
                                  open <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </span>
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                          {b.startsAt || b.endsAt
                            ? `${b.startsAt ? formatDate(b.startsAt) : 'Now'} – ${b.endsAt ? formatDate(b.endsAt) : 'No end'}`
                            : 'Always'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex md:flex-col items-center md:items-end justify-between gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-line/70 shrink-0">
                      <Switch
                        checked={b.isActive}
                        onChange={() => toggleActive(b)}
                        disabled={busy}
                        label={`Show "${b.title}"`}
                        hideLabel
                        onLabel="Active"
                        offLabel="Hidden"
                      />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          disabled={i === 0 || reordering}
                          aria-label={`Move "${b.title}" up`}
                          className="w-10 h-10 inline-flex items-center justify-center rounded-xl border border-line text-slate-600 hover:bg-paper disabled:opacity-30"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          disabled={i === banners.length - 1 || reordering}
                          aria-label={`Move "${b.title}" down`}
                          className="w-10 h-10 inline-flex items-center justify-center rounded-xl border border-line text-slate-600 hover:bg-paper disabled:opacity-30"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(b)}
                          aria-label={`Edit "${b.title}"`}
                          className="w-10 h-10 inline-flex items-center justify-center rounded-xl border border-line text-ink hover:bg-paper"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setToDelete(b)}
                          aria-label={`Delete "${b.title}"`}
                          className="w-10 h-10 inline-flex items-center justify-center rounded-xl border border-line text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {editing && (
        <BannerFormModal
          key={editing === 'new' ? 'new' : editing.id}
          open
          banner={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete banner?"
        message={
          <>
            <b>"{toDelete?.title}"</b> will be removed from the homepage carousel. This can't be undone.
            <span className="block mt-2 text-xs text-slate-500">Tip: switch it to Hidden instead if you may reuse it.</span>
          </>
        }
        confirmLabel="Delete banner"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

export default BannersManager;

