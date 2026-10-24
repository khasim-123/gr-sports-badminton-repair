/**
 * GR Sports Platform - Site Analytics Service
 * First-party page-view tracking (no IP stored, no third-party scripts) and the
 * admin visitor / customer reports.
 */
import { apiClient, ApiError, getAuthToken } from './apiClient';

const VISITOR_KEY = 'gr_visitor_id';
const SESSION_KEY = 'gr_session';
const SESSION_IDLE_MS = 30 * 60 * 1000;

export interface ReportCount {
  label: string;
  count: number;
}

export interface VisitorSummary {
  start: string;
  end: string;
  totals: {
    pageViews: number;
    uniqueVisitors: number;
    sessions: number;
    loggedInCustomers: number;
    newCustomers: number;
    bookings: number;
    conversionRate: number; // bookings per 100 unique visitors
  };
  daily: { date: string; pageViews: number; visitors: number; bookings: number }[];
  topPages: ReportCount[];
  topReferrers: ReportCount[];
  devices: ReportCount[];
  recentCustomers: {
    name: string;
    phone: string; // "+91 98765 43210"
    lastVisit: string;
    lastPage: string;
    pageViews: number;
  }[];
}

export type ReportType = 'customers' | 'visits';

function randomId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, '');
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

function trackingAllowed(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return !(nav.globalPrivacyControl || nav.doNotTrack === '1');
}

function visitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

/** A session ends after 30 minutes without a page view. Returns [id, isNewSession]. */
function session(): [string, boolean] {
  const now = Date.now();
  try {
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (stored && now - stored.lastSeen < SESSION_IDLE_MS) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: stored.id, lastSeen: now }));
      return [stored.id, false];
    }
    const id = randomId();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, lastSeen: now }));
    return [id, true];
  } catch {
    return [randomId(), true];
  }
}

let lastPage = '';
let lastSentAt = 0;

export const analyticsService = {
  /** Records a page view. Fire-and-forget: never throws, never blocks the UI. */
  trackPageView(page: string): void {
    if (!trackingAllowed()) return;
    const now = Date.now();
    if (page === lastPage && now - lastSentAt < 2000) return;
    lastPage = page;
    lastSentAt = now;

    const [sessionId, isNewSession] = session();
    const params = new URLSearchParams(window.location.search);
    const body = {
      visitorId: visitorId(),
      sessionId,
      page: page.slice(0, 120),
      // Where the visitor came from is only meaningful on the first page of a visit.
      referrer: isNewSession ? document.referrer || undefined : undefined,
      utmSource: params.get('utm_source')?.slice(0, 60) || undefined,
    };
    const token = getAuthToken();
    fetch(`${apiClient.baseUrl}/analytics/visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      // Analytics must never affect the visitor.
    });
  },

  getSummary(start: string, end: string): Promise<VisitorSummary> {
    return apiClient.get<VisitorSummary>(`/analytics/summary?start=${start}&end=${end}`);
  },

  /** Downloads a CSV report (needs the admin token, so it can't be a plain link). */
  async downloadReport(type: ReportType, start: string, end: string): Promise<void> {
    const token = getAuthToken();
    const response = await fetch(`${apiClient.baseUrl}/analytics/export?type=${type}&start=${start}&end=${end}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
      let data: any = null;
      try {
        data = await response.json();
      } catch {
        // ignore
      }
      throw new ApiError(data?.detail || `Download failed (${response.status})`, response.status, data);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const match = /filename="([^"]+)"/.exec(disposition);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = match?.[1] || `gr-sports-${type}-${start}_to_${end}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
