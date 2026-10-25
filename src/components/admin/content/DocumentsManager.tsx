/**
 * Admin: downloadable documents (price lists, T&Cs, warranty, guides, staff-only files).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileImage, FileText, Globe, Link2, Lock, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { contentService } from '../../../services/contentService';
import { DocumentCategory, SiteDocument, SiteDocumentInput } from '../../../types/content';
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
  focusRing,
  formatDate,
  iconButtonClass,
  iconButtonDangerClass,
  inputClass,
  inputErrorClass,
  isHttpsUrl,
  nullIfEmpty,
  switchGroupClass,
} from './shared';

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'Price List',
  'Terms & Conditions',
  'Warranty',
  'Policy',
  'Guide',
  'Internal',
  'Other',
];

const DOC_ACCEPT = 'application/pdf,.pdf,image/*';

const isImageDoc = (d: { contentType?: string | null; fileUrl: string }) =>
  (d.contentType ? d.contentType.startsWith('image/') : /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(d.fileUrl));

const isPdfDoc = (d: { contentType?: string | null; fileUrl: string; fileName?: string | null }) =>
  d.contentType === 'application/pdf' || /\.pdf(\?.*)?$/i.test(d.fileName || d.fileUrl);

const guessContentType = (url: string): string | null => {
  if (/\.pdf(\?.*)?$/i.test(url)) return 'application/pdf';
  const m = url.match(/\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i);
  if (m) return `image/${m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase()}`;
  return null;
};

// ---------- Form ----------

type SourceMode = 'upload' | 'link';

interface DocFormState {
  title: string;
  description: string;
  category: DocumentCategory;
  isPublic: boolean;
  mode: SourceMode;
  uploadUrl: string | null;
  uploadFileName: string | null;
  uploadContentType: string | null;
  linkUrl: string;
}

const docToForm = (d: SiteDocument | null): DocFormState => {
  // Treat a document with a stored fileName as an upload, otherwise as an external link.
  const isUpload = !!d && (!!d.fileName || !/^https?:\/\//i.test(d.fileUrl) || false);
  return {
    title: d?.title ?? '',
    description: d?.description ?? '',
    category: d?.category ?? 'Price List',
    isPublic: d?.isPublic ?? true,
    mode: d ? (isUpload ? 'upload' : 'link') : 'upload',
    uploadUrl: d && isUpload ? d.fileUrl : null,
    uploadFileName: d?.fileName ?? null,
    uploadContentType: d?.contentType ?? null,
    linkUrl: d && !isUpload ? d.fileUrl : '',
  };
};

const DocumentFormModal: React.FC<{
  doc: SiteDocument | null;
  onClose: () => void;
  onSaved: (d: SiteDocument, isNew: boolean) => void;
}> = ({ doc, onClose, onSaved }) => {
  const { addToast } = useApp();
  const [form, setForm] = useState<DocFormState>(() => docToForm(doc));
  const [errors, setErrors] = useState<{ title?: string; file?: string; link?: string }>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof DocFormState>(key: K, value: DocFormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!form.title.trim()) errs.title = 'Add a title.';
    if (form.mode === 'upload' && !form.uploadUrl) errs.file = 'Upload a PDF or a photo.';
    if (form.mode === 'link') {
      if (!form.linkUrl.trim()) errs.link = 'Paste the link to the document.';
      else if (!isHttpsUrl(form.linkUrl)) errs.link = 'The link must start with https://';
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      focusFirstInvalid(formId);
      return;
    }

    const input: SiteDocumentInput =
      form.mode === 'upload'
        ? {
            title: form.title.trim(),
            description: nullIfEmpty(form.description),
            category: form.category,
            isPublic: form.isPublic,
            fileUrl: form.uploadUrl as string,
            fileName: form.uploadFileName,
            contentType: form.uploadContentType,
          }
        : {
            title: form.title.trim(),
            description: nullIfEmpty(form.description),
            category: form.category,
            isPublic: form.isPublic,
            fileUrl: form.linkUrl.trim(),
            fileName: null,
            contentType: guessContentType(form.linkUrl.trim()),
          };

    setSaving(true);
    setSaveError(null);
    try {
      const saved = doc ? await contentService.updateDocument(doc.id, input) : await contentService.createDocument(input);
      addToast('success', doc ? 'Document updated' : 'Document added', `"${saved.title}" saved.`);
      onSaved(saved, !doc);
    } catch (err) {
      const msg = errorMessage(err, 'Could not save the document.');
      setSaveError(msg);
      addToast('error', 'Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const formId = 'document-form';
  return (
    <Modal
      open
      title={doc ? 'Edit document' : 'New document'}
      subtitle="A PDF or photo customers can open, or a staff-only file"
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="min-h-[44px] sm:px-5">
            Cancel
          </Button>
          <Button type="submit" form={formId} isLoading={saving} disabled={uploading} className="min-h-[44px] sm:px-6">
            {uploading ? 'Waiting for upload…' : doc ? 'Save changes' : 'Add document'}
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

        <FormSection title="Document">
          <div role="radiogroup" aria-label="Where the file is" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-paper-deep">
            {(
              [
                { id: 'upload', label: 'Upload file', icon: Upload },
                { id: 'link', label: 'Link to a file', icon: Link2 },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const active = form.mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set('mode', opt.id)}
                  disabled={uploading}
                  className={`min-h-[44px] rounded-lg text-[14px] font-medium inline-flex items-center justify-center gap-2 transition-colors duration-150 ${focusRing} ${
                    active ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" /> {opt.label}
                </button>
              );
            })}
          </div>

          {form.mode === 'upload' ? (
            <MediaUpload
              label="File"
              required
              kind="file"
              accept={DOC_ACCEPT}
              allowUrl={false}
              value={form.uploadUrl}
              fileName={form.uploadFileName}
              contain
              aspectClass="aspect-[4/3]"
              compact
              error={errors.file}
              onUploadingChange={setUploading}
              onChange={(url, info) => {
                setForm((f) => {
                  const name = info?.media?.fileName || info?.file?.name || null;
                  const autoTitle =
                    !f.title.trim() && name ? name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim() : f.title;
                  return {
                    ...f,
                    uploadUrl: url,
                    uploadFileName: url ? name : null,
                    uploadContentType: url ? info?.media?.contentType || info?.file?.type || null : null,
                    title: autoTitle,
                  };
                });
                if (url) setErrors((x) => ({ ...x, file: undefined }));
              }}
            />
          ) : (
            <Field label="Link" htmlFor="doc-link" required error={errors.link} hint="For example a Google Drive share link. It must start with https://">
              <input
                id="doc-link"
                type="url"
                inputMode="url"
                value={form.linkUrl}
                onChange={(e) => {
                  set('linkUrl', e.target.value);
                  if (errors.link) setErrors((x) => ({ ...x, link: undefined }));
                }}
                placeholder="https://"
                className={`${inputClass} ${errors.link ? inputErrorClass : ''}`}
              />
            </Field>
          )}
        </FormSection>

        <FormSection title="Details">
          <Field label="Title" htmlFor="doc-title" required error={errors.title} hint="Customers see this name.">
            <input
              id="doc-title"
              value={form.title}
              onChange={(e) => {
                set('title', e.target.value);
                if (errors.title) setErrors((x) => ({ ...x, title: undefined }));
              }}
              className={`${inputClass} ${errors.title ? inputErrorClass : ''}`}
              placeholder="e.g. Stringing price list 2026"
            />
          </Field>

          <Field label="Category" htmlFor="doc-category">
            <select
              id="doc-category"
              value={form.category}
              onChange={(e) => {
                const category = e.target.value as DocumentCategory;
                setForm((f) => ({
                  ...f,
                  category,
                  // New internal documents default to staff-only.
                  isPublic: !doc && category === 'Internal' ? false : f.isPublic,
                }));
              }}
              className={inputClass}
            >
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description" htmlFor="doc-desc" optional>
            <textarea
              id="doc-desc"
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className={`${inputClass} resize-y`}
            />
          </Field>
        </FormSection>

        <FormSection title="Who can see it">
          <div className={switchGroupClass}>
            <Switch
              checked={form.isPublic}
              onChange={(v) => set('isPublic', v)}
              label="Show on the website"
              description={form.isPublic ? 'Customers can open and download it.' : 'Staff only: hidden from customers.'}
              onLabel="Website"
              offLabel="Staff only"
            />
          </div>
        </FormSection>
      </form>
    </Modal>
  );
};

// ---------- Manager ----------

export const DocumentsManager: React.FC = () => {
  const { addToast } = useApp();
  const [docs, setDocs] = useState<SiteDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SiteDocument | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<SiteDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await contentService.listDocuments();
      setDocs([...list].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)));
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load documents.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const known = new Set<string>(DOCUMENT_CATEGORIES);
    const cats = [...DOCUMENT_CATEGORIES, ...Array.from(new Set(docs.map((d) => d.category))).filter((c) => !known.has(c))];
    return cats
      .map((cat) => ({ category: cat, items: docs.filter((d) => d.category === cat) }))
      .filter((g) => g.items.length > 0);
  }, [docs]);

  const toggleVisibility = async (d: SiteDocument) => {
    const next = !d.isPublic;
    setDocs((list) => list.map((x) => (x.id === d.id ? { ...x, isPublic: next } : x)));
    setBusyIds((s) => new Set(s).add(d.id));
    try {
      const saved = await contentService.updateDocument(d.id, { isPublic: next });
      setDocs((list) => list.map((x) => (x.id === d.id ? saved : x)));
    } catch (err) {
      setDocs((list) => list.map((x) => (x.id === d.id ? { ...x, isPublic: d.isPublic } : x)));
      addToast('error', 'Could not change visibility', errorMessage(err));
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(d.id);
        return n;
      });
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await contentService.deleteDocument(toDelete.id);
      setDocs((list) => list.filter((d) => d.id !== toDelete.id));
      addToast('success', 'Document deleted', `"${toDelete.title}" was removed.`);
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
        title="Documents"
        description="Price lists, terms, warranty and guides customers can download, plus staff-only files."
        actions={
          <Button
            type="button"
            onClick={() => setEditing('new')}
            leftIcon={<Plus className="w-4 h-4" />}
            className="min-h-[44px] px-5"
            disabled={loading && docs.length === 0 && !loadError}
          >
            Add document
          </Button>
        }
      />

      {loading && docs.length === 0 ? (
        <ListSkeleton rows={3} withImage={false} />
      ) : loadError && docs.length === 0 ? (
        <ErrorState message={loadError} onRetry={load} retrying={loading} />
      ) : docs.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Upload your stringing price list or terms & conditions so customers can download them."
          actionText="Add document"
          onAction={() => setEditing('new')}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.category} aria-labelledby={`doc-cat-${group.category}`}>
              <h4 id={`doc-cat-${group.category}`} className="mb-2.5 flex items-center gap-2 text-[15px] font-semibold text-ink">
                {group.category}
                <span className="text-[12px] leading-none font-semibold tabular-nums bg-paper-deep text-ink-soft rounded-full px-2 py-1">
                  {group.items.length}
                </span>
              </h4>
              <ul className="space-y-2">
                {group.items.map((d) => {
                  const Icon = isImageDoc(d) ? FileImage : isPdfDoc(d) ? FileText : Link2;
                  return (
                    <li key={d.id} className={`${cardClass} p-3 sm:p-4`}>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border bg-paper border-line text-ink-soft">
                            <Icon className="w-5 h-5" aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-[15px] font-semibold leading-snug text-ink break-words">{d.title}</span>
                              {d.isPublic ? (
                                <span className={`${chipClass} bg-emerald-50 text-emerald-800 border-emerald-200`}>
                                  <Globe className="w-3 h-3" aria-hidden="true" /> On the website
                                </span>
                              ) : (
                                <span className={`${chipClass} bg-paper-deep text-ink-soft border-line`}>
                                  <Lock className="w-3 h-3" aria-hidden="true" /> Staff only
                                </span>
                              )}
                            </div>
                            {d.description && <p className="mt-0.5 text-[14px] text-ink-soft break-words">{d.description}</p>}
                            <p className="mt-0.5 text-[13px] text-ink-muted truncate">
                              {d.fileName || d.fileUrl} · Added {formatDate(d.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-line">
                          <Switch
                            checked={d.isPublic}
                            onChange={() => toggleVisibility(d)}
                            disabled={busyIds.has(d.id)}
                            label={`Show "${d.title}" on the website`}
                            hideLabel
                          />
                          <a
                            href={d.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open "${d.title}" in a new tab`}
                            title="Open"
                            className={iconButtonClass}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button type="button" onClick={() => setEditing(d)} aria-label={`Edit "${d.title}"`} title="Edit" className={iconButtonClass}>
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setToDelete(d)}
                            aria-label={`Delete "${d.title}"`}
                            title="Delete"
                            className={iconButtonDangerClass}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <DocumentFormModal
          key={editing === 'new' ? 'new' : editing.id}
          doc={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            setDocs((list) => (isNew ? [...list, saved] : list.map((d) => (d.id === saved.id ? saved : d))));
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete document?"
        message={
          <>
            <b className="font-semibold text-ink">“{toDelete?.title}”</b> will be removed{toDelete?.isPublic ? ' from the website' : ''}. This can’t be undone.
          </>
        }
        confirmLabel="Delete document"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

export default DocumentsManager;
