/**
 * Admin → Website Content: tabbed container for storefront content management.
 * Tabs are mounted on first visit and then kept mounted (just hidden), so unsaved
 * input in one tab survives switching to another.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, FileText, Images, Layers, Medal, Star, Trophy } from 'lucide-react';
import { contentService } from '../../../services/contentService';
import { EventsManager } from './EventsManager';
import { BannersManager } from './BannersManager';
import { StringsManager } from './StringsManager';
import { RacketsManager } from './RacketsManager';
import { ReviewsManager } from './ReviewsManager';
import { DocumentsManager } from './DocumentsManager';
import { AvailabilityManager } from './AvailabilityManager';

type TabId = 'events' | 'banners' | 'strings' | 'rackets' | 'reviews' | 'documents' | 'availability';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'events', label: 'Events', icon: Medal },
  { id: 'banners', label: 'Banners', icon: Images },
  { id: 'strings', label: 'Strings & Stock', icon: Layers },
  { id: 'rackets', label: 'Rackets', icon: Trophy },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'availability', label: 'Pickup Availability', icon: CalendarClock },
];

const STORAGE_KEY = 'gr_admin_content_tab';

const readStoredTab = (): TabId => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && TABS.some((t) => t.id === v)) return v as TabId;
  } catch {
    // storage unavailable
  }
  return 'events';
};

export const WebsiteContentPanel: React.FC = () => {
  const [active, setActive] = useState<TabId>(readStoredTab);
  const [visited, setVisited] = useState<Set<TabId>>(() => new Set([active]));
  const [pendingReviews, setPendingReviews] = useState<number | null>(null);

  const select = (id: TabId) => {
    setActive(id);
    setVisited((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  };

  // Pending-review badge before the Reviews tab has been opened.
  useEffect(() => {
    let cancelled = false;
    contentService
      .listReviews('pending')
      .then((list) => {
        if (!cancelled && Array.isArray(list)) setPendingReviews((prev) => (prev === null ? list.length : prev));
      })
      .catch(() => {
        // badge is optional
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePendingCount = useCallback((n: number) => setPendingReviews(n), []);

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = TABS[(index + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    select(next.id);
    document.getElementById(`content-tab-${next.id}`)?.focus();
  };

  return (
    <div className="space-y-5 min-w-0">
      <div>
        <h2 className="font-display tracking-[0.01em] text-3xl sm:text-4xl font-bold text-slate-900">Website Content</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage what customers see on the GR Sports website — events, banners, string stock, rackets, reviews, documents and pickup days.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Website content sections"
        className="flex gap-1 p-1 bg-white rounded-2xl border border-line shadow-2xs overflow-x-auto max-w-full"
      >
        {TABS.map((tab, i) => {
          const Icon = tab.icon;
          const isActive = tab.id === active;
          const badge = tab.id === 'reviews' && pendingReviews ? pendingReviews : null;
          return (
            <button
              key={tab.id}
              id={`content-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`content-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => select(tab.id)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              className={`shrink-0 inline-flex items-center gap-2 min-h-[42px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                isActive ? 'bg-sportsBlue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-brandYellow' : ''}`} />
              {tab.label}
              {badge !== null && (
                <span
                  className="text-[10px] min-w-[20px] px-1.5 py-0.5 rounded-full font-bold bg-brandYellow text-sportsBlue"
                  aria-label={`${badge} pending`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {TABS.map((tab) =>
        visited.has(tab.id) ? (
          <div
            key={tab.id}
            id={`content-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`content-tab-${tab.id}`}
            hidden={tab.id !== active}
            className="min-w-0"
          >
            {tab.id === 'events' && <EventsManager />}
            {tab.id === 'banners' && <BannersManager />}
            {tab.id === 'strings' && <StringsManager />}
            {tab.id === 'rackets' && <RacketsManager />}
            {tab.id === 'reviews' && <ReviewsManager onPendingCountChange={handlePendingCount} />}
            {tab.id === 'documents' && <DocumentsManager />}
            {tab.id === 'availability' && <AvailabilityManager />}
          </div>
        ) : null
      )}
    </div>
  );
};

export default WebsiteContentPanel;
