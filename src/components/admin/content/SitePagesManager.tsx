/**
 * Admin: the footer pages the shop writes itself (About us, Our promise, Shipping, Return &
 * cancellation, …). The set of pages is fixed; each starts empty and is only linked from the
 * website footer once it has text.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { EyeOff, Globe, Pencil } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { contentService } from '../../../services/contentService';
import type { SitePage } from '../../../types/content';
import { Button } from '../../common/Button';
import {
  ErrorState,
  Field,
  FixFieldsNotice,
  ListSkeleton,
  Modal,
  SaveFailedNotice,
  SectionHeader,
  cardClass,
  chipClass,
  errorMessage,
  focusFirstInvalid,
  formatDate,
  iconButtonClass,
  inputClass,
  inputErrorClass,
} from './shared';

const TITLE_MAX = 80;
const BODY_MAX = 20_000;

const hasText = (p: SitePage) => !!p.body.trim();

const PageFormModal: React.FC<{ page: SitePage; onClose: () => void; onSaved: (p: SitePage) => void }> = ({ page, onClose, onSaved }) => {
  const { addToast } = useApp();
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formId = 'site-page-form';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = title.trim() ? null : 'Add a title.';
    setTitleError(err);
    if (err) {
      focusFirstInvalid(formId);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await contentService.saveSitePage(page.slug, { title: title.trim(), body });
      addToast('success', 'Page saved', hasText(saved) ? `"${saved.title}" is on the website.` : `"${saved.title}" has no text, so it isn't linked.`);
      onSaved(saved);
    } catch (error) {
      const msg = errorMessage(error, 'Could not save the page.');
      setSaveError(msg);
      addToast('error', 'Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={`Edit "${page.title}"`}
      subtitle="Linked from the footer of every page once it has text"
      onClose={onClose}
      busy={saving}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="min-h-[44px] sm:px-5">
            Cancel
          </Button>
          <Button type="submit" form={formId} isLoading={saving} className="min-h-[44px] sm:px-6">
            Save page
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-5" noValidate>
        {(saveError || titleError) && (
          <div className="space-y-2">
            <SaveFailedNotice message={saveError} />
            <FixFieldsNotice count={titleError ? 1 : 0} />
          </div>
        )}
        <Field label="Title" htmlFor="site-page-title" required error={titleError}>
          <input
            id="site-page-title"
            maxLength={TITLE_MAX}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError(null);
            }}
            className={`${inputClass} ${titleError ? inputErrorClass : ''}`}
          />
        </Field>
        <Field
          label="Text"
          htmlFor="site-page-body"
          hint={
            <>
              Plain text. Leave a blank line between paragraphs. Empty the text to take the page off the website.{' '}
              <span className="tabular-nums">
                {body.length.toLocaleString('en-IN')} / {BODY_MAX.toLocaleString('en-IN')}
              </span>
            </>
          }
        >
          <textarea
            id="site-page-body"
            rows={14}
            maxLength={BODY_MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={`${inputClass} resize-y leading-relaxed`}
          />
        </Field>
      </form>
    </Modal>
  );
};

export const SitePagesManager: React.FC = () => {
  const [pages, setPages] = useState<SitePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SitePage | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setPages(await contentService.listSitePages());
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load the footer pages.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const written = pages.filter(hasText).length;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Footer pages"
        description={
          pages.length
            ? `Pages linked from the footer of every page. A page shows on the website once it has text: ${written} of ${pages.length} written.`
            : 'Pages linked from the footer of every page. A page shows on the website once it has text.'
        }
      />

      {loading && pages.length === 0 ? (
        <ListSkeleton rows={4} withImage={false} />
      ) : loadError && pages.length === 0 ? (
        <ErrorState message={loadError} onRetry={load} retrying={loading} />
      ) : (
        <ul className="space-y-2">
          {pages.map((p) => (
            <li key={p.slug} className={`${cardClass} p-3 sm:p-4`}>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[15px] font-semibold leading-snug text-ink">{p.title}</span>
                    {hasText(p) ? (
                      <span className={`${chipClass} border-emerald-200 bg-emerald-50 text-emerald-800`}>
                        <Globe className="h-3 w-3" aria-hidden="true" /> On the website
                      </span>
                    ) : (
                      <span className={`${chipClass} border-line bg-paper-deep text-ink-soft`}>
                        <EyeOff className="h-3 w-3" aria-hidden="true" /> Not written yet
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[13px] text-ink-muted">
                    {hasText(p)
                      ? `${p.body.trim().split(/\s+/).length.toLocaleString('en-IN')} words${p.updatedAt ? ` · Updated ${formatDate(p.updatedAt)}` : ''}`
                      : 'Hidden from the footer until it has text.'}
                  </p>
                </div>
                <button type="button" onClick={() => setEditing(p)} aria-label={`Edit "${p.title}"`} title="Edit" className={iconButtonClass}>
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <PageFormModal
          key={editing.slug}
          page={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setPages((list) => list.map((p) => (p.slug === saved.slug ? saved : p)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

export default SitePagesManager;
