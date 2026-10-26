/**
 * Admin: homepage banners — top slideshow slides, promo banners and announcements.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarClock, ExternalLink, Megaphone, MousePointerClick, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { contentService } from '../../../services/contentService';
import { Banner, BannerCtaTarget, BannerInput, BannerPlacement } from '../../../types/content';
import { Button } from '../../common/Button';
import { EmptyState } from '../../common/EmptyStates';
import { MediaUpload } from './MediaUpload';
import {
  ConfirmDialog,
  ErrorState,
  Field,
  FixFieldsNotice,
  FormSection,
  ListSkeleton,
  Modal,
  SaveFailedNotice,
  SectionHeader,
  Switch,
  cardClass,
  chipClass,
  errorMessage,
  focusFirstInvalid,
  formatDate,
  iconButtonClass,
  iconButtonDangerClass,
  inputClass,
  inputErrorClass,
  isHttpsUrl,
  nullIfEmpty,
  Pills,
  switchGroupClass,
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

const PLACEMENTS: Record<BannerPlacement, { label: string; tab: string; noun: string; description: string; add: string }> = {
  hero: {
    label: 'Top slideshow',
    tab: 'Slideshow',
    noun: 'slide',
    description: 'A large photo slide at the very top of the homepage.',
    add: 'Add slide',
  },
  promo: {
    label: 'Promo banner',
    tab: 'Promo banners',
    noun: 'promo banner',
    description: 'A running photo banner further down the homepage, below the strings.',
    add: 'Add promo banner',
  },
  announcement: {
    label: 'Announcement',
    tab: 'Announcements',
    noun: 'announcement',
    description: 'A short notice card, e.g. holiday timings or new stock. Photo optional.',
    add: 'Add announcement',
  },
};
const PLACEMENT_IDS = Object.keys(PLACEMENTS) as BannerPlacement[];
const placementOf = (b: Banner): BannerPlacement => b.placement || 'hero';

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
  live: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  scheduled: 'bg-paper text-ink border-line',
  expired: 'bg-amber-50 text-amber-900 border-amber-200',
  off: 'bg-paper-deep text-ink-soft border-line',
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
  placement: BannerPlacement;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

const emptyForm = (placement: BannerPlacement): BannerFormState => ({
  title: '',
  subtitle: '',
  badge: '',
  // Announcements usually just inform; slides and promos usually lead somewhere.
  ctaLabel: placement === 'announcement' ? '' : 'Book now',
  ctaTarget: placement === 'announcement' ? 'none' : 'stringing',
  ctaUrl: '',
  desktopImageUrl: null,
  mobileImageUrl: null,
  placement,
  isActive: true,
  startsAt: '',
  endsAt: '',
});

const toForm = (b: Banner): BannerFormState => ({
  title: b.title,
  subtitle: b.subtitle ?? '',
  badge: b.badge ?? '',
  ctaLabel: b.ctaLabel ?? '',
  ctaTarget: b.ctaTarget,
  ctaUrl: b.ctaUrl ?? '',
  desktopImageUrl: b.desktopImageUrl || null,
  mobileImageUrl: b.mobileImageUrl ?? null,
  placement: placementOf(b),
  isActive: b.isActive,
  startsAt: b.startsAt ?? '',
  endsAt: b.endsAt ?? '',
});

type FormErrors = Partial<Record<keyof BannerFormState, string>>;

const validate = (f: BannerFormState): FormErrors => {
  const e: FormErrors = {};
  if (!f.title.trim()) e.title = 'Add a title.';
  if (!f.desktopImageUrl && f.placement !== 'announcement') e.desktopImageUrl = 'Add the wide image.';
  if (f.ctaTarget !== 'none' && !f.ctaLabel.trim()) e.ctaLabel = 'Add the button text, or choose "No button".';
  if (f.ctaTarget === 'url') {
    if (!f.ctaUrl.trim()) e.ctaUrl = 'Paste the link the button should open.';
    else if (!isHttpsUrl(f.ctaUrl)) e.ctaUrl = 'The link must start with https://';
  }
  if (f.startsAt && f.endsAt && f.endsAt < f.startsAt) e.endsAt = 'Choose a day on or after the start date.';
  return e;
};

const toInput = (f: BannerFormState): BannerInput => ({
  title: f.title.trim(),
  subtitle: nullIfEmpty(f.subtitle),
  badge: nullIfEmpty(f.badge),
  ctaTarget: f.ctaTarget,
  ctaLabel: f.ctaTarget === 'none' ? null : nullIfEmpty(f.ctaLabel),
  ctaUrl: f.ctaTarget === 'url' ? f.ctaUrl.trim() : null,
  desktopImageUrl: f.desktopImageUrl || null,
  // Announcements show one photo at most; the phone version is only for slides and promos.
  mobileImageUrl: f.placement === 'announcement' ? null : f.mobileImageUrl || null,
  placement: f.placement,
  isActive: f.isActive,
  startsAt: f.startsAt || null,
  endsAt: f.endsAt || null,
});

interface BannerFormModalProps {
  banner: Banner | null; // null = new
  /** Where a new banner shows (the tab it was added from). */
  defaultPlacement: BannerPlacement;
  open: boolean;
  onClose: () => void;
  onSaved: (b: Banner, isNew: boolean) => void;
}

const BannerFormModal: React.FC<BannerFormModalProps> = ({ banner, defaultPlacement, open, onClose, onSaved }) => {
  const { addToast } = useApp();
  const [form, setForm] = useState<BannerFormState>(banner ? toForm(banner) : emptyForm(defaultPlacement));
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
    if (Object.keys(errs).length > 0) {
      focusFirstInvalid(formId);
      return;
    }
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
  const meta = PLACEMENTS[form.placement];
  const isNotice = form.placement === 'announcement';

  return (
    <Modal
      open={open}
      title={banner ? `Edit ${meta.noun}` : `New ${meta.noun}`}
      subtitle={meta.description}
      onClose={onClose}
      busy={saving}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="min-h-[44px] sm:px-5">
            Cancel
          </Button>
          <Button type="submit" form={formId} isLoading={saving} disabled={uploading} className="min-h-[44px] sm:px-6">
            {uploading ? 'Waiting for upload…' : banner ? 'Save changes' : meta.add}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-7" noValidate>
        {(saveError || Object.keys(errors).some((k) => errors[k as keyof FormErrors])) && (
          <div className="space-y-2 -mb-2">
            <SaveFailedNotice message={saveError} />
            <FixFieldsNotice count={Object.values(errors).filter(Boolean).length} />
          </div>
        )}

        <FormSection title="Where it shows">
          <div role="radiogroup" aria-label="Where it shows" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PLACEMENT_IDS.map((id) => {
              const checked = form.placement === id;
              return (
                <label
                  key={id}
                  className={`flex min-h-[44px] cursor-pointer flex-col rounded-xl border bg-white px-3.5 py-3 transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                    checked ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-ink/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="banner-placement"
                    value={id}
                    checked={checked}
                    onChange={() => {
                      set('placement', id);
                      if (id === 'announcement' && errors.desktopImageUrl) setErrors((e) => ({ ...e, desktopImageUrl: undefined }));
                    }}
                    className="sr-only"
                  />
                  <span className="text-[15px] font-semibold text-ink">{PLACEMENTS[id].label}</span>
                  <span className="mt-0.5 text-[13px] leading-snug text-ink-muted">{PLACEMENTS[id].description}</span>
                </label>
              );
            })}
          </div>
        </FormSection>

        {isNotice ? (
          <FormSection title="Photo" description="Optional. Shown at the top of the card. Real photos only.">
            <div className="sm:max-w-md">
              <MediaUpload
                label="Photo (optional)"
                value={form.desktopImageUrl}
                onChange={(url) => set('desktopImageUrl', url)}
                aspectClass="aspect-[16/9]"
                contain={false}
                hint="1200 × 675 px works best. Leave empty for a text-only notice."
                onUploadingChange={setUploadingDesktop}
              />
            </div>
          </FormSection>
        ) : (
          <FormSection title="Images" description="Real photos only. Keep words and faces away from the edges.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <MediaUpload
                  label="Wide image"
                  required
                  value={form.desktopImageUrl}
                  onChange={(url) => set('desktopImageUrl', url)}
                  aspectClass="aspect-[16/5]"
                  contain={false}
                  hint={
                    form.placement === 'promo'
                      ? 'For laptops and tablets. 1600 × 500 px works best. Promo banners take turns, one at a time.'
                      : 'For laptops and tablets. 1600 × 500 px works best.'
                  }
                  error={errors.desktopImageUrl}
                  onUploadingChange={setUploadingDesktop}
                />
              </div>
              <div>
                <MediaUpload
                  label="Phone image (optional)"
                  value={form.mobileImageUrl}
                  onChange={(url) => set('mobileImageUrl', url)}
                  aspectClass="aspect-square"
                  contain={false}
                  compact
                  hint="Square, 800 × 800 px. If empty, the wide image is used."
                  onUploadingChange={setUploadingMobile}
                />
              </div>
            </div>
          </FormSection>
        )}

        <FormSection title={isNotice ? 'Text of the announcement' : 'Text on the banner'}>
          <Field label="Title" htmlFor="banner-title" required error={errors.title}>
            <input
              id="banner-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className={`${inputClass} ${errors.title ? inputErrorClass : ''}`}
              placeholder={isNotice ? 'e.g. Shop closed on Sunday 1 November' : 'e.g. Pro stringing in 24 hours'}
              maxLength={120}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label={isNotice ? 'Details' : 'Subtitle'} htmlFor="banner-subtitle" optional className="sm:col-span-2">
              {isNotice ? (
                <textarea
                  id="banner-subtitle"
                  value={form.subtitle}
                  onChange={(e) => set('subtitle', e.target.value)}
                  className={`${inputClass} py-2.5 leading-relaxed`}
                  rows={3}
                  placeholder="e.g. Pickups resume on Monday 2 November."
                  maxLength={300}
                />
              ) : (
                <input
                  id="banner-subtitle"
                  value={form.subtitle}
                  onChange={(e) => set('subtitle', e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Free pickup within 5 km"
                  maxLength={200}
                />
              )}
            </Field>
            <Field
              label={isNotice ? 'Label' : 'Badge'}
              htmlFor="banner-badge"
              optional
              hint={isNotice ? 'Shown above the title. Empty = “Announcement”.' : 'A short tag, e.g. NEW'}
            >
              <input
                id="banner-badge"
                value={form.badge}
                onChange={(e) => set('badge', e.target.value)}
                className={inputClass}
                placeholder={isNotice ? 'e.g. Holiday timings' : undefined}
                maxLength={30}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title={isNotice ? 'Link' : 'Button'}
          description={isNotice ? 'Optional: a link under the text, e.g. to book stringing.' : "What happens when a customer taps the banner's button."}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </FormSection>

        <FormSection title="When to show it">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Show from" htmlFor="banner-start" optional hint="Empty = starts straight away">
              <input
                id="banner-start"
                type="date"
                value={form.startsAt}
                onChange={(e) => set('startsAt', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Show until" htmlFor="banner-end" optional hint="Shown on this day too. Empty = no end date" error={errors.endsAt}>
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

          <div className={switchGroupClass}>
            <Switch
              checked={form.isActive}
              onChange={(v) => set('isActive', v)}
              label="Show on the homepage"
              description="When off, the banner stays hidden whatever the dates."
              onLabel="On"
              offLabel="Hidden"
            />
          </div>
        </FormSection>
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
  const [tab, setTab] = useState<BannerPlacement>('hero');
  const visible = banners.filter((b) => placementOf(b) === tab);
  const tabMeta = PLACEMENTS[tab];

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

  // Moves within the current tab; the saved order still covers every banner.
  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= visible.length || reordering) return;
    const previous = banners;
    const next = [...banners];
    const a = next.findIndex((b) => b.id === visible[index].id);
    const z = next.findIndex((b) => b.id === visible[target].id);
    [next[a], next[z]] = [next[z], next[a]];
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
    setTab(placementOf(saved)); // show it where it now lives
    setEditing(null);
  };

  const liveCount = visible.filter((b) => scheduleState(b).tone === 'live').length;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Homepage banners"
        description="The top slideshow (after any events marked “Show in homepage banner”), promo banners and announcements further down. Each shows in the order listed."
        actions={
          <Button
            type="button"
            onClick={() => setEditing('new')}
            leftIcon={<Plus className="w-4 h-4" />}
            className="min-h-[44px] px-5"
            disabled={loading && banners.length === 0 && !loadError}
          >
            {tabMeta.add}
          </Button>
        }
      />

      <Pills<BannerPlacement>
        ariaLabel="Banner type"
        value={tab}
        onChange={setTab}
        options={PLACEMENT_IDS.map((id) => ({ id, label: PLACEMENTS[id].tab, count: banners.filter((b) => placementOf(b) === id).length }))}
      />

      {loading && banners.length === 0 ? (
        <ListSkeleton rows={3} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} retrying={loading} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={tab === 'hero' ? 'No slides yet' : tab === 'promo' ? 'No promo banners yet' : 'No announcements yet'}
          description={
            tab === 'hero'
              ? 'Add your first homepage slide — e.g. a stringing offer or new string colours.'
              : tab === 'promo'
                ? 'Promo banners run one after another further down the homepage, below the strings — e.g. new stock or a seasonal offer.'
                : 'Announcements appear as notice cards on the homepage — e.g. holiday timings or new arrivals.'
          }
          actionText={tabMeta.add}
          onAction={() => setEditing('new')}
        />
      ) : (
        <>
          <p className="text-[14px] text-ink-muted" aria-live="polite">
            {visible.length} {visible.length === 1 ? tabMeta.noun : `${tabMeta.noun}s`} ·{' '}
            <span className={liveCount ? 'font-semibold text-emerald-800' : 'text-ink-muted'}>{liveCount} showing now</span>
          </p>
          <ol className="space-y-3">
            {visible.map((b, i) => {
              const state = scheduleState(b);
              const busy = busyIds.has(b.id);
              return (
                <li key={b.id} className={`${cardClass} p-3 sm:p-4`}>
                  <div className="flex flex-col md:flex-row gap-3 md:gap-5">
                    {/* Previews */}
                    {placementOf(b) === 'announcement' ? (
                      <div className="md:w-40 shrink-0">
                        {b.desktopImageUrl ? (
                          <figure className="relative w-40 aspect-[16/9] rounded-xl overflow-hidden bg-paper border border-line">
                            <img
                              src={b.desktopImageUrl}
                              alt={`${b.title}, photo`}
                              loading="lazy"
                              className={`absolute inset-0 w-full h-full object-cover ${b.isActive ? '' : 'grayscale opacity-60'}`}
                            />
                          </figure>
                        ) : (
                          <div className="flex w-40 aspect-[16/9] flex-col items-center justify-center gap-1 rounded-xl border border-line bg-paper text-[13px] text-ink-muted">
                            <Megaphone className="w-4 h-4" aria-hidden="true" />
                            Text only
                          </div>
                        )}
                      </div>
                    ) : (
                    <div className="flex gap-2 md:w-[320px] shrink-0">
                      <figure className="relative flex-1 min-w-0 aspect-[16/5] rounded-xl overflow-hidden bg-paper border border-line">
                        <img
                          src={b.desktopImageUrl || undefined}
                          alt={`${b.title}, wide image`}
                          loading="lazy"
                          className={`absolute inset-0 w-full h-full object-cover ${b.isActive ? '' : 'grayscale opacity-60'}`}
                        />
                        <figcaption className="absolute bottom-1.5 left-1.5 text-[12px] font-medium leading-none bg-ink/75 text-white px-1.5 py-1 rounded-md">
                          Wide
                        </figcaption>
                      </figure>
                      <figure className="relative w-[4.5rem] sm:w-20 shrink-0 aspect-square rounded-xl overflow-hidden bg-paper border border-line self-start">
                        <img
                          src={b.mobileImageUrl || b.desktopImageUrl || undefined}
                          alt={`${b.title}, phone image`}
                          loading="lazy"
                          className={`absolute inset-0 w-full h-full object-cover ${b.isActive ? '' : 'grayscale opacity-60'}`}
                        />
                        <figcaption className="absolute bottom-1.5 left-1.5 text-[12px] font-medium leading-none bg-ink/75 text-white px-1.5 py-1 rounded-md">
                          Phone
                        </figcaption>
                      </figure>
                    </div>
                    )}

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-ink-muted tabular-nums" aria-label={`Position ${i + 1}`}>
                          {i + 1}.
                        </span>
                        <span className={`${chipClass} ${toneClass[state.tone]}`}>{state.label}</span>
                        {b.badge && <span className={`${chipClass} bg-accent/30 border-accent/60 text-ink`}>{b.badge}</span>}
                      </div>
                      <h4 className="mt-1.5 text-[16px] font-semibold leading-snug text-ink break-words">{b.title}</h4>
                      {b.subtitle && <p className="mt-0.5 text-[14px] text-ink-soft break-words">{b.subtitle}</p>}
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-muted">
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <MousePointerClick className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          {b.ctaTarget === 'none' ? (
                            'No button'
                          ) : (
                            <span className="truncate">
                              “{b.ctaLabel}” goes to {CTA_TARGET_LABELS[b.ctaTarget]}
                              {b.ctaTarget === 'url' && b.ctaUrl && (
                                <a
                                  href={b.ctaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1.5 text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink inline-flex items-center gap-0.5"
                                >
                                  Open <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                </a>
                              )}
                            </span>
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          {b.startsAt || b.endsAt
                            ? `${b.startsAt ? formatDate(b.startsAt) : 'Now'} – ${b.endsAt ? formatDate(b.endsAt) : 'no end date'}`
                            : 'Always'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex md:flex-col items-center md:items-end justify-between gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-line shrink-0">
                      <Switch
                        checked={b.isActive}
                        onChange={() => toggleActive(b)}
                        disabled={busy}
                        label={`Show "${b.title}" on the homepage`}
                        hideLabel
                        onLabel="On"
                        offLabel="Hidden"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          disabled={i === 0 || reordering}
                          aria-label={`Move "${b.title}" up`}
                          title="Move up"
                          className={iconButtonClass}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          disabled={i === visible.length - 1 || reordering}
                          aria-label={`Move "${b.title}" down`}
                          title="Move down"
                          className={iconButtonClass}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setEditing(b)} aria-label={`Edit "${b.title}"`} title="Edit" className={iconButtonClass}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setToDelete(b)}
                          aria-label={`Delete "${b.title}"`}
                          title="Delete"
                          className={iconButtonDangerClass}
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
          defaultPlacement={tab}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete banner?"
        message={
          <>
            <b className="font-semibold text-ink">“{toDelete?.title}”</b> will be removed from the homepage. This can’t be undone.
            <span className="block mt-2 text-[13px] text-ink-muted">Tip: switch it to Hidden instead if you may use it again.</span>
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

