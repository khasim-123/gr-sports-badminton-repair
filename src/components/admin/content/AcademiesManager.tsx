/**
 * Admin: academies listed on the website's Academies page. Visitors pick an academy and one of
 * its batches and send a slot request, which arrives in Admin → Enquiries.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, EyeOff, GraduationCap, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { contentService } from '../../../services/contentService';
import type { Academy, AcademyInput } from '../../../types/content';
import { formatMobile, normalizeMobile } from '../../../utils/phone';
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
  iconButtonClass,
  iconButtonDangerClass,
  inputClass,
  inputErrorClass,
  isHttpsUrl,
  nullIfEmpty,
  switchGroupClass,
} from './shared';

const BATCHES_MAX = 12;
const BATCH_MAX = 80;

// ---------- Form ----------

interface AcademyFormState {
  name: string;
  area: string;
  address: string;
  mapsUrl: string;
  phone: string;
  photoUrl: string | null;
  description: string;
  ageGroups: string;
  fee: string;
  batches: string[];
  isActive: boolean;
}

const toForm = (a: Academy | null): AcademyFormState => ({
  name: a?.name ?? '',
  area: a?.area ?? '',
  address: a?.address ?? '',
  mapsUrl: a?.mapsUrl ?? '',
  phone: a?.phone ? formatMobile(a.phone) : '',
  photoUrl: a?.photoUrl ?? null,
  description: a?.description ?? '',
  ageGroups: a?.ageGroups ?? '',
  fee: a?.fee ?? '',
  batches: a?.batches.length ? [...a.batches] : [''],
  isActive: a?.isActive ?? true,
});

type Errors = Partial<Record<'name' | 'area' | 'mapsUrl' | 'phone' | 'batches', string>>;

const AcademyFormModal: React.FC<{
  academy: Academy | null;
  onClose: () => void;
  onSaved: (a: Academy, isNew: boolean) => void;
}> = ({ academy, onClose, onSaved }) => {
  const { addToast } = useApp();
  const [form, setForm] = useState<AcademyFormState>(() => toForm(academy));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formId = 'academy-form';

  const set = <K extends keyof AcademyFormState>(key: K, value: AcademyFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((x) => ({ ...x, [key]: undefined }));
  };
  const setBatch = (i: number, value: string) => {
    setForm((f) => ({ ...f, batches: f.batches.map((b, j) => (j === i ? value : b)) }));
    if (errors.batches) setErrors((x) => ({ ...x, batches: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Errors = {};
    const batches = form.batches.map((b) => b.trim().replace(/\s+/g, ' ')).filter(Boolean);
    if (form.name.trim().length < 2) errs.name = 'Add the academy name.';
    if (form.area.trim().length < 2) errs.area = 'Add the area, e.g. MVP Colony.';
    if (form.mapsUrl.trim() && !isHttpsUrl(form.mapsUrl)) errs.mapsUrl = 'The link must start with https://';
    if (form.phone.trim() && !normalizeMobile(form.phone)) errs.phone = 'Enter a 10-digit Indian mobile number.';
    if (batches.some((b) => b.length > BATCH_MAX)) errs.batches = `Keep each batch under ${BATCH_MAX} characters.`;
    setErrors(errs);
    if (Object.keys(errs).length) {
      focusFirstInvalid(formId);
      return;
    }
    const input: AcademyInput = {
      name: form.name.trim(),
      area: form.area.trim(),
      address: nullIfEmpty(form.address),
      mapsUrl: nullIfEmpty(form.mapsUrl),
      phone: form.phone.trim() ? normalizeMobile(form.phone) : null,
      photoUrl: form.photoUrl,
      description: nullIfEmpty(form.description),
      ageGroups: nullIfEmpty(form.ageGroups),
      fee: nullIfEmpty(form.fee),
      batches,
      isActive: form.isActive,
    };
    setSaving(true);
    setSaveError(null);
    try {
      const saved = academy ? await contentService.updateAcademy(academy.id, input) : await contentService.createAcademy(input);
      addToast('success', academy ? 'Academy updated' : 'Academy added', `"${saved.name}" saved.`);
      onSaved(saved, !academy);
    } catch (err) {
      const msg = errorMessage(err, 'Could not save the academy.');
      setSaveError(msg);
      addToast('error', 'Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={academy ? 'Edit academy' : 'New academy'}
      subtitle="Shown on the Academies page, where visitors request a slot"
      onClose={onClose}
      busy={saving}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="min-h-[44px] sm:px-5">
            Cancel
          </Button>
          <Button type="submit" form={formId} isLoading={saving} disabled={uploading} className="min-h-[44px] sm:px-6">
            {uploading ? 'Waiting for upload…' : academy ? 'Save changes' : 'Add academy'}
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

        <FormSection title="Academy">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="academy-name" required error={errors.name}>
              <input
                id="academy-name"
                maxLength={80}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className={`${inputClass} ${errors.name ? inputErrorClass : ''}`}
              />
            </Field>
            <Field label="Area" htmlFor="academy-area" required error={errors.area} hint="Shown above the name, e.g. MVP Colony.">
              <input
                id="academy-area"
                maxLength={80}
                value={form.area}
                onChange={(e) => set('area', e.target.value)}
                className={`${inputClass} ${errors.area ? inputErrorClass : ''}`}
              />
            </Field>
          </div>
          <Field label="About the academy" htmlFor="academy-desc" optional>
            <textarea
              id="academy-desc"
              rows={3}
              maxLength={2000}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className={`${inputClass} resize-y`}
              placeholder="Coaches, courts, what a session looks like"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Who it's for" htmlFor="academy-ages" optional hint="e.g. Ages 6–16 and adults">
              <input id="academy-ages" maxLength={80} value={form.ageGroups} onChange={(e) => set('ageGroups', e.target.value)} className={inputClass} />
            </Field>
            <Field label="Fee" htmlFor="academy-fee" optional hint="As you want it shown, e.g. ₹2,000 a month">
              <input id="academy-fee" maxLength={80} value={form.fee} onChange={(e) => set('fee', e.target.value)} className={inputClass} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Batches" description="The times visitors choose from when they request a slot. Leave empty to let them just ask.">
          <div className="space-y-2" aria-describedby={errors.batches ? 'academy-batches-err' : undefined}>
            {form.batches.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <label htmlFor={`academy-batch-${i}`} className="sr-only">
                  Batch {i + 1}
                </label>
                <input
                  id={`academy-batch-${i}`}
                  maxLength={BATCH_MAX}
                  value={b}
                  onChange={(e) => setBatch(i, e.target.value)}
                  placeholder="e.g. Mon–Fri 6:00–7:30 AM"
                  aria-invalid={errors.batches && b.trim().length > BATCH_MAX ? true : undefined}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, batches: f.batches.length > 1 ? f.batches.filter((_, j) => j !== i) : [''] }))}
                  aria-label={`Remove batch ${i + 1}`}
                  title="Remove"
                  className={iconButtonClass}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {errors.batches && (
              <p id="academy-batches-err" role="alert" className="text-[13px] font-medium text-rose-700">
                {errors.batches}
              </p>
            )}
            {form.batches.length < BATCHES_MAX && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-[40px]"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setForm((f) => ({ ...f, batches: [...f.batches, ''] }))}
              >
                Add batch
              </Button>
            )}
          </div>
        </FormSection>

        <FormSection title="Where and how to reach it">
          <Field label="Address" htmlFor="academy-address" optional>
            <input id="academy-address" maxLength={200} value={form.address} onChange={(e) => set('address', e.target.value)} className={inputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Google Maps link" htmlFor="academy-maps" optional error={errors.mapsUrl} hint="Share link from Google Maps (https://…)">
              <input
                id="academy-maps"
                type="url"
                inputMode="url"
                value={form.mapsUrl}
                onChange={(e) => set('mapsUrl', e.target.value)}
                placeholder="https://"
                className={`${inputClass} ${errors.mapsUrl ? inputErrorClass : ''}`}
              />
            </Field>
            <Field label="Academy phone" htmlFor="academy-phone" optional error={errors.phone} hint="Shown on the website. Leave empty to have calls come to the shop.">
              <input
                id="academy-phone"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="98765 43210"
                className={`${inputClass} ${errors.phone ? inputErrorClass : ''}`}
              />
            </Field>
          </div>
          <MediaUpload
            label="Photo (optional)"
            value={form.photoUrl}
            onChange={(url) => set('photoUrl', url)}
            aspectClass="aspect-[16/7]"
            contain={false}
            hint="A real photo of the academy or its courts, landscape."
            onUploadingChange={setUploading}
          />
        </FormSection>

        <FormSection title="On the website">
          <div className={switchGroupClass}>
            <Switch
              checked={form.isActive}
              onChange={(v) => set('isActive', v)}
              label="Show on the Academies page"
              description={form.isActive ? 'Visitors can see it and request a slot.' : 'Hidden from the website.'}
              onLabel="Shown"
              offLabel="Hidden"
            />
          </div>
        </FormSection>
      </form>
    </Modal>
  );
};

// ---------- Manager ----------

export const AcademiesManager: React.FC = () => {
  const { addToast } = useApp();
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Academy | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Academy | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setAcademies(await contentService.listAcademies());
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load the academies.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (a: Academy) => {
    const next = !a.isActive;
    setAcademies((list) => list.map((x) => (x.id === a.id ? { ...x, isActive: next } : x)));
    setBusyIds((s) => new Set(s).add(a.id));
    try {
      const saved = await contentService.updateAcademy(a.id, { isActive: next });
      setAcademies((list) => list.map((x) => (x.id === a.id ? saved : x)));
    } catch (err) {
      setAcademies((list) => list.map((x) => (x.id === a.id ? { ...x, isActive: a.isActive } : x)));
      addToast('error', 'Could not change visibility', errorMessage(err));
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(a.id);
        return n;
      });
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await contentService.deleteAcademy(toDelete.id);
      setAcademies((list) => list.filter((a) => a.id !== toDelete.id));
      addToast('success', 'Academy deleted', `"${toDelete.name}" was removed.`);
      setToDelete(null);
    } catch (err) {
      addToast('error', 'Delete failed', errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Academies"
        description="Coaching academies on the website's Academies page. Visitors choose one and a batch; their request arrives in Enquiries."
        actions={
          <Button
            type="button"
            onClick={() => setEditing('new')}
            leftIcon={<Plus className="w-4 h-4" />}
            className="min-h-[44px] px-5"
            disabled={loading && academies.length === 0 && !loadError}
          >
            Add academy
          </Button>
        }
      />

      {loading && academies.length === 0 ? (
        <ListSkeleton rows={2} />
      ) : loadError && academies.length === 0 ? (
        <ErrorState message={loadError} onRetry={load} retrying={loading} />
      ) : academies.length === 0 ? (
        <EmptyState
          title="No academies yet"
          description="Add the academies you work with. Until then the Academies page asks visitors to message you on WhatsApp."
          actionText="Add academy"
          onAction={() => setEditing('new')}
        />
      ) : (
        <ul className="space-y-2">
          {academies.map((a) => (
            <li key={a.id} className={`${cardClass} p-3 sm:p-4`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {a.photoUrl ? (
                    <img src={a.photoUrl} alt="" className="h-14 w-20 shrink-0 rounded-xl border border-line object-cover" />
                  ) : (
                    <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-ink-soft">
                      <GraduationCap className="h-5 w-5" aria-hidden="true" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="break-words text-[15px] font-semibold leading-snug text-ink">{a.name}</span>
                      {!a.isActive && (
                        <span className={`${chipClass} border-line bg-paper-deep text-ink-soft`}>
                          <EyeOff className="h-3 w-3" aria-hidden="true" /> Hidden
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-ink-muted">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {a.area}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                        {a.batches.length ? `${a.batches.length} batch${a.batches.length === 1 ? '' : 'es'}` : 'No batches'}
                      </span>
                      {a.fee && <span>{a.fee}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-line pt-3 sm:justify-end sm:border-t-0 sm:pt-0">
                  <Switch
                    checked={a.isActive}
                    onChange={() => toggleActive(a)}
                    disabled={busyIds.has(a.id)}
                    label={`Show "${a.name}" on the website`}
                    hideLabel
                  />
                  <button type="button" onClick={() => setEditing(a)} aria-label={`Edit "${a.name}"`} title="Edit" className={iconButtonClass}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setToDelete(a)} aria-label={`Delete "${a.name}"`} title="Delete" className={iconButtonDangerClass}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <AcademyFormModal
          key={editing === 'new' ? 'new' : editing.id}
          academy={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            setAcademies((list) => (isNew ? [...list, saved] : list.map((a) => (a.id === saved.id ? saved : a))));
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete academy?"
        message={
          <>
            <b className="font-semibold text-ink">“{toDelete?.name}”</b> will be removed from the website. Enquiries already sent for it stay in
            Enquiries. This can’t be undone.
          </>
        }
        confirmLabel="Delete academy"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

export default AcademiesManager;
