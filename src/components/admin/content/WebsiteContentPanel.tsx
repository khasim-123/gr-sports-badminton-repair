/**
 * Admin → Website Content: tabbed container for storefront content management.
 * Tabs are mounted on first visit and then kept mounted (just hidden), so unsaved
 * input in one tab survives switching to another.
 */
import { PageHeader } from '../PageHeader';
import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, FileText, GraduationCap, Images, Layers, Medal, PanelBottom, Shirt, Star, Trophy } from 'lucide-react';
import { contentService } from '../../../services/contentService';
import { EventsManager } from './EventsManager';
import { BannersManager } from './BannersManager';
import { StringsManager } from './StringsManager';
import { RacketsManager } from './RacketsManager';
import { ApparelManager } from './ApparelManager';
import { ReviewsManager } from './ReviewsManager';
import { DocumentsManager } from './DocumentsManager';
import { AvailabilityManager } from './AvailabilityManager';
import { AcademiesManager } from './AcademiesManager';
import { SitePagesManager } from './SitePagesManager';

type TabId = 'events' | 'banners' | 'strings' | 'rackets' | 'apparel' | 'academies' | 'reviews' | 'pages' | 'documents' | 'availability';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'events', label: 'Events', icon: Medal },
  { id: 'banners', label: 'Banners', icon: Images },
  { id: 'strings', label: 'Strings', icon: Layers },
  { id: 'rackets', label: 'Rackets', icon: Trophy },
  { id: 'apparel', label: 'T-shirts', icon: Shirt },
  { id: 'academies', label: 'Academies', icon: GraduationCap },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'pages', label: 'Footer pages', icon: PanelBottom },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'availability', label: 'Pickup times', icon: CalendarClock },
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
    <div className="space-y-6 min-w-0">
      <PageHeader title="Website content" subtitle="Everything customers see on the GR Sports website." />

      {/* Phones: every section visible as wrapped pills. Wider screens: underlined tabs, wrapping to a
          second row rather than hiding sections off the edge. */}
      <div
        role="tablist"
        aria-label="Website content sections"
        className="flex flex-wrap gap-1.5 sm:gap-x-0.5 sm:gap-y-0 sm:border-b sm:border-line max-w-full"
      >
        {TABS.map((tab, i) => {
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
              className={`shrink-0 inline-flex items-center gap-2 min-h-[44px] px-3 rounded-full border text-[14px] font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:-mb-px sm:rounded-none sm:border-0 sm:border-b-2 sm:bg-transparent sm:px-2.5 sm:text-[15px] ${
                isActive
                  ? 'bg-ink border-ink text-white sm:text-ink sm:border-ink sm:font-semibold'
                  : 'bg-white border-line text-ink-soft hover:text-ink hover:border-ink/30 sm:border-transparent sm:text-ink-muted sm:hover:border-line'
              }`}
            >
              {tab.label}
              {badge !== null && (
                <span
                  className="text-[12px] leading-none min-w-[22px] text-center px-1.5 py-1 rounded-full font-semibold bg-accent text-ink tabular-nums"
                  aria-label={`${badge} waiting for approval`}
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
            {tab.id === 'apparel' && <ApparelManager />}
            {tab.id === 'academies' && <AcademiesManager />}
            {tab.id === 'reviews' && <ReviewsManager onPendingCountChange={handlePendingCount} />}
            {tab.id === 'pages' && <SitePagesManager />}
            {tab.id === 'documents' && <DocumentsManager />}
            {tab.id === 'availability' && <AvailabilityManager />}
          </div>
        ) : null
      )}
    </div>
  );
};

export default WebsiteContentPanel;
