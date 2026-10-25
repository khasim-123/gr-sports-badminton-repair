/**
 * Admin → Courts: badminton court bookings. Customers book a court for a time slot online and pay
 * at the venue (Cash / UPI); the shop sets up venues, courts, hours, prices and blocked times and
 * runs the day's bookings here.
 *
 * Tabs: Day view (calendar grid), Bookings (list + CSV), Setup (venues, courts, blocked times).
 * A notification for a court booking puts its id ("CRT-…") in AppContext.selectedRequestId;
 * AdminPortal switches to this page and the panel opens the booking.
 */
import { PageHeader } from './PageHeader';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, LandPlot, List, RefreshCw, Settings2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { courtService } from '../../services/courtService';
import type { CourtBooking, CourtVenue } from '../../types/courts';
import { Button } from '../common/Button';
import { BookingDetailDialog } from './courts/BookingDetailDialog';
import { BookingsList } from './courts/BookingsList';
import { DayView } from './courts/DayView';
import { CourtBookingPrefill, NewCourtBookingDialog } from './courts/NewCourtBookingDialog';
import { SetupTab } from './courts/SetupTab';
import { cardCls, errStatus, errText, todayIso } from './courts/shared';

type TabId = 'day' | 'list' | 'setup';
const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'day', label: 'Day view', icon: CalendarDays },
  { id: 'list', label: 'Bookings', icon: List },
  { id: 'setup', label: 'Setup', icon: Settings2 },
];
const TAB_KEY = 'gr_admin_courts_tab';
const VENUE_KEY = 'gr_admin_courts_venue';

const readLocal = (key: string) => {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};
const writeLocal = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // per-browser convenience only
  }
};

const sortVenues = (list: CourtVenue[]) =>
  [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));

export const CourtsPanel: React.FC<{
  /** Called after any booking change (the sidebar badge and dashboard card reload). */
  onBookingsChanged?: () => void;
}> = ({ onBookingsChanged }) => {
  const { selectedRequestId, setSelectedRequestId } = useApp();
  const [tab, setTabState] = useState<TabId>(() => {
    const t = readLocal(TAB_KEY) as TabId;
    return TABS.some((x) => x.id === t) ? t : 'day';
  });
  const [venues, setVenues] = useState<CourtVenue[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [venueId, setVenueIdState] = useState(() => readLocal(VENUE_KEY));
  const [date, setDate] = useState(todayIso());
  const [version, setVersion] = useState(0);
  const [detail, setDetail] = useState<{ id: string; fallback: CourtBooking | null } | null>(null);
  const [newBooking, setNewBooking] = useState<CourtBookingPrefill | null>(null);
  const seq = useRef(0);

  const setTab = (t: TabId) => {
    setTabState(t);
    writeLocal(TAB_KEY, t);
  };
  const setVenueId = (id: string) => {
    setVenueIdState(id);
    writeLocal(VENUE_KEY, id);
  };

  const loadVenues = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const list = await courtService.listVenuesAdmin();
      if (mine !== seq.current) return;
      setVenues(sortVenues((Array.isArray(list) ? list : []).map((v) => ({ ...v, courts: Array.isArray(v.courts) ? v.courts : [] }))));
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (mine !== seq.current) return;
      setUnavailable(errStatus(err) === 404);
      setError(errText(err, 'Could not load the venues.'));
    } finally {
      if (mine === seq.current) {
        setLoading(false);
        setLoaded(true);
      }
    }
  }, []);

  useEffect(() => {
    loadVenues();
  }, [loadVenues]);

  // Keep a valid venue selected.
  useEffect(() => {
    if (!venues.length) return;
    if (!venues.some((v) => v.id === venueId)) setVenueId((venues.find((v) => v.isActive) || venues[0]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues]);

  // A notification opens a court booking by putting its id in selectedRequestId.
  useEffect(() => {
    if (selectedRequestId && selectedRequestId.startsWith('CRT-')) {
      setDetail({ id: selectedRequestId, fallback: null });
      setSelectedRequestId(null);
    }
  }, [selectedRequestId, setSelectedRequestId]);

  const bump = useCallback(() => {
    setVersion((v) => v + 1);
    onBookingsChanged?.();
  }, [onBookingsChanged]);

  const openBooking = (b: CourtBooking) => setDetail({ id: b.id, fallback: b });

  const pageHeader = (
    <PageHeader title="Courts" subtitle="Badminton court bookings. Customers book a slot online and pay at the venue — cash or UPI." />
  );

  if (!loaded) {
    return (
      <div className="space-y-4 animate-in fade-in">
        {pageHeader}
        <div className={`${cardCls} p-6 animate-pulse space-y-3`} aria-busy="true" aria-label="Loading courts">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-40 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  if (error && venues.length === 0) {
    return (
      <div className="space-y-4 animate-in fade-in">
        {pageHeader}
        <div className={`${cardCls} p-6 sm:p-8 text-center flex flex-col items-center`} role="alert">
          <div className="w-12 h-12 rounded-2xl bg-paper border border-line flex items-center justify-center mb-3">
            <LandPlot className={`w-6 h-6 ${unavailable ? 'text-slate-500' : 'text-rose-500'}`} />
          </div>
          <h3 className="text-sm font-bold text-slate-900">{unavailable ? 'Court booking is not switched on yet' : "Couldn't load the courts"}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm break-words">
            {unavailable ? 'The server does not have the court booking service yet. Once it is updated, venues and bookings appear here.' : error}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 min-h-[40px]"
            onClick={() => loadVenues()}
            isLoading={loading}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Try again
          </Button>
        </div>
        {detail && (
          <BookingDetailDialog key={detail.id} bookingId={detail.id} fallback={detail.fallback} onClose={() => setDetail(null)} onChanged={() => onBookingsChanged?.()} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in min-w-0">
      {pageHeader}

      <div role="tablist" aria-label="Courts sections" className="flex gap-1 border-b border-line overflow-x-auto max-w-full no-scrollbar">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              id={`courts-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`courts-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex-1 sm:flex-none -mb-px inline-flex items-center justify-center gap-2 min-h-[44px] px-3 sm:px-4 border-b-2 text-sm font-semibold whitespace-nowrap transition-colors duration-150 ${
                on ? 'border-ink text-ink' : 'border-transparent text-slate-500 hover:text-ink hover:border-line'
              }`}
            >
              <Icon className={`w-4 h-4 ${on ? 'text-ink' : 'text-slate-400'}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between gap-2" role="alert">
          <span>Refresh failed: {error}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => loadVenues()} className="min-h-[36px] shrink-0">
            Retry
          </Button>
        </div>
      )}

      <div id={`courts-panel-${tab}`} role="tabpanel" aria-labelledby={`courts-tab-${tab}`} className="min-w-0">
        {tab === 'day' &&
          (venues.length === 0 ? (
            <div className={`${cardCls} p-6 sm:p-8 text-center`}>
              <h3 className="text-sm font-bold text-slate-900">No venue yet</h3>
              <p className="text-xs text-slate-500 mt-1">Add the venue, its courts, opening hours and prices to start taking bookings.</p>
              <Button type="button" size="sm" className="mt-4 min-h-[40px]" onClick={() => setTab('setup')}>
                Go to Setup
              </Button>
            </div>
          ) : (
            <DayView
              venues={venues}
              venueId={venueId}
              onVenueChange={setVenueId}
              date={date}
              onDateChange={setDate}
              version={version}
              onOpenBooking={openBooking}
              onNewBooking={(p) => setNewBooking(p)}
            />
          ))}
        {tab === 'list' && <BookingsList venues={venues} version={version} onOpenBooking={openBooking} />}
        {tab === 'setup' && (
          <SetupTab
            venues={venues}
            venueId={venueId}
            onVenueChange={setVenueId}
            onVenueSaved={(v) =>
              setVenues((list) => sortVenues(list.some((x) => x.id === v.id) ? list.map((x) => (x.id === v.id ? v : x)) : [...list, v]))
            }
            onVenueDeleted={(id) => setVenues((list) => list.filter((x) => x.id !== id))}
            onChanged={() => setVersion((n) => n + 1)}
          />
        )}
      </div>

      {detail && (
        <BookingDetailDialog
          key={detail.id}
          bookingId={detail.id}
          fallback={detail.fallback}
          onClose={() => {
            setDetail(null);
            bump();
          }}
          onChanged={() => onBookingsChanged?.()}
        />
      )}
      {newBooking && (
        <NewCourtBookingDialog
          venues={venues}
          prefill={newBooking}
          onClose={() => setNewBooking(null)}
          onCreated={(b) => {
            if (b.date) setDate(b.date);
            if (b.venueId) setVenueId(b.venueId);
            bump();
          }}
          onOpenBooking={(b) => {
            setNewBooking(null);
            openBooking(b);
          }}
        />
      )}
    </div>
  );
};

export default CourtsPanel;
