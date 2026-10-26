/**
 * Admin → Enquiries: requests visitors send from the website without logging in — academy slots,
 * tournament organizing (umpires, dress, trophies, …) and custom T-shirts. The admin calls back,
 * keeps a note, and marks each one contacted or closed.
 *
 * `useAdminEnquiries` is owned by AdminPortal (sidebar badge) and passed in here, so there is one
 * list for the whole console.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, GraduationCap, MapPin, MessageCircle, Phone, RefreshCw, Shirt, StickyNote, Trophy } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { contentService } from '../../services/contentService';
import type { Enquiry, EnquiryKind, EnquiryStatus } from '../../types/content';
import { formatDateTime } from '../../utils/format';
import { formatMobile, localMobileDigits, mobileTelHref } from '../../utils/phone';
import { Button } from '../common/Button';
import { PageHeader } from './PageHeader';
import {
  ErrorState,
  ListSkeleton,
  NoMatches,
  Pills,
  SearchField,
  cardClass,
  errorMessage,
  formatDate,
  inputClass,
  type PillOption,
} from './content/shared';

const KIND: Record<EnquiryKind, { label: string; filter: string; icon: React.ElementType }> = {
  academy: { label: 'Academy slot', filter: 'Academies', icon: GraduationCap },
  tournament: { label: 'Tournament organizing', filter: 'Tournaments', icon: Trophy },
  custom_tshirt: { label: 'Custom T-shirts', filter: 'T-shirts', icon: Shirt },
};

const STATUS: Record<EnquiryStatus, { label: string; pill: string; dot: string }> = {
  new: { label: 'New', pill: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  contacted: { label: 'Contacted', pill: 'bg-paper text-ink border-line', dot: 'bg-ink' },
  closed: { label: 'Closed', pill: 'bg-emerald-50 text-emerald-800 border-emerald-300', dot: 'bg-emerald-600' },
};

const DATE_LABEL: Record<EnquiryKind, string> = { academy: 'Start', tournament: 'Tournament on', custom_tshirt: 'Needed by' };

const sortEnquiries = (list: Enquiry[]) => [...list].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));

// ---------------------------------------------------------------------------
// Data hook (used by AdminPortal)
// ---------------------------------------------------------------------------
export interface AdminEnquiriesState {
  enquiries: Enquiry[];
  /** True once the first load finished (successfully or not). */
  loaded: boolean;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Puts a fresh copy of one enquiry (from an update's response) into the list. */
  upsert: (enquiry: Enquiry) => void;
}

export function useAdminEnquiries(enabled = true, pollMs = 60_000): AdminEnquiriesState {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const list = await contentService.listEnquiries();
      if (mine !== seq.current) return;
      setEnquiries(sortEnquiries(Array.isArray(list) ? list : []));
      setError(null);
    } catch (err) {
      if (mine !== seq.current) return;
      setError(errorMessage(err, 'Could not load the enquiries.'));
    } finally {
      if (mine === seq.current) {
        setLoading(false);
        setLoaded(true);
      }
    }
  }, []);

  const upsert = useCallback((enquiry: Enquiry) => {
    if (!enquiry?.id) return;
    setEnquiries((list) =>
      sortEnquiries(list.some((e) => e.id === enquiry.id) ? list.map((e) => (e.id === enquiry.id ? enquiry : e)) : [enquiry, ...list]),
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;
    reload();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, pollMs);
    return () => window.clearInterval(t);
  }, [enabled, pollMs, reload]);

  return { enquiries, loaded, loading, error, reload, upsert };
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------
type StatusFilter = 'OPEN' | EnquiryStatus | 'ALL';
type KindFilter = 'ALL' | EnquiryKind;

export const EnquiriesPanel: React.FC<{ data: AdminEnquiriesState }> = ({ data }) => {
  const { selectedRequestId, setSelectedRequestId } = useApp();
  const { enquiries, loaded, loading, error, reload, upsert } = data;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [kindFilter, setKindFilter] = useState<KindFilter>('ALL');
  const [query, setQuery] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);

  // A notification opens an enquiry by putting its id in selectedRequestId.
  useEffect(() => {
    if (selectedRequestId && selectedRequestId.startsWith('ENQ-')) {
      setFocusId(selectedRequestId);
      setStatusFilter('ALL');
      setKindFilter('ALL');
      setQuery('');
      setSelectedRequestId(null);
    }
  }, [selectedRequestId, setSelectedRequestId]);
  useEffect(() => {
    if (!focusId || !loaded) return;
    const el = document.getElementById(`enquiry-${focusId}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus({ preventScroll: true });
  }, [focusId, loaded, enquiries]);

  const counts = useMemo(() => {
    const byStatus = { new: 0, contacted: 0, closed: 0 } as Record<EnquiryStatus, number>;
    const byKind = { academy: 0, tournament: 0, custom_tshirt: 0 } as Record<EnquiryKind, number>;
    for (const e of enquiries) {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      if (statusFilter === 'ALL' || (statusFilter === 'OPEN' ? e.status !== 'closed' : e.status === statusFilter)) {
        byKind[e.kind] = (byKind[e.kind] || 0) + 1;
      }
    }
    return { byStatus, byKind };
  }, [enquiries, statusFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return enquiries.filter((e) => {
      if (statusFilter === 'OPEN' ? e.status === 'closed' : statusFilter !== 'ALL' && e.status !== statusFilter) return false;
      if (kindFilter !== 'ALL' && e.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        e.id.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        (e.subject || '').toLowerCase().includes(q) ||
        (digits.length >= 3 && (e.mobile || '').replace(/\D/g, '').includes(digits))
      );
    });
  }, [enquiries, statusFilter, kindFilter, query]);

  const statusOptions: PillOption<StatusFilter>[] = [
    { id: 'OPEN', label: 'To follow up', count: counts.byStatus.new + counts.byStatus.contacted },
    { id: 'new', label: 'New', count: counts.byStatus.new, highlight: true },
    { id: 'contacted', label: 'Contacted', count: counts.byStatus.contacted },
    { id: 'closed', label: 'Closed', count: counts.byStatus.closed },
    { id: 'ALL', label: 'All', count: enquiries.length },
  ];
  const kindOptions: PillOption<KindFilter>[] = [
    { id: 'ALL', label: 'All kinds' },
    ...(Object.keys(KIND) as EnquiryKind[]).map((k) => ({ id: k, label: KIND[k].filter, count: counts.byKind[k] })),
  ];
  const filtersActive = statusFilter !== 'OPEN' || kindFilter !== 'ALL' || !!query.trim();

  const header = (
    <PageHeader
      title="Enquiries"
      subtitle="Academy slot bookings, tournament organizing and custom T-shirt requests from the website. Call back, keep a note, then mark them contacted or closed."
      actions={
        <Button
          onClick={() => reload()}
          variant="outline"
          size="sm"
          className="min-h-[40px]"
          isLoading={loading && loaded}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh
        </Button>
      }
    />
  );

  if (!loaded) {
    return (
      <div className="space-y-5 animate-in fade-in">
        {header}
        <ListSkeleton rows={3} withImage={false} />
      </div>
    );
  }
  if (error && enquiries.length === 0) {
    return (
      <div className="space-y-5 animate-in fade-in">
        {header}
        <ErrorState title="Couldn't load the enquiries" message={error} onRetry={() => reload()} retrying={loading} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in">
      {header}

      <div className="space-y-3">
        <Pills<StatusFilter> ariaLabel="Filter by status" options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Pills<KindFilter> ariaLabel="Filter by kind" options={kindOptions} value={kindFilter} onChange={setKindFilter} />
          <div className="lg:w-72">
            <SearchField id="enquiry-search" label="Search enquiries" value={query} onChange={setQuery} placeholder="Name, mobile or ENQ number" />
          </div>
        </div>
      </div>

      {enquiries.length === 0 ? (
        <div className={`${cardClass} px-6 py-12 text-center`}>
          <p className="text-[16px] font-semibold text-ink">No enquiries yet</p>
          <p className="mx-auto mt-1 max-w-md text-[14px] text-ink-muted">
            Requests sent from the Academies, Tournament organizing and T-shirts pages appear here, and you get a notification for each.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        statusFilter === 'OPEN' && kindFilter === 'ALL' && !query.trim() ? (
          <div className={`${cardClass} px-6 py-12 text-center`} role="status">
            <p className="text-[16px] font-semibold text-ink">Nothing to follow up</p>
            <p className="mt-1 text-[14px] text-ink-muted">Every enquiry has been closed.</p>
          </div>
        ) : (
          <NoMatches
            title="No enquiries match"
            onClear={() => {
              setStatusFilter('OPEN');
              setKindFilter('ALL');
              setQuery('');
            }}
            clearLabel={filtersActive ? 'Show the ones to follow up' : 'Clear search'}
          />
        )
      ) : (
        <ul className="space-y-3">
          {filtered.map((e) => (
            <li key={e.id}>
              <EnquiryCard enquiry={e} highlighted={e.id === focusId} onSaved={upsert} />
            </li>
          ))}
        </ul>
      )}
      {error && enquiries.length > 0 && (
        <p className="text-[13px] text-rose-700" role="alert">
          Couldn't refresh: {error}
        </p>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// One enquiry
// ---------------------------------------------------------------------------
const EnquiryCard: React.FC<{ enquiry: Enquiry; highlighted: boolean; onSaved: (e: Enquiry) => void }> = ({ enquiry: e, highlighted, onSaved }) => {
  const { addToast } = useApp();
  const [saving, setSaving] = useState<EnquiryStatus | 'note' | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(e.adminNote || '');
  const kind = KIND[e.kind];
  const KindIcon = kind.icon;
  const status = STATUS[e.status];
  const tel = mobileTelHref(e.mobile);
  const digits = localMobileDigits(e.mobile);

  const save = async (update: { status?: EnquiryStatus; adminNote?: string | null }, what: EnquiryStatus | 'note') => {
    setSaving(what);
    try {
      const fresh = await contentService.updateEnquiry(e.id, update);
      onSaved(fresh);
      if (what === 'note') setEditingNote(false);
    } catch (err) {
      addToast('error', "Couldn't save", errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const details = [
    e.subject && e.kind !== 'custom_tshirt' ? e.subject : null,
    e.batch,
    e.quantity ? `${e.quantity} T-shirt${e.quantity === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

  return (
    <article
      id={`enquiry-${e.id}`}
      tabIndex={-1}
      aria-label={`${kind.label} enquiry ${e.id} from ${e.name}`}
      className={`${cardClass} p-4 sm:p-5 outline-none transition-shadow ${highlighted ? 'ring-2 ring-accent' : ''}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${status.pill}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
              {status.label}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-ink-soft">
              <KindIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {kind.label}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{e.id}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDateTime(e.createdAt)}</span>
          </p>

          <h3 className="mt-2 text-[17px] font-semibold text-ink">{e.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]">
            {tel ? (
              <a href={tel} className="inline-flex min-h-[36px] items-center gap-1.5 font-semibold text-ink hover:underline">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {formatMobile(e.mobile)}
              </a>
            ) : (
              <span className="text-ink-soft">{formatMobile(e.mobile)}</span>
            )}
            {digits && (
              <a
                href={`https://wa.me/91${digits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] items-center gap-1.5 font-semibold text-[#128C4B] hover:underline"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                WhatsApp
              </a>
            )}
          </div>

          {(details.length > 0 || e.location || e.date) && (
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[14px] text-ink">
              {details.length > 0 && <li className="font-medium">{details.join(' · ')}</li>}
              {e.location && (
                <li className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
                  {e.location}
                </li>
              )}
              {e.date && (
                <li className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
                  {DATE_LABEL[e.kind]} {formatDate(e.date, true)}
                </li>
              )}
            </ul>
          )}

          {e.notes && <p className="mt-3 whitespace-pre-line break-words rounded-xl bg-paper px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-soft">{e.notes}</p>}

          {editingNote ? (
            <div className="mt-3">
              <label htmlFor={`note-${e.id}`} className="block text-[13px] font-medium text-ink mb-1">
                Your note (only staff see it)
              </label>
              <textarea
                id={`note-${e.id}`}
                rows={2}
                maxLength={1000}
                value={note}
                onChange={(ev) => setNote(ev.target.value)}
                placeholder="e.g. Called, coming Saturday with his father"
                className={`${inputClass} leading-relaxed`}
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="min-h-[40px]" isLoading={saving === 'note'} onClick={() => save({ adminNote: note.trim() || null }, 'note')}>
                  Save note
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-[40px]"
                  onClick={() => {
                    setNote(e.adminNote || '');
                    setEditingNote(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            e.adminNote && (
              <p className="mt-3 flex items-start gap-2 text-[14px] text-ink">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                <span className="whitespace-pre-line break-words">{e.adminNote}</span>
              </p>
            )
          )}
        </div>

        <div className="flex flex-wrap gap-2 lg:w-[200px] lg:flex-col lg:items-stretch">
          {e.status === 'new' && (
            <Button size="sm" className="min-h-[40px]" isLoading={saving === 'contacted'} disabled={!!saving} onClick={() => save({ status: 'contacted' }, 'contacted')}>
              Mark contacted
            </Button>
          )}
          {e.status !== 'closed' ? (
            <Button
              size="sm"
              variant="outline"
              className="min-h-[40px]"
              isLoading={saving === 'closed'}
              disabled={!!saving}
              onClick={() => save({ status: 'closed' }, 'closed')}
            >
              Close
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="min-h-[40px]"
              isLoading={saving === 'contacted'}
              disabled={!!saving}
              onClick={() => save({ status: 'contacted' }, 'contacted')}
            >
              Reopen
            </Button>
          )}
          {!editingNote && (
            <Button size="sm" variant="ghost" className="min-h-[40px]" disabled={!!saving} onClick={() => setEditingNote(true)}>
              {e.adminNote ? 'Edit note' : 'Add note'}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
};
